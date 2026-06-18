import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiUrl, getWsUrl, isDiscordActivity, proxyImage, useIsMinimized } from "../services/discordActivity";
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
	MoreVertical,
	Baseline,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { BotInfo } from "../services/discordActivity";

interface Track {
	title: string;
	url: string;
	duration: string | number;
	thumbnail: string;
	author: string;
}

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

	// Thêm hằng số này bên ngoài Component hoặc trong component
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
		if (stats?.track?.duration) {
			const durationMs = parseDuration(stats.track.duration);
			if (durationMs > 0) {
				const currentProgress = (stats.timestamp / durationMs) * 100;
				setProgress(Math.min(100, Math.max(0, currentProgress)));
			}
		}
	}, [stats?.timestamp, stats?.track?.duration]);
	const [volume, setVolume] = useState(50);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<any[]>([]);
	const [lyrics, setLyrics] = useState<string | null>(null);
	const [showLyrics, setShowLyrics] = useState(false);
	const [isPlayerOpen, setIsPlayerOpen] = useState(false);

	const token = localStorage.getItem("ziji-token");
	const baseUrl = apiUrl("");
	const wsUrl = getWsUrl();

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

					case "statistics":
						setStats(data);
						setVolume(data.volume);
						break;

					case "error":
						setError(data.message);
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
		if (stats?.track?.title) {
			fetch(`${baseUrl}/music/lyrics?q=${encodeURIComponent(stats.track.title)}`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			})
				.then((res) => res.json())
				.then((data) => setLyrics(data?.lyrics?.text || "Lyrics not found"))
				.catch(() => setLyrics("Lyrics error"));
		}
	}, [stats?.track?.title, baseUrl, token]);
	// Thêm vào trong component MusicPlayerView
	useEffect(() => {
		if (!("mediaSession" in navigator) || !stats?.track) return;

		const { track, paused } = stats;

		// Kích hoạt Audio "im lặng" để trình duyệt hiện Media Control
		if (audioRef.current) {
			if (!paused) {
				audioRef.current.play().catch(() => {
					console.log("Cần tương tác người dùng để kích hoạt Media Session");
				});
			} else {
				audioRef.current.pause();
			}
		}

		// 1. Cập nhật Metadata
		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: track.author,
			album: "Ziji Melody",
			artwork: [
				{
					src: proxyImage(
						track.thumbnail ||
							botInfo?.avatars ||
							"https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=512&auto=format&fit=crop",
					),
					sizes: "512x512",
					type: "image/jpeg",
				},
				{
					src: proxyImage(
						track.thumbnail ||
							botInfo?.avatars ||
							"https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=192&auto=format&fit=crop",
					),
					sizes: "192x192",
					type: "image/jpeg",
				},
			],
		});

		// 2. Trạng thái Playback
		navigator.mediaSession.playbackState = paused ? "paused" : "playing";

		// 3. Đăng ký Action Handlers
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
				console.warn(`Action ${action} không được hỗ trợ`);
			}
		});

		// 4. Cập nhật vị trí thanh progress (Position State)
		// Cần bọc trong try-catch vì thông số duration/position phải hợp lệ
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
			console.error("Lỗi cập nhật PositionState:", e);
		}
	}, [stats?.track, stats?.paused, stats?.timestamp]);
	const handleSearch = async () => {
		if (!searchQuery) return;
		try {
			const res = await fetch(`${baseUrl}/music/search?q=${encodeURIComponent(searchQuery)}`, {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			});
			const data = await res.json();
			setSearchResults(data.results || []);
		} catch (err) {
			console.error(err);
		}
	};

	const sendCommand = (event: string, data: any = {}) => {
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

		if (!connected) {
			return (
				<div className='fixed inset-0 bg-[#050505] flex items-center justify-center select-none'>
					<div className='w-8 h-8 border-2 border-white/10 border-t-discord rounded-full animate-spin'></div>
				</div>
			);
		}

		return (
			<div className='fixed inset-0 bg-[#050505] flex flex-col overflow-hidden select-none'>
				{/* Thumbnail Container */}
				<div className='relative flex-grow w-full overflow-hidden bg-black flex items-center justify-center'>
					{stats?.track?.thumbnail ?
						<>
							{/* Blurred Background for aesthetic glow */}
							<img
								src={proxyImage(stats.track.thumbnail)}
								alt=''
								className='absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110'
							/>
							{/* Sharp Image */}
							<img
								src={proxyImage(stats.track.thumbnail)}
								alt={stats.track.title}
								className='relative max-w-full max-h-full object-contain z-10 shadow-2xl rounded-lg p-2'
							/>
						</>
					:	<div className='flex flex-col items-center justify-center text-zinc-600 gap-2'>
							<Music className='w-10 h-10 animate-pulse' />
							<span className='text-xs font-bold tracking-widest uppercase'>No Track</span>
						</div>
					}
				</div>

				{/* Controls Bar at bottom */}
				<div className='h-14 bg-black/60 backdrop-blur-md border-t border-white/5 flex items-center justify-between px-3 shrink-0 gap-3'>
					{/* Title and artist */}
					<div className='flex-grow min-w-0'>
						<div className='font-bold text-xs truncate text-white'>{stats?.track?.title || "Ziji Music Engine"}</div>
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

	if (!connected) {
		return (
			<div className='flex items-center justify-center h-[calc(100vh-64px)]'>
				<div className='w-12 h-12 border-4 border-white/10 border-t-discord rounded-full animate-spin'></div>
			</div>
		);
	}

	return (
		<div className='fixed inset-0 top-16 bg-[#09090b] flex overflow-hidden'>
			{/* Sidebar - Desktop Only */}
			<div className='w-64 border-r border-white/5 flex flex-col p-6 gap-8 hidden lg:flex shrink-0'>
				<div className='flex items-center gap-3'>
					<div className='w-10 h-10 bg-discord rounded-xl flex items-center justify-center shadow-glow'>
						<Music className='w-6 h-6 text-white' />
					</div>
					<h2 className='font-black text-2xl tracking-tighter'>Melody</h2>
				</div>

				<nav className='space-y-1'>
					{[
						{ icon: LayoutGrid, label: "Home", active: !searchQuery },
						{ icon: Search, label: "Search", active: !!searchQuery },
						{ icon: ListMusic, label: "Your Library" },
					].map((item, idx) => (
						<button
							key={idx}
							className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${item.active ? "bg-white/5 text-white font-bold" : "text-zinc-500 hover:text-white"}`}>
							<item.icon className='w-5 h-5' />
							<span className='text-sm'>{item.label}</span>
						</button>
					))}
				</nav>

				<div className='mt-auto'>
					<div className='p-4 glass rounded-2xl bg-discord/10 border border-discord/20'>
						<p className='text-[10px] font-black text-discord uppercase tracking-widest mb-1'>Status</p>
						<div className='text-sm font-bold text-white flex items-center gap-2'>
							<div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
							<span>{connected ? "Live Sync" : "Reconnecting..."}</span>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content Area */}
			<div className='flex-grow flex flex-col min-w-0 pb-20 md:pb-0'>
				<div className='p-4 md:p-8 flex-grow overflow-y-auto custom-scrollbar'>
					<div className='max-w-4xl mx-auto space-y-8 md:space-y-10'>
						{/* Search Bar */}
						<div className='flex items-center gap-4 sticky top-0 bg-[#09090b] py-2 z-20'>
							<div className='relative flex-grow'>
								<Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500' />
								<input
									placeholder='Search songs, artists, albums...'
									className='w-full bg-white/5 border border-white/10 rounded-2xl ps-12 pe-4 py-4 text-sm outline-none focus:border-discord/30 focus:bg-white/[0.08] transition-all'
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleSearch()}
								/>
							</div>
							<button
								onClick={handleSearch}
								className='px-6 py-4 bg-discord hover:brightness-110 text-white rounded-2xl font-bold text-sm transition-all shadow-glow'>
								Search
							</button>
						</div>

						{/* Results or Queue */}
						{searchResults.length > 0 ?
							<div className='space-y-6'>
								<div className='flex items-center justify-between'>
									<h3 className='font-black text-3xl tracking-tight'>Search Results</h3>
									<button
										onClick={() => setSearchResults([])}
										className='text-xs font-bold text-zinc-500 hover:text-white uppercase transition-colors'>
										Clear
									</button>
								</div>
								<div className='grid gap-2'>
									{searchResults.map((track, idx) => (
										<div
											key={idx}
											className='group flex items-center gap-3 md:gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/5'>
											<img
												src={proxyImage(track.thumbnail)}
												alt={track.title}
												className='w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover'
											/>
											<div className='flex-grow overflow-hidden'>
												<h4 className='font-bold text-xs md:text-sm truncate'>{track.title}</h4>
												<p className='text-[9px] md:text-[10px] uppercase font-bold text-zinc-500 tracking-wider truncate'>
													{track.author}
												</p>
											</div>
											<div className='flex gap-1 md:gap-2'>
												<button
													title='play'
													onClick={(e) => {
														e.stopPropagation();
														sendCommand("play", { trackUrl: track.url });
													}}
													className='p-2 bg-discord rounded-lg text-white transition-all transform scale-90 hover:scale-100'>
													<Play className='w-3.5 h-3.5 md:w-4 md:h-4 fill-current' />
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														sendCommand("Playnext", {
															trackUrl: track.url,
															TrackPosition: 1,
														});
													}}
													className='p-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-all text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 md:px-3'>
													Next
												</button>
											</div>
										</div>
									))}
								</div>
							</div>
						:	<div className='space-y-12'>
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
													className='glass p-4 rounded-3xl flex items-center gap-4 hover:bg-white/5 transition-all cursor-pointer group'
													onClick={() => sendCommand("play", { trackUrl: track.url })}>
													<div className='relative w-16 h-16 shrink-0'>
														<img
															src={proxyImage(track.thumbnail)}
															alt={track.title}
															className='w-full h-full rounded-2xl object-cover'
														/>
														<div className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl'>
															<Play className='w-6 h-6 text-white fill-current' />
														</div>
													</div>
													<div className='flex-grow min-w-0'>
														<h4 className='font-bold text-sm truncate'>{track.title}</h4>
														<p className='text-[10px] font-bold text-zinc-500 uppercase truncate'>{track.author}</p>
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								<div className='space-y-6'>
									<div className='flex items-center justify-between'>
										<h3 className='font-black text-2xl md:text-3xl tracking-tight'>Up Next</h3>
										<div className='flex gap-4 text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest'>
											<span>{stats?.tracks || 0} tracks</span>
										</div>
									</div>

									<div className='space-y-1'>
										{stats?.queue && stats.queue.length > 0 ?
											stats.queue.map((track, idx) => (
												<div
													key={idx}
													className='group flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-3xl hover:bg-white/[0.03] transition-all cursor-pointer border border-transparent hover:border-white/5'>
													<span className='w-4 md:w-6 text-center font-bold text-xs md:text-sm text-zinc-600 group-hover:text-discord transition-colors'>
														{idx + 1}
													</span>
													<img
														src={proxyImage(track.thumbnail)}
														alt={track.title}
														className='w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover border border-white/5 shadow-lg'
													/>
													<div className='flex-grow overflow-hidden'>
														<h4 className='font-bold text-xs md:text-sm truncate'>{track.title}</h4>
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
															onClick={(e) => {
																e.stopPropagation();
																sendCommand("DelTrack", {
																	TrackPosition: idx + 1,
																});
															}}
															className='md:hidden group-hover:flex flex p-2 text-zinc-500 hover:text-red-500 transition-colors'>
															<Trash2 className='w-3.5 h-3.5 md:w-4 md:h-4' />
														</button>
														<button
															title='none'
															className='hidden md:group-hover:flex p-2 text-zinc-500 hover:text-white transition-colors'>
															<MoreVertical className='w-4 h-4' />
														</button>
													</div>
												</div>
											))
										:	<div className='py-20 text-center flex flex-col items-center gap-4 opacity-30'>
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

			{/* Mini Player - Mobile Only */}
			<div
				className='md:hidden fixed bottom-0 left-0 right-0 glass-dark border-t border-white/5 p-3 flex items-center gap-3 z-40'
				onClick={() => setIsPlayerOpen(true)}>
				<div className='relative w-12 h-12 shrink-0'>
					<img
						src={proxyImage(stats?.track?.thumbnail)}
						alt=''
						className='w-full h-full rounded-xl object-cover'
					/>
					<div className='absolute inset-0 bg-discord opacity-20 blur-xl'></div>
				</div>
				<div className='flex-grow min-w-0'>
					<h4 className='font-bold text-sm truncate'>{stats?.track?.title || "Not Playing"}</h4>
					<p className='text-[10px] font-bold text-zinc-500 uppercase truncate'>{stats?.track?.author || "Melody Engine"}</p>
				</div>
				<div className='flex items-center gap-1'>
					<button
						onClick={(e) => {
							e.stopPropagation();
							sendCommand("pause");
						}}
						className='p-3 bg-white/5 rounded-xl text-white'>
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
						className='p-3 text-zinc-400'>
						<SkipForward className='w-4 h-4 fill-current' />
					</button>
				</div>
				<div
					className='absolute top-0 left-0 h-[2px] bg-discord shadow-glow'
					style={{ width: `${progress}%` }}
				/>
			</div>

			{/* Now Playing Panel */}
			<div
				className={`shrink-0 border-l border-white/5 flex flex-col transition-all duration-500 ease-out z-50
          ${isPlayerOpen ? "fixed inset-0 bg-[#09090b]" : "hidden md:flex md:relative md:w-80 lg:w-[450px]"}
          bg-gradient-to-b from-white/[0.02] to-transparent`}>
				<div className='p-6 md:p-8 flex flex-col h-full gap-6 md:gap-8 overflow-y-auto'>
					<div className='flex items-center justify-between'>
						<button
							onClick={() => (isPlayerOpen ? setIsPlayerOpen(false) : setShowLyrics(!showLyrics))}
							className={`p-3 rounded-xl transition-all ${showLyrics && !isPlayerOpen ? "bg-discord text-white" : "bg-white/5 text-zinc-500 hover:text-white"}`}>
							{isPlayerOpen ?
								<SkipBack className='w-5 h-5 -rotate-90' />
							:	<SlidersHorizontal className='w-5 h-5' />}
						</button>
						<p className='text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400'>Now Playing</p>
						<button
							title='showLyrics'
							onClick={() => setShowLyrics(!showLyrics)}
							className={`p-3 bg-white/5 rounded-xl text-zinc-500 hover:text-white transition-all md:block ${isPlayerOpen ? "block" : "hidden"}`}>
							<LayoutGrid className='w-5 h-5' />
						</button>
					</div>

					<AnimatePresence mode='wait'>
						{showLyrics ?
							<motion.div
								key='lyrics'
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								className='flex-grow glass rounded-[2.5rem] p-8 overflow-y-auto custom-scrollbar'>
								<p className='text-zinc-400 font-bold uppercase text-[10px] tracking-widest mb-6'>Lyrics</p>
								<div className='whitespace-pre-wrap font-bold text-xl leading-relaxed text-zinc-300'>
									{lyrics || "Searching for lyrics..."}
								</div>
							</motion.div>
						:	<motion.div
								key='cover'
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.95 }}
								className='flex-grow flex flex-col gap-8 justify-center'>
								<div className='relative group perspective-1000'>
									<div className='absolute inset-0 bg-discord/20 blur-[80px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity'></div>
									<img
										src={proxyImage(
											stats?.track?.thumbnail ||
												botInfo?.avatars ||
												"https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop",
										)}
										alt='Album Art'
										className='relative w-full aspect-square rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-white/10 z-10 transform-gpu transition-all duration-700 group-hover:rotate-y-12'
									/>
								</div>

								<div className='space-y-1 md:space-y-2 text-center px-4'>
									<div className='overflow-hidden whitespace-nowrap'>
										<motion.h2
											className='font-black text-2xl md:text-3xl tracking-tighter inline-block'
											animate={stats?.track?.title?.length && stats.track.title.length > 25 ? { x: [0, -100, 0] } : {}}
											transition={{
												duration: 10,
												repeat: Infinity,
												ease: "linear",
											}}>
											{stats?.track?.title || "Ziji Music Engine"}
										</motion.h2>
									</div>
									<p className='text-xs md:text-sm font-bold text-zinc-500 uppercase tracking-[0.2em]'>
										{stats?.track?.author || "Standby Mode"}
									</p>
								</div>
							</motion.div>
						}
					</AnimatePresence>

					<div className='space-y-6 pt-4'>
						<div className='space-y-3'>
							<div className='relative h-1 w-full bg-white/5 rounded-full cursor-pointer group'>
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
									className='absolute top-0 left-0 h-full bg-gradient-to-r from-discord to-vibrant-pink shadow-glow z-10'
									initial={{ width: 0 }}
									animate={{ width: `${progress}%` }}
								/>
							</div>
							<div className='flex justify-between text-[10px] font-mono text-zinc-500 font-bold px-1'>
								<span>{formatTime(stats?.timestamp || 0)}</span>
								<span>{formatDisplayDuration(stats?.track?.duration || "0:00")}</span>
							</div>
						</div>

						<div className='flex items-center justify-center gap-4'>
							<button
								onClick={() => sendCommand("Loop")}
								className={`p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors ${stats?.repeatMode !== "off" ? "text-discord" : "text-zinc-600"}`}
								title='Loop Mode'>
								<Repeat className='w-5 h-5' />
							</button>
							<button
								onClick={() => sendCommand("AutoPlay")}
								className={`p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors ${stats?.autoPlay ? "text-green-500" : "text-zinc-600"}`}
								title='AutoPlay'>
								<Baseline className='w-5 h-5' />
							</button>
							<button
								onClick={() => sendCommand("Lock")}
								className={`p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors ${stats?.lockStatus ? "text-vibrant-pink" : "text-zinc-600"}`}
								title='Lock Player'>
								<LockKeyhole className='w-5 h-5' />
							</button>

							<div className='flex items-center gap-4 mx-2'>
								<button
									title='back'
									onClick={() => sendCommand("back")}
									className='text-zinc-500 hover:text-white transition-colors'>
									<SkipBack className='w-6 h-6 fill-current' />
								</button>
								<button
									onClick={() => sendCommand("pause")}
									className='w-16 h-16 bg-discord hover:brightness-110 rounded-3xl flex items-center justify-center shadow-glow text-white transition-transform active:scale-95'>
									{stats?.paused ?
										<Play className='w-6 h-6 fill-current translate-x-0.5' />
									:	<Pause className='w-6 h-6 fill-current' />}
								</button>
								<button
									title='skip'
									onClick={() => sendCommand("skip")}
									className='text-zinc-500 hover:text-white transition-colors'>
									<SkipForward className='w-6 h-6 fill-current' />
								</button>
							</div>

							<button
								onClick={() => sendCommand("Shuffle")}
								className='p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-zinc-600 hover:text-white'
								title='Shuffle'>
								<Shuffle className='w-5 h-5' />
							</button>
						</div>

						<div className='flex items-center gap-4 px-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5'>
							<Volume2 className='w-4 h-4 text-zinc-500' />
							<div className='relative flex-grow h-1 bg-white/10 rounded-full cursor-pointer group'>
								<input
									title='setVolume'
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
									className='absolute top-0 left-0 h-full bg-discord rounded-full shadow-glow'
									style={{ width: `${volume}%` }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
