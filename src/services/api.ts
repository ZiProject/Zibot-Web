
export interface BotInfo {
  status: string;
  content: string;
  clientName: string;
  clientId: string;
  avatars: string;
}

export async function fetchBotInfo(): Promise<BotInfo> {
  const response = await fetch(process.env.BotAPI || 'https://api.ziji.best');
  if (!response.ok) {
    throw new Error('Failed to fetch bot info');
  }
  return response.json();
}
