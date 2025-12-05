# Tarkov Discord Bot

A Discord bot that provides Escape from Tarkov item information using the [api.tarkov.dev](https://api.tarkov.dev) API.

## Features

- 🔍 Search for any Tarkov item by name
- 💰 View current flea market prices (24h average)
- 💵 See best trader sell prices
- 📋 Check if an item is needed for future quests
- 🏷️ Display item categories and types
- 🖼️ Show item icons and wiki links

## Commands

- `!item <item name>` - Search for an item (alias: `!i`)
- `!help` - Display help message (alias: `!h`)

### Examples

```
!item bitcoin
!item graphics card
!i m4a1
!item gas analyzer
```

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) version 18 or higher
- A Discord Bot Token from the [Discord Developer Portal](https://discord.com/developers/applications)

### Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Create a `.env` file** in the project root:
   ```powershell
   Copy-Item .env.example .env
   ```

4. **Configure your bot token:**
   
   Edit the `.env` file and replace `your_bot_token_here` with your actual Discord bot token:
   ```
   DISCORD_TOKEN=your_actual_bot_token
   PREFIX=!
   ```

### Getting a Discord Bot Token

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section in the left sidebar
4. Click "Add Bot"
5. Under the bot's username, click "Reset Token" to get your token
6. **Important:** Enable the "Message Content Intent" under Privileged Gateway Intents
7. Copy the token to your `.env` file

### Inviting the Bot to Your Server

1. In the Discord Developer Portal, go to "OAuth2" → "URL Generator"
2. Select the following scopes:
   - `bot`
3. Select the following bot permissions:
   - `Send Messages`
   - `Embed Links`
   - `Read Message History`
4. Copy the generated URL and open it in your browser
5. Select the server you want to add the bot to

## Running the Bot

**Start the bot:**
```powershell
npm start
```

**For development with auto-restart (Node 18+):**
```powershell
npm run dev
```

When the bot starts successfully, you'll see:
```
✅ Bot is online as YourBotName#1234
📝 Command prefix: !
```

## Usage

Once the bot is running and in your Discord server, you can use it like this:

```
User: !item bitcoin
Bot: [Displays formatted embed with bitcoin info including prices, traders, and quests]

User: !item gas analyzer
Bot: [Shows gas analyzer details and which quests require it]

User: !help
Bot: [Shows list of available commands]
```

## Bot Response Example

When you search for an item, the bot will display:
- **Item name and short name** (with icon thumbnail)
- **Flea market price** - 24-hour average
- **Base price** - Game-defined value
- **Best sell prices** - Top traders to sell to, sorted by value
- **Quest requirements** - Which quests need this item (if any)
- **Item categories** - What type of item it is

## Troubleshooting

### Bot doesn't respond to commands
- Make sure "Message Content Intent" is enabled in the Discord Developer Portal
- Verify the bot has permission to read and send messages in the channel
- Check that your `.env` file has the correct token

### "DISCORD_TOKEN not found" error
- Ensure you created a `.env` file (not `.env.example`)
- Make sure the token is on a line like: `DISCORD_TOKEN=your_token_here`

### API errors
- The bot uses the free api.tarkov.dev API - occasional timeouts may occur
- Check your internet connection

## Technologies Used

- [Discord.js](https://discord.js.org/) v14 - Discord bot framework
- [api.tarkov.dev](https://api.tarkov.dev) - Tarkov data GraphQL API
- [Node.js](https://nodejs.org/) - JavaScript runtime
- [dotenv](https://www.npmjs.com/package/dotenv) - Environment variable management

## License

MIT

## Credits

Item data provided by [tarkov.dev](https://tarkov.dev) and their amazing API.
