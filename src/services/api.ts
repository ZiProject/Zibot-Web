export interface BotInfo {
  status: string;
  content: string;
  clientName: string;
  clientId: string;
  avatars: string;
  inviteUrl?: string;
  playerNetClient?: [
    {
      clientId: string;
      clientName: string;
      avatars: string;
      inviteUrl?: string;
    },
  ];
  [key: string]: any;
}

export async function fetchBotInfo(): Promise<BotInfo> {
  const response = await fetch(
    import.meta.env.VITE_BotAPI || "https://api.ziji.best",
    {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    },
  );
  if (!response.ok) {
    throw new Error("Failed to fetch bot info");
  }
  return response.json();
}
