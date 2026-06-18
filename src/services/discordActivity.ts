import { useState, useEffect } from "react";
import type { DiscordSDK } from "@discord/embedded-app-sdk";

let _sdk: DiscordSDK | null = null;
let _clientId: string | null = null;

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

export const isDiscordActivity = (): boolean => {
  const isEmbed = window.self !== window.top;
  const isDiscordOrigin = Boolean(
    window.location.ancestorOrigins?.[0]?.includes("discord.com"),
  );
  const result = isEmbed && isDiscordOrigin;

  console.log(
    `[DiscordUtils] isDiscordActivity check: isEmbed=${isEmbed}, isDiscordOrigin=${isDiscordOrigin} -> Result=${result}`,
  );
  return result;
};

export const getApiBase = (): string => {
  const isActivity = isDiscordActivity();
  const fallbackApi = import.meta.env.VITE_BotAPI || "https://api.ziji.best";
  const result = isActivity ? "/api" : fallbackApi;

  console.log(
    `[DiscordUtils] getApiBase: isDiscordActivity=${isActivity} -> Result=${result}`,
  );
  return result;
};

export const apiUrl = (path: string): string => {
  const isActivity = isDiscordActivity();
  const fallbackApi = import.meta.env.VITE_BotAPI || "https://api.ziji.best";
  const result = isActivity ? `/api${path}` : `${fallbackApi}${path}`;

  console.log(
    `[DiscordUtils] apiUrl (path: "${path}"): isDiscordActivity=${isActivity} -> Result=${result}`,
  );
  return result;
};

export const getWsUrl = (): string => {
  console.log("[DiscordUtils] getWsUrl() called");
  if (isDiscordActivity()) {
    console.log(
      "[DiscordUtils] getWsUrl: inside Discord Activity -> Result=/api/ws",
    );
    return "/api/ws";
  }

  const base = import.meta.env.VITE_BotAPI || "https://api.ziji.best";
  const result =
    base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://") +
    "/ws";

  console.log(
    `[DiscordUtils] getWsUrl: outside Discord Activity -> Base=${base} -> Result=${result}`,
  );
  return result;
};

export async function getDiscordClientId() {
  console.log("[DiscordUtils] getDiscordClientId() called");
  if (_clientId) {
    console.log(
      `[DiscordUtils] getDiscordClientId: Returning cached _clientId=${_clientId}`,
    );
    return _clientId;
  }

  const targetUrl = apiUrl("");
  console.log(
    `[DiscordUtils] getDiscordClientId: Fetching client ID from ${targetUrl}`,
  );

  const res = await fetch(targetUrl, {
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  });

  console.log(
    `[DiscordUtils] getDiscordClientId: Fetch response status=${res.status} (${res.statusText})`,
  );

  if (!res.ok) {
    console.error(
      "[DiscordUtils] getDiscordClientId: Cannot fetch Bot API (response not ok)",
    );
    throw new Error("Cannot fetch Bot API");
  }

  const data = await res.json();
  console.log("[DiscordUtils] getDiscordClientId: Fetched data context:", data);

  _clientId = data.clientId;
  console.log(
    `[DiscordUtils] getDiscordClientId: Updated cached _clientId=${_clientId}`,
  );

  return _clientId;
}

export async function loginViaActivity(): Promise<string | null> {
  console.log("[DiscordUtils] loginViaActivity() called");

  if (!isDiscordActivity()) {
    console.warn(
      "[DiscordUtils] loginViaActivity: Not running inside Discord Activity. Aborting.",
    );
    return null;
  }

  console.log(
    "[DiscordUtils] loginViaActivity: Running inside Discord Activity. Retrieving Client ID...",
  );
  const clientId = await getDiscordClientId();

  if (!clientId) {
    console.error(
      "[DiscordUtils] loginViaActivity: Không lấy được Discord Client ID",
    );
    return null;
  }
  console.log(`[DiscordUtils] loginViaActivity: Using Client ID=${clientId}`);

  console.log(
    "[DiscordUtils] loginViaActivity: Dynamically importing @discord/embedded-app-sdk...",
  );
  const { DiscordSDK } = await import("@discord/embedded-app-sdk");

  console.log(
    "[DiscordUtils] loginViaActivity: Initializing DiscordSDK instance...",
  );
  const sdk = new DiscordSDK(clientId);
  _sdk = sdk;

  console.log("[DiscordUtils] loginViaActivity: Waiting for sdk.ready()...");
  await sdk.ready();
  console.log(
    "[DiscordUtils] loginViaActivity: sdk.ready() resolved successfully.",
  );

  const authOptions = {
    client_id: clientId ?? "1501197759754272928",
    response_type: "code" as const,
    state: "",
    prompt: "none" as const,
    scope: ["identify", "guilds"] as any, // ép kiểu nếu SDK yêu cầu strict type
  };
  console.log(
    "[DiscordUtils] loginViaActivity: Calling sdk.commands.authorize with options:",
    authOptions,
  );

  const { code } = await sdk.commands.authorize(authOptions);
  console.log(
    `[DiscordUtils] loginViaActivity: Received authorization code=${code}`,
  );

  const tokenAuthUrl = apiUrl("/auth/token");
  console.log(
    `[DiscordUtils] loginViaActivity: Exchanging code for token at ${tokenAuthUrl}`,
  );

  const res = await fetch(tokenAuthUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({ code }),
  });

  console.log(
    `[DiscordUtils] loginViaActivity: Token exchange response status=${res.status}`,
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error(
      "[DiscordUtils] loginViaActivity: Token exchange thất bại",
      errorText,
    );
    return null;
  }

  const { token } = await res.json();
  console.log(
    `[DiscordUtils] loginViaActivity: Token received successfully (Length: ${token?.length || 0})`,
  );

  localStorage.setItem("ziji-token", token);
  console.log(
    "[DiscordUtils] loginViaActivity: Saved token to localStorage ('ziji-token')",
  );

  return token;
}

export async function fetchBotInfo(): Promise<BotInfo> {
  const response = await fetch(apiUrl("/"), {
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch bot info");
  }
  return response.json();
}

export const proxyImage = (url?: string) => {
  if (!url) return "";
  if (!isDiscordActivity()) {
    return url;
  }
  return `${apiUrl("/proxy/image")}?url=${encodeURIComponent(url)}`;
};

export const getDiscordSdk = (): DiscordSDK | null => _sdk;

export function useIsMinimized() {
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const checkDimensions = () => {
      return window.innerWidth < 480 || window.innerHeight < 350;
    };

    const handleResize = () => {
      setIsMinimized(checkDimensions());
    };

    setIsMinimized(checkDimensions());
    window.addEventListener("resize", handleResize);

    let active = true;
    let subscribed = false;
    let sdkInstance: any = null;

    const handleLayoutUpdate = (eventData: any) => {
      if (!active) return;
      console.log("[useIsMinimized] Discord layout update event:", eventData);
      if (eventData && (eventData.layout_mode === 1 || eventData.layout_mode === "PIP")) {
        setIsMinimized(true);
      } else {
        setIsMinimized(checkDimensions());
      }
    };

    const setupDiscordListener = async () => {
      for (let i = 0; i < 20; i++) {
        if (!active) return;
        if (_sdk) {
          sdkInstance = _sdk;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (sdkInstance && active) {
        try {
          console.log("[useIsMinimized] Subscribing to ACTIVITY_LAYOUT_MODE_UPDATE");
          await sdkInstance.subscribe("ACTIVITY_LAYOUT_MODE_UPDATE", handleLayoutUpdate);
          subscribed = true;
        } catch (err) {
          console.warn("[useIsMinimized] Failed to subscribe to layout updates:", err);
        }
      }
    };

    if (isDiscordActivity()) {
      setupDiscordListener();
    }

    return () => {
      active = false;
      window.removeEventListener("resize", handleResize);
      if (subscribed && sdkInstance) {
        try {
          sdkInstance.unsubscribe("ACTIVITY_LAYOUT_MODE_UPDATE", handleLayoutUpdate);
        } catch (err) {
          console.warn("[useIsMinimized] Failed to unsubscribe from layout updates:", err);
        }
      }
    };
  }, []);

  return isMinimized;
}
