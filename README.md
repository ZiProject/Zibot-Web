# Ziji Bot Dashboard 🚀

<p align="center">
  <a href="https://github.com/ZiProject/Zibot-Web">
    <img src="https://img.shields.io/github/stars/ZiProject/Zibot-Web?style=for-the-badge" />
  </a>

  <a href="https://vercel.com/new/clone?repository-url=https://github.com/ZiProject/Zibot-Web">
    <img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel" />
  </a>

  <a href="https://discord.gg/wbhBExpMNj">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
  </a>
</p>

The official web management interface and **Discord Activity** for **Ziji Bot**. A modern, high-performance dashboard designed to
give users and server administrators full control over their bot experience with a sleek Cyberpunk aesthetic.

---

## ✨ Key Features

- **🎮 Dual Mode**: Works perfectly as a standalone web application and as an integrated **Discord Activity**.
- **🌌 Cyberpunk Design**: A stunning, modern interface featuring smooth animations powered by Framer Motion.
- **📊 Management Dashboard**: Real-time server configuration and personal stats tracking (Level, Currency, XP).
- **🎵 Advanced Music Player**: Intuitive web-based music experience with search, playlist management, and lyrics support.
- **🛠️ Server Customization**: Easily configure Autoresponders, Welcome Messages, and Guild settings without using bot commands.
- **🌐 Multilingual Support**: Fully localized in **English**, **Vietnamese**, and **Japanese**.
- **🔒 Secure Authentication**: Robust security using Discord OAuth2 and JWT-based session management.

---

## 🛠️ Technology Stack

| Category                | Technology                                    |
| :---------------------- | :-------------------------------------------- |
| **Frontend**            | React 19, Vite, Tailwind CSS 4, Framer Motion |
| **Backend**             | Express.js, Node.js                           |
| **Discord Integration** | @discord/embedded-app-sdk                     |
| **UI Components**       | Shadcn UI, Lucide React                       |
| **Authentication**      | Discord OAuth2, JSON Web Tokens (JWT)         |

---

## 🚀 Getting Started

### 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [NPM](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- A Discord Application created via the [Discord Developer Portal](https://discord.com/developers/applications).

### ⚙️ Discord Configuration

1.  **Create Application**: Create a new application in the Developer Portal.
2.  **Client ID & Secret**: Copy your **Application ID** and **Client Secret**.
3.  **OAuth2 Redirects**: Add the following URIs in the OAuth2 section:
    - `http://localhost:3000/auth/discord/callback` (Local development)
    - `https://your-domain.com/auth/discord/callback` (Production)
4.  **Bot Scopes**: Ensure the bot has `identify`, `guilds`, and `email` scopes.
5.  **Discord Activity URL Mapping**: If you are using this as an Activity, configure the **URL Mappings** in the "Embedded App
    SDK" section: | Prefix | Target URL | | :--- | :--- | | `/` | `https://bot.ziji.best` | | `/api` | `https://api.ziji.best` | |
    `/api/ws` | `https://api.ziji.best/ws` |
    - bot.ziji.best: url this web
    - api.ziji.best: url Ziji-discord-bot - connect via clouflared/ngrok/... support at .env

---

### 🔧 Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/ZiProject/Zibot-Web.git
    cd Zibot-Web
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Environment Variables:** Create a `.env` file in the root directory and configure your backend API:
    ```env
    VITE_BotAPI="http://localhost:2003" # Your Ziji-discord-bot API URL
    ```
    _Note: For the backend repository ([Ziji-discord-bot](https://github.com/ZiProject/Ziji-bot-discord)), ensure you set up
    `DISCORD_CLIENT_SECRET`, `JWT_SECRET`, and `DASHBOARD_URL`._

---

### 🏃 Running Locally

**Start development server:**

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

**Build for production:**

```bash
npm run build
npm start
```

---

## 📂 Project Structure

```text
├── api/            # Backend API routes and logic
├── src/            # Frontend React application
│   ├── components/ # Reusable UI components
│   ├── context/    # State management and localization
│   ├── services/   # API and Discord Activity integrations
│   └── main.tsx    # Application entry point
├── server.ts       # Unified Express/Vite server entry
└── public/         # Static assets
```

---

## 🔗 Useful Links

- **Main Website**: [bot.ziji.best](https://bot.ziji.best)
- **Discord Bot Repo**: [Ziji-bot-discord](https://github.com/ZiProject/Ziji-bot-discord)
- **Community**: [Join our Discord](https://discord.gg/wbhBExpMNj)

---

<p align="center">
  Developed with ❤️ by <b>ZiProject</b>
  <br>
  <i>Empowering Discord communities with modern tools.</i>
</p>
