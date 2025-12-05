import NodeCache from 'node-cache';
import crypto from 'crypto';

// Initialize cache with 7-day TTL and hourly cleanup
// Quest data rarely changes, so longer TTL reduces LLM costs significantly
const questCache = new NodeCache({
  stdTTL: 604800, // 7 days in seconds (7 * 24 * 60 * 60)
  checkperiod: 3600, // Check for expired keys every hour
  maxKeys: 500, // Maximum number of cached quests
  useClones: false // Store references for better performance
});

/**
 * Generate a cache key for a quest
 * @param {string} questId - Quest ID
 * @param {Array} objectives - Quest objectives array
 * @returns {string} Cache key
 */
function generateCacheKey(questId, objectives) {
  // Hash objectives to invalidate cache when quest objectives change
  const objectivesHash = crypto
    .createHash('md5')
    .update(JSON.stringify(objectives || []))
    .digest('hex')
    .substring(0, 8);

  return `quest:${questId}:${objectivesHash}`;
}

/**
 * Get cached quest guide data
 * @param {string} questId - Quest ID
 * @param {Array} objectives - Quest objectives for cache key generation
 * @returns {Object|null} Cached data or null if not found
 */
export function getCachedQuestGuide(questId, objectives) {
  try {
    const cacheKey = generateCacheKey(questId, objectives);
    const cachedData = questCache.get(cacheKey);

    if (cachedData) {
      console.log(`Cache HIT for quest ${questId}`);
      return cachedData;
    }

    console.log(`Cache MISS for quest ${questId}`);
    return null;
  } catch (error) {
    console.error('Error retrieving from cache:', error);
    return null; // Non-blocking: return null on error
  }
}

/**
 * Cache quest guide data
 * @param {string} questId - Quest ID
 * @param {Array} objectives - Quest objectives for cache key generation
 * @param {Object} data - Data to cache (llmGuide, images)
 * @param {number} [ttl] - Optional TTL in seconds (overrides default)
 * @returns {boolean} Success status
 */
export function setCachedQuestGuide(questId, objectives, data, ttl) {
  try {
    const cacheKey = generateCacheKey(questId, objectives);
    const defaultTTL = 604800; // 7 days
    const success = questCache.set(cacheKey, data, ttl || defaultTTL);

    if (success) {
      const cacheDays = Math.round((ttl || defaultTTL) / 86400);
      console.log(`Cached quest ${questId} for ${cacheDays} day(s)`);
    }

    return success;
  } catch (error) {
    console.error('Error writing to cache:', error);
    return false; // Non-blocking: return false on error
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats (keys, hits, misses, ksize, vsize)
 */
export function getCacheStats() {
  return questCache.getStats();
}

/**
 * Clear the entire cache (useful for testing or manual admin commands)
 * @returns {void}
 */
export function clearCache() {
  questCache.flushAll();
  console.log('Quest cache cleared');
}

/**
 * Clear a specific quest from cache
 * @param {string} questId - Quest ID to clear
 * @param {Array} objectives - Quest objectives for cache key generation
 * @returns {number} Number of deleted entries
 */
export function clearQuestCache(questId, objectives) {
  try {
    const cacheKey = generateCacheKey(questId, objectives);
    return questCache.del(cacheKey);
  } catch (error) {
    console.error('Error deleting from cache:', error);
    return 0;
  }
}
