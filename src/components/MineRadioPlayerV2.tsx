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
import { MineRadioBackground } from "./mineradio/MineRadioBackground";

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

function artwork(track: Track | null): string {
	return proxyImage(track?.thumbnail) || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1600&auto=format&fit=crop";
}

function time(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MineRadioPlayerV2() {
	const [stats, setStats] = useState<PlayerStats | null>(null);
	const [connected, setConnected] = useState(false);
	const [authenticated, setAuthenticated] = useState(false);
	const [streamMode, setStreamMode] = useState<StreamMode>("off");
	const [showQueue, setShowQueue] = useState(false);
	const [showSearch, setShowSearch] = useState(false);
	const [showLyrics, setShowLyrics] = useState(false);
	const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
	const [lyricsLoading, setLyricsLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<any[]>([]);
	const [searching, setSearching] = useState(false);
	const [liked, setLiked] = useState(false);
	const [volume, setVolume] = useState(1);
	const socketRef = useRef<WebSocket | null>(null);
	const mediaRef = useRef<HTMLMediaElement | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectDelay = useRef(1000);
	const destroyedRef = useRef(false);

	const token = typeof window === "undefined" ? null : localStorage.getItem("ziji-token");
	const track = useMemo(() => normalizeTrack(stats?.track), [stats?.track]);
	const queue = useMemo(() => (stats?.queue ?? []).map(normalizeTrack).filter(Boolean) as Track[], [stats?.queue]);
	const related = useMemo(() => (stats?.related ?? []).map(normalizeTrack).filter(Boolean) as Track[], [stats?.related]);
	const currentArtwork = artwork(track);
	const streamUrl = track && streamMode !== "off" ? getStreamUrl(track, streamMode) : null;
	const progress = track && !track.isLive ? Math.min(100, Math.max(0, ((stats?.timestamp ?? 0) / Math.max(1, track.duration)) * 100)) : 0;

	const sendCommand = (event: string, data: Record<string, unknown> = {}) => {
		const socket = socketRef.current;
		if (socket?.readyState === WebSocket.OPEN && authenticated) socket.send(JSON.stringify({ event, ...data }));
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
					} else if (data.event === "statistics") setStats(data);
				} catch {
					// Ignore malformed websocket frames.
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
		fetch(`${apiUrl("/music/lyrics")}?q=${encodeURIComponent(`${track.title} ${track.author ?? ""}`)}`, {
			headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
			signal: controller.signal,
		})
			.then(async (response) => {
				if (!response.ok) throw new Error("lyrics request failed");
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
		if (!media || !streamUrl) return;
		media.src = streamUrl;
		media.load();
		const target = Math.max(0, (stats?.timestamp ?? 0) / 1000);
		const onMetadata = () => {
			if (target > 0 && !track?.isLive && Number.isFinite(media.duration)) {
				try { media.currentTime = target; } catch { /* progressive stream may not be seekable */ }
			}
			if (!stats?.paused) media.play().catch(() => undefined);
		};
		media.addEventListener("loadedmetadata", onMetadata, { once: true });
		return () => media.removeEventListener("loadedmetadata", onMetadata);
	}, [streamUrl, track?.id]);

	useEffect(() => {
		const media = mediaRef.current;
		if (!media || streamMode === "off") return;
		if (stats?.paused) media.pause();
		else media.play().catch(() => undefined);
	}, [stats?.paused, streamMode]);

	useEffect(() => {
		const media = mediaRef.current;
		if (!media || streamMode === "off" || !track || track.isLive) return;
		const update = () => setStats((current) => current ? { ...current, timestamp: media.currentTime * 1000 } : current);
		media.addEventListener("timeupdate", update);
		return () => media.removeEventListener("timeupdate", update);
	}, [streamMode, track?.id, track?.isLive]);

	useEffect(() => {
		if (!track || !("mediaSession" in navigator)) return;
		navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.author ?? track.source, album: "Ziji · MineRadio", artwork: [{ src: currentArtwork }] });
		try { navigator.mediaSession.setActionHandler("play", () => mediaRef.current?.play().catch(() => sendCommand("pause"))); } catch {}
		try { navigator.mediaSession.setActionHandler("pause", () => { mediaRef.current?.pause(); sendCommand("pause"); }); } catch {}
		try { navigator.mediaSession.setActionHandler("nexttrack", () => sendCommand("skip")); } catch {}
		try { navigator.mediaSession.setActionHandler("previoustrack", () => sendCommand("back")); } catch {}
	}, [track?.id, currentArtwork]);

	const handleSearch = async () => {
		if (!search.trim() || !token) return;
		setSearching(true);
		try {
			const response = await fetch(`${apiUrl("/music/search")}?q=${encodeURIComponent(search.trim())}`, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } });
			if (!response.ok) throw new Error("search failed");
			const data = await response.json();
			setResults(data.results ?? []);
		} catch {
			setResults([]);
		} finally {
			setSearching(false);
		}
	};

	const playTrack = (item: any) => {
		if (item?.url) sendCommand("play", { trackUrl: item.url });
		setShowSearch(false);
	};

	const togglePlayback = () => {
		if (streamMode !== "off" && mediaRef.current) {
			if (stats?.paused) mediaRef.current.play().catch(() => undefined);
			else mediaRef.current.pause();
		}
		sendCommand("pause");
	};

	const seek = (event: ChangeEvent<HTMLInputElement>) => {
		if (!track || track.isLive) return;
		const value = Number(event.target.value);
		const media = mediaRef.current;
		if (streamMode !== "off" && media && Number.isFinite(media.duration) && media.duration > 0) {
			try { media.currentTime = (value / 100) * media.duration; return; } catch {}
		}
		sendCommand("seek", { timestamp: Math.round(track.duration * value / 100) });
	};

	const queueItems = queue.slice(0, 7);
	const centerIndex = Math.min(2, Math.max(0, queueItems.length - 1));

	if (!token) return <div className="grid h-[100dvh] place-items-center bg-[#08090c] text-white/50">Please login to use the player.</div>;

	return (
		<div className="relative h-[100dvh] w-full overflow-hidden bg-[#07080b] text-white selection:bg-white/20">
			<MineRadioBackground track={track} intensity={1} videoUrl={null} />
			<div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(0,0,0,.22),transparent_25%,transparent_75%,rgba(0,0,0,.2))]" />

			<header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
				<div className="flex items-center gap-3">
					<div className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/20 shadow-2xl backdrop-blur-2xl"><AudioLines size={18} /></div>
					<div className="hidden sm:block"><div className="text-sm font-black tracking-wide">MineRadio</div><div className="text-[9px] uppercase tracking-[.32em] text-white/45">Ziji music experience</div></div>
				</div>
				<div className="flex items-center gap-2">
					<div className="hidden rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[9px] uppercase tracking-[.2em] text-white/55 backdrop-blur-xl sm:flex sm:items-center sm:gap-2"><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} />{connected ? "Live sync" : "Connecting"}</div>
					<button onClick={() => setShowSearch((value) => !value)} aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/20 backdrop-blur-xl transition hover:bg-white/10"><Search size={16} /></button>
					<button aria-label="Home" className="hidden h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/20 backdrop-blur-xl transition hover:bg-white/10 sm:grid"><Home size={16} /></button>
					<div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 py-1.5 pl-1.5 pr-2.5 backdrop-blur-2xl"><div className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-[10px] font-black">Z</div><span className="hidden text-xs font-bold sm:inline">Ziji</span><span className="hidden rounded-full bg-white px-2 py-0.5 text-[7px] font-black text-black sm:inline">PREMIUM</span></div>
				</div>
			</header>

			<AnimatePresence>
				{showSearch && (
					<motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="absolute left-1/2 top-20 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-3xl border border-white/10 bg-[#111319d9] p-3 shadow-2xl backdrop-blur-3xl">
						<form onSubmit={(event) => { event.preventDefault(); handleSearch(); }} className="flex items-center gap-2"><Search className="ml-2 text-white/35" size={17} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search music..." className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm outline-none placeholder:text-white/30" /><button className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black">{searching ? <Loader2 size={14} className="animate-spin" /> : "Search"}</button><button type="button" onClick={() => setShowSearch(false)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10"><X size={15} /></button></form>
						<div className="mt-2 max-h-[45vh] overflow-auto">{results.map((item, index) => <button key={`${item.url}-${index}`} onClick={() => playTrack(item)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/10"><img src={proxyImage(item.thumbnail)} alt="" className="h-11 w-11 rounded-xl object-cover bg-white/5" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-xs text-white/40">{item.author ?? item.source}</span></span><Play size={14} className="mr-2 text-white/40" /></button>)}</div>
					</motion.div>
				)}
			</AnimatePresence>

			<main className="absolute inset-0 z-10 flex flex-col items-center justify-center pb-36 pt-24">
				<div className="mb-6 flex items-center gap-3 rounded-full border border-white/10 bg-black/15 px-4 py-2 text-[9px] uppercase tracking-[.24em] text-white/55 backdrop-blur-2xl"><span className="h-1.5 w-1.5 rounded-full bg-white" />Now playing</div>
				<div className="flex w-full max-w-[1200px] items-center justify-center gap-2 px-4 sm:gap-5">
					{queueItems.map((item, index) => {
						const distance = index - centerIndex;
						const active = distance === 0;
						return <motion.button key={`${item.id}-${index}`} onClick={() => playTrack(item)} animate={{ scale: active ? 1 : Math.max(.62, 1 - Math.abs(distance) * .11), opacity: active ? 1 : Math.max(.28, .68 - Math.abs(distance) * .12), y: Math.abs(distance) * 10 }} transition={{ type: "spring", stiffness: 260, damping: 24 }} className={`relative shrink-0 overflow-hidden rounded-2xl border shadow-2xl ${active ? "h-[220px] w-[min(70vw,420px)] border-white/35 sm:h-[250px]" : "hidden h-[150px] w-[180px] border-white/10 sm:block"}`}><img src={artwork(item)} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />{active && <div className="absolute inset-x-5 bottom-5 text-left"><div className="text-[9px] font-bold uppercase tracking-[.2em] text-white/55">{item.source}</div><div className="mt-1 line-clamp-2 text-lg font-black sm:text-xl">{item.title}</div><div className="mt-1 truncate text-xs text-white/55">{item.author ?? "Unknown artist"}</div></div>}</motion.button>;
					})}
					{queueItems.length === 0 && track && <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="relative h-[240px] w-[min(70vw,420px)] overflow-hidden rounded-2xl border border-white/20 shadow-2xl"><img src={currentArtwork} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" /><div className="absolute inset-x-5 bottom-5 text-left"><div className="text-[9px] uppercase tracking-[.2em] text-white/50">{track.source}</div><div className="mt-1 text-xl font-black">{track.title}</div><div className="mt-1 text-xs text-white/55">{track.author ?? "Unknown artist"}</div></div></motion.div>}
				</div>
				{track && <div className="mt-7 max-w-[min(80vw,620px)] truncate text-center text-xs text-white/40">{track.author ?? track.source} · {track.isLive ? "LIVE" : time(track.duration)}</div>}
			</main>

			<AnimatePresence>
				{showQueue && <motion.aside initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} className="absolute bottom-28 left-4 top-24 z-40 w-[min(88vw,360px)] overflow-hidden rounded-3xl border border-white/10 bg-[#101217c9] shadow-2xl backdrop-blur-3xl sm:left-8"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><div className="text-sm font-black">Queue</div><div className="text-[9px] uppercase tracking-[.2em] text-white/35">{queue.length} tracks</div></div><button onClick={() => setShowQueue(false)} className="grid h-8 w-8 place-items-center rounded-xl hover:bg-white/10"><X size={14} /></button></div><div className="space-y-1 overflow-auto p-3">{queue.map((item, index) => <button key={`${item.id}-${index}`} onClick={() => playTrack(item)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-white/10"><img src={artwork(item)} alt="" className="h-12 w-12 rounded-xl object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-[10px] text-white/40">{item.author ?? item.source}</span></span><span className="text-[10px] text-white/25">{index + 1}</span></button>)}</div></motion.aside>}
			</AnimatePresence>

			<AnimatePresence>
				{showLyrics && <motion.aside initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }} className="absolute bottom-28 right-4 top-24 z-40 w-[min(88vw,420px)] overflow-hidden rounded-3xl border border-white/10 bg-[#101217d9] shadow-2xl backdrop-blur-3xl sm:right-8"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="text-sm font-black">Lyrics</div><button onClick={() => setShowLyrics(false)} className="grid h-8 w-8 place-items-center rounded-xl hover:bg-white/10"><X size={14} /></button></div><div className="h-full overflow-auto whitespace-pre-wrap px-6 py-5 pb-24 text-sm leading-7 text-white/75">{lyricsLoading ? <div className="flex items-center gap-2 text-white/40"><Loader2 size={15} className="animate-spin" />Loading lyrics...</div> : lyrics?.lyrics || "No lyrics found."}</div></motion.aside>}
			</AnimatePresence>

			<div className="absolute inset-x-3 bottom-3 z-50 sm:inset-x-6 sm:bottom-5">
				<div className="mx-auto max-w-[1100px] rounded-[28px] border border-white/15 bg-[#0d0f13b8] px-4 py-3 shadow-[0_20px_80px_rgba(0,0,0,.45)] backdrop-blur-3xl sm:px-5 sm:py-4">
					<div className="mb-3 flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-xs font-bold">{track?.title ?? "Nothing playing"}</span><span className="text-[10px] tabular-nums text-white/35">{track?.isLive ? "LIVE" : `${time(stats?.timestamp ?? 0)} / ${time(track?.duration ?? 0)}`}</span></div>
					<input aria-label="Seek" type="range" min="0" max="100" step="0.1" value={progress} onChange={seek} className="mb-3 h-1 w-full cursor-pointer accent-white" />
					<div className="flex items-center gap-2 sm:gap-3">
						<button onClick={() => setShowQueue((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Queue"><ListMusic size={17} /></button>
						<button onClick={() => sendCommand("shuffle")} className="hidden h-9 w-9 place-items-center rounded-full hover:bg-white/10 sm:grid" aria-label="Shuffle"><Shuffle size={16} /></button>
						<button onClick={() => sendCommand("back")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Previous"><SkipBack size={18} /></button>
						<button onClick={togglePlayback} className="grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-xl transition hover:scale-105" aria-label={stats?.paused ? "Play" : "Pause"}>{stats?.paused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}</button>
						<button onClick={() => sendCommand("skip")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Next"><SkipForward size={18} /></button>
						<button onClick={() => setLiked((value) => !value)} className={`grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 ${liked ? "text-pink-300" : ""}`} aria-label="Like"><Heart size={17} fill={liked ? "currentColor" : "none"} /></button>
						<div className="ml-auto hidden items-center gap-2 sm:flex"><button onClick={() => setVolume((value) => value > 0 ? 0 : 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Mute">{volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}</button><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-20 accent-white" /></div>
						<button onClick={() => setShowLyrics((value) => !value)} className="hidden h-9 rounded-full px-3 text-[10px] font-bold uppercase tracking-[.16em] hover:bg-white/10 sm:block">Lyrics</button>
						<div className="hidden h-6 w-px bg-white/10 sm:block" />
						<button onClick={() => setStreamMode((value) => value === "off" ? "audio" : value === "audio" ? "video" : "off")} className={`grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 ${streamMode !== "off" ? "text-white" : "text-white/45"}`} aria-label="Browser stream">{streamMode === "video" ? <Video size={16} /> : <AudioLines size={16} />}</button>
						<button onClick={() => document.documentElement.requestFullscreen?.()} className="hidden h-9 w-9 place-items-center rounded-full hover:bg-white/10 sm:grid" aria-label="Fullscreen"><Maximize2 size={16} /></button>
					</div>
					{streamMode !== "off" && <div className="mt-2 text-[9px] text-white/35">Browser stream: {streamMode} · audio/video is mirrored from ZiPlayer</div>}
				</div>
			</div>

			<audio ref={mediaRef as React.RefObject<HTMLAudioElement>} className="hidden" preload="auto" />
			{streamMode === "video" && <video ref={mediaRef as React.RefObject<HTMLVideoElement>} className="pointer-events-none fixed -left-[9999px] h-px w-px" muted={false} playsInline preload="auto" />}
			<div className="hidden">{related.length} related · <Settings2 size={1} /><Repeat2 size={1} /><ChevronLeft size={1} /><ChevronRight size={1} /></div>
		</div>
	);
}
