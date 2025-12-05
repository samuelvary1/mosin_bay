import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { handleItemCommand, handleQuestCommand, handleHelpCommand } from './commands.js';
import { handleEnhancedQuestCommand } from './commands/enhancedQuest.js';

// Load environment variables
dotenv.config();

const PREFIX = process.env.PREFIX || '!';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error('❌ Error: DISCORD_TOKEN not found in environment variables.');
  console.error('Please create a .env file with your Discord bot token.');
  console.error('Example: DISCORD_TOKEN=your_token_here');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Bot ready event
client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  console.log(`📝 Command prefix: ${PREFIX}`);
  console.log(`🔗 Invite link: https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=2048&scope=bot`);
  
  // Set bot status
  client.user.setActivity('Escape from Tarkov | !help', { type: 'PLAYING' });
});

// Message handler
client.on('messageCreate', async (message) => {
  // Debug logging
  console.log(`Message received: "${message.content}" from ${message.author.tag}`);
  
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if message starts with prefix
  if (!message.content.startsWith(PREFIX)) {
    console.log(`Message doesn't start with prefix ${PREFIX}`);
    return;
  }
  
  console.log(`Processing command: ${message.content}`);

  // Parse command and arguments
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Handle commands
  try {
    switch (command) {
      case 'item':
      case 'i':
        await handleItemCommand(message, args);
        break;

      case 'quest':
      case 'q':
        await handleQuestCommand(message, args);
        break;

      case 'e-quest':
      case 'eq':
        await handleEnhancedQuestCommand(message, args);
        break;

      case 'liability':
      case 'whosucks':
        await message.reply('The biggest liability on the Raiders Tarkov squad is <@eyyzeus> 💀');
        break;

      case 'help':
      case 'h':
        await handleHelpCommand(message);
        break;

      default:
        // Unknown command - ignore or optionally send help
        break;
    }
  } catch (error) {
    console.error('Error handling command:', error);
    message.reply('❌ An error occurred while processing your command.');
  }
});

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(DISCORD_TOKEN);
