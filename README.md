# Avalon

## Overview

> **⚠️ Notice:** This project is no longer being actively worked on.

Avalon is a Discord bot powered by AI that provides conversational capabilities through LangChain and OpenRouter. Built on Cloudflare Workers, it offers fast and efficient responses to user queries within Discord servers.

## Features

- **AI-Powered Chat**: Interact with Avalon using the `/chat` command to get intelligent responses
- **Multiple Model Support**: Uses OpenRouter with fallback to Groq for reliability
- **Owner Controls**: Set and manage AI models through the `/setmodel` command (owner only)
- **Discord Integration**: Seamless integration with Discord using slash commands
- **Serverless Architecture**: Runs on Cloudflare Workers for global availability and low latency
- **Persistent Storage**: Utilizes Cloudflare KV and D1 for storing settings and data

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)
- [Cloudflare Workers account](https://workers.cloudflare.com/)
- [Discord Developer account](https://discord.com/developers/applications)
- API keys for OpenRouter and Groq

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/yehezkieldio/avalon.git
   cd avalon
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.dev.vars` file in the root directory with the following:
   ```
   DISCORD_BOT_TOKEN=your_discord_bot_token
   OPENROUTER_API_KEY=your_openrouter_api_key
   GROQ_API_KEY=your_groq_api_key
   DISCORD_PUBLIC_KEY=your_discord_public_key
   DISCORD_APPLICATION_ID=your_discord_application_id
   OWNER_USER_ID=your_discord_user_id
   ```

4. Run type checking:
   ```bash
   npm run typecheck
   ```

5. Start the development server:
   ```bash
   npm start
   ```

6. Deploy to Cloudflare Workers:
   ```bash
   npx wrangler deploy
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
