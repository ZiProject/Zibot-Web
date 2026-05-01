# Ziji Bot Dashboard 🚀

The official web management interface for **Ziji Bot** - A multi-purpose Discord bot featuring a modern design and smooth animations.

## 🌟 Key Features

- **Modern Interface**: Designed with a Cyberpunk/Modern UI aesthetic, supporting multiple languages (EN, VI, JA).
- **Management Dashboard**: Configure your servers, view personal profile stats (Level, Currency, XP).
- **Music Player**: An intuitive web-based music experience with search and lyrics support.
- **Server Customization**: Configure Autoresponders, Welcome Messages, and Guild Settings.
- **Security**: Authenticated via Discord OAuth2 and secured with JWT.

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion (Motion).
- **Backend (API)**: Express.js, JWT.
- **Icons**: Lucide React.
- **Fonts**: Inter & JetBrains Mono.

---

## ⚙️ Setup Instructions

### 1. Discord Developer Portal Configuration

Before you start, you need to create an application at the [Discord Developer Portal](https://discord.com/developers/applications).

1.  **Create Application**: Click "New Application" and give your bot a name.
2.  **Get Client ID**: Copy the **Application ID** (Use this for `VITE_DISCORD_CLIENT_ID`).
3.  **Get Client Secret**: Go to **OAuth2** -> **General** -> **Reset Secret** to generate a secret (Use this for `DISCORD_CLIENT_SECRET`).
4.  **Set Redirect URIs**: Add the following URLs in the **Redirects** section:
    - `http://localhost:3000/auth/discord/callback` (For local development)
    - `https://your-domain.com/auth/discord/callback` (For production)

### 2. Environment Variables Configuration

Create a `.env` file in the root directory (based on `.env.example`):

#### Frontend Configuration (.env)
```env
VITE_DISCORD_CLIENT_ID="YOUR_APPLICATION_ID"
VITE_BotAPI="http://localhost:3000" # Your backend API URL
```

#### Backend Configuration (.env)
```env
DISCORD_CLIENT_SECRET="YOUR_CLIENT_SECRET"
DASHBOARD_URL="http://localhost:3000" # URL where the dashboard is hosted
API_URL="http://localhost:3000"       # URL where this API is hosted
JWT_SECRET="your_random_secret_string" # Change this to a secure random string
```

### 3. Backend Dependency Note

The files in the `/api` directory might rely on specific libraries from the [Ziji ecosystem](https://github.com/ZiProject/Ziji-bot-discord). If you are setting up the backend manually, ensure these dependencies are referenced or mocked appropriately as seen in `server.ts`.

---

## 🚀 Getting Started

### Install Dependencies
```bash
npm install
```

### Run in Development Mode
```bash
npm run dev
```
The app will be available at: `http://localhost:3000`

### Build for Production
```bash
npm run build
npm start
```

---

## 📂 Project Structure

- `/src`: Frontend source code (React).
- `/api`: Express API routes (Backend logic).
- `/public`: Static assets.
- `server.ts`: Unified entry point for both Web and API Server.

## 🔗 Links

- **Website**: [bot.ziji.best](https://bot.ziji.best)
- **API**: [api.ziji.best](https://api.ziji.best)
- **GitHub API**: [Ziji-bot-discord](https://github.com/ZiProject/Ziji-bot-discord)
- **GitHub Web**: [Zibot-Web](https://github.com/zijipia/Zibot-Web)

---
© 2024 **ZiProject** - Developed by the Discord community.
