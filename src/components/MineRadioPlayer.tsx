import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AudioLines, ChevronDown, ListMusic, Pause, Play, Radio, Search, SkipBack, SkipForward, Volume2, Video } from "lucide-react";
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
	return { id: String(value.id ?? value.url), title: value.title ?? "Unknown track", url: value.url ?? "", duration: durationMs(value.duration), thumbnail: value.thumbnail, requestedBy: value.requestedBy ?? "web", source: value.source ?? "unknown", metadata: value.metadata, isLive: Boolean(value.isLive), author: value.author ?? value.artist };
}

function formatTime(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export function MineRadioPlayer() {
	const [stats, setStats] = useState<PlayerStats | null>(null);
	const [connected, setConnected] = useState(false);
	const [authenticated, setAuthenticated] = useState(false);
	const [streamMode, setStreamMode] = useState<StreamMode>("off");
	const [streamError, setStreamError] = useState<string | null>(null);
	const [showQueue, setShowQueue] = useState(false);
	const [showLyrics, setShowLyrics] = useState(false);
	const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
	const [lyricsLoading, setLyricsLoading] = useState(false);
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<any[]>([]);
	const [searching, setSearching] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);
	const mediaRef = useRef<HTMLMediaElement | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectDelay = useRef(1000);
	const destroyedRef = useRef(false);
	const mediaSyncRef = useRef(false);

	const token = localStorage.getItem("ziji-token");
	const track = useMemo(() => normalizeTrack(stats?.track), [stats?.track]);
	const queue = useMemo(() => (stats?.queue ?? []).map(normalizeTrack).filter(Boolean) as Track[], [stats?.queue]);
	const streamUrl = track && streamMode !== "off" ? getStreamUrl(track, streamMode) : null;
	const progress = track && !track.isLive ? Math.min(100, Math.max(0, ((stats?.timestamp ?? 0) / Math.max(1, track.duration)) * 100)) : 0;
	const artwork = proxyImage(track?.thumbnail) || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=900&auto=format&fit=crop";

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
			socket.onopen = () => { setConnected(true); reconnectDelay.current = 1000; socket.send(JSON.stringify({ event: "identify", token })); };
			socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.event === "authenticated") { setAuthenticated(true); socket.send(JSON.stringify({ event: "GetVoice" })); }
					else if (data.event === "statistics") setStats(data);
					else if (data.event === "error" && data.message !== "No active voice connection found for user") console.warn("[MineRadio]", data.message);
				} catch (error) { console.warn("[MineRadio] invalid websocket message", error); }
			};
			socket.onclose = () => { setConnected(false); setAuthenticated(false); if (!destroyedRef.current) { const delay = reconnectDelay.current; reconnectRef.current = setTimeout(connect, delay); reconnectDelay.current = Math.min(delay * 2, 30000); } };
			socket.onerror = () => socket.close();
		};
		connect();
		return () => { destroyedRef.current = true; if (reconnectRef.current) clearTimeout(reconnectRef.current); socketRef.current?.close(); socketRef.current = null; };
	}, [token]);

	useEffect(() => {
		if (!track || !token) { setLyrics(null); return; }
		const controller = new AbortController();
		setLyricsLoading(true);
		fetch(`${apiUrl("/music/lyrics")}?q=${encodeURIComponent(`${track.title} ${track.author ?? ""}`)}`, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" }, signal: controller.signal })
			.then(async (response) => { if (!response.ok) throw new Error(`Lyrics request failed (${response.status})`); return response.json(); })
			.then(setLyrics).catch((error) => { if (error?.name !== "AbortError") setLyrics(null); }).finally(() => { if (!controller.signal.aborted) setLyricsLoading(false); });
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
		const onLoaded = () => { if (Number.isFinite(target) && target > 0 && !track.isLive) { try { media.currentTime = target; } catch { /* stream may not be seekable */ } } mediaSyncRef.current = false; };
		media.addEventListener("loadedmetadata", onLoaded, { once: true });
		if (!stats?.paused) media.play().catch((error) => setStreamError(error instanceof Error ? error.message : "Browser playback was blocked"));
		else media.pause();
		return () => media.removeEventListener("loadedmetadata", onLoaded);
	}, [streamUrl, streamMode, track?.id]);

	useEffect(() => {
		const media = mediaRef.current;
		if (!media || streamMode === "off" || mediaSyncRef.current) return;
		if (stats?.paused) media.pause(); else media.play().catch(() => undefined);
	}, [stats?.paused, streamMode]);

	useEffect(() => {
		const media = mediaRef.current;
		if (!media || streamMode === "off") return;
		const onTimeUpdate = () => {
			if (!mediaSyncRef.current && media.currentTime > 0 && !track?.isLive) setStats((current) => current ? { ...current, timestamp: media.currentTime * 1000 } : current);
		};
		media.addEventListener("timeupdate", onTimeUpdate);
		return () => media.removeEventListener("timeupdate", onTimeUpdate);
	}, [streamMode, track?.isLive]);

	useEffect(() => {
		if (!track || !("mediaSession" in navigator)) return;
		navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.author ?? track.source, album: "Ziji · MineRadio", artwork: [{ src: artwork, sizes: "512x512", type: "image/jpeg" }] });
		navigator.mediaSession.playbackState = stats?.paused ? "paused" : "playing";
		const actions: [MediaSessionAction, () => void][] = [["play", () => sendCommand("pause")], ["pause", () => sendCommand("pause")], ["nexttrack", () => sendCommand("skip")], ["previoustrack", () => sendCommand("back")], ["stop", () => sendCommand("stop")]];
		actions.forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported */ } });
	}, [track?.id, stats?.paused, artwork]);

	const handleSearch = async () => {
		if (!search.trim() || !token) return;
		setSearching(true);
		try { const response = await fetch(`${apiUrl("/music/search")}?q=${encodeURIComponent(search.trim())}`, { headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" } }); if (!response.ok) throw new Error(`Search failed (${response.status})`); const data = await response.json(); setResults(data.results ?? []); } catch (error) { console.warn("[MineRadio] search failed", error); setResults([]); } finally { setSearching(false); }
	};

	const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = Number(event.target.value);
		const media = mediaRef.current;
		if (streamMode !== "off" && media && Number.isFinite(media.duration) && media.duration > 0) {
			try { media.currentTime = (value / 100) * media.duration; return; } catch { /* fall through */ }
		}
		if (track && !track.isLive) sendCommand("seek", { timestamp: Math.round((value / 100) * track.duration) });
	};

	if (!token) return <div className='min-h-[70vh] grid place-items-center text-zinc-400'>Please login to use the player.</div>;

	return (
		<div className='min-h-[calc(100vh-5rem)] bg-[#050505] text-white overflow-hidden'>
			<div className='absolute inset-0 pointer-events-none opacity-30' style={{ background: `radial-gradient(circle at 50% 35%, rgba(88,101,242,.35), transparent 45%), radial-gradient(circle at 15% 80%, rgba(235,69,158,.2), transparent 35%)` }} />
			<div className='relative max-w-7xl mx-auto px-4 sm:px-8 py-8'>
				<div className='flex items-center justify-between mb-6'><div><p className='text-[10px] tracking-[.35em] uppercase text-zinc-500'>Ziji / MineRadio</p><h1 className='text-2xl sm:text-4xl font-black tracking-tight'>Music, reimagined.</h1></div><div className='flex items-center gap-2 text-xs text-zinc-400'><span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />{connected ? "ONLINE" : "CONNECTING"}</div></div>
				<div className='grid lg:grid-cols-[1fr_360px] gap-6'>
					<section className='glass rounded-[2rem] overflow-hidden min-h-[620px] relative'><div className='absolute inset-0 bg-cover bg-center opacity-20 blur-3xl scale-110' style={{ backgroundImage: `url(${artwork})` }} /><div className='relative flex flex-col items-center justify-center min-h-[620px] p-6 sm:p-12'>
						<motion.div animate={{ scale: stats?.paused ? 1 : [1, 1.025, 1] }} transition={{ repeat: Infinity, duration: 2 }} className='w-56 h-56 sm:w-72 sm:h-72 rounded-full p-2 bg-white/10 shadow-2xl'><img src={artwork} alt='' className='w-full h-full object-cover rounded-full shadow-[0_0_100px_rgba(88,101,242,.3)]' /></motion.div>
						<div className='mt-8 text-center'><div className='flex items-center justify-center gap-2 text-[10px] uppercase tracking-[.3em] text-discord mb-3'><Radio size={13} /> {track?.isLive ? "Live" : track?.source ?? "Idle"}</div><h2 className='text-2xl sm:text-3xl font-black'>{track?.title ?? "Nothing is playing"}</h2><p className='text-zinc-500 mt-2'>{track?.author ?? "Choose a track from search or queue"}</p></div>
						<div className='w-full max-w-2xl mt-8'><input aria-label='Seek' type='range' min='0' max='100' value={progress} onChange={handleSeek} disabled={!track || track.isLive} className='w-full accent-[var(--color-discord)] disabled:opacity-40' /><div className='flex justify-between text-[10px] font-mono text-zinc-600 mt-2'><span>{formatTime(stats?.timestamp ?? 0)}</span><span>{track?.isLive ? "LIVE" : formatTime(track?.duration ?? 0)}</span></div></div>
						<div className='flex items-center gap-5 mt-7'><button aria-label='Previous' onClick={() => sendCommand("back")} className='p-3 rounded-full hover:bg-white/10'><SkipBack /></button><button aria-label='Play pause' onClick={() => sendCommand("pause")} className='w-14 h-14 rounded-full bg-white text-black grid place-items-center hover:scale-105 transition-transform'>{stats?.paused ? <Play fill='currentColor' /> : <Pause fill='currentColor' />}</button><button aria-label='Next' onClick={() => sendCommand("skip")} className='p-3 rounded-full hover:bg-white/10'><SkipForward /></button></div>
						<div className='mt-8 flex flex-wrap items-center justify-center gap-2'><button onClick={() => setStreamMode("off")} className={`px-4 py-2 rounded-full text-xs ${streamMode === "off" ? "bg-white text-black" : "bg-white/5 text-zinc-400"}`}>Discord Voice</button><button disabled={!track} onClick={() => setStreamMode("audio")} className={`px-4 py-2 rounded-full text-xs flex gap-2 items-center ${streamMode === "audio" ? "bg-discord text-white" : "bg-white/5 text-zinc-400 disabled:opacity-40"}`}><AudioLines size={14} /> Browser Audio</button><button disabled={!track} onClick={() => setStreamMode("video")} className={`px-4 py-2 rounded-full text-xs flex gap-2 items-center ${streamMode === "video" ? "bg-vibrant-pink text-white" : "bg-white/5 text-zinc-400 disabled:opacity-40"}`}><Video size={14} /> Browser Video</button></div>{streamError && <p className='mt-3 text-xs text-red-400'>{streamError}</p>}
					</div></section>
					<aside className='space-y-4'>
						<div className='glass rounded-3xl p-4'><div className='flex items-center gap-2 mb-3'><Search size={16} /><span className='text-xs uppercase tracking-widest text-zinc-500'>Search</span></div><form onSubmit={(event) => { event.preventDefault(); handleSearch(); }} className='flex gap-2'><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Search music...' className='min-w-0 flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-discord' /><button className='px-3 rounded-xl bg-white/10'>{searching ? "…" : "Go"}</button></form><div className='mt-3 space-y-1 max-h-72 overflow-auto'>{results.map((item, index) => <button key={`${item.url}-${index}`} onClick={() => sendCommand("play", { trackUrl: item.url })} className='w-full text-left p-2 rounded-xl hover:bg-white/5 flex items-center gap-3'><img src={proxyImage(item.thumbnail)} className='w-10 h-10 rounded-lg object-cover bg-white/5' alt='' /><span className='min-w-0'><span className='block truncate text-sm'>{item.title}</span><span className='block truncate text-xs text-zinc-600'>{item.author ?? item.source}</span></span></button>)}</div></div>
						<div className='glass rounded-3xl p-4'><button onClick={() => setShowQueue((value) => !value)} className='w-full flex items-center justify-between'><span className='flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500'><ListMusic size={16} /> Queue · {queue.length}</span><ChevronDown className={showQueue ? "rotate-180" : ""} size={16} /></button><AnimatePresence initial={false}>{showQueue && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className='overflow-hidden'><div className='mt-4 space-y-2 max-h-80 overflow-auto'>{queue.map((item, index) => <button key={`${item.id}-${index}`} onClick={() => sendCommand("play", { trackUrl: item.url })} className='w-full flex items-center gap-3 text-left p-2 rounded-xl hover:bg-white/5'><img src={proxyImage(item.thumbnail)} className='w-10 h-10 rounded-lg object-cover' alt='' /><span className='truncate text-sm'>{item.title}</span></button>)}</div></motion.div>}</AnimatePresence></div>
						<div className='glass rounded-3xl p-4'><div className='flex items-center justify-between text-xs text-zinc-500 uppercase tracking-widest'><span className='flex items-center gap-2'><Volume2 size={15} /> Volume</span><span>{stats?.volume ?? 0}%</span></div><input type='range' min='0' max='100' value={stats?.volume ?? 0} onChange={(event) => sendCommand("volume", { volume: Number(event.target.value) })} className='w-full mt-4 accent-[var(--color-discord)]' /></div>
						<div className='glass rounded-3xl p-4'><button onClick={() => setShowLyrics((value) => !value)} className='w-full text-left text-xs uppercase tracking-widest text-zinc-500'>{showLyrics ? "Hide lyrics" : "Show lyrics"}</button>{showLyrics && <div className='mt-4 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-7 text-zinc-300'>{lyricsLoading ? "Loading lyrics…" : lyrics?.lyrics || "No lyrics found."}{lyrics?.lyrics_romanization && <><div className='my-4 border-t border-white/10' /><span className='text-zinc-500'>{lyrics.lyrics_romanization}</span></>}</div>}</div>
					</aside>
				</div>
				{streamMode === "audio" && streamUrl && <audio ref={mediaRef} controls className='fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(90vw,640px)] z-50' />}{streamMode === "video" && streamUrl && <video ref={mediaRef} controls playsInline className='fixed bottom-4 right-4 w-[min(90vw,420px)] max-h-[40vh] rounded-2xl shadow-2xl border border-white/10 z-50 bg-black' />}
			</div>
		</div>
	);
}
