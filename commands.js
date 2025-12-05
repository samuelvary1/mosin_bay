import { EmbedBuilder } from 'discord.js';
import { searchItem, getCurrencySymbol, formatNumber } from './tarkovApi.js';

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

  // Quest information
  if (item.usedInTasks && item.usedInTasks.length > 0) {
    const questText = item.usedInTasks
      .slice(0, 5)
      .map(task => {
        const objectives = task.objectivesWithItem
          .map(obj => obj.optional ? `~~${obj.description}~~` : obj.description)
          .join('\n  - ');
        return `**${task.name}** (${task.trader.name}, Lvl ${task.minPlayerLevel})\n  - ${objectives}`;
      })
      .join('\n\n');

    embed.addFields({
      name: `📋 Needed for Quests (${item.usedInTasks.length})`,
      value: questText.length > 1024 ? questText.substring(0, 1021) + '...' : questText,
      inline: false,
    });
  } else {
    embed.addFields({
      name: '📋 Quest Status',
      value: '✅ Not needed for any quests',
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
    .setDescription('Search for Escape from Tarkov item information')
    .addFields(
      {
        name: '!item <item name>',
        value: 'Search for an item and get:\n• Current flea market price\n• Best trader sell prices\n• Quest requirements\n• Item categories',
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
      value: '`!item bitcoin`\n`!item graphics card`\n`!item m4a1`',
      inline: false,
    })
    .setFooter({ text: 'Data from api.tarkov.dev' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
