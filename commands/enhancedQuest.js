import { EmbedBuilder } from 'discord.js';
import { searchQuest, formatNumber } from '../tarkovApi.js';
import { generateQuestGuide } from '../services/gemini.js';
import { getQuestImages, findImageForObjective } from '../services/images.js';
import { getCachedQuestGuide, setCachedQuestGuide } from '../services/cache.js';
import { createQuestEmbed } from '../commands.js';

/**
 * Get color for objective type
 * @param {string} type - Objective type
 * @returns {number} Color hex code
 */
function getObjectiveColor(type) {
  const colorMap = {
    'plantItem': 0x2ECC71,       // Green
    'plantQuestItem': 0x2ECC71,  // Green
    'pickupItem': 0x2ECC71,      // Green
    'findItem': 0x2ECC71,        // Green
    'giveItem': 0x2ECC71,        // Green
    'kill': 0xE74C3C,            // Red
    'shoot': 0xE74C3C,           // Red
    'mark': 0xF39C12,            // Orange
    'place': 0xF39C12,           // Orange
    'build': 0x3498DB,           // Blue
    'visit': 0x9B59B6,           // Purple
    'default': 0x95A5A6          // Gray
  };

  return colorMap[type] || colorMap['default'];
}

/**
 * Create overview embed for the quest
 * @param {Object} quest - Quest data
 * @param {Object} images - Image data
 * @returns {EmbedBuilder} Discord embed
 */
function createOverviewEmbed(quest, images) {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6) // Purple for enhanced quest
    .setTitle(`${quest.name}`)
    .setURL(quest.wikiLink || 'https://tarkov.dev')
    .setTimestamp();

  // Basic description
  let description = `**Trader:** ${quest.trader.name}\n**Min Level:** ${quest.minPlayerLevel}`;
  if (quest.map && quest.map.name) {
    description += `\n**Map:** ${quest.map.name}`;
  }
  if (quest.experience) {
    description += `\n**XP Reward:** ${formatNumber(quest.experience)}`;
  }
  embed.setDescription(description);

  // Add map image if available
  if (images.mapImage) {
    embed.setImage(images.mapImage.url);
  }

  // Add prerequisites if any
  if (quest.taskRequirements && quest.taskRequirements.length > 0) {
    const reqText = quest.taskRequirements
      .slice(0, 3)
      .map(req => `${req.task.name}`)
      .join(', ');

    embed.addFields({
      name: 'Required Quests',
      value: reqText + (quest.taskRequirements.length > 3 ? '...' : ''),
      inline: false
    });
  }

  embed.setFooter({ text: 'Enhanced with AI | Powered by Google Gemini' });

  return embed;
}

/**
 * Create guide overview embed
 * @param {Object} llmGuide - LLM-generated guide
 * @returns {EmbedBuilder} Discord embed
 */
function createGuideEmbed(llmGuide) {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB) // Blue for guide
    .setTitle('Quest Guide');

  // Add overview
  if (llmGuide.overview) {
    embed.setDescription(llmGuide.overview.substring(0, 4096));
  }

  // Add priority tips if available
  if (llmGuide.tips) {
    const tipsText = llmGuide.tips.substring(0, 1024);
    embed.addFields({
      name: 'Priority Tips',
      value: tipsText,
      inline: false
    });
  }

  return embed;
}

/**
 * Create embed for a specific objective
 * @param {Object} objective - Quest objective
 * @param {number} index - Objective index
 * @param {string} guideText - LLM guide text for this objective
 * @param {Object} images - All quest images
 * @returns {EmbedBuilder} Discord embed
 */
function createObjectiveEmbed(objective, index, guideText, images) {
  const embed = new EmbedBuilder()
    .setColor(getObjectiveColor(objective.type))
    .setTitle(`Objective ${index + 1}${objective.optional ? ' (Optional)' : ''}`);

  // Objective description + AI guide
  let description = `**${objective.description}**\n\n`;
  if (guideText) {
    description += guideText.substring(0, 3800); // Leave room for title
  } else {
    description += '_No detailed guide available for this objective._';
  }

  embed.setDescription(description.substring(0, 4096));

  // Find and add relevant image
  const imageUrl = findImageForObjective(objective, index, images);
  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  return embed;
}

/**
 * Create rewards embed
 * @param {Object} quest - Quest data
 * @returns {EmbedBuilder|null} Discord embed or null if no rewards
 */
function createRewardsEmbed(quest) {
  if (!quest.finishRewards) {
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F) // Gold for rewards
    .setTitle('Rewards');

  const rewards = [];

  // XP
  if (quest.experience) {
    rewards.push(`**XP:** ${formatNumber(quest.experience)}`);
  }

  // Items
  if (quest.finishRewards.items && quest.finishRewards.items.length > 0) {
    const items = quest.finishRewards.items
      .slice(0, 5)
      .map(item => `${item.item.shortName} (x${item.count})`)
      .join(', ');
    rewards.push(`**Items:** ${items}`);
  }

  // Unlocks
  if (quest.finishRewards.offerUnlock && quest.finishRewards.offerUnlock.length > 0) {
    const unlocks = quest.finishRewards.offerUnlock
      .slice(0, 3)
      .map(unlock => `${unlock.item.name} (${unlock.trader.name})`)
      .join(', ');
    rewards.push(`**Unlocks:** ${unlocks}`);
  }

  // Reputation
  if (quest.finishRewards.traderStanding && quest.finishRewards.traderStanding.length > 0) {
    const standing = quest.finishRewards.traderStanding
      .map(s => `${s.trader.name} ${s.standing > 0 ? '+' : ''}${s.standing}`)
      .join(', ');
    rewards.push(`**Reputation:** ${standing}`);
  }

  if (rewards.length > 0) {
    embed.setDescription(rewards.join('\n'));
    return embed;
  }

  return null;
}

/**
 * Handle the enhanced quest command
 * @param {Message} message - Discord message object
 * @param {string[]} args - Command arguments
 */
export async function handleEnhancedQuestCommand(message, args) {
  if (args.length === 0) {
    return message.reply('Please provide a quest name to search for. Example: `!e-quest spa tour`');
  }

  const questName = args.join(' ');
  const thinking = await message.reply(`Generating AI-enhanced quest guide for "${questName}"...`);

  try {
    // Search for the quest
    const quests = await searchQuest(questName);

    if (!quests || quests.length === 0) {
      return thinking.edit(`No quests found matching "${questName}". Try searching for part of the name like "punisher" or "chemical".`);
    }

    const quest = quests[0];
    console.log(`Found quest: ${quest.name}`);

    // Check cache first
    let cachedData = getCachedQuestGuide(quest.id, quest.objectives);

    if (cachedData) {
      console.log(`Using cached guide for ${quest.name}`);
      return await sendEnhancedResponse(thinking, quest, cachedData, quests.length > 1 ? quests : null);
    }

    try {
      // Generate LLM guide and fetch images in parallel
      console.log('Cache miss - generating new guide and fetching images...');
      const [llmGuide, images] = await Promise.all([
        generateQuestGuide(quest),
        getQuestImages(quest)
      ]);

      // If LLM generation failed, fallback to regular quest display
      if (!llmGuide) {
        console.log('LLM guide generation failed, falling back to regular quest display');
        const regularEmbed = createQuestEmbed(quest);

        if (quests.length > 1) {
          const otherQuests = quests.slice(1, 4).map(q => q.name).join(', ');
          regularEmbed.setFooter({
            text: `AI unavailable. ${quests.length - 1} other result(s): ${otherQuests}`
          });
        } else {
          regularEmbed.setFooter({ text: 'AI enhancement unavailable' });
        }

        return thinking.edit({ content: null, embeds: [regularEmbed] });
      }

      // Cache the result
      setCachedQuestGuide(quest.id, quest.objectives, { llmGuide, images });

      // Send enhanced response
      return await sendEnhancedResponse(thinking, quest, { llmGuide, images }, quests.length > 1 ? quests : null);

    } catch (enhancementError) {
      // Fallback to regular quest display on any enhancement error
      console.error('Enhancement failed, falling back to regular display:', enhancementError);
      const regularEmbed = createQuestEmbed(quest);

      if (quests.length > 1) {
        const otherQuests = quests.slice(1, 4).map(q => q.name).join(', ');
        regularEmbed.setFooter({
          text: `AI unavailable. ${quests.length - 1} other result(s): ${otherQuests}`
        });
      } else {
        regularEmbed.setFooter({ text: 'AI enhancement unavailable' });
      }

      return thinking.edit({
        content: 'AI enhancement unavailable, showing standard quest info:',
        embeds: [regularEmbed]
      });
    }
  } catch (error) {
    console.error('Error in handleEnhancedQuestCommand:', error);
    await thinking.edit('An error occurred while searching for the quest. Please try again.');
  }
}

/**
 * Send the enhanced response with multiple embeds
 * @param {Message} thinking - The "thinking" message to edit
 * @param {Object} quest - Quest data
 * @param {Object} data - Cached or generated data (llmGuide, images)
 * @param {Array|null} allQuests - All matching quests (for multiple results footer)
 */
async function sendEnhancedResponse(thinking, quest, data, allQuests) {
  const { llmGuide, images } = data;
  const embeds = [];

  // Embed 1: Quest overview
  const overviewEmbed = createOverviewEmbed(quest, images);
  if (allQuests && allQuests.length > 1) {
    const otherQuests = allQuests.slice(1, 4).map(q => q.name).join(', ');
    overviewEmbed.setFooter({
      text: `Enhanced with AI | ${allQuests.length - 1} other result(s): ${otherQuests}`
    });
  }
  embeds.push(overviewEmbed);

  // Embed 2: AI guide overview
  if (llmGuide.overview || llmGuide.tips) {
    embeds.push(createGuideEmbed(llmGuide));
  }

  // Embeds 3+: Individual objectives (limit to avoid hitting Discord's 10 embed limit)
  const maxObjectiveEmbeds = 6; // Leave room for overview, guide, and rewards
  const objectivesToShow = Math.min(quest.objectives.length, maxObjectiveEmbeds);

  for (let i = 0; i < objectivesToShow; i++) {
    const objective = quest.objectives[i];
    const guideText = llmGuide.objectives[i] || '';
    embeds.push(createObjectiveEmbed(objective, i, guideText, images));
  }

  // If there are more objectives, add a note
  if (quest.objectives.length > objectivesToShow) {
    const remainingCount = quest.objectives.length - objectivesToShow;
    embeds[embeds.length - 1].setFooter({
      text: `${remainingCount} more objective(s) not shown. Check the wiki for full details.`
    });
  }

  // Final embed: Rewards (if it fits within the 10 embed limit)
  const rewardsEmbed = createRewardsEmbed(quest);
  if (rewardsEmbed && embeds.length < 10) {
    embeds.push(rewardsEmbed);
  }

  // Send all embeds (Discord max is 10)
  await thinking.edit({
    content: null,
    embeds: embeds.slice(0, 10)
  });
}
