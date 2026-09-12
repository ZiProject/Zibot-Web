import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
	AudioLines,
	ChevronLeft,
	ChevronRight,
	Heart,
	Home,
	ListMusic,
	Loader2,
	Maximize2,
	Menu,
	Pause,
	Play,
	Repeat2,
	Search,
	Settings2,
	Shuffle,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	Video,
	X,
} from "lucide-react";
import { apiUrl, getWsUrl, proxyImage } from "../services/discordActivity";
import { getStreamUrl } from "../services/webStream";
import type { StreamMode, Track } from "../types/track";

interface PlayerStats {
	timestamp: number;
	listeners: number;
	volume: number;
	paused: boolean;
	repeatMode?: string;
	autoPlay?: boolean;
	track: Track | null;
	queue: Track[];
	related: Track[];
}

interface LyricsResult {
	lyrics?: string;
	lyrics_romanization?: string;
	[key: string]: unknown;
}

function durationMs(value: unknown): number {
	if (typeof value === "number") return value > 10000 ? value : value * 1000;
	if (typeof value !== "string") return 0;
	if (value.includes(":")) {
		const parts = value.split(":").map(Number);
		if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
		if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? (parsed > 10000 ? parsed : parsed * 1000) : 0;
}

function normalizeTrack(value: any): Track | null {
	if (!value?.url && !value?.id) return null;
	return {
		id: String(value.id ?? value.url),
		title: value.title ?? "Unknown track",
		url: value.url ?? "",
		duration: durationMs(value.duration),
		thumbnail: value.thumbnail,
		requestedBy: value.requestedBy ?? "web",
		source: value.source ?? "unknown",
		metadata: value.metadata,
		isLive: Boolean(value.isLive),
		author: value.author ?? value.artist,
	};
}

function formatTime(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

function getArtwork(track: Track | null): string {
	return (
		proxyImage(track?.thumbnail) ||
		"https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1600&auto=format&fit=crop"
	);
}

export function MineRadioPlayer() {
	const [stats, setStats] = useState<PlayerStats | null>(null);
	const [connected, setConnected] = useState(false);
	const [authenticated, setAuthenticated] = useState(false);
	const [streamMode, setStreamMode] = useState<StreamMode>("off");
	const [streamError, setStreamError] = useState<string | null>(null);
	const [showQueue, setShowQueue] = useState(false);
	const [showSearch, setShowSearch] = useState(false);
	const [showLyrics, setShowLyrics] = useState(false);
	const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
	const [lyricsLoading, setLyricsLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<any[]>([]);
	const [searching, setSearching] = useState(false);
	const [liked, setLiked] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);
	const mediaRef = useRef<HTMLMediaElement | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectDelay = useRef(1000);
	const destroyedRef = useRef(false);
	const mediaSyncRef = useRef(false);

	const token = localStorage.getItem("ziji-token");
	const track = useMemo(() => normalizeTrack(stats?.track), [stats?.track]);
	const queue = useMemo(
		() => (stats?.queue ?? []).map(normalizeTrack).filter(Boolean) as Track[],
		[stats?.queue],
	);
	const artwork = getArtwork(track);
	const streamUrl = track && streamMode !== "off" ? getStreamUrl(track, streamMode) : null;
	const progress = track && !track.isLive
		? Math.min(100, Math.max(0, ((stats?.timestamp ?? 0) / Math.max(1, track.duration)) * 100))
		: 0;
	const related = useMemo(
		() => (stats?.related ?? []).map(normalizeTrack).filter(Boolean) as Track[],
		[stats?.related],
	);

	const sendCommand = (event: string, data: Record<string, unknown> = {}) => {
		const socket = socketRef.current;
		if (socket?.readyState === WebSocket.OPEN && authenticated) {
			socket.send(JSON.stringify({ event, ...data }));
		}
	};

	useEffect(() => {
		if (!token) return;
		destroyedRef.current = false;
		const connect = () => {
			if (destroyedRef.current) return;
			const socket = new WebSocket(getWsUrl());
			socketRef.current = socket;
			socket.onopen = () => {
				setConnected(true);
				reconnectDelay.current = 1000;
				socket.send(JSON.stringify({ event: "identify", token }));
			};
			socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.event === "authenticated") {
						setAuthenticated(true);
						socket.send(JSON.stringify({ event: "GetVoice" }));
					} else if (data.event === "statistics") {
						setStats(data);
					} else if (data.event === "error" && data.message !== "No active voice connection found for user") {
						console.warn("[MineRadio]", data.message);
					}
				} catch (error) {
					console.warn("[MineRadio] invalid websocket message", error);
				}
			};
			socket.onclose = () => {
				setConnected(false);
				setAuthenticated(false);
				if (!destroyedRef.current) {
					const delay = reconnectDelay.current;
					reconnectRef.current = setTimeout(connect, delay);
					reconnectDelay.current = Math.min(delay * 2, 30000);
				}
			};
			socket.onerror = () => socket.close();
		};
		connect();
		return () => {
			destroyedRef.current = true;
			if (reconnectRef.current) clearTimeout(reconnectRef.current);
			socketRef.current?.close();
			socketRef.current = null;
		};
	}, [token]);

	useEffect(() => {
		if (!track || !token) {
			setLyrics(null);
			return;
		}
		const controller = new AbortController();
		setLyricsLoading(true);
		fetch(
			`${apiUrl("/music/lyrics")}?q=${encodeURIComponent(`${track.title} ${track.author ?? ""}`)}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
				signal: controller.signal,
			},
		)
			.then(async (response) => {
				if (!response.ok) throw new Error(`Lyrics request failed (${response.status})`);
				return response.json();
			})
			.then(setLyrics)
			.catch((error) => {
				if (error?.name !== "AbortError") setLyrics(null);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLyricsLoading(false);
			});
		return () => controller.abort();
	}, [track?.id, track?.title, track?.author, token]);

	useEffect(() => {
		const media = mediaRef.current;
		if (!media || !track || streamMode === "off" || !streamUrl) return;
		setStreamError(null);
		mediaSyncRef.current = true;
		media.src = streamUrl;
		media.load();
		const target = Math.max(0, (stats?.timestamp ?? 0) / 1000);
		const onLoaded = () => {
			if (Number.isFinite(target) && target > 0 && !track.isLive) {
				try {
					media.currentTime = target;
				} catch {
					// The progressive stream may not expose a seekable range.
				}
			}
			mediaSyncRef.current = false;
		};
		media.addEventListener("loadedmetadata", onLoaded, { once: true });
		if (!stats?.paused) {
			media.play().catch((error) =>
				setStreamError(error instanceof Error ? error.message : "Browser playback was blocked"),
			);
		} else {
			media.pause();
		}
		return () => media.removeEventListener("loadedmetadata", onLoaded);
	}, [streamUrl, streamMode, track?.id]);

	useEffect(() => {
		const media = mediaRef.current;
		if (!media || streamMode === "off" || mediaSyncRef.current) return;
		if (stats?.paused) media.pause();
		else media.play().catch(() => undefined);
	}, [stats?.paused, streamMode]);

	useEffect(() => {
		const media = mediaRef.current;
		if (!media || streamMode === "off") return;
		const onTimeUpdate = () => {
			if (!mediaSyncRef.current && media.currentTime > 0 && !track?.isLive) {
				setStats((current) => current ? { ...current, timestamp: media.currentTime * 1000 } : current);
			}
		};
		media.addEventListener("timeupdate", onTimeUpdate);
		return () => media.removeEventListener("timeupdate", onTimeUpdate);
	}, [streamMode, track?.isLive]);

	useEffect(() => {
		if (!track || !("mediaSession" in navigator)) return;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: track.author ?? track.source,
			album: "Ziji · MineRadio",
			artwork: [{ src: artwork, sizes: "512x512", type: "image/jpeg" }],
		});
		navigator.mediaSession.playbackState = stats?.paused ? "paused" : "playing";
		const media = mediaRef.current;
		const actions: [MediaSessionAction, () => void][] = [
			["play", () => media?.play().catch(() => sendCommand("pause"))],
			["pause", () => media?.pause()],
			["nexttrack", () => sendCommand("skip")],
			["previoustrack", () => sendCommand("back")],
			["stop", () => sendCommand("stop")],
		];
		actions.forEach(([action, handler]) => {
			try {
				navigator.mediaSession.setActionHandler(action, handler);
			} catch {
				// Unsupported Media Session action.
			}
		});
	}, [track?.id, stats?.paused, artwork]);

	const handleSearch = async () => {
		if (!search.trim() || !token) return;
		setSearching(true);
		try {
			const response = await fetch(
			`${apiUrl("/music/search")}?q=${encodeURIComponent(search.trim())}`,
			{ headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } },
			);
			if (!response.ok) throw new Error(`Search failed (${response.status})`);
			const data = await response.json();
			setResults(data.results ?? []);
		} catch (error) {
			console.warn("[MineRadio] search failed", error);
			setResults([]);
		} finally {
			setSearching(false);
		}
	};

	const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
		const value = Number(event.target.value);
		const media = mediaRef.current;
		if (streamMode !== "off" && media && Number.isFinite(media.duration) && media.duration > 0) {
			try {
				media.currentTime = (value / 100) * media.duration;
				return;
			} catch {
				// Fall through to server seek.
			}
		}
		if (track && !track.isLive) {
			sendCommand("seek", { timestamp: Math.round((value / 100) * track.duration) });
		}
	};

	const playTrack = (item: Track | any) => {
		if (item?.url) sendCommand("play", { trackUrl: item.url });
		setShowSearch(false);
	};

	if (!token) {
		return <div className="min-h-screen grid place-items-center bg-[#090a0c] text-zinc-400">Please login to use the player.</div>;
	}

	return (
		<div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white select-none">
			{/* MineRadio uses the current artwork as the entire visual stage. */}
			<motion.div
				key={artwork}
				initial={{ opacity: 0, scale: 1.04 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.8 }}
				className="absolute inset-0 bg-cover bg-center"
				style={{ backgroundImage: `url(${artwork})` }}
			/>
			<div className="absolute inset-0 bg-black/15" />
			<div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />
			<div className="absolute inset-0 backdrop-blur-[1.5px]" />

			<header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
				<div className="flex items-center gap-3">
					<div className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/20 backdrop-blur-xl shadow-lg">
						<AudioLines size={18} />
					</div>
					<div className="hidden sm:block">
						<div className="text-sm font-bold tracking-wide">MineRadio</div>
						<div className="text-[10px] uppercase tracking-[0.25em] text-white/55">Ziji music</div>
					</div>
				</div>

				<div className="flex items-center gap-2 sm:gap-3">
					<div className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-2 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur-xl sm:flex">
						<span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
						{connected ? "Online" : "Connecting"}
					</div>
					<button aria-label="Home" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/15 backdrop-blur-xl hover:bg-white/15">
						<Home size={16} />
					</button>
					<div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/15 py-1.5 pl-1.5 pr-2.5 backdrop-blur-xl shadow-lg">
						<div className="grid h-7 w-7 place-items-center rounded-full bg-white/20 text-[10px] font-bold">Z</div>
						<span className="hidden text-xs font-semibold sm:inline">Ziji</span>
						<span className="hidden rounded-full bg-amber-300 px-2 py-0.5 text-[8px] font-black text-black sm:inline">PREMIUM</span>
					</div>
				</div>
			</header>

			{/* Search is a floating MineRadio-style glass panel rather than a permanent sidebar. */}
			<AnimatePresence>
				{showSearch && (
					<motion.div
						initial={{ opacity: 0, y: -12, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -12, scale: 0.98 }}
						className="absolute left-1/2 top-20 z-40 w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#17191dcc] p-3 shadow-2xl backdrop-blur-2xl"
					>
						<form onSubmit={(event) => { event.preventDefault(); handleSearch(); }} className="flex items-center gap-2">
							<Search size={17} className="ml-2 text-white/45" />
							<input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm bài hát, nghệ sĩ..." className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-white/35" />
							<button className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15">{searching ? <Loader2 size={14} className="animate-spin" /> : "Tìm"}</button>
							<button type="button" onClick={() => setShowSearch(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"><X size={15} /></button>
						</form>
						<div className="mt-2 max-h-[46vh] space-y-1 overflow-auto">
							{results.map((item, index) => (
								<button key={`${item.url}-${index}`} onClick={() => playTrack(item)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/10">
									<img src={proxyImage(item.thumbnail)} alt="" className="h-10 w-10 rounded-lg object-cover bg-white/5" />
									<span className="min-w-0 flex-1"><span className="block truncate text-sm">{item.title}</span><span className="block truncate text-xs text-white/40">{item.author ?? item.source}</span></span>
								</button>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Center carousel: the defining MineRadio visual instead of a large album/player card. */}
			<div className="absolute inset-x-0 top-[42%] z-10 -translate-y-1/2 px-4 sm:top-[45%]">
				<div className="mx-auto flex max-w-[1180px] items-center justify-center gap-2 sm:gap-4">
					{queue.slice(0, 5).map((item, index) => {
						const distance = index - 2;
						return (
							<motion.button
								key={`${item.id}-${index}`}
								onClick={() => playTrack(item)}
								initial={false}
								animate={{
								x: distance * 4,
								y: Math.abs(distance) * 6,
								scale: distance === 0 ? 1 : 0.72,
								opacity: distance === 0 ? 1 : 0.48,
							}}
							className={`group relative shrink-0 overflow-hidden rounded-xl border shadow-2xl transition-all ${distance === 0 ? "h-28 w-64 border-fuchsia-400/70 sm:h-32 sm:w-[290px]" : "hidden h-20 w-32 border-white/10 sm:block sm:h-24 sm:w-40"}`}
							style={{ backgroundImage: `url(${getArtwork(item)})`, backgroundSize: "cover", backgroundPosition: "center" }}
							>
								<div className="absolute inset-0 bg-black/35" />
								{distance === 0 && (
									<div className="absolute inset-0 flex items-center gap-3 bg-gradient-to-r from-black/75 via-black/35 to-transparent p-3 text-left">
										<img src={getArtwork(item)} alt="" className="h-20 w-20 rounded-lg object-cover shadow-lg sm:h-24 sm:w-24" />
										<div className="min-w-0"><div className="text-[9px] font-semibold text-fuchsia-300">Đang phát</div><div className="mt-1 line-clamp-2 text-sm font-bold">{item.title}</div><div className="mt-1 truncate text-[10px] text-white/55">{item.author ?? item.source}</div></div>
									</div>
								)}
							</motion.button>
						);
					})}
					{queue.length === 0 && track && (
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 rounded-xl border border-fuchsia-400/50 bg-black/30 p-2 shadow-2xl backdrop-blur-xl">
							<img src={artwork} alt="" className="h-24 w-24 rounded-lg object-cover" />
							<div className="max-w-[250px]"><div className="text-[9px] text-fuchsia-300">Đang phát</div><div className="mt-1 line-clamp-2 text-sm font-bold">{track.title}</div><div className="mt-1 text-[10px] text-white/50">{track.author ?? track.source}</div></div>
						</motion.div>
					)}
				</div>
				{track && <div className="mt-4 text-center"><div className="text-[11px] text-white/70">{track.title}</div><div className="mt-0.5 text-[9px] uppercase tracking-[0.25em] text-white/35">{track.author ?? track.source}</div></div>}
			</div>

			{/* Queue drawer matches the reference: left glass panel over the artwork. */}
			<AnimatePresence>
				{showQueue && (
					<>
						<motion.button aria-label="Close queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowQueue(false)} className="absolute inset-0 z-40 cursor-default bg-black/10" />
						<motion.aside initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }} className="absolute left-4 top-16 z-50 h-[calc(100dvh-130px)] w-[min(88vw,360px)] overflow-hidden rounded-2xl border border-white/15 bg-[#17191dd9] shadow-2xl backdrop-blur-2xl">
							<div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
								<div><div className="text-sm font-bold">Playlist / Hàng chờ</div><div className="mt-1 text-[10px] text-white/40">HÀNG CHỜ · Tự ẩn khi rời chuột</div></div>
								<button onClick={() => setShowQueue(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"><X size={15} /></button>
							</div>
							<div className="flex gap-2 px-4 py-3 text-[10px]"><span className="rounded-full bg-white/15 px-3 py-1.5">Hàng chờ hiện tại</span><span className="rounded-full bg-white/5 px-3 py-1.5 text-white/45">Playlist của tôi</span></div>
							<div className="space-y-1 overflow-auto px-3 pb-4">
								{queue.map((item, index) => (
									<button key={`${item.id}-${index}`} onClick={() => playTrack(item)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${track?.id === item.id ? "bg-white/20" : "hover:bg-white/10"}`}>
										<img src={getArtwork(item)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
										<span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{item.title}</span><span className="mt-0.5 block truncate text-[10px] text-white/45">{item.author ?? item.source}</span></span>
										{track?.id === item.id && <span className="text-[9px] text-fuchsia-300">Đang phát</span>}
									</button>
								))}
								{queue.length === 0 && <div className="px-3 py-10 text-center text-xs text-white/35">Hàng chờ đang trống</div>}
							</div>
						</motion.aside>
					</>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{showLyrics && (
					<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-28 left-1/2 z-40 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/55 p-5 shadow-2xl backdrop-blur-2xl">
						<div className="mb-3 flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-[0.2em]">Lyrics</div><button onClick={() => setShowLyrics(false)}><X size={15} /></button></div>
						<div className="max-h-[45vh] overflow-auto whitespace-pre-wrap text-sm leading-7 text-white/75">{lyricsLoading ? "Loading lyrics…" : lyrics?.lyrics || "No lyrics found."}{lyrics?.lyrics_romanization && <><div className="my-4 border-t border-white/10" /><span className="text-white/35">{lyrics.lyrics_romanization}</span></>}</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Bottom dock is intentionally the primary control surface, like MineRadio. */}
			<div className="absolute bottom-4 left-1/2 z-30 w-[calc(100%-20px)] max-w-[1140px] -translate-x-1/2 sm:bottom-5 sm:w-[calc(100%-48px)]">
				<div className="relative overflow-hidden rounded-[26px] border border-white/20 bg-white/15 shadow-[0_20px_80px_rgba(0,0,0,.28)] backdrop-blur-2xl">
					<div className="absolute inset-x-6 top-0 h-px bg-white/35" />
					<div className="px-4 pt-2 sm:px-6">
						<input aria-label="Seek" type="range" min="0" max="100" value={progress} onChange={handleSeek} disabled={!track || track.isLive} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white disabled:cursor-default disabled:opacity-40" />
					</div>
					<div className="flex h-[70px] items-center gap-2 px-3 sm:h-[76px] sm:gap-3 sm:px-5">
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-black/20 sm:h-12 sm:w-12">
								<img src={artwork} alt="" className="h-full w-full object-cover" />
								{!stats?.paused && track && <span className="absolute inset-x-2 bottom-1 h-0.5 animate-pulse rounded bg-white/80" />}
							</div>
							<div className="min-w-0 hidden sm:block"><div className="max-w-[260px] truncate text-xs font-bold">{track?.title ?? "Nothing is playing"}</div><div className="mt-0.5 max-w-[260px] truncate text-[10px] text-white/55">{track?.author ?? "Choose a track"}</div></div>
						</div>

						<div className="flex items-center gap-0.5 sm:gap-1">
							<button aria-label="Like" onClick={() => setLiked((value) => !value)} className={`hidden p-2 transition sm:block ${liked ? "text-pink-300" : "text-white/60 hover:text-white"}`}><Heart size={16} fill={liked ? "currentColor" : "none"} /></button>
							<button aria-label="Shuffle" onClick={() => sendCommand("shuffle")} className="hidden p-2 text-white/55 hover:text-white sm:block"><Shuffle size={15} /></button>
							<button aria-label="Previous" onClick={() => sendCommand("back")} className="p-2 text-white/70 hover:text-white"><SkipBack size={17} /></button>
							<button aria-label="Play pause" onClick={() => streamMode !== "off" && mediaRef.current ? (stats?.paused ? mediaRef.current.play() : mediaRef.current.pause()) : sendCommand("pause")} className="mx-1 grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-xl transition hover:scale-105 sm:h-12 sm:w-12">
								{stats?.paused ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}
							</button>
							<button aria-label="Next" onClick={() => sendCommand("skip")} className="p-2 text-white/70 hover:text-white"><SkipForward size={17} /></button>
							<button aria-label="Repeat" onClick={() => sendCommand("repeat")} className="hidden p-2 text-white/55 hover:text-white sm:block"><Repeat2 size={15} /></button>
						</div>

						<div className="flex flex-1 items-center justify-end gap-1 sm:gap-2">
							<span className="hidden text-[9px] font-mono text-white/45 sm:inline">{formatTime(stats?.timestamp ?? 0)} / {track?.isLive ? "LIVE" : formatTime(track?.duration ?? 0)}</span>
							<button aria-label="Search" onClick={() => setShowSearch((value) => !value)} className="p-2 text-white/60 hover:text-white"><Search size={16} /></button>
							<button aria-label="Queue" onClick={() => setShowQueue((value) => !value)} className={`p-2 ${showQueue ? "text-white" : "text-white/60 hover:text-white"}`}><ListMusic size={17} /></button>
							<button aria-label="Lyrics" onClick={() => setShowLyrics((value) => !value)} className={`hidden p-2 sm:block ${showLyrics ? "text-white" : "text-white/60 hover:text-white"}`}>A̲</button>
							<button aria-label="Volume" onClick={() => sendCommand("volume", { volume: stats?.volume ? 0 : 100 })} className="hidden p-2 text-white/60 hover:text-white sm:block">{stats?.volume ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
							<div className="hidden w-20 md:block"><input aria-label="Volume" type="range" min="0" max="100" value={stats?.volume ?? 0} onChange={(event) => sendCommand("volume", { volume: Number(event.target.value) })} className="w-full accent-white" /></div>
							<button aria-label="Stream settings" onClick={() => setStreamMode(streamMode === "off" ? "audio" : "off")} className="hidden p-2 text-white/60 hover:text-white sm:block"><Settings2 size={15} /></button>
						</div>
					</div>
				</div>
			</div>

			{/* Small floating utility button visible in the reference. */}
			<button aria-label="Player settings" className="absolute bottom-20 right-5 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/15 text-white/70 shadow-xl backdrop-blur-xl hover:bg-white/15 sm:bottom-24 sm:right-7">
				<Settings2 size={16} />
			</button>

			{/* Stream controls are tucked away instead of occupying the center layout. */}
			<div className="absolute bottom-24 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/25 p-1 backdrop-blur-xl sm:flex">
				<button onClick={() => setStreamMode("off")} className={`rounded-full px-3 py-1.5 text-[9px] ${streamMode === "off" ? "bg-white text-black" : "text-white/50"}`}>VOICE</button>
				<button disabled={!track} onClick={() => setStreamMode("audio")} className={`rounded-full px-3 py-1.5 text-[9px] ${streamMode === "audio" ? "bg-white text-black" : "text-white/50 disabled:opacity-30"}`}><AudioLines size={11} className="mr-1 inline" />AUDIO</button>
				<button disabled={!track} onClick={() => setStreamMode("video")} className={`rounded-full px-3 py-1.5 text-[9px] ${streamMode === "video" ? "bg-white text-black" : "text-white/50 disabled:opacity-30"}`}><Video size={11} className="mr-1 inline" />VIDEO</button>
			</div>

			{streamError && <div className="absolute bottom-24 left-1/2 z-30 max-w-[80vw] -translate-x-1/2 rounded-full bg-red-500/20 px-4 py-2 text-[10px] text-red-200 backdrop-blur-xl">{streamError}</div>}

			{streamMode === "audio" && streamUrl && <audio ref={mediaRef} controls={false} className="hidden" />}
			{streamMode === "video" && streamUrl && <video ref={mediaRef} controls={false} playsInline className="absolute right-5 top-20 z-20 h-[min(32vh,260px)] w-[min(42vw,420px)] rounded-2xl border border-white/15 bg-black/60 object-contain shadow-2xl" />}
		</div>
	);
}
