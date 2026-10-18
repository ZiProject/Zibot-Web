import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { WebAudioClient } from "@ziplayer/client";
import { apiUrl, getWsUrl, isDiscordActivity, proxyImage, useIsMinimized, videoStreamUrl } from "../services/discordActivity";
import {
	Play,
	Pause,
	SkipForward,
	SkipBack,
	Volume2,
	Repeat,
	Shuffle,
	Music,
	Users,
	ListMusic,
	Search,
	SlidersHorizontal,
	LayoutGrid,
	Heart,
	LockKeyhole,
	Activity,
	Trash2,
	Baseline,
	LoaderCircle,
	CircleAlert,
	X,
	Headphones,
	Video,
	VideoOff,
	Film,
	Eye,
	EyeOff,
	Maximize,
	Minimize,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { BotInfo } from "../services/discordActivity";

interface Track {
	title: string;
	url: string | null;
	duration: string | number;
	thumbnail: string | null;
	author: string | null;
	isLive?: boolean;
}

type SearchState = "idle" | "loading" | "success" | "empty" | "error";

interface PlayerStats {
	event: string;
	timestamp: number;
	listeners: number;
	tracks: number;
	volume: number;
	paused: boolean;
	repeatMode: string;
	autoPlay: boolean;
	lockStatus: boolean;
	track: Track | null;
	queue: Track[];
	related: Track[];
}
interface HeroProps {
	botInfo: BotInfo | null;
}

function getStreamWebSocketUrl() {
	const url = new URL(getWsUrl(), window.location.href);
	if (url.protocol === "https:") url.protocol = "wss:";
	else if (url.protocol === "http:") url.protocol = "ws:";
	url.pathname = `${url.pathname.replace(/\/$/, "")}/stream`;
	url.search = "";
	url.hash = "";
	return url.toString();
}

interface StreamPlayersInfo {
	sessionId: string;
	voice: { guildId: string; channelId: string; name: string | null } | null;
	discord: {
		playerId: string;
		channel: { id: string | null; name: string | null; guildName: string | null };
		playing: boolean;
		attached: boolean;
	} | null;
	browser: { playerId: string; playing: boolean; attached: boolean } | null;
	selectedTarget: "discord" | "browser" | null;
}

/**
 * Single-line text that ellipsizes normally and scrolls to its end while the surrounding row
 * (`data-marquee-host`) is hovered or focused, so long titles can be read in full.
 */
function MarqueeText({ text, className = "" }: { text: string; className?: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	const frame = useRef<number | null>(null);
	const [scrolling, setScrolling] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el || typeof window === "undefined") return;
		const host = (el.closest("[data-marquee-host]") as HTMLElement | null) ?? el;
		const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

		const stop = () => {
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			frame.current = null;
			el.scrollLeft = 0;
			setScrolling(false);
		};
		const start = () => {
			if (reduceMotion || frame.current !== null) return;
			const max = el.scrollWidth - el.clientWidth;
			if (max <= 2) return;
			setScrolling(true);
			const pause = 700;
			const travel = (max / 48) * 1000; // 48px per second
			const cycle = pause * 2 + travel;
			let startedAt: number | null = null;
			const tick = (now: number) => {
				if (startedAt === null) startedAt = now;
				const t = (now - startedAt) % cycle;
				el.scrollLeft =
					t < pause ? 0
					: t < pause + travel ? ((t - pause) / travel) * max
					: max;
				frame.current = requestAnimationFrame(tick);
			};
			frame.current = requestAnimationFrame(tick);
		};

		host.addEventListener("mouseenter", start);
		host.addEventListener("mouseleave", stop);
		host.addEventListener("focusin", start);
		host.addEventListener("focusout", stop);
		return () => {
			host.removeEventListener("mouseenter", start);
			host.removeEventListener("mouseleave", stop);
			host.removeEventListener("focusin", start);
			host.removeEventListener("focusout", stop);
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			frame.current = null;
		};
	}, [text]);

	return (
		<span
			ref={ref}
			title={text}
			className={`block min-w-0 overflow-hidden whitespace-nowrap ${scrolling ? "text-clip" : "text-ellipsis"} ${className}`}>
			{text}
		</span>
	);
}

function VideoCanvas({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		let animId: number;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const render = () => {
			const video = videoRef.current;
			if (video && video.readyState >= 2) {
				if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
					if (video.videoWidth && video.videoHeight) {
						canvas.width = video.videoWidth;
						canvas.height = video.videoHeight;
					}
				}
				if (canvas.width > 0 && canvas.height > 0) {
					try {
						ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
					} catch {}
				}
			}
			animId = requestAnimationFrame(render);
		};

		animId = requestAnimationFrame(render);
		return () => cancelAnimationFrame(animId);
	}, [videoRef]);

	return (
		<canvas
			ref={canvasRef}
			className='absolute inset-0 z-10 h-full w-full object-cover rounded-xl pointer-events-none'
		/>
	);
}

export function MusicPlayerView({ botInfo }: HeroProps) {
	const { t } = useLanguage();
	const [stats, setStats] = useState<PlayerStats | null>(null);
	const isMinimized = useIsMinimized();
	const [ws, setWs] = useState<WebSocket | null>(null);
	const [connected, setConnected] = useState(false);
	const [authenticated, setAuthenticated] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
	const reconnectDelay = useRef(1000);

	const [isVoiceConnected, setIsVoiceConnected] = useState(false);
	const [voiceChannel, setVoiceChannel] = useState<{ channelName: string; guildName: string } | null>(null);
	const [isJoining, setIsJoining] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);
	const [webAudioMode, setWebAudioMode] = useState(false);
	const [webStreamActive, setWebStreamActive] = useState(false);
	const [webAudioConnected, setWebAudioConnected] = useState(false);
	const [webAudioStatus, setWebAudioStatus] = useState("");
	const [webAudioError, setWebAudioError] = useState<string | null>(null);
	const [streamTarget, setStreamTarget] = useState<"auto" | "browser">("auto");
	const [playersInfo, setPlayersInfo] = useState<StreamPlayersInfo | null>(null);
	const [attachedPlayerId, setAttachedPlayerId] = useState<string | null>(null);
	const [switchingToDiscord, setSwitchingToDiscord] = useState(false);
	const [outputSwitching, setOutputSwitching] = useState(false);
	const playersSyncingRef = useRef(false);
	const outputBusyRef = useRef(false);
	const lastAttachFailureRef = useRef(0);
	const webAudioClient = useRef<WebAudioClient | null>(null);
	const webStreamActiveRef = useRef(false);
	const webStreamSessionIdRef = useRef<string | null>(null);
	const webStreamMirrorsVoiceRef = useRef(false);
	const webStreamSharesDiscordPlayerRef = useRef(false);
	const webAudioModeRef = useRef(false);

	const [videoBgEnabled, setVideoBgEnabled] = useState(() => {
		try {
			return localStorage.getItem("ziji-video-bg") !== "false";
		} catch {
			return true;
		}
	});
	const [videoCanvasMode, setVideoCanvasMode] = useState(false);
	const [videoError, setVideoError] = useState(false);
	const [videoLoaded, setVideoLoaded] = useState(false);
	const [miniVideoLoaded, setMiniVideoLoaded] = useState(false);
	const videoBgRef = useRef<HTMLVideoElement | null>(null);
	const miniVideoRef = useRef<HTMLVideoElement | null>(null);
	const lastKnownThumbnailRef = useRef<string | null>(null);
	const lastKnownTrackRef = useRef<Track | null>(null);

	if (stats?.track?.thumbnail) {
		lastKnownThumbnailRef.current = stats.track.thumbnail;
	}
	if (stats?.track) {
		lastKnownTrackRef.current = stats.track;
	}

	const activeThumbnail = stats?.track?.thumbnail || lastKnownThumbnailRef.current || botInfo?.avatars || null;

	const [bgBlur, setBgBlur] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("ziji-bg-blur");
			return saved !== null ? Math.min(30, Math.max(0, Number(saved))) : 8;
		} catch {
			return 8;
		}
	});

	const [bgOpacity, setBgOpacity] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("ziji-bg-opacity");
			return saved !== null ? Math.min(100, Math.max(0, Number(saved))) : 35;
		} catch {
			return 35;
		}
	});

	const [guiOpacity, setGuiOpacity] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("ziji-gui-opacity");
			return saved !== null ? Math.min(100, Math.max(10, Number(saved))) : 85;
		} catch {
			return 85;
		}
	});

	const [guiBlur, setGuiBlur] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("ziji-gui-blur");
			return saved !== null ? Math.min(30, Math.max(0, Number(saved))) : 16;
		} catch {
			return 16;
		}
	});

	const [showVisualSettings, setShowVisualSettings] = useState(false);

	const updateBgBlur = (val: number) => {
		const clamped = Math.min(30, Math.max(0, val));
		setBgBlur(clamped);
		try {
			localStorage.setItem("ziji-bg-blur", String(clamped));
		} catch {}
	};

	const updateBgOpacity = (val: number) => {
		const clamped = Math.min(100, Math.max(0, val));
		setBgOpacity(clamped);
		try {
			localStorage.setItem("ziji-bg-opacity", String(clamped));
		} catch {}
	};

	const updateGuiOpacity = (val: number) => {
		const clamped = Math.min(100, Math.max(10, val));
		setGuiOpacity(clamped);
		try {
			localStorage.setItem("ziji-gui-opacity", String(clamped));
		} catch {}
	};

	const updateGuiBlur = (val: number) => {
		const clamped = Math.min(30, Math.max(0, val));
		setGuiBlur(clamped);
		try {
			localStorage.setItem("ziji-gui-blur", String(clamped));
		} catch {}
	};

	const resetVisualSettings = () => {
		updateBgBlur(8);
		updateBgOpacity(35);
		updateGuiOpacity(85);
		updateGuiBlur(16);
	};

	const applyPreset = (preset: "default" | "cinema" | "glass" | "focus") => {
		switch (preset) {
			case "cinema":
				updateBgOpacity(85);
				updateBgBlur(0);
				updateGuiOpacity(35);
				updateGuiBlur(8);
				break;
			case "glass":
				updateBgOpacity(55);
				updateBgBlur(6);
				updateGuiOpacity(60);
				updateGuiBlur(20);
				break;
			case "focus":
				updateBgOpacity(15);
				updateBgBlur(16);
				updateGuiOpacity(95);
				updateGuiBlur(20);
				break;
			case "default":
			default:
				resetVisualSettings();
				break;
		}
	};

	const [hideGui, setHideGui] = useState<boolean>(false);
	const [showZenControls, setShowZenControls] = useState<boolean>(true);
	const zenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [hideScrollbar, setHideScrollbar] = useState<boolean>(() => {
		try {
			return localStorage.getItem("ziji-hide-scrollbar") !== "false";
		} catch {
			return true;
		}
	});

	const updateHideScrollbar = (val: boolean) => {
		setHideScrollbar(val);
		try {
			localStorage.setItem("ziji-hide-scrollbar", String(val));
		} catch {}
	};

	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(Boolean(document.fullscreenElement));
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
	}, []);

	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch(() => {});
		} else {
			document.exitFullscreen().catch(() => {});
		}
	};

	const triggerZenActivity = () => {
		setShowZenControls(true);
		if (zenTimeoutRef.current) clearTimeout(zenTimeoutRef.current);
		zenTimeoutRef.current = setTimeout(() => {
			setShowZenControls(false);
		}, 3500);
	};

	useEffect(() => {
		if (!hideGui) {
			setShowZenControls(true);
			if (zenTimeoutRef.current) clearTimeout(zenTimeoutRef.current);
			return;
		}

		triggerZenActivity();
		const onMouseMove = () => triggerZenActivity();
		const onTouchStart = () => triggerZenActivity();

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("touchstart", onTouchStart);

		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("touchstart", onTouchStart);
			if (zenTimeoutRef.current) clearTimeout(zenTimeoutRef.current);
		};
	}, [hideGui]);

	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
				return;
			}

			if (e.key === "Escape") {
				if (showVisualSettings) {
					setShowVisualSettings(false);
				} else if (hideGui) {
					setHideGui(false);
				}
			} else if (e.key.toLowerCase() === "h") {
				setHideGui((prev) => !prev);
			}
		};

		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [showVisualSettings, hideGui]);

	useEffect(() => {
		if (hideGui) {
			document.body.classList.add("cyber-zen-mode");
		} else {
			document.body.classList.remove("cyber-zen-mode");
		}
		return () => {
			document.body.classList.remove("cyber-zen-mode");
		};
	}, [hideGui]);

	const currentTrackUrl = stats?.track?.url || null;
	const currentTrackTitle = stats?.track?.title || null;
	const currentVideoUrl = stats?.track ? videoStreamUrl(stats.track) : null;

	useEffect(() => {
		setVideoError(false);
		setVideoLoaded(false);
		setMiniVideoLoaded(false);
		initialSyncedTrackRef.current = null;
		lastVideoSeekRef.current = 0;
	}, [currentTrackUrl, currentTrackTitle]);

	useEffect(() => {
		const isPaused = Boolean(stats?.paused);
		const updateVideoPlayback = (v: HTMLVideoElement | null) => {
			if (!v) return;
			if (isPaused) {
				v.pause();
			} else {
				v.play().catch(() => {});
			}
		};
		updateVideoPlayback(videoBgRef.current);
		updateVideoPlayback(miniVideoRef.current);
	}, [stats?.paused]);

	const lastVideoSeekRef = useRef(0);
	const initialSyncedTrackRef = useRef<string | null>(null);

	useEffect(() => {
		if (stats?.timestamp === undefined || stats?.timestamp === null) return;
		const targetSec = stats.timestamp / 1000;
		const trackKey = stats?.track?.url || stats?.track?.title || "";

		const isBuffered = (video: HTMLVideoElement, time: number): boolean => {
			try {
				const b = video.buffered;
				for (let i = 0; i < b.length; i++) {
					if (time >= b.start(i) && time <= b.end(i)) return true;
				}
			} catch {}
			return false;
		};

		const syncVideoElement = (v: HTMLVideoElement | null) => {
			if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
			if (v.seeking || v.readyState < 2) return;

			// Handle looping if video is shorter than track duration
			const effectiveTarget = targetSec % v.duration;
			const delta = Math.abs(v.currentTime - effectiveTarget);

			const isInitialSync = initialSyncedTrackRef.current !== trackKey;
			const now = Date.now();

			if (isInitialSync) {
				initialSyncedTrackRef.current = trackKey;
				if (targetSec < 5) {
					v.playbackRate = 1.0;
					return;
				}
			}

			// If target is in buffered cache and delta is noticeable, seek directly from memory
			if (delta > 3.0 && isBuffered(v, effectiveTarget) && now - lastVideoSeekRef.current > 3000) {
				lastVideoSeekRef.current = now;
				try {
					v.currentTime = effectiveTarget;
				} catch {}
				v.playbackRate = 1.0;
				return;
			}

			// Nudge playback rate gently to drift into sync without firing network byte range requests
			if (delta > 1.5) {
				v.playbackRate = v.currentTime < effectiveTarget ? 1.08 : 0.92;
			} else {
				v.playbackRate = 1.0;
			}
		};

		syncVideoElement(videoBgRef.current);
		syncVideoElement(miniVideoRef.current);
	}, [stats?.timestamp, stats?.track?.url, stats?.track?.title]);

	// Silent sound data URI for background media control
	const SILENT_SOUND_URL =
		"data:audio/wav;base64,UklGRqAWAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YV4WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
	const parseDuration = (val: string | number): number => {
		if (!val) return 0;
		if (typeof val === "number") {
			return val > 10000 ? val : val * 1000;
		}
		if (typeof val === "string" && val.includes(":")) {
			const parts = val.split(":").map(Number);
			if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
			if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
		}
		const parsed = parseInt(val);
		return (
			isNaN(parsed) ? 0
			: parsed > 10000 ? parsed
			: parsed * 1000
		);
	};

	const formatDisplayDuration = (val: string | number) => {
		if (!val) return "0:00";
		if (typeof val === "string" && val.includes(":")) return val;
		return formatTime(parseDuration(val));
	};
	const audioRef = useRef<HTMLAudioElement | null>(null);
	useEffect(() => {
		audioRef.current = new Audio(SILENT_SOUND_URL);
		audioRef.current.loop = true;

		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, []);
	// Calculate progress percentage with auto-detect duration format
	useEffect(() => {
		if (!stats?.track?.duration) {
			setProgress(0);
			return;
		}
		const durationMs = parseDuration(stats.track.duration);
		if (durationMs > 0) {
			const currentProgress = (stats.timestamp / durationMs) * 100;
			setProgress(Math.min(100, Math.max(0, currentProgress)));
		}
	}, [stats?.timestamp, stats?.track?.duration]);
	const [volume, setVolume] = useState(50);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<Track[]>([]);
	const [searchState, setSearchState] = useState<SearchState>("idle");
	const [searchError, setSearchError] = useState<string | null>(null);
	const latestSearchId = useRef(0);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const queueSectionRef = useRef<HTMLDivElement>(null);
	const [activeTrackAction, setActiveTrackAction] = useState<string | null>(null);
	const [lyrics, setLyrics] = useState<string | null>(null);
	const [romanizedLyrics, setRomanizedLyrics] = useState<string | null>(null);
	const [showRomanized, setShowRomanized] = useState(false);
	const [showLyrics, setShowLyrics] = useState(false);
	const [isPlayerOpen, setIsPlayerOpen] = useState(false);

	const token = localStorage.getItem("ziji-token");
	const baseUrl = apiUrl("");
	const wsUrl = getWsUrl();
	const streamWsUrl = getStreamWebSocketUrl();

	const setWebStreamRunning = (active: boolean) => {
		webStreamActiveRef.current = active;
		setWebStreamActive(active);
	};

	const enterWebAudioMode = () => {
		webAudioModeRef.current = true;
		setWebAudioMode(true);
	};

	const getWebAudioClient = () => {
		if (webAudioClient.current) return webAudioClient.current;

		const client = new WebAudioClient({
			webSocketFactory: (clientUrl) => {
				const authToken = clientUrl.searchParams.get("token");
				if (!authToken) throw new Error("Web audio authentication token is missing");
				clientUrl.searchParams.delete("token");
				const socket = new WebSocket(streamWsUrl);
				socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "auth", token: authToken })), { once: true });
				return socket;
			},
		});
		client.addEventListener("statechange", ({ detail }) => {
			setWebAudioConnected(detail.state !== "disconnected");
			if (detail.state === "playing") setWebAudioStatus("Playing in browser");
			else if (detail.state === "waiting") setWebAudioStatus("Waiting for audio stream");
			else if (detail.state === "connected") setWebAudioStatus("Connected; waiting for playback");
			else if (detail.state === "disconnected") setWebAudioStatus("Browser audio disconnected");
		});
		client.addEventListener("error", ({ detail }) => {
			console.error("Web audio stream error:", detail.error);
			const message = detail.error.message;
			setWebAudioError(
				message.includes("PCM configuration") ?
					"Your browser audio receiver is outdated. Update @ziplayer/client to the Opus Web Audio client."
				:	message,
			);
		});
		client.addEventListener("close", ({ detail }) => {
			if (detail.code !== 1000) setWebAudioStatus(`Audio connection closed (${detail.code})`);
		});
		webAudioClient.current = client;
		return client;
	};

	const playOnWeb = async (query: string, positionMs = 0, mirrorsVoice = false, trackOpt?: Track) => {
		if (!token) {
			setWebAudioError("Please log in to use browser audio.");
			return;
		}
		setWebAudioError(null);
		setWebAudioStatus("Connecting browser audio…");
		if (trackOpt) {
			setStats((prev) => ({
				event: "statistics",
				timestamp: positionMs || 0,
				listeners: prev?.listeners ?? 0,
				tracks: prev?.tracks ? Math.max(1, prev.tracks) : 1,
				volume: prev?.volume ?? 50,
				paused: false,
				repeatMode: prev?.repeatMode ?? "off",
				autoPlay: prev?.autoPlay ?? false,
				lockStatus: false,
				track: trackOpt,
				queue: prev?.queue ?? [],
				related: prev?.related ?? [],
			}));
		}
		try {
			const client = getWebAudioClient();
			if (client.state === "disconnected") {
				await client.connect({ gatewayUrl: streamWsUrl, token, nextPublisher: true });
			}
			const response = await fetch(apiUrl("/api/stream/play"), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"ngrok-skip-browser-warning": "true",
				},
				body: JSON.stringify({ query, target: streamTarget, ...(positionMs > 0 ? { positionMs } : {}) }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || `Playback request failed (${response.status})`);
			if (!result.sessionId) throw new Error("The audio player did not return a session ID");
			if (client.sessionId && client.sessionId !== result.sessionId) {
				throw new Error("The browser listener connected to a different player session");
			}
			webStreamSessionIdRef.current = result.sessionId;
			webStreamMirrorsVoiceRef.current = mirrorsVoice;
			webStreamSharesDiscordPlayerRef.current = result.target === "discord";
			setAttachedPlayerId(result.playerId ?? null);
			void refreshPlayersInfo();
			enterWebAudioMode();
			setWebStreamRunning(true);
			setWebAudioStatus(
				result.target === "discord" ?
					`Using the existing Discord player${result.track?.title ? ` for ${result.track.title}` : ""}; playback stays synchronized`
				: mirrorsVoice ? `Playing browser copy of ${result.track?.title || "track"}; Discord voice is unchanged`
				: `Loading ${result.track?.title || "track"}…`,
			);
			setError(null);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Could not start browser audio";
			console.error("Browser audio playback failed:", err);
			setWebAudioError(message);
			setWebAudioStatus("Browser audio failed");
		}
	};

	const streamHeaders = () => ({
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
		"ngrok-skip-browser-warning": "true",
	});

	const refreshPlayersInfo = async (): Promise<StreamPlayersInfo | null> => {
		if (!token) return null;
		try {
			const response = await fetch(apiUrl("/api/stream/players?sse=false"), {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
					Accept: "application/json",
				},
			});
			if (!response.ok) return null;
			const info = (await response.json()) as StreamPlayersInfo;
			setPlayersInfo(info);
			return info;
		} catch {
			return null;
		}
	};

	// Registers the browser audio output on the user's existing Discord player (no new session).
	const attachToDiscordPlayer = async (migrate = false): Promise<boolean> => {
		if (!token) return false;
		try {
			const client = getWebAudioClient();
			if (client.state === "disconnected") {
				await client.connect({ gatewayUrl: streamWsUrl, token, nextPublisher: true });
			}
			const response = await fetch(apiUrl("/api/stream/attach"), {
				method: "POST",
				headers: streamHeaders(),
				body: JSON.stringify({ migrate }),
			});
			const result = await response.json();
			if (!response.ok) {
				if (!webStreamActiveRef.current) await client.disconnect().catch(() => {});
				if (result.code === "NO_DISCORD_PLAYER") return false;
				throw new Error(result.error || `Attach failed (${response.status})`);
			}
			if (client.sessionId && client.sessionId !== result.sessionId) {
				throw new Error("The browser listener connected to a different player session");
			}
			webStreamSessionIdRef.current = result.sessionId;
			webStreamMirrorsVoiceRef.current = false;
			webStreamSharesDiscordPlayerRef.current = true;
			setAttachedPlayerId(result.playerId ?? null);
			enterWebAudioMode();
			setWebStreamRunning(true);
			setWebAudioError(null);
			setWebAudioStatus(`Connected to the Discord player${result.channel?.name ? ` in ${result.channel.name}` : ""}`);
			void refreshPlayersInfo();
			return true;
		} catch (err) {
			lastAttachFailureRef.current = Date.now();
			const message = err instanceof Error ? err.message : "Could not connect to the Discord player";
			console.error("Attach to Discord player failed:", err);
			setWebAudioError(message);
			return false;
		}
	};

	const switchToDiscordPlayer = async () => {
		setSwitchingToDiscord(true);
		try {
			await switchToVoiceOutput();
		} finally {
			setSwitchingToDiscord(false);
		}
	};

	const discordChannelLabel = playersInfo?.discord?.channel.name ? `#${playersInfo.discord.channel.name}` : "your voice channel";
	const discordPlayerAvailable = Boolean(playersInfo?.discord);
	const addingToDiscord = streamTarget === "auto" && discordPlayerAvailable;
	const showSwitchBanner =
		streamTarget === "auto" &&
		discordPlayerAvailable &&
		!playersInfo?.discord?.attached &&
		Boolean(playersInfo?.browser?.playing);

	const handleOutputSwitch = async (toBrowser: boolean) => {
		if (outputSwitching || webAudioMode === toBrowser) return;
		setOutputSwitching(true);
		try {
			await toggleWebAudioMode();
		} finally {
			setOutputSwitching(false);
		}
	};

	// Small segmented switch: where the audio is heard (Discord voice <-> this browser).
	const renderStreamSwitch = (full: boolean) => (
		<div
			role='radiogroup'
			aria-label='Audio output'
			className={`relative inline-grid grid-cols-2 rounded-full border border-white/10 bg-black/30 p-0.5 text-[10px] font-black uppercase tracking-wider ${full ? "w-full" : "w-[148px]"} ${outputSwitching ? "opacity-70" : ""}`}>
			<span
				aria-hidden
				className={`pointer-events-none absolute bottom-0.5 top-0.5 w-[calc(50%-2px)] rounded-full transition-all duration-200 ${webAudioMode ? "left-[calc(50%+1px)] bg-lime-300/20 shadow-[0_0_14px_rgba(190,242,100,0.25)]" : "left-0.5 bg-cyan-300/20 shadow-[0_0_14px_rgba(34,211,238,0.25)]"}`}
			/>
			{[
				{ key: "discord", label: "Discord", Icon: Music, active: !webAudioMode, hint: "Play through the bot in Discord voice" },
				{ key: "browser", label: "Browser", Icon: Headphones, active: webAudioMode, hint: "Listen in this browser" },
			].map(({ key, label, Icon, active, hint }) => (
				<button
					key={key}
					type='button'
					role='radio'
					aria-checked={active}
					title={hint}
					disabled={outputSwitching}
					onClick={() => void handleOutputSwitch(key === "browser")}
					className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors disabled:cursor-wait ${
						active ?
							key === "browser" ?
								"text-lime-200"
							:	"text-cyan-100"
						:	"text-zinc-500 hover:text-zinc-200"
					}`}>
					<Icon className='h-3 w-3' />
					{label}
				</button>
			))}
		</div>
	);

	// Compact "add songs to" control for browser mode (replaces the old select + description).
	const renderTargetPill = () => (
		<div className='flex shrink-0 items-center gap-1.5'>
			{showSwitchBanner && (
				<button
					type='button'
					disabled={switchingToDiscord}
					onClick={() => void switchToDiscordPlayer()}
					title={`A Discord player is running in ${discordChannelLabel}. Your browser-only song will move there.`}
					className='rounded-full bg-lime-300/15 px-2 py-0.5 text-[10px] font-bold text-lime-200 transition-colors hover:bg-lime-300/25 disabled:opacity-50'>
					{switchingToDiscord ? "Switching…" : "Use Discord player"}
				</button>
			)}
			<select
				aria-label='Add songs to'
				value={streamTarget}
				title={
					addingToDiscord ? `Songs go into the Discord player in ${discordChannelLabel}; the web shares that same player.`
					: streamTarget === "browser" ?
						"Songs play only in this browser and never take over the Discord voice connection."
					:	"No Discord player found: songs play in a browser-only player until you start one in voice."
				}
				onChange={(event) => setStreamTarget(event.target.value === "browser" ? "browser" : "auto")}
				className='max-w-[150px] truncate rounded-full border border-white/10 bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-zinc-200 outline-none focus:border-cyan-300/40'>
				<option value='auto'>{discordPlayerAvailable ? `→ Discord ${discordChannelLabel}` : "→ Discord player"}</option>
				<option value='browser'>→ Browser only</option>
			</select>
		</div>
	);

	// Stream players info via Server-Sent Events (SSE)
	useEffect(() => {
		if (!token) return;
		const controller = new AbortController();
		let cancelled = false;
		let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

		const connectPlayersStream = async () => {
			let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
			try {
				const response = await fetch(apiUrl("/api/stream/players"), {
					headers: {
						Authorization: `Bearer ${token}`,
						"ngrok-skip-browser-warning": "true",
						Accept: "text/event-stream",
					},
					signal: controller.signal,
				});
				if (!response.ok) {
					void refreshPlayersInfo();
					return;
				}
				if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
					const info = (await response.json()) as StreamPlayersInfo;
					if (!cancelled) setPlayersInfo(info);
					return;
				}

				reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				const consumeEvent = (block: string) => {
					let eventName = "message";
					const data: string[] = [];
					for (const line of block.split(/\r\n|\r|\n/)) {
						if (line.startsWith(":")) continue;
						const separator = line.indexOf(":");
						const field = separator === -1 ? line : line.slice(0, separator);
						const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
						if (field === "event") eventName = value;
						else if (field === "data") data.push(value);
					}
					if (!data.length || cancelled) return;
					try {
						const payload = JSON.parse(data.join("\n")) as StreamPlayersInfo;
						if (eventName === "stream-players" || eventName === "message") {
							setPlayersInfo(payload);
						}
					} catch (err) {
						console.error("Could not process stream players event:", err);
					}
				};

				while (!cancelled) {
					const { value, done } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					let boundary = buffer.search(/\r?\n\r?\n/);
					while (boundary !== -1) {
						const block = buffer.slice(0, boundary);
						const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0].length ?? 2;
						buffer = buffer.slice(boundary + separator);
						consumeEvent(block);
						boundary = buffer.search(/\r?\n\r?\n/);
					}
				}
			} catch (err) {
				if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
				console.warn("Players stream disconnected, reconnecting in 3s...", err);
			} finally {
				reader?.releaseLock();
				if (!cancelled) reconnectTimeout = setTimeout(connectPlayersStream, 3000);
			}
		};

		void connectPlayersStream();

		return () => {
			cancelled = true;
			clearTimeout(reconnectTimeout);
			controller.abort();
		};
	}, [token]);

	const sendWebStreamControl = async (action: string, values: Record<string, unknown> = {}) => {
		if (!token) throw new Error("Please log in to control browser audio");
		const response = await fetch(apiUrl("/api/stream/control"), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"ngrok-skip-browser-warning": "true",
			},
			body: JSON.stringify({ action, ...values }),
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || `Playback control failed (${response.status})`);
		return result;
	};

	const switchToVoiceOutput = async () => {
		setWebAudioStatus("Connecting the player to Discord voice…");
		setWebAudioError(null);
		try {
			const response = await fetch(apiUrl("/api/stream/output"), {
				method: "POST",
				headers: streamHeaders(),
				body: JSON.stringify({ mode: "voice" }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || `Voice output failed (${response.status})`);
			await webAudioClient.current?.disconnect().catch(() => {});
			webAudioModeRef.current = false;
			setWebAudioMode(false);
			setWebStreamRunning(false);
			webStreamSessionIdRef.current = null;
			setAttachedPlayerId(null);
			webStreamSharesDiscordPlayerRef.current = false;
			webStreamMirrorsVoiceRef.current = false;
			void refreshPlayersInfo();
			setWebAudioStatus(`Playing in Discord voice${result.channel?.name ? `: ${result.channel.name}` : ""}`);
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Could not switch to Discord voice";
			setWebAudioError(message);
			setWebAudioStatus("Output switch failed");
			return false;
		}
	};

	const switchToBrowserOutput = async () => {
		setWebAudioStatus("Switching playback to browser…");
		setWebAudioError(null);
		try {
			if (!token) throw new Error("Please log in to use browser audio.");
			const client = getWebAudioClient();
			if (client.state === "disconnected") {
				await client.connect({ gatewayUrl: streamWsUrl, token, nextPublisher: true });
			}
			const response = await fetch(apiUrl("/api/stream/output"), {
				method: "POST",
				headers: streamHeaders(),
				body: JSON.stringify({ mode: "web" }),
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || `Browser output failed (${response.status})`);
			webAudioModeRef.current = true;
			setWebAudioMode(true);
			setWebStreamRunning(true);
			webStreamSessionIdRef.current = result.sessionId;
			webStreamSharesDiscordPlayerRef.current = false;
			setAttachedPlayerId(result.playerId ?? null);
			void refreshPlayersInfo();
			setWebAudioStatus("Playing in browser");
			return true;
		} catch (error) {
			await webAudioClient.current?.disconnect().catch(() => {});
			const message = error instanceof Error ? error.message : "Could not switch to browser audio";
			setWebAudioError(message);
			setWebAudioStatus("Output switch failed");
			return false;
		}
	};

	const switchOutputMode = async () => {
		if (webAudioMode) {
			await switchToVoiceOutput();
		} else {
			await switchToBrowserOutput();
		}
	};

	// Marks the switch as in flight so the auto-attach poll can't re-register the browser output
	// on a player that is just being connected to / released from Discord voice.
	const toggleWebAudioMode = async () => {
		if (outputBusyRef.current) return;
		outputBusyRef.current = true;
		try {
			await switchOutputMode();
		} finally {
			outputBusyRef.current = false;
		}
	};

	useEffect(() => {
		if (!webStreamActive || !token) return;
		let cancelled = false;
		const controller = new AbortController();
		let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
		const applyState = (state: any) => {
			setStats({
				event: "statistics",
				timestamp: state.timestamp ?? 0,
				listeners: 0,
				tracks: state.queue?.length ?? 0,
				volume: state.volume ?? 0,
				paused: Boolean(state.paused),
				repeatMode: state.loopMode ?? "off",
				autoPlay: Boolean(state.autoPlay),
				lockStatus: false,
				track: state.currentTrack,
				queue: state.queue ?? [],
				related: Array.isArray(state.related) ? state.related : [],
			});
			setVolume(state.volume ?? 0);
		};

		const connectStateStream = async () => {
			let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
			try {
				const response = await fetch(apiUrl("/api/stream/state"), {
					headers: {
						Authorization: `Bearer ${token}`,
						"ngrok-skip-browser-warning": "true",
					},
					signal: controller.signal,
				});
				if (response.status === 404) {
					if (!cancelled) setWebAudioStatus("Waiting for a browser audio player");
					return;
				}
				if (!response.ok) {
					const result = await response.json();
					throw new Error(result.error || `Player state request failed (${response.status})`);
				}
				if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
					throw new Error("Player state endpoint did not return an SSE stream");
				}
				if (cancelled) return;
				setWebAudioStatus("Receiving live player updates");

				reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";
				const consumeEvent = (block: string) => {
					let eventName = "message";
					const data: string[] = [];
					for (const line of block.split(/\r\n|\r|\n/)) {
						if (line.startsWith(":")) continue;
						const separator = line.indexOf(":");
						const field = separator === -1 ? line : line.slice(0, separator);
						const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
						if (field === "event") eventName = value;
						else if (field === "data") data.push(value);
					}
					if (!data.length || cancelled) return;
					try {
						const payload = JSON.parse(data.join("\n"));
						if (eventName === "player-state") applyState(payload);
						else if (eventName === "player-state-error") {
							throw new Error(payload.message || "Player state is temporarily unavailable");
						}
					} catch (err) {
						const message = err instanceof Error ? err.message : "Invalid player state event";
						console.error("Could not process player state event:", err);
						setWebAudioError(message);
					}
				};

				while (!cancelled) {
					const { value, done } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					let boundary = buffer.search(/\r?\n\r?\n/);
					while (boundary !== -1) {
						const block = buffer.slice(0, boundary);
						const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0].length ?? 2;
						buffer = buffer.slice(boundary + separator);
						consumeEvent(block);
						boundary = buffer.search(/\r?\n\r?\n/);
					}
				}
			} catch (err) {
				if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
				const message = err instanceof Error ? err.message : "Could not read browser player state";
				console.error("Browser player state stream failed:", err);
				setWebAudioError(message);
			} finally {
				reader?.releaseLock();
				if (!cancelled) reconnectTimeout = setTimeout(connectStateStream, 2000);
			}
		};

		void connectStateStream();
		return () => {
			cancelled = true;
			controller.abort();
			if (reconnectTimeout) clearTimeout(reconnectTimeout);
		};
	}, [webStreamActive, token, attachedPlayerId]);

	useEffect(
		() => () => {
			void webAudioClient.current?.disconnect();
		},
		[],
	);

	const handleJoinVoice = async () => {
		if (!token) {
			setJoinError("Please log in before connecting to a voice channel.");
			return;
		}
		setIsJoining(true);
		setJoinError(null);
		try {
			const res = await fetch(`${baseUrl}/music/join`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"ngrok-skip-browser-warning": "true",
				},
				body: JSON.stringify({}),
			});

			const responseText = await res.text();
			let data: { error?: string } = {};
			if (responseText) {
				try {
					data = JSON.parse(responseText);
				} catch {
					if (!res.ok) throw new Error(responseText);
					throw new Error("The server returned an invalid response while connecting to voice.");
				}
			}
			if (!res.ok) {
				throw new Error(data.error || "Failed to join voice channel");
			}

			if (ws && connected && authenticated) {
				ws.send(JSON.stringify({ event: "GetVoice" }));
			}
		} catch (err: any) {
			console.error("Join voice error:", err);
			setJoinError(err.message || "Could not connect to voice channel");
		} finally {
			setIsJoining(false);
		}
	};

	useEffect(() => {
		if (!token) {
			setError("Please login to access the music player.");
			return;
		}

		let destroyed = false;
		let socket: WebSocket;

		const connect = () => {
			socket = new WebSocket(wsUrl);

			socket.onopen = () => {
				setConnected(true);
				setAuthenticated(true);
				setError(null);
				reconnectDelay.current = 1000;

				socket.send(
					JSON.stringify({
						event: "identify",
						token,
					}),
				);
			};

			socket.onmessage = (event) => {
				const data = JSON.parse(event.data);

				switch (data.event) {
					case "authenticated":
						setAuthenticated(true);
						socket.send(JSON.stringify({ event: "GetVoice" }));
						break;

					case "ReplyVoice":
						setVoiceChannel({
							channelName: data.channel?.name || "Unknown Channel",
							guildName: data.guild?.name || "Unknown Guild",
						});
						setIsVoiceConnected(true);
						setError(null);
						break;

					case "statistics":
						if (!webAudioModeRef.current && !webStreamActiveRef.current) {
							setStats(data);
							setVolume(data.volume);
							setIsVoiceConnected(true);
						}
						break;

					case "error":
						if (data.message === "No active voice connection found for user") {
							setIsVoiceConnected(false);
							setVoiceChannel(null);
							setError(null);
						} else {
							setError(data.message);
						}
						break;
				}
			};

			socket.onclose = () => {
				setConnected(false);
				setAuthenticated(false);

				if (!destroyed) {
					const delay = reconnectDelay.current;
					reconnectTimeout.current = setTimeout(connect, delay);
					reconnectDelay.current = Math.min(delay * 2, 30000);
				}
			};

			socket.onerror = () => {
				socket.close();
			};

			setWs(socket);
		};

		connect();

		return () => {
			destroyed = true;

			if (reconnectTimeout.current) {
				clearTimeout(reconnectTimeout.current);
			}

			socket?.close();
		};
	}, [wsUrl, token]);

	// Fetch lyrics when track changes
	useEffect(() => {
		if (!stats?.track?.title) {
			setLyrics(null);
			setRomanizedLyrics(null);
			return;
		}

		// If stats.track already came with lyrics from serializeTrack / metadata:
		const trackWithLyrics = stats.track as typeof stats.track & {
			lyrics?: { text?: string; synced?: string; romanized?: string } | null;
		};
		if (trackWithLyrics.lyrics?.text || trackWithLyrics.lyrics?.synced) {
			const directText =
				trackWithLyrics.lyrics.text || trackWithLyrics.lyrics.synced?.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s?/g, "");
			if (directText) {
				setLyrics(directText);
				setRomanizedLyrics(trackWithLyrics.lyrics.romanized || null);
				return;
			}
		}

		setLyrics(null);
		setRomanizedLyrics(null);

		const params = new URLSearchParams();
		params.set("q", stats.track.title);
		if (stats.track.author) {
			params.set("artist", stats.track.author);
		}
		if (stats.track.duration) {
			params.set("duration", String(stats.track.duration));
		}

		let active = true;
		fetch(`${baseUrl}/music/lyrics?${params.toString()}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				"ngrok-skip-browser-warning": "true",
			},
		})
			.then(async (res) => {
				if (!res.ok && res.status !== 404) {
					throw new Error(`HTTP ${res.status}`);
				}
				return res.json();
			})
			.then((data) => {
				if (!active) return;
				const plainFromSynced = data?.synced?.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s?/g, "");
				const extracted =
					data?.text ||
					data?.lyrics?.text ||
					plainFromSynced ||
					data?.lyrics?.synced?.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]\s?/g, "") ||
					(typeof data?.lyrics === "string" ? data.lyrics : null);

				setLyrics(extracted || "Lyrics not found");
				setRomanizedLyrics(data?.lyrics_romanization || data?.lyrics?.romanized || null);
			})
			.catch((err) => {
				if (!active) return;
				console.error("[MusicPlayerView] Failed to fetch lyrics:", err);
				setLyrics("Lyrics not found");
			});

		return () => {
			active = false;
		};
	}, [stats?.track?.title, stats?.track?.author, stats?.track?.duration, baseUrl, token]);
	// Sync navigator.mediaSession state and action handlers
	useEffect(() => {
		if (!("mediaSession" in navigator) || !stats?.track) return;

		const { track, paused } = stats;

		// Trigger silent audio so the browser activates Media Session controls
		if (audioRef.current) {
			if (!paused) {
				audioRef.current.play().catch(() => {
					console.log("User interaction required to activate Media Session");
				});
			} else {
				audioRef.current.pause();
			}
		}

		// 1. Update Metadata
		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: track.author || "Unknown artist",
			album: "Melody",
			artwork: [
				{
					src: proxyImage(track.thumbnail || botInfo?.avatars),
					sizes: "512x512",
					type: "image/jpeg",
				},
				{
					src: proxyImage(track.thumbnail || botInfo?.avatars),
					sizes: "192x192",
					type: "image/jpeg",
				},
			],
		});

		// 2. Playback state
		navigator.mediaSession.playbackState = paused ? "paused" : "playing";

		// 3. Register Action Handlers
		const actions: [MediaSessionAction, () => void][] = [
			["play", () => sendCommand("pause")],
			["pause", () => sendCommand("pause")],
			["previoustrack", () => sendCommand("back")],
			["nexttrack", () => sendCommand("skip")],
			["stop", () => sendCommand("stop")],
			[
				"seekbackward",
				() => {
					const newPos = Math.max(0, (stats.timestamp || 0) - 10000);
					sendCommand("seek", { position: newPos });
				},
			],
			[
				"seekforward",
				() => {
					const duration = parseDuration(track.duration);
					const newPos = Math.min(duration, (stats.timestamp || 0) + 10000);
					sendCommand("seek", { position: newPos });
				},
			],
		];

		actions.forEach(([action, handler]) => {
			try {
				navigator.mediaSession.setActionHandler(action, handler);
			} catch (error) {
				console.warn(`Action ${action} is not supported`);
			}
		});

		// 4. Update Position State
		try {
			const duration = parseDuration(track.duration) / 1000;
			const position = (stats.timestamp || 0) / 1000;

			if (duration > 0 && position <= duration && "setPositionState" in navigator.mediaSession) {
				navigator.mediaSession.setPositionState({
					duration: duration,
					playbackRate: 1,
					position: position,
				});
			}
		} catch (e) {
			console.error("Error updating PositionState:", e);
		}
	}, [stats?.track, stats?.paused, stats?.timestamp]);
	const handleSearch = async () => {
		const query = searchQuery.trim();
		if (!query || searchState === "loading") return;
		const searchId = ++latestSearchId.current;
		setSearchState("loading");
		setSearchError(null);
		setSearchResults([]);
		try {
			const res = await fetch(`${baseUrl}/music/search?q=${encodeURIComponent(query)}`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			});
			if (!res.ok) throw new Error(`Search failed (${res.status})`);
			const data = await res.json();
			if (searchId !== latestSearchId.current) return;
			if (!Array.isArray(data.results)) throw new Error("The search service returned an invalid response.");
			const results = data.results as Track[];
			setSearchResults(results);
			setSearchState(results.length > 0 ? "success" : "empty");
		} catch (err) {
			if (searchId !== latestSearchId.current) return;
			const message = err instanceof Error ? err.message : "Could not search for music.";
			console.error("Music search failed:", err);
			setSearchError(message);
			setSearchState("error");
		}
	};

	const clearSearch = () => {
		latestSearchId.current += 1;
		setSearchQuery("");
		setSearchResults([]);
		setSearchError(null);
		setSearchState("idle");
	};

	const handleTrackAction = async (track: Track, queueNext = false) => {
		const actionId = track.url || track.title;
		setActiveTrackAction(actionId);
		try {
			if (webAudioMode) {
				if (queueNext) return;
				await playOnWeb(track.url || track.title, 0, false, track);
			} else {
				if (!stats?.track) {
					setStats({
						event: "statistics",
						timestamp: 0,
						listeners: 0,
						tracks: 1,
						volume: volume || 50,
						paused: false,
						repeatMode: "off",
						autoPlay: false,
						lockStatus: false,
						track,
						queue: [],
						related: [],
					});
				} else {
					setStats((prev) =>
						prev ?
							{
								...prev,
								queue: queueNext ? [track, ...prev.queue] : [...prev.queue, track],
								tracks: prev.tracks + 1,
							}
						:	null,
					);
				}
				sendCommand(queueNext ? "Playnext" : "play", {
					trackUrl: track.url,
					...(queueNext ? { TrackPosition: 1 } : {}),
				});
			}
		} finally {
			window.setTimeout(
				() => {
					setActiveTrackAction((current) => (current === actionId ? null : current));
				},
				webAudioMode ? 0 : 500,
			);
		}
	};

	const sendCommand = (event: string, data: any = {}) => {
		if (webAudioModeRef.current) {
			if (!webStreamActiveRef.current) {
				setWebAudioError("Start browser playback by selecting a track from search results.");
				return;
			}

			let action: string;
			let values: Record<string, unknown> = {};
			switch (event.toLowerCase()) {
				case "play":
				case "playnext":
					if (typeof data.trackUrl === "string") void playOnWeb(data.trackUrl);
					return;
				case "pause":
					action = stats?.paused ? "resume" : "pause";
					break;
				case "skip":
					action = "skip";
					break;
				case "seek":
					action = "seek";
					values = { positionMs: data.position };
					break;
				case "volume":
					action = "volume";
					values = { volume: data.volume };
					break;
				case "loop":
					action = "loop";
					values = {
						mode:
							stats?.repeatMode === "off" ? "track"
							: stats?.repeatMode === "track" ? "queue"
							: "off",
					};
					break;
				case "autoplay":
					action = "autoplay";
					values = { enabled: !stats?.autoPlay };
					break;
				case "back":
					setWebAudioError("Previous-track playback is not supported by this player yet.");
					return;
				case "lock":
				case "shuffle":
					setWebAudioError(`${event} is not supported by browser audio playback.`);
					return;
				case "deltrack":
					setWebAudioError("Removing queued tracks is not supported by browser audio playback yet.");
					return;
				default:
					return;
			}
			void sendWebStreamControl(action, values).catch((err) => {
				const message = err instanceof Error ? err.message : "Browser audio control failed";
				console.error("Browser audio control failed:", err);
				setWebAudioError(message);
			});
			return;
		}

		if (ws && authenticated) {
			ws.send(JSON.stringify({ event, ...data }));
		}
	};

	const formatTime = (ms: number | string) => {
		const totalSeconds = typeof ms === "number" ? Math.floor(ms / 1000) : 0;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	};

	if (isMinimized) {
		if (error) {
			return (
				<div className='fixed inset-0 bg-[#050505] flex flex-col items-center justify-center p-4 text-center select-none'>
					<p className='text-vibrant-pink font-bold text-xs'>{error}</p>
				</div>
			);
		}

		if (!stats && !connected && !webAudioMode) {
			return (
				<div className='fixed inset-0 bg-[#050505] flex flex-col items-center justify-center gap-3 p-4 text-center select-none'>
					<div className='w-8 h-8 border-2 border-white/10 border-t-discord rounded-full animate-spin'></div>
					<p className='text-xs text-zinc-400'>Discord player reconnecting…</p>
					<button
						onClick={enterWebAudioMode}
						className='rounded-xl bg-white/10 px-4 py-2 text-[10px] font-bold text-white'>
						Use browser audio
					</button>
				</div>
			);
		}

		if (!stats && !isVoiceConnected && !webAudioMode) {
			return (
				<div className='fixed inset-0 bg-[#050505] flex flex-col items-center justify-center p-4 text-center select-none'>
					<Music className='w-8 h-8 text-zinc-500 mb-2 animate-pulse' />
					<p className='text-zinc-400 font-bold text-xs mb-3'>Not Connected to Voice</p>
					<button
						onClick={handleJoinVoice}
						disabled={isJoining}
						className='px-4 py-2 bg-discord hover:brightness-110 disabled:opacity-50 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all'>
						{isJoining ? "Connecting..." : "Connect Voice"}
					</button>
					<button
						onClick={enterWebAudioMode}
						className='px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all'>
						Use browser audio
					</button>
					{joinError && <p className='text-vibrant-pink font-bold text-[9px] mt-2 truncate w-full px-2'>{joinError}</p>}
				</div>
			);
		}

		return (
			<div className='fixed inset-0 bg-[#050505] flex flex-col overflow-hidden select-none'>
				{/* Thumbnail / Video Container */}
				<div className='relative flex-grow w-full overflow-hidden bg-black flex items-center justify-center'>
					{activeThumbnail ?
						<>
							{/* Blurred Background for aesthetic glow */}
							<img
								src={proxyImage(activeThumbnail)}
								alt=''
								className='absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110'
							/>
							{/* Sharp Image */}
							<img
								src={proxyImage(activeThumbnail)}
								alt={stats?.track?.title || ""}
								className='relative max-w-full max-h-full object-contain z-10 shadow-2xl rounded-lg p-2'
							/>
						</>
					:	<div className='flex flex-col items-center justify-center text-zinc-600 gap-2'>
							<Music className='w-10 h-10 animate-pulse' />
							<span className='text-xs font-bold tracking-widest uppercase'>No Track</span>
						</div>
					}
					{videoBgEnabled && currentVideoUrl && !videoError && (
						<div
							className={`absolute inset-0 z-20 transition-opacity duration-500 ${miniVideoLoaded ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
							<video
								ref={miniVideoRef}
								key={`mini-${currentVideoUrl}`}
								src={currentVideoUrl}
								autoPlay
								loop
								muted
								playsInline
								onLoadedData={() => setMiniVideoLoaded(true)}
								onCanPlay={() => setMiniVideoLoaded(true)}
								onError={(e) => {
									const err = e.currentTarget.error;
									if (!err || err.code === MediaError.MEDIA_ERR_ABORTED) return;
									setVideoError(true);
									setMiniVideoLoaded(false);
								}}
								className='absolute inset-0 w-full h-full object-cover'
							/>
							<div className='absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none' />
						</div>
					)}
				</div>

				{/* Controls Bar at bottom */}
				<div className='h-14 bg-black/60 backdrop-blur-md border-t border-white/5 flex items-center justify-between px-3 shrink-0 gap-3'>
					{/* Title and artist */}
					<div className='flex-grow min-w-0'>
						<div className='font-bold text-xs truncate text-white'>{stats?.track?.title || "Music Engine"}</div>
						<div className='text-[9px] font-bold text-zinc-500 uppercase truncate'>{stats?.track?.author || "Standby"}</div>
					</div>

					{/* Buttons */}
					<div className='flex items-center gap-1 shrink-0'>
						<button
							onClick={() => sendCommand("back")}
							className='p-2 text-zinc-400 hover:text-white transition-colors'
							title='Previous'>
							<SkipBack className='w-4 h-4 fill-current' />
						</button>
						<button
							onClick={() => sendCommand("pause")}
							className='p-2 bg-discord hover:brightness-110 rounded-xl text-white flex items-center justify-center transition-all'
							title='Play/Pause'>
							{stats?.paused ?
								<Play className='w-4 h-4 fill-current' />
							:	<Pause className='w-4 h-4 fill-current' />}
						</button>
						<button
							onClick={() => sendCommand("skip")}
							className='p-2 text-zinc-400 hover:text-white transition-colors'
							title='Next'>
							<SkipForward className='w-4 h-4 fill-current' />
						</button>
					</div>
				</div>
				{webAudioMode && (
					<div className='shrink-0 border-t border-white/5 bg-black/80 p-2 space-y-2'>
						<form
							className='flex gap-2'
							onSubmit={(event) => {
								event.preventDefault();
								void handleSearch();
							}}>
							<input
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder='Search music'
								aria-label='Search music'
								className='cyber-input min-w-0 flex-1 rounded-lg px-3 py-2 text-xs outline-none'
							/>
							<button
								type='submit'
								disabled={!searchQuery.trim() || searchState === "loading"}
								className='cyber-action rounded-lg px-3 text-white disabled:cursor-not-allowed disabled:opacity-40'
								title={searchState === "loading" ? "Searching" : "Search"}>
								{searchState === "loading" ?
									<LoaderCircle className='h-4 w-4 animate-spin' />
								:	<Search className='h-4 w-4' />}
							</button>
							<button
								type='button'
								onClick={toggleWebAudioMode}
								className='rounded-lg bg-white/10 px-2 text-[10px] text-white'>
								Discord
							</button>
						</form>
						{searchResults.slice(0, 3).map((track, index) => (
							<button
								key={`${track.url || track.title}-${index}`}
								onClick={() => void handleTrackAction(track)}
								disabled={activeTrackAction === (track.url || track.title)}
								className='cyber-row flex w-full items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-xs text-white disabled:opacity-60'>
								{activeTrackAction === (track.url || track.title) ?
									<LoaderCircle className='h-3.5 w-3.5 shrink-0 animate-spin text-cyan-200' />
								:	<Play className='h-3.5 w-3.5 shrink-0 text-lime-300' />}
								<span className='truncate'>{track.title}</span>
							</button>
						))}
						{renderTargetPill()}
						{searchState === "loading" && <p className='px-1 font-mono text-[10px] text-cyan-200'>Searching the network...</p>}
						{searchState === "empty" && <p className='px-1 text-[10px] text-zinc-400'>No tracks found. Try another search.</p>}
						{searchState === "error" && <p className='px-1 text-[10px] text-rose-300'>{searchError}</p>}
						{webAudioError && <p className='px-1 text-[10px] text-vibrant-pink'>{webAudioError}</p>}
					</div>
				)}
			</div>
		);
	}

	if (error) {
		return (
			<div className='flex items-center justify-center h-[calc(100vh-64px)]'>
				<div className='glass p-10 rounded-3xl text-center'>
					<p className='text-vibrant-pink font-bold mb-4'>{error}</p>
					<a
						href='#/dashboard'
						className='text-xs uppercase tracking-widest font-black hover:text-discord transition-colors'>
						Go Back
					</a>
				</div>
			</div>
		);
	}

	if (!stats && !connected && !webAudioMode) {
		return (
			<div className='flex h-[calc(100vh-64px)] flex-col items-center justify-center gap-4'>
				<div className='w-12 h-12 border-4 border-white/10 border-t-discord rounded-full animate-spin'></div>
				<p className='text-sm text-zinc-400'>Discord player reconnecting…</p>
				<button
					onClick={enterWebAudioMode}
					className='rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white'>
					Use browser audio
				</button>
			</div>
		);
	}

	if (!stats && !isVoiceConnected && !webAudioMode) {
		return (
			<div className='fixed inset-0 top-16 bg-[#09090b] flex items-center justify-center p-6 overflow-hidden select-none'>
				{/* Animated Background Ambient Glows */}
				<div className='absolute top-1/4 left-1/4 w-96 h-96 bg-discord/10 rounded-full blur-[100px] animate-pulse duration-5000'></div>
				<div className='absolute bottom-1/4 right-1/4 w-96 h-96 bg-vibrant-pink/10 rounded-full blur-[100px] animate-pulse duration-7000'></div>

				<div className='relative glass max-w-md w-full rounded-[2.5rem] p-10 text-center border border-white/5 shadow-2xl z-10 flex flex-col items-center gap-6'>
					<div className='w-20 h-20 bg-discord/10 rounded-3xl flex items-center justify-center border border-discord/20 relative group overflow-hidden shadow-glow'>
						<div className='absolute inset-0 bg-gradient-to-br from-discord/20 to-vibrant-pink/20 opacity-0 group-hover:opacity-100 transition-opacity'></div>
						<Music className='w-10 h-10 text-discord' />
					</div>

					<div className='space-y-2'>
						<h2 className='text-2xl font-black tracking-tight'>Not Connected to Voice</h2>
						<p className='text-sm text-zinc-400 font-medium'>
							Join a Discord voice channel first, then click below to connect Ziji Bot to your channel.
						</p>
					</div>

					<button
						onClick={handleJoinVoice}
						disabled={isJoining}
						className='w-full py-4 bg-discord hover:brightness-110 disabled:opacity-50 text-white rounded-2xl font-bold text-sm transition-all shadow-glow hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer'>
						{isJoining ?
							<>
								<div className='w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin'></div>
								<span>Connecting Bot...</span>
							</>
						:	<span>Connect Bot to Voice</span>}
					</button>
					<button
						onClick={enterWebAudioMode}
						className='px-5 py-3 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-bold text-sm transition-all'>
						Use browser audio instead
					</button>

					{joinError && (
						<div className='text-xs font-bold text-vibrant-pink bg-vibrant-pink/5 border border-vibrant-pink/10 px-4 py-3 rounded-xl w-full'>
							{joinError}
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div
			className={`cyber-player fixed inset-0 ${hideGui ? "top-0 z-[100] cyber-player-zen" : "top-16"} ${hideScrollbar ? "cyber-hide-scrollbars" : ""} flex overflow-hidden select-none`}
			style={
				{
					"--bg-video-opacity": `${bgOpacity / 100}`,
					"--bg-video-blur": `${bgBlur}px`,
					"--gui-opacity": `${guiOpacity / 100}`,
					"--gui-blur": `${guiBlur}px`,
				} as React.CSSProperties
			}>
			{/* Video Background Layer (Master Video Source) */}
			{/* Artwork Ambient Base Background - Always rendered whenever a thumbnail is available */}
			{activeThumbnail && (
				<div className='pointer-events-none absolute inset-0 z-0 overflow-hidden'>
					<img
						src={proxyImage(activeThumbnail)}
						alt=''
						className='h-full w-full object-cover scale-110 transition-all duration-700'
						style={{
							opacity: hideGui ? 0.9 : (bgOpacity / 100) * 0.5,
							filter: hideGui ? "blur(4px)" : `blur(${Math.max(16, bgBlur * 2.5)}px)`,
						}}
					/>
					<div
						className={`absolute inset-0 transition-all duration-500 ${hideGui ? "bg-black/40" : "bg-gradient-to-t from-[#080b10] via-[#080b10]/60 to-[#080b10]/80"}`}
					/>
				</div>
			)}
			{/* Video Background Layer (Overlaid on top of artwork base, smoothly fading in when ready) */}
			{(videoBgEnabled || videoCanvasMode) && currentVideoUrl && !videoError && (
				<div
					className={`pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-700 ${
						videoBgEnabled && videoLoaded ? "opacity-100" : "opacity-0 -z-10"
					}`}>
					<video
						ref={videoBgRef}
						key={`bg-${currentVideoUrl}`}
						src={currentVideoUrl}
						crossOrigin='anonymous'
						autoPlay
						loop
						muted
						playsInline
						onLoadedData={() => setVideoLoaded(true)}
						onCanPlay={(e) => {
							setVideoLoaded(true);
							if (stats?.paused) {
								e.currentTarget.pause();
							} else {
								e.currentTarget.play().catch(() => {});
							}
						}}
						onError={(e) => {
							const err = e.currentTarget.error;
							if (!err || err.code === MediaError.MEDIA_ERR_ABORTED) return;
							setVideoError(true);
							setVideoLoaded(false);
						}}
						className={`h-full w-full object-cover transition-all duration-500 ${hideGui ? "scale-100" : "scale-105"}`}
						style={{
							opacity: hideGui ? 1 : bgOpacity / 100,
							filter: hideGui ? "none" : `blur(${bgBlur}px)`,
						}}
					/>
					<div
						className='absolute inset-0 transition-opacity duration-500 pointer-events-none'
						style={{
							background:
								hideGui ?
									"linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 20%, transparent 80%, rgba(0, 0, 0, 0.5) 100%)"
								:	`linear-gradient(to top, rgba(8, 11, 16, ${Math.max(0.12, 0.9 - (bgOpacity / 100) * 0.65)}), rgba(8, 11, 16, ${Math.max(0.05, 0.5 - (bgOpacity / 100) * 0.45)}), rgba(8, 11, 16, ${Math.max(0.12, 0.8 - (bgOpacity / 100) * 0.55)}))`,
						}}
					/>
				</div>
			)}
			{/* Background Animated Ambient Blobs */}
			<div className='pointer-events-none absolute left-1/3 top-10 h-80 w-80 rounded-full bg-cyan-400/10 blur-[120px]'></div>
			<div className='pointer-events-none absolute bottom-10 right-1/4 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-[120px]'></div>
			{/* Sidebar - Desktop Only */}
			<div
				className={`cyber-sidebar relative z-10 hidden w-64 shrink-0 flex-col gap-8 border-r border-white/10 p-6 lg:flex transition-all duration-500 ease-in-out ${
					hideGui ? "opacity-0 -translate-x-full pointer-events-none" : "opacity-100 translate-x-0"
				}`}>
				<div className='flex items-center gap-3'>
					<div className='flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.2)]'>
						<Music className='h-5 w-5 text-cyan-200' />
					</div>
					<div>
						<h2 className='font-black text-xl tracking-[0.18em] text-white'>
							PLAYER<span className='text-cyan-300'>//</span>FM
						</h2>
						<p className='text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500'>Night City audio</p>
					</div>
				</div>

				<div className='-mb-4 space-y-2'>
					<p className='px-1 text-[9px] font-black uppercase tracking-[0.24em] text-zinc-500'>Output</p>
					{renderStreamSwitch(true)}
				</div>

				<nav className='space-y-1'>
					{[
						{
							icon: LayoutGrid,
							label: "Home",
							active: searchState === "idle" && !searchQuery && !showVisualSettings,
							onClick: clearSearch,
						},
						{
							icon: Search,
							label: "Search",
							active: (Boolean(searchQuery) || searchState !== "idle") && !showVisualSettings,
							onClick: () => searchInputRef.current?.focus(),
						},
						{
							icon: ListMusic,
							label: "Your Library",
							active: false,
							onClick: () => {
								if (searchState !== "idle") clearSearch();
								window.setTimeout(() => queueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
							},
						},
						{
							icon: EyeOff,
							label: "Hide GUI (H)",
							active: false,
							onClick: () => setHideGui(true),
						},
						{
							icon: SlidersHorizontal,
							label: "Visual & Blur",
							active: showVisualSettings,
							onClick: () => setShowVisualSettings(true),
						},
					].map((item, idx) => (
						<button
							key={idx}
							onClick={item.onClick}
							className={`w-full flex items-center gap-4 rounded-xl border px-4 py-3 transition-all ${item.active ? "border-cyan-300/20 bg-cyan-300/[0.08] font-bold text-cyan-100" : "border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-white"}`}>
							<item.icon className='w-5 h-5' />
							<span className='text-sm'>{item.label}</span>
						</button>
					))}
				</nav>

				<div className='mt-auto'>
					<div className='cyber-card rounded-2xl p-4'>
						<p className='mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300'>System status</p>
						<div className='text-sm font-bold text-white flex items-center gap-2'>
							<div className='h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_12px_rgba(190,242,100,0.8)] animate-pulse' />
							<span>
								{webAudioMode ?
									webAudioConnected ?
										"Browser audio connected"
									:	"Browser audio ready"
								: connected ?
									"Live Sync"
								:	"Reconnecting..."}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content Area: one fixed page. Only the list panel scrolls, so the layout never resizes. */}
			<div
				className={`relative z-10 flex min-h-0 min-w-0 flex-grow flex-col pb-20 md:pb-0 transition-all duration-500 ease-in-out ${
					hideGui ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
				}`}>
				<div className='mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col gap-3 p-4 md:gap-4 md:p-8'>
					{/* Search Bar */}
					<form
						className='flex shrink-0 items-center gap-3'
						onSubmit={(event) => {
							event.preventDefault();
							void handleSearch();
						}}>
						<div className='relative flex-grow'>
							<Search className='absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70' />
							<input
								ref={searchInputRef}
								placeholder='Search songs, artists, albums...'
								aria-label='Search songs, artists, albums'
								className='cyber-input w-full rounded-xl py-3.5 ps-12 pe-4 text-sm outline-none transition-all'
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value);
									latestSearchId.current += 1;
									setSearchResults([]);
									if (searchState !== "idle") {
										setSearchState("idle");
										setSearchError(null);
									}
								}}
							/>
							{searchQuery && (
								<button
									type='button'
									onClick={clearSearch}
									aria-label='Clear search'
									className='absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white'>
									<X className='h-4 w-4' />
								</button>
							)}
						</div>
						<button
							type='submit'
							disabled={!searchQuery.trim() || searchState === "loading"}
							aria-label={searchState === "loading" ? "Searching" : "Search"}
							className='cyber-action flex min-w-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-3.5 text-sm font-black uppercase tracking-wider transition-all disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[108px] sm:px-5'>
							{searchState === "loading" ?
								<>
									<LoaderCircle className='h-4 w-4 animate-spin' />
									<span className='hidden sm:inline'>Searching...</span>
								</>
							:	<>
									<Search className='h-4 w-4' />
									<span className='hidden sm:inline'>Search</span>
								</>
							}
						</button>
					</form>

					{/* Status row: constant height so nothing jumps when the mode changes */}
					<div
						className='flex h-7 shrink-0 items-center gap-2 text-[11px]'
						role='status'
						aria-live='polite'>
						<span className='lg:hidden'>{renderStreamSwitch(false)}</span>
						<span
							className={`min-w-0 flex-1 truncate font-mono ${webAudioMode && webAudioError ? "text-rose-300" : "text-zinc-400"}`}>
							{webAudioMode ?
								webAudioError || webAudioStatus || "Select a track to start browser playback."
							: connected ?
								"Discord voice · live sync"
							:	"Reconnecting..."}
						</span>
						{webAudioMode && renderTargetPill()}
					</div>

					<div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${hideScrollbar ? "no-scrollbar" : "custom-scrollbar"}`}>
						<div className='flex min-h-full flex-col'>
							{/* Results or Queue */}
							{searchState === "loading" ?
								<div
									className='cyber-card space-y-4 rounded-2xl p-5 md:p-6'
									role='status'
									aria-live='polite'>
									<div className='flex items-center gap-3 text-cyan-100'>
										<LoaderCircle className='h-5 w-5 animate-spin text-cyan-300' />
										<div>
											<h3 className='font-bold'>Searching the network...</h3>
											<p className='mt-0.5 truncate text-xs text-zinc-500'>Looking for “{searchQuery.trim()}”</p>
										</div>
									</div>
									{[0, 1, 2].map((item) => (
										<div
											key={item}
											className='flex animate-pulse items-center gap-4 rounded-xl bg-white/[0.025] p-3'>
											<div className='h-12 w-12 shrink-0 rounded-lg bg-white/[0.07]' />
											<div className='min-w-0 flex-1 space-y-2'>
												<div className='h-3 w-2/3 rounded bg-white/[0.08]' />
												<div className='h-2 w-1/3 rounded bg-white/[0.05]' />
											</div>
										</div>
									))}
								</div>
							: searchState === "error" ?
								<div
									className='cyber-card my-auto flex items-start gap-4 rounded-2xl p-5 md:p-6'
									role='alert'>
									<CircleAlert className='mt-0.5 h-5 w-5 shrink-0 text-rose-300' />
									<div className='min-w-0 flex-1'>
										<h3 className='font-bold text-white'>Search failed</h3>
										<p className='mt-1 break-words text-sm text-zinc-400'>{searchError}</p>
										<button
											onClick={() => void handleSearch()}
											className='mt-4 rounded-lg border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-2 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-200/[0.15]'>
											Try again
										</button>
									</div>
								</div>
							: searchState === "empty" ?
								<div
									className='cyber-card my-auto flex flex-col items-center rounded-2xl px-5 py-12 text-center'
									role='status'>
									<div className='mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06]'>
										<Search className='h-6 w-6 text-cyan-200' />
									</div>
									<h3 className='text-lg font-black text-white'>No tracks found</h3>
									<p className='mt-2 max-w-sm text-sm text-zinc-400'>
										Nothing matched “{searchQuery.trim()}”. Try a different title, artist, or link.
									</p>
									<button
										onClick={() => searchInputRef.current?.focus()}
										className='mt-5 rounded-lg border border-cyan-200/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-cyan-100 transition-colors hover:bg-cyan-200/[0.08]'>
										Edit search
									</button>
								</div>
							: searchResults.length > 0 ?
								<div className='space-y-6'>
									<div className='flex items-center justify-between'>
										<div>
											<h3 className='font-black text-2xl tracking-tight md:text-3xl'>Search Results</h3>
											<p className='mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500'>
												{searchResults.length} {searchResults.length === 1 ? "track" : "tracks"} found
											</p>
										</div>
										<button
											onClick={clearSearch}
											className='rounded-lg px-3 py-2 text-xs font-bold uppercase text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white'>
											Clear
										</button>
									</div>
									<div
										className='grid gap-2'
										onKeyDown={(event) => {
											if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
											const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-track-row]"));
											const index = rows.indexOf(document.activeElement as HTMLElement);
											if (index < 0) return;
											event.preventDefault();
											const next = Math.min(rows.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)));
											rows[next]?.focus();
										}}>
										{searchResults.map((track, idx) => {
											const trackKey = track.url || track.title;
											const isCurrent = Boolean(track.url) && track.url === stats?.track?.url;
											const queuedAt = track.url ? (stats?.queue?.findIndex((queued) => queued.url === track.url) ?? -1) : -1;
											return (
												<div
													key={`${trackKey}-${idx}`}
													data-marquee-host
													data-track-row
													tabIndex={0}
													role='button'
													aria-label={`Play ${track.title}`}
													onClick={() => void handleTrackAction(track)}
													onKeyDown={(event) => {
														if (event.target !== event.currentTarget) return;
														if (event.key === "Enter" || event.key === " ") {
															event.preventDefault();
															void handleTrackAction(track);
														}
													}}
													className={`cyber-row group flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/60 md:gap-4 ${isCurrent ? "ring-1 ring-lime-300/30" : ""}`}>
													<div className='flex shrink-0 items-center gap-1.5 md:gap-2'>
														<button
															type='button'
															title='Play track'
															aria-label={`Play ${track.title}`}
															disabled={activeTrackAction === trackKey}
															onClick={(event) => {
																event.stopPropagation();
																void handleTrackAction(track);
															}}
															className='cyber-action flex min-h-10 min-w-10 items-center justify-center rounded-lg p-2 transition-all active:scale-95 disabled:cursor-wait disabled:opacity-60'>
															{activeTrackAction === trackKey ?
																<LoaderCircle className='h-4 w-4 animate-spin' />
															:	<Play className='h-4 w-4 fill-current' />}
														</button>
														{!webAudioMode && (
															<button
																type='button'
																title='Play next'
																onClick={(event) => {
																	event.stopPropagation();
																	void handleTrackAction(track, true);
																}}
																className='flex min-h-10 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-widest text-zinc-200 transition-all hover:border-cyan-200/20 hover:bg-cyan-200/[0.06] active:scale-95'>
																Next
															</button>
														)}
													</div>
													<img
														src={proxyImage(track.thumbnail ?? undefined)}
														alt=''
														loading='lazy'
														className='h-10 w-10 shrink-0 rounded-xl object-cover md:h-12 md:w-12'
													/>
													<div className='min-w-0 flex-grow'>
														<h4 className='text-xs font-bold md:text-sm'>
															<MarqueeText text={track.title} />
														</h4>
														<div className='flex items-center gap-2'>
															<p className='min-w-0 truncate text-[9px] font-bold uppercase tracking-wider text-zinc-500 md:text-[10px]'>
																{track.author}
															</p>
															{isCurrent && (
																<span className='shrink-0 rounded-full bg-lime-300/15 px-1.5 py-px text-[8px] font-black uppercase tracking-wider text-lime-200'>
																	Now playing
																</span>
															)}
															{!isCurrent && queuedAt >= 0 && (
																<span className='shrink-0 rounded-full bg-cyan-300/10 px-1.5 py-px text-[8px] font-black uppercase tracking-wider text-cyan-200'>
																	In queue #{queuedAt + 1}
																</span>
															)}
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							:	<div className='flex min-h-full flex-col gap-8'>
									{/* Related Tracks Section */}
									{stats?.related && stats.related.length > 0 && (
										<div className='space-y-6'>
											<div className='flex items-center justify-between'>
												<h3 className='font-black text-3xl tracking-tight'>Related Songs</h3>
												<p className='text-[10px] font-black text-zinc-500 uppercase tracking-widest'>Suggestions</p>
											</div>
											<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
												{stats.related.slice(0, 4).map((track, idx) => (
													<div
														key={idx}
														data-marquee-host
														className='cyber-card flex cursor-pointer items-center gap-4 rounded-2xl p-4 transition-all group'
														onClick={() => {
															if (webAudioMode) void playOnWeb(track.url || track.title);
															else sendCommand("play", { trackUrl: track.url });
														}}>
														<div className='relative w-16 h-16 shrink-0'>
															<img
																src={proxyImage(track.thumbnail ?? undefined)}
																alt={track.title}
																className='h-full w-full rounded-xl object-cover'
															/>
															<div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl'>
																<Play className='w-6 h-6 text-white fill-current' />
															</div>
														</div>
														<div className='flex-grow min-w-0'>
															<h4 className='text-sm font-bold'>
																<MarqueeText text={track.title} />
															</h4>
															<p className='text-[10px] font-bold text-zinc-500 uppercase truncate'>{track.author}</p>
														</div>
													</div>
												))}
											</div>
										</div>
									)}

									<div
										ref={queueSectionRef}
										className='flex flex-1 flex-col gap-4'>
										<div className='flex items-center justify-between'>
											<h3 className='font-black text-2xl md:text-3xl tracking-tight'>Up Next</h3>
											<div className='flex gap-4 text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest'>
												<span>{stats?.tracks || 0} tracks</span>
											</div>
										</div>

										<div className='flex flex-1 flex-col gap-1'>
											{stats?.queue && stats.queue.length > 0 ?
												stats.queue.map((track, idx) => (
													<div
														key={idx}
														data-marquee-host
														className='cyber-row group flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-all md:gap-4 md:p-4'>
														<span className='w-4 md:w-6 text-center font-bold text-xs md:text-sm text-zinc-600 group-hover:text-discord transition-colors'>
															{idx + 1}
														</span>
														<img
															src={proxyImage(track.thumbnail ?? undefined)}
															alt={track.title}
															className='w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover border border-white/5 shadow-lg'
														/>
														<div className='min-w-0 flex-grow'>
															<h4 className='text-xs font-bold md:text-sm'>
																<MarqueeText text={track.title} />
															</h4>
															<p className='text-[9px] md:text-[10px] uppercase font-bold text-zinc-500 tracking-wider truncate'>
																{track.author}
															</p>
														</div>
														<div className='flex items-center gap-1 md:gap-2'>
															<span className='text-[9px] md:text-[10px] font-mono text-zinc-500 opacity-50 group-hover:hidden'>
																{formatDisplayDuration(track.duration)}
															</span>
															<button
																title='DelTrack'
																aria-label={`Remove ${track.title} from queue`}
																disabled={webAudioMode}
																onClick={(e) => {
																	e.stopPropagation();
																	sendCommand("DelTrack", {
																		TrackPosition: idx + 1,
																	});
																}}
																className='flex p-2 text-zinc-500 transition-colors hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30 md:hidden md:group-hover:flex'>
																<Trash2 className='w-3.5 h-3.5 md:w-4 md:h-4' />
															</button>
															<button
																title={webAudioMode ? "Queue removal is not supported in browser audio" : "Remove from queue"}
																aria-label={`Remove ${track.title} from queue`}
																disabled={webAudioMode}
																onClick={(e) => {
																	e.stopPropagation();
																	sendCommand("DelTrack", {
																		TrackPosition: idx + 1,
																	});
																}}
																className='hidden p-2 text-zinc-500 transition-colors hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30 md:group-hover:flex'>
																<Trash2 className='h-4 w-4' />
															</button>
														</div>
													</div>
												))
											:	<div className='my-auto flex flex-col items-center gap-4 py-10 text-center opacity-30'>
													<Music className='w-12 h-12' />
													<p className='italic font-medium'>Your queue is empty</p>
												</div>
											}
										</div>
									</div>
								</div>
							}
						</div>
					</div>
				</div>
			</div>

			{/* Mini Player - Mobile Only */}
			<div
				className={`cyber-mini fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 border-t p-3 md:hidden transition-all duration-300 ${
					hideGui ? "opacity-0 translate-y-full pointer-events-none" : "opacity-100 translate-y-0"
				}`}
				onClick={() => setIsPlayerOpen(true)}>
				<div className='relative w-12 h-12 shrink-0'>
					<img
						src={proxyImage(activeThumbnail ?? undefined)}
						alt=''
						className='h-full w-full rounded-lg border border-cyan-200/20 object-cover'
					/>
					<div className='absolute inset-0 bg-cyan-300/20 blur-xl'></div>
				</div>
				<div className='flex-grow min-w-0'>
					<h4 className='font-bold text-sm truncate'>{stats?.track?.title || "Not Playing"}</h4>
					<p className='truncate text-[10px] font-bold uppercase text-cyan-100/50'>
						{stats?.track?.author || "Night City audio"}
					</p>
				</div>
				<div className='flex items-center gap-1'>
					<button
						onClick={(e) => {
							e.stopPropagation();
							sendCommand("pause");
						}}
						className='cyber-control rounded-xl p-3 text-cyan-100'>
						{stats?.paused ?
							<Play className='w-4 h-4 fill-current' />
						:	<Pause className='w-4 h-4 fill-current' />}
					</button>
					<button
						title='skip'
						onClick={(e) => {
							e.stopPropagation();
							sendCommand("skip");
						}}
						className='cyber-skip p-3 text-zinc-400'>
						<SkipForward className='w-4 h-4 fill-current' />
					</button>
				</div>
				<div
					className='cyber-progress-fill absolute left-0 top-0 h-[2px]'
					style={{ width: `${progress}%` }}
				/>
			</div>

			{/* Now Playing Panel */}
			<div
				className={`cyber-now-playing relative z-10 flex shrink-0 flex-col overflow-hidden border-l border-cyan-300/10 transition-all duration-500 ease-out ${
					hideGui ? "opacity-0 translate-x-full pointer-events-none" : "opacity-100 translate-x-0"
				} ${isPlayerOpen ? "fixed inset-0 h-dvh" : "hidden md:relative md:flex md:w-[clamp(320px,28vw,450px)]"}`}>
				<div
					className={`cyber-now-playing-content flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-6 md:gap-8 md:p-8 ${
						hideScrollbar ? "no-scrollbar" : "custom-scrollbar"
					}`}>
					<div className='flex items-start justify-between shrink-0'>
						{isPlayerOpen ?
							<button
								onClick={() => setIsPlayerOpen(false)}
								className='p-3 rounded-xl bg-white/[0.04] text-zinc-500 hover:text-cyan-200 transition-all'
								title='Close'>
								<SkipBack className='w-5 h-5 -rotate-90' />
							</button>
						:	<button
								type='button'
								title='Visual & Blur Settings'
								aria-label='Visual and blur settings'
								onClick={() => setShowVisualSettings(true)}
								className={`p-3 rounded-xl transition-all ${
									showVisualSettings ? "bg-cyan-300 text-[#071014]" : "bg-white/[0.04] text-zinc-500 hover:text-cyan-200"
								}`}>
								<SlidersHorizontal className='w-5 h-5' />
							</button>
						}

						{/* Center */}
						<div className='flex flex-col items-center flex-1 px-4'>
							<p className='text-[10px] font-black uppercase tracking-[0.3em] text-cyan-200'>Now Playing</p>
							<p className='mt-1 font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-600'>// audio feed active</p>

							{voiceChannel && (
								<div className='mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-lime-300'>
									<span className='h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-lime-300 shadow-[0_0_10px_rgba(190,242,100,0.8)]' />
									<span className='truncate max-w-[220px]'>{voiceChannel.channelName}</span>
								</div>
							)}
						</div>

						<div className='flex items-center gap-1.5'>
							{isPlayerOpen && (
								<button
									type='button'
									title='Visual & Blur Settings'
									onClick={() => setShowVisualSettings(true)}
									className={`p-3 rounded-xl transition-all ${
										showVisualSettings ? "bg-cyan-300 text-[#071014]" : "bg-white/[0.04] text-zinc-500 hover:text-cyan-200"
									}`}>
									<SlidersHorizontal className='w-5 h-5' />
								</button>
							)}

							<button
								type='button'
								title='Hide GUI for Video (H)'
								aria-label='Hide GUI to watch video'
								onClick={() => setHideGui(true)}
								className='rounded-xl p-3 bg-white/[0.04] text-zinc-500 hover:text-cyan-200 hover:bg-cyan-300/10 transition-all'>
								<EyeOff className='w-5 h-5' />
							</button>

							<button
								type='button'
								title={videoBgEnabled ? "Disable video background" : "Enable video background"}
								onClick={() => {
									const next = !videoBgEnabled;
									setVideoBgEnabled(next);
									try {
										localStorage.setItem("ziji-video-bg", String(next));
									} catch {}
								}}
								className={`rounded-xl p-3 transition-all ${
									videoBgEnabled ?
										"bg-cyan-300/10 text-cyan-200 border border-cyan-300/30 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
									:	"bg-white/[0.04] text-zinc-600 hover:text-zinc-400"
								}`}>
								{videoBgEnabled ?
									<Video className='w-5 h-5' />
								:	<VideoOff className='w-5 h-5' />}
							</button>

							<button
								title='Lyrics'
								onClick={() => setShowLyrics(!showLyrics)}
								className={`rounded-xl p-3 transition-all ${
									showLyrics ? "bg-cyan-300 text-[#071014]" : "bg-white/[0.04] text-zinc-500 hover:text-cyan-200"
								}`}>
								<LayoutGrid className='w-5 h-5' />
							</button>
						</div>
					</div>
					<AnimatePresence mode='wait'>
						{showLyrics ?
							<motion.div
								key='lyrics'
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								className={`cyber-card flex-grow overflow-y-auto rounded-2xl p-8 ${
									hideScrollbar ? "no-scrollbar" : "custom-scrollbar"
								}`}>
								<div className='mb-6 flex items-center justify-between'>
									<p className='text-[10px] font-bold uppercase tracking-widest text-cyan-300'>Lyrics</p>
									{romanizedLyrics ?
										<button
											type='button'
											onClick={() => setShowRomanized(!showRomanized)}
											className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
												showRomanized ? "bg-cyan-300 text-[#071014]" : "bg-white/[0.06] text-zinc-400 hover:text-cyan-200"
											}`}>
											{showRomanized ? "Romaji" : "Original"}
										</button>
									:	null}
								</div>
								<div className='whitespace-pre-wrap font-bold text-xl leading-relaxed text-zinc-300'>
									{(showRomanized && romanizedLyrics ? romanizedLyrics : lyrics) || "Searching for lyrics..."}
								</div>
							</motion.div>
						:	<motion.div
								key='cover'
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className='cyber-now-playing-cover flex min-h-0 flex-grow flex-col justify-center gap-6'>
								<div className='cyber-art-frame relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl'>
									<img
										src={proxyImage(activeThumbnail || botInfo?.avatars)}
										alt='Album Art'
										className='cyber-artwork h-full w-full rounded-xl object-cover'
									/>
									{videoCanvasMode && currentVideoUrl && !videoError && <VideoCanvas videoRef={videoBgRef} />}
									<div className='pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-md border border-cyan-200/20 bg-[#071014]/80 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100 backdrop-blur'>
										<span className='h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300' />
										{videoCanvasMode && currentVideoUrl && !videoError ? "Video canvas active" : "Now transmitting"}
									</div>

									{currentVideoUrl && !videoError && (
										<button
											type='button'
											onClick={() => setVideoCanvasMode(!videoCanvasMode)}
											title={videoCanvasMode ? "Switch to album cover" : "Switch to live video canvas"}
											className='absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-lg border border-cyan-200/20 bg-[#071014]/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200 backdrop-blur transition-all hover:bg-cyan-300 hover:text-[#071014]'>
											{videoCanvasMode ?
												<Film className='h-3 w-3' />
											:	<Video className='h-3 w-3' />}
											<span>{videoCanvasMode ? "Cover" : "Canvas"}</span>
										</button>
									)}
								</div>

								<div className='min-w-0 space-y-1 px-2 text-center md:space-y-2'>
									<div
										data-marquee-host
										className='w-full min-w-0 overflow-hidden'>
										<motion.h2 className='block max-w-full font-black text-2xl tracking-tight text-white md:text-3xl'>
											<MarqueeText text={stats?.track?.title || "Music Engine"} />
										</motion.h2>
									</div>
									<p className='text-xs font-bold uppercase tracking-[0.2em] text-cyan-100/60 md:text-sm'>
										{stats?.track?.author || "Standby Mode"}
									</p>
								</div>
							</motion.div>
						}
					</AnimatePresence>

					<div className='cyber-now-playing-controls shrink-0 space-y-4 pt-2'>
						<div className='space-y-3'>
							<div className='cyber-progress-track relative h-1.5 w-full cursor-pointer rounded-full'>
								<div
									className='absolute inset-0 z-20 cursor-pointer'
									onClick={(e) => {
										if (!stats?.track?.duration) return;
										const rect = e.currentTarget.getBoundingClientRect();
										const x = e.clientX - rect.left;
										const pct = x / rect.width;
										const durationMs = parseDuration(stats.track.duration);
										sendCommand("seek", {
											position: Math.floor(pct * durationMs),
										});
									}}
								/>
								<motion.div
									className='cyber-progress-fill absolute left-0 top-0 z-10 h-full rounded-full'
									initial={{ width: 0 }}
									animate={{ width: `${progress}%` }}
								/>
							</div>
							<div className='flex justify-between px-1 font-mono text-[10px] font-bold text-zinc-500'>
								<span>{formatTime(stats?.timestamp || 0)}</span>
								<span>{formatDisplayDuration(stats?.track?.duration || "0:00")}</span>
							</div>
						</div>

						<div className='flex items-center justify-center gap-3 md:gap-4 flex-wrap'>
							{/* Primary Controls Row */}
							<div className='cyber-now-playing-buttons my-1 flex items-center justify-center gap-4 md:gap-6'>
								<button
									onClick={() => sendCommand("Loop")}
									aria-label='Loop mode'
									aria-pressed={Boolean(stats?.repeatMode && stats.repeatMode !== "off")}
									className={`cyber-control rounded-xl p-2.5 transition-colors ${stats?.repeatMode && stats.repeatMode !== "off" ? "text-cyan-200" : "text-zinc-600"}`}
									title='Loop Mode'>
									<Repeat className='w-4.5 h-4.5' />
								</button>
								<button
									onClick={() => sendCommand("AutoPlay")}
									aria-label='Toggle autoplay'
									aria-pressed={Boolean(stats?.autoPlay)}
									className={`cyber-control rounded-xl p-2.5 transition-colors ${stats?.autoPlay ? "text-lime-300" : "text-zinc-600"}`}
									title='AutoPlay'>
									<Baseline className='w-4.5 h-4.5' />
								</button>{" "}
								<button
									title='back'
									aria-label='Previous track'
									onClick={() => sendCommand("back")}
									className='cyber-skip text-zinc-500 transition-colors'>
									<SkipBack className='w-6 h-6 fill-current' />
								</button>
								<button
									onClick={() => sendCommand("pause")}
									aria-label={stats?.paused ? "Play" : "Pause"}
									className='cyber-play-button flex h-16 w-16 items-center justify-center rounded-2xl text-[#081013] transition-transform active:scale-95'>
									{stats?.paused ?
										<Play className='w-6 h-6 fill-current translate-x-0.5' />
									:	<Pause className='w-6 h-6 fill-current' />}
								</button>
								<button
									title='skip'
									aria-label='Next track'
									onClick={() => sendCommand("skip")}
									className='cyber-skip text-zinc-500 transition-colors'>
									<SkipForward className='w-6 h-6 fill-current' />
								</button>
								<button
									onClick={() => sendCommand("Lock")}
									aria-label='Lock player'
									aria-pressed={Boolean(stats?.lockStatus)}
									className={`cyber-control rounded-xl p-2.5 transition-colors ${stats?.lockStatus ? "text-fuchsia-300" : "text-zinc-600"}`}
									title='Lock Player'>
									<LockKeyhole className='w-4.5 h-4.5' />
								</button>
								<button
									onClick={() => sendCommand("Shuffle")}
									aria-label='Shuffle queue'
									className='cyber-control rounded-xl p-2.5 text-zinc-600 transition-colors hover:text-white'
									title='Shuffle'>
									<Shuffle className='w-4.5 h-4.5' />
								</button>
							</div>
						</div>

						<div className='cyber-volume flex items-center gap-4 rounded-xl border px-4 py-3'>
							<Volume2 className='h-4 w-4 text-cyan-200/60' />
							<div className='cyber-progress-track relative h-1 flex-grow cursor-pointer rounded-full'>
								<input
									title='setVolume'
									aria-label='Volume'
									type='range'
									min='0'
									max='100'
									value={volume}
									onChange={(e) => {
										const val = parseInt(e.target.value);
										setVolume(val);
										sendCommand("volume", { volume: val });
									}}
									className='absolute inset-0 w-full opacity-0 z-10 cursor-pointer'
								/>
								<div
									className='cyber-progress-fill absolute left-0 top-0 h-full rounded-full'
									style={{ width: `${volume}%` }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Zen Mode Floating HUD (When GUI is hidden to watch video) */}
			{hideGui && (
				<div
					className={`fixed inset-x-0 bottom-6 z-[110] flex justify-center px-4 transition-all duration-500 pointer-events-none ${
						showZenControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
					}`}>
					<div className='pointer-events-auto flex items-center gap-2 sm:gap-4 rounded-2xl border border-cyan-300/30 bg-[#080d14]/85 px-3.5 py-2.5 sm:px-5 sm:py-3 shadow-[0_12px_48px_rgba(0,0,0,0.8),0_0_24px_rgba(34,211,238,0.2)] backdrop-blur-2xl'>
						{/* Track info with thumbnail */}
						{stats?.track && (
							<div className='flex items-center gap-2.5 max-w-[150px] sm:max-w-[240px] md:max-w-[300px] min-w-0 pr-3 border-r border-white/10'>
								{stats.track.thumbnail && (
									<img
										src={proxyImage(stats.track.thumbnail)}
										alt=''
										className='h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover border border-cyan-300/30 shrink-0'
									/>
								)}
								<div className='min-w-0'>
									<p className='truncate text-xs font-bold text-white'>{stats.track.title}</p>
									<p className='truncate text-[10px] font-mono text-cyan-300/70'>{stats.track.author || "Unknown"}</p>
								</div>
							</div>
						)}

						{/* Playback Controls */}
						<div className='flex items-center gap-1'>
							<button
								type='button'
								onClick={() => sendCommand("pause")}
								title={stats?.paused ? "Play" : "Pause"}
								className='cyber-play-button flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition-all active:scale-95'>
								{stats?.paused ?
									<Play className='h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current' />
								:	<Pause className='h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current' />}
							</button>
							<button
								type='button'
								onClick={() => sendCommand("skip")}
								title='Skip'
								className='p-2 rounded-lg text-zinc-400 hover:text-cyan-200 hover:bg-white/5 transition-all'>
								<SkipForward className='h-4 w-4' />
							</button>
						</div>

						{/* Unhide GUI Button */}
						<button
							type='button'
							onClick={() => setHideGui(false)}
							className='flex items-center gap-2 rounded-xl bg-cyan-300 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-[#080b10] shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all hover:bg-cyan-200 active:scale-95'
							title='Show GUI (Press H or Esc)'>
							<Eye className='h-4 w-4' />
							<span className='hidden sm:inline'>Show GUI</span>
							<span className='font-mono text-[10px] opacity-75 sm:hidden'>H</span>
						</button>

						{/* Fullscreen Button */}
						<button
							type='button'
							onClick={toggleFullscreen}
							className='p-2 rounded-lg text-zinc-400 hover:text-cyan-200 hover:bg-white/5 transition-all'
							title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
							{isFullscreen ?
								<Minimize className='h-4 w-4' />
							:	<Maximize className='h-4 w-4' />}
						</button>
					</div>
				</div>
			)}

			{/* Visual & Blur Controls Modal */}
			<AnimatePresence>
				{showVisualSettings && (
					<div
						className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'
						onClick={() => setShowVisualSettings(false)}>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 10 }}
							onClick={(e) => e.stopPropagation()}
							className='cyber-card relative w-full max-w-md rounded-2xl border border-cyan-300/30 p-6 shadow-2xl space-y-6'
							style={{
								background: "rgba(10, 15, 22, 0.96)",
								backdropFilter: "blur(24px)",
							}}>
							{/* Header */}
							<div className='flex items-center justify-between border-b border-cyan-300/10 pb-4'>
								<div className='flex items-center gap-3'>
									<div className='flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10'>
										<SlidersHorizontal className='h-4 w-4 text-cyan-200' />
									</div>
									<div>
										<h3 className='text-sm font-black uppercase tracking-wider text-white'>Visual & Blur Settings</h3>
										<p className='text-[10px] font-mono text-cyan-300/70'>VISUAL & BLUR CONTROLS</p>
									</div>
								</div>
								<button
									type='button'
									onClick={() => setShowVisualSettings(false)}
									className='rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors'
									title='Close'>
									<X className='h-4 w-4' />
								</button>
							</div>

							{/* Presets */}
							<div className='space-y-2'>
								<p className='text-[10px] font-bold uppercase tracking-wider text-zinc-400'>Presets</p>
								<div className='grid grid-cols-4 gap-2'>
									{[
										{ id: "default", label: "Default", desc: "Balanced" },
										{ id: "cinema", label: "Cinema", desc: "Vivid Video" },
										{ id: "glass", label: "Glass", desc: "Translucent" },
										{ id: "focus", label: "Focus", desc: "Minimal" },
									].map((item) => (
										<button
											key={item.id}
											type='button'
											onClick={() => applyPreset(item.id as any)}
											className='flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center transition-all hover:border-cyan-300/40 hover:bg-cyan-300/10 active:scale-95'>
											<span className='text-xs font-bold text-white'>{item.label}</span>
											<span className='text-[9px] text-zinc-400'>{item.desc}</span>
										</button>
									))}
								</div>
							</div>

							{/* Zen mode & Scrollbars Options */}
							<div className='space-y-2.5'>
								<div className='flex items-center justify-between rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-3'>
									<div className='flex items-center gap-2.5'>
										<EyeOff className='h-4 w-4 text-cyan-300' />
										<div>
											<p className='text-xs font-bold text-white'>Hide Interface (Video Mode)</p>
											<p className='font-mono text-[10px] text-cyan-300/80'>Press H to toggle, Esc to exit</p>
										</div>
									</div>
									<button
										type='button'
										onClick={() => {
											setShowVisualSettings(false);
											setHideGui(true);
										}}
										className='cyber-action rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#080b10] transition-all active:scale-95'>
										Enable
									</button>
								</div>

								<div className='flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3'>
									<div className='flex items-center gap-2.5'>
										<Baseline className='h-4 w-4 text-zinc-400' />
										<div>
											<p className='text-xs font-bold text-white'>Hide Scrollbars</p>
											<p className='text-[10px] text-zinc-400'>Clean aesthetic, wheel and touch scrolling stay smooth</p>
										</div>
									</div>
									<button
										type='button'
										role='switch'
										aria-checked={hideScrollbar}
										onClick={() => updateHideScrollbar(!hideScrollbar)}
										className={`relative h-6 w-11 rounded-full transition-colors ${
											hideScrollbar ? "bg-cyan-400" : "bg-zinc-700"
										}`}>
										<span
											className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
												hideScrollbar ? "translate-x-5" : "translate-x-0.5"
											}`}
										/>
									</button>
								</div>
							</div>

							{/* Sliders */}
							<div className='space-y-4'>
								{/* Background Blur */}
								<div className='space-y-1.5'>
									<div className='flex justify-between text-xs font-bold'>
										<span className='text-zinc-200'>Background Blur</span>
										<span className='font-mono text-cyan-300'>{bgBlur}px</span>
									</div>
									<input
										type='range'
										min='0'
										max='30'
										value={bgBlur}
										onChange={(e) => updateBgBlur(Number(e.target.value))}
										className='cyber-range-slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800'
									/>
									<div className='flex justify-between text-[9px] text-zinc-400 font-mono'>
										<span>0px (Sharp)</span>
										<span>30px (Soft Blur)</span>
									</div>
								</div>

								{/* Background Opacity */}
								<div className='space-y-1.5'>
									<div className='flex justify-between text-xs font-bold'>
										<span className='text-zinc-200'>Background Opacity</span>
										<span className='font-mono text-cyan-300'>{bgOpacity}%</span>
									</div>
									<input
										type='range'
										min='0'
										max='100'
										value={bgOpacity}
										onChange={(e) => updateBgOpacity(Number(e.target.value))}
										className='cyber-range-slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800'
									/>
									<div className='flex justify-between text-[9px] text-zinc-400 font-mono'>
										<span>0% (Hidden)</span>
										<span>100% (Full Vivid)</span>
									</div>
								</div>

								{/* GUI Opacity */}
								<div className='space-y-1.5'>
									<div className='flex justify-between text-xs font-bold'>
										<span className='text-zinc-200'>GUI Opacity</span>
										<span className='font-mono text-lime-300'>{guiOpacity}%</span>
									</div>
									<input
										type='range'
										min='10'
										max='100'
										value={guiOpacity}
										onChange={(e) => updateGuiOpacity(Number(e.target.value))}
										className='cyber-range-slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800'
									/>
									<div className='flex justify-between text-[9px] text-zinc-400 font-mono'>
										<span>10% (See-Through)</span>
										<span>100% (Opaque)</span>
									</div>
								</div>

								{/* GUI Backdrop Blur */}
								<div className='space-y-1.5'>
									<div className='flex justify-between text-xs font-bold'>
										<span className='text-zinc-200'>GUI Glass Blur</span>
										<span className='font-mono text-lime-300'>{guiBlur}px</span>
									</div>
									<input
										type='range'
										min='0'
										max='30'
										value={guiBlur}
										onChange={(e) => updateGuiBlur(Number(e.target.value))}
										className='cyber-range-slider h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800'
									/>
									<div className='flex justify-between text-[9px] text-zinc-400 font-mono'>
										<span>0px (Clear Glass)</span>
										<span>30px (Frosted Glass)</span>
									</div>
								</div>
							</div>

							{/* Footer actions */}
							<div className='flex items-center justify-between border-t border-white/5 pt-4'>
								<button
									type='button'
									onClick={resetVisualSettings}
									className='text-xs font-semibold text-zinc-400 hover:text-white transition-colors'>
									Reset to Default
								</button>
								<button
									type='button'
									onClick={() => setShowVisualSettings(false)}
									className='cyber-action rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#080b10] transition-all active:scale-95'>
									Done
								</button>
							</div>
						</motion.div>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
}
