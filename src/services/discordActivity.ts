import type { DiscordSDK } from "@discord/embedded-app-sdk";

let _sdk: DiscordSDK | null = null;
let _clientId: string | null = null;

export const isDiscordActivity = (): boolean =>
  window.self !== window.top &&
  Boolean(window.location.ancestorOrigins?.[0]?.includes("discord.com"));

export const getApiBase = (): string =>
  isDiscordActivity()
    ? "/api"
    : import.meta.env.VITE_BotAPI || "https://api.ziji.best";

export const apiUrl = (path: string): string =>
  isDiscordActivity()
    ? `/api${path}`
    : `${import.meta.env.VITE_BotAPI || "https://api.ziji.best"}${path}`;

export const getWsUrl = (): string => {
  if (isDiscordActivity()) {
    return "/api/ws";
  }

  const base = import.meta.env.VITE_BotAPI || "https://api.ziji.best";

  return (
    base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://") + "/ws"
  );
};

export async function getDiscordClientId() {
  if (_clientId) return _clientId;

  const res = await fetch(
    import.meta.env.VITE_BotAPI || "https://api.ziji.best",
    {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    },
  );

  if (!res.ok) {
    throw new Error("Cannot fetch Bot API");
  }

  const data = await res.json();

  _clientId = data.clientId;

  return _clientId;
}

export async function loginViaActivity(): Promise<string | null> {
  if (!isDiscordActivity()) return null;

  const clientId = await getDiscordClientId();

  if (!clientId) {
    console.error("[Activity] Không lấy được Discord Client ID");
    return null;
  }

  const { DiscordSDK } = await import("@discord/embedded-app-sdk");

  const sdk = new DiscordSDK(clientId);

  _sdk = sdk;

  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });

  const res = await fetch("/api/auth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    console.error("[Activity] Token exchange thất bại", await res.text());
    return null;
  }

  const { token } = await res.json();

  localStorage.setItem("ziji-token", token);

  return token;
}
