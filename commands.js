import { EmbedBuilder } from 'discord.js';
import { searchItem, searchQuest, getCurrencySymbol, formatNumber } from './tarkovApi.js';

/**
 * Handle the item search command
 * @param {Message} message - Discord message object
 * @param {string[]} args - Command arguments
 */
export async function handleItemCommand(message, args) {
  if (args.length === 0) {
    return message.reply('Please provide an item name to search for. Example: `!item bitcoin`');
  }

  const itemName = args.join(' ');
  const thinking = await message.reply(`🔍 Searching for "${itemName}"...`);

  try {
    const items = await searchItem(itemName);

    if (!items || items.length === 0) {
      return thinking.edit(`❌ No items found matching "${itemName}".`);
    }

    // If multiple items found, show the first one (most relevant)
    const item = items[0];
    const embed = createItemEmbed(item);

    // If multiple results, add a footer note
    if (items.length > 1) {
      const otherItems = items.slice(1, 4).map(i => i.shortName).join(', ');
      embed.setFooter({ 
        text: `${items.length - 1} other result(s): ${otherItems}` 
      });
    }

    await thinking.edit({ content: null, embeds: [embed] });
  } catch (error) {
    console.error('Error in handleItemCommand:', error);
    await thinking.edit('❌ An error occurred while searching for the item.');
  }
}

/**
 * Create a Discord embed for an item
 * @param {Object} item - Item data from Tarkov API
 * @returns {EmbedBuilder} Discord embed
 */
function createItemEmbed(item) {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`${item.name} (${item.shortName})`)
    .setURL(item.wikiLink || 'https://tarkov.dev')
    .setTimestamp();

  if (item.iconLink) {
    embed.setThumbnail(item.iconLink);
  }

  // Price Information
  if (item.avg24hPrice) {
    embed.addFields({
      name: '💰 Flea Market Price (24h avg)',
      value: `${formatNumber(item.avg24hPrice)} ₽`,
      inline: true,
    });
  }

  if (item.basePrice) {
    embed.addFields({
      name: '📊 Base Price',
      value: `${formatNumber(item.basePrice)} ₽`,
      inline: true,
    });
  }

  // Best sell prices
  if (item.sellFor && item.sellFor.length > 0) {
    const bestSells = item.sellFor
      .sort((a, b) => b.priceRUB - a.priceRUB)
      .slice(0, 5);
    
    const sellText = bestSells
      .map(sell => `**${sell.vendor.name}**: ${formatNumber(sell.price)} ${getCurrencySymbol(sell.currency)} (${formatNumber(sell.priceRUB)} ₽)`)
      .join('\n');

    embed.addFields({
      name: '💵 Best Sell Prices',
      value: sellText || 'No trader sell data',
      inline: false,
    });
  }

  // Quest information - items needed for quest turn-in
  if (item.usedInTasks && item.usedInTasks.length > 0) {
    const questText = item.usedInTasks
      .slice(0, 5)
      .map(task => `**${task.name}** (${task.trader.name}, Lvl ${task.minPlayerLevel})`)
      .join('\n');

    embed.addFields({
      name: `📋 Needed for Quests (${item.usedInTasks.length})`,
      value: questText.length > 1024 ? questText.substring(0, 1021) + '...' : questText,
      inline: false,
    });
  }

  // Quest rewards - received from completing quests
  if (item.receivedFromTasks && item.receivedFromTasks.length > 0) {
    const rewardText = item.receivedFromTasks
      .slice(0, 5)
      .map(task => `**${task.name}** (${task.trader.name}, Lvl ${task.minPlayerLevel})`)
      .join('\n');

    embed.addFields({
      name: `🎁 Reward from Quests (${item.receivedFromTasks.length})`,
      value: rewardText.length > 1024 ? rewardText.substring(0, 1021) + '...' : rewardText,
      inline: false,
    });
  }

  // Crafting - what this item produces
  if (item.craftsFor && item.craftsFor.length > 0) {
    const craftText = item.craftsFor
      .slice(0, 3)
      .map(craft => {
        const output = craft.rewardItems.map(r => `${r.item.name} (x${r.count})`).join(', ');
        return `**${craft.station.name}** Lvl ${craft.level}: → ${output}`;
      })
      .join('\n');

    embed.addFields({
      name: `🔨 Can Craft (${item.craftsFor.length})`,
      value: craftText.length > 1024 ? craftText.substring(0, 1021) + '...' : craftText,
      inline: false,
    });
  }

  // Crafting - what uses this item as ingredient
  if (item.craftsUsing && item.craftsUsing.length > 0) {
    const craftText = item.craftsUsing
      .slice(0, 3)
      .map(craft => {
        const output = craft.rewardItems.map(r => `${r.item.name} (x${r.count})`).join(', ');
        return `**${craft.station.name}** Lvl ${craft.level}: → ${output}`;
      })
      .join('\n');

    embed.addFields({
      name: `🧪 Used in Crafts (${item.craftsUsing.length})`,
      value: craftText.length > 1024 ? craftText.substring(0, 1021) + '...' : craftText,
      inline: false,
    });
  }

  // Item types/categories
  if (item.types && item.types.length > 0) {
    embed.addFields({
      name: '🏷️ Categories',
      value: item.types.join(', '),
      inline: false,
    });
  }

  return embed;
}

/**
 * Handle the help command
 * @param {Message} message - Discord message object
 */
export async function handleHelpCommand(message) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🎮 Tarkov Bot Commands')
    .setDescription('Search for Escape from Tarkov item and quest information')
    .addFields(
      {
        name: '!item <item name>',
        value: 'Search for an item and get:\n• Current flea market price\n• Best trader sell prices\n• Quest requirements\n• Crafting recipes\n• Item categories',
        inline: false,
      },
      {
        name: '!quest <quest name>',
        value: 'Search for a quest and get:\n• Objectives\n• Requirements\n• Rewards\n• Unlock requirements',
        inline: false,
      },
      {
        name: '!help',
        value: 'Show this help message',
        inline: false,
      }
    )
    .addFields({
      name: '📝 Examples',
      value: '`!item bitcoin`\n`!item graphics card`\n`!quest spa tour`\n`!quest punisher`',
      inline: false,
    })
    .setFooter({ text: 'Data from api.tarkov.dev' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

/**
 * Handle the quest search command
 * @param {Message} message - Discord message object
 * @param {string[]} args - Command arguments
 */
export async function handleQuestCommand(message, args) {
  if (args.length === 0) {
    return message.reply('Please provide a quest name to search for. Example: `!quest spa tour`');
  }

  const questName = args.join(' ');
  const thinking = await message.reply(`🔍 Searching for quest "${questName}"...`);

  try {
    const quests = await searchQuest(questName);

    if (!quests || quests.length === 0) {
      return thinking.edit(`❌ No quests found matching "${questName}". Try searching for part of the name like "punisher" or "chemical".`);
    }

    // If multiple quests found, show the first one (most relevant)
    const quest = quests[0];
    console.log(`Found quest: ${quest.name}`);
    const embed = createQuestEmbed(quest);

    // If multiple results, add a footer note
    if (quests.length > 1) {
      const otherQuests = quests.slice(1, 4).map(q => q.name).join(', ');
      embed.setFooter({ 
        text: `${quests.length - 1} other result(s): ${otherQuests}` 
      });
    }

    await thinking.edit({ content: null, embeds: [embed] });
  } catch (error) {
    console.error('Error in handleQuestCommand:', error);
    await thinking.edit('❌ An error occurred while searching for the quest.');
  }
}

/**
 * Create a Discord embed for a quest
 * @param {Object} quest - Quest data from Tarkov API
 * @returns {EmbedBuilder} Discord embed
 */
function createQuestEmbed(quest) {
  const embed = new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle(`${quest.name}`)
    .setURL(quest.wikiLink || 'https://tarkov.dev')
    .setTimestamp();

  // Basic info
  let description = `**Trader:** ${quest.trader.name}\n**Min Level:** ${quest.minPlayerLevel}`;
  if (quest.map && quest.map.name) {
    description += `\n**Map:** ${quest.map.name}`;
  }
  if (quest.experience) {
    description += `\n**XP Reward:** ${formatNumber(quest.experience)}`;
  }
  embed.setDescription(description);

  // Task requirements
  if (quest.taskRequirements && quest.taskRequirements.length > 0) {
    const reqText = quest.taskRequirements
      .slice(0, 5)
      .map(req => `${req.task.name} (${req.status.join(', ')})`)
      .join('\n');
    
    embed.addFields({
      name: '📋 Required Quests',
      value: reqText,
      inline: false,
    });
  }

  // Trader level requirements
  if (quest.traderLevelRequirements && quest.traderLevelRequirements.length > 0) {
    const traderReqText = quest.traderLevelRequirements
      .map(req => `${req.trader.name} Level ${req.level}`)
      .join(', ');
    
    embed.addFields({
      name: '🤝 Trader Requirements',
      value: traderReqText,
      inline: false,
    });
  }

  // Objectives
  if (quest.objectives && quest.objectives.length > 0) {
    const objText = quest.objectives
      .slice(0, 10)
      .map((obj, idx) => {
        const optional = obj.optional ? ' (Optional)' : '';
        return `${idx + 1}. ${obj.description}${optional}`;
      })
      .join('\n');
    
    embed.addFields({
      name: `🎯 Objectives (${quest.objectives.length})`,
      value: objText.length > 1024 ? objText.substring(0, 1021) + '...' : objText,
      inline: false,
    });
  }

  // Rewards
  if (quest.finishRewards) {
    const rewards = [];
    
    if (quest.finishRewards.items && quest.finishRewards.items.length > 0) {
      const items = quest.finishRewards.items
        .slice(0, 5)
        .map(item => `${item.item.shortName} (x${item.count})`)
        .join(', ');
      rewards.push(`**Items:** ${items}`);
    }

    if (quest.finishRewards.offerUnlock && quest.finishRewards.offerUnlock.length > 0) {
      const unlocks = quest.finishRewards.offerUnlock
        .slice(0, 3)
        .map(unlock => `${unlock.item.name} (${unlock.trader.name})`)
        .join(', ');
      rewards.push(`**Unlocks:** ${unlocks}`);
    }

    if (quest.finishRewards.traderStanding && quest.finishRewards.traderStanding.length > 0) {
      const standing = quest.finishRewards.traderStanding
        .map(s => `${s.trader.name} ${s.standing > 0 ? '+' : ''}${s.standing}`)
        .join(', ');
      rewards.push(`**Rep:** ${standing}`);
    }

    if (rewards.length > 0) {
      embed.addFields({
        name: '🎁 Rewards',
        value: rewards.join('\n'),
        inline: false,
      });
    }
  }

  return embed;
}
