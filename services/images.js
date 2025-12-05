import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Extract images from quest data (API-provided images)
 * @param {Object} quest - Quest data from Tarkov API
 * @returns {Object} Structured image data
 */
function extractAPIImages(quest) {
  const images = {
    mapImage: null,
    objectiveImages: [],
    itemImages: []
  };

  // Map image - API doesn't provide map images, will rely on wiki scraping
  // Keeping this structure for future API updates
  if (quest.map && quest.map.imageLink) {
    images.mapImage = {
      url: quest.map.imageLink,
      description: `${quest.map.name} map`,
      source: 'api'
    };
  }

  // Objective-specific images
  if (quest.objectives) {
    quest.objectives.forEach((objective, idx) => {
      const objImages = [];

      // Check for item images (TaskObjectiveItem type)
      if (objective.item && objective.item.iconLink) {
        objImages.push({
          url: objective.item.iconLink,
          description: `${objective.item.name}`,
          source: 'api',
          objectiveIndex: idx,
          type: 'icon'
        });
      }

      // Check for items array
      if (objective.items && Array.isArray(objective.items)) {
        objective.items.forEach(item => {
          if (item.iconLink) {
            objImages.push({
              url: item.iconLink,
              description: `${item.name}`,
              source: 'api',
              objectiveIndex: idx,
              type: 'icon'
            });
          }
        });
      }

      // Check for marker item (TaskObjectiveMark type)
      if (objective.markerItem && objective.markerItem.iconLink) {
        objImages.push({
          url: objective.markerItem.iconLink,
          description: `${objective.markerItem.name}`,
          source: 'api',
          objectiveIndex: idx,
          type: 'icon'
        });
      }

      if (objImages.length > 0) {
        images.objectiveImages.push({
          objectiveIndex: idx,
          images: objImages
        });
      }
    });
  }

  return images;
}

/**
 * Calculate relevance score for an image based on keywords
 * @param {string} context - Text context around the image
 * @param {string[]} keywords - Keywords to match
 * @returns {number} Relevance score (0-1)
 */
function calculateRelevance(context, keywords) {
  if (!context || !keywords || keywords.length === 0) {
    return 0;
  }

  const contextLower = context.toLowerCase();
  let score = 0;
  let matchedKeywords = 0;

  keywords.forEach(keyword => {
    if (contextLower.includes(keyword.toLowerCase())) {
      matchedKeywords++;
      // Give higher weight to exact matches
      if (contextLower.split(/\s+/).includes(keyword.toLowerCase())) {
        score += 2;
      } else {
        score += 1;
      }
    }
  });

  // Normalize score to 0-1 range
  const maxScore = keywords.length * 2;
  return matchedKeywords > 0 ? score / maxScore : 0;
}

/**
 * Normalize image URL (handle relative URLs)
 * @param {string} url - Image URL
 * @param {string} baseUrl - Base URL for relative paths
 * @returns {string} Normalized URL
 */
function normalizeImageUrl(url, baseUrl) {
  if (!url) return null;

  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Protocol-relative URL
  if (url.startsWith('//')) {
    return 'https:' + url;
  }

  // Relative URL
  try {
    const base = new URL(baseUrl);
    return new URL(url, base.origin).href;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return null;
  }
}

/**
 * Scrape images from quest wiki page
 * @param {string} wikiLink - URL to quest wiki page
 * @param {Object} quest - Quest data for keyword generation
 * @returns {Promise<Array>} Array of image objects
 */
async function scrapeWikiImages(wikiLink, quest) {
  if (!wikiLink) {
    return [];
  }

  try {
    console.log(`Scraping images from wiki: ${wikiLink}`);

    // Fetch wiki page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(wikiLink, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TarkovBot/1.0)'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Wiki fetch failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Generate keywords from quest data
    const keywords = [
      quest.name,
      quest.map?.name,
      ...quest.objectives.map(obj => {
        // Extract location names, item names, etc.
        const words = obj.description.split(/\s+/);
        return words.filter(w => w.length > 4); // Only meaningful words
      }).flat()
    ].filter(Boolean);

    const images = [];

    // Find images in the page
    $('img').each((i, elem) => {
      const src = $(elem).attr('src');
      const alt = $(elem).attr('alt') || '';
      const title = $(elem).attr('title') || '';

      // Skip small icons and UI elements (but be more lenient)
      const width = $(elem).attr('width');
      const height = $(elem).attr('height');
      if (width && height && (parseInt(width) < 50 || parseInt(height) < 50)) {
        return;
      }

      // Skip obvious UI icons
      if (alt.toLowerCase().includes('icon') ||
          src.toLowerCase().includes('/icon') ||
          src.toLowerCase().includes('_icon')) {
        return;
      }

      // Get context around image (parent paragraph or div)
      const context = $(elem).closest('p, div, td, li, table').text() || alt || title;

      // Calculate relevance score
      const relevanceScore = calculateRelevance(context, keywords);

      // Be more lenient with relevance threshold (0.1 instead of 0.3)
      // Also include images even with low scores if they're from wiki content sections
      const isContentImage = src && !src.includes('advertisements') && !src.includes('/thumb/');

      if ((relevanceScore > 0.1 || isContentImage) && src) {
        const normalizedUrl = normalizeImageUrl(src, wikiLink);
        if (normalizedUrl && !normalizedUrl.includes('data:image')) {
          images.push({
            url: normalizedUrl,
            alt: alt,
            title: title,
            description: context.substring(0, 100),
            relevanceScore: relevanceScore || 0.1,
            source: 'wiki'
          });
        }
      }
    });

    // Sort by relevance and return top 10 (increased from 5)
    const sortedImages = images
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);

    console.log(`Scraped ${sortedImages.length} relevant images from wiki (total found: ${images.length})`);

    if (sortedImages.length > 0) {
      console.log(`Top image: ${sortedImages[0].url.substring(0, 80)}... (score: ${sortedImages[0].relevanceScore.toFixed(2)})`);
    }

    return sortedImages;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Wiki scraping timeout');
    } else {
      console.error('Error scraping wiki images:', error.message);
    }
    return [];
  }
}

/**
 * Get all images for a quest (API + wiki scraping)
 * @param {Object} quest - Quest data from Tarkov API
 * @returns {Promise<Object>} Combined image data
 */
export async function getQuestImages(quest) {
  // Extract API-provided images first (currently none available from API)
  const apiImages = extractAPIImages(quest);

  // Always try wiki scraping since API doesn't provide quest images
  let wikiImages = [];
  if (quest.wikiLink) {
    wikiImages = await scrapeWikiImages(quest.wikiLink, quest);
  }

  return {
    ...apiImages,
    wikiImages,
    totalImages: (apiImages.mapImage ? 1 : 0) +
      apiImages.objectiveImages.reduce((sum, obj) => sum + obj.images.length, 0) +
      wikiImages.length
  };
}

/**
 * Find the most relevant image for a specific objective
 * @param {Object} objective - Quest objective
 * @param {number} objectiveIndex - Index of the objective
 * @param {Object} allImages - All quest images
 * @returns {string|null} Image URL or null
 */
export function findImageForObjective(objective, objectiveIndex, allImages) {
  // First check if we have objective-specific images from API
  const objectiveImageData = allImages.objectiveImages.find(
    obj => obj.objectiveIndex === objectiveIndex
  );

  if (objectiveImageData && objectiveImageData.images.length > 0) {
    // Prefer full images over icons
    const fullImage = objectiveImageData.images.find(img => img.type === 'image');
    if (fullImage) return fullImage.url;

    // Fallback to icon
    return objectiveImageData.images[0].url;
  }

  // If no API images, try to match from wiki images
  if (allImages.wikiImages && allImages.wikiImages.length > 0) {
    // Find images that mention this objective's description
    const keywords = objective.description.split(/\s+/).filter(w => w.length > 4);
    const matchedImage = allImages.wikiImages.find(img =>
      calculateRelevance(img.description + ' ' + img.alt, keywords) > 0.5
    );

    if (matchedImage) return matchedImage.url;

    // Fallback: use first wiki image if available
    return allImages.wikiImages[0].url;
  }

  return null;
}
