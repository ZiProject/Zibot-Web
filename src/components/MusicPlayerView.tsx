
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, 
  Repeat, Shuffle, Music, Users, ListMusic, 
  Search, SlidersHorizontal, LayoutGrid, Heart 
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

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
  track: Track | null;
  queue: Track[];
}

export function MusicPlayerView() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);

  const wsUrl = (import.meta.env.VITE_BotAPI || '').replace('http', 'ws');
  const token = localStorage.getItem('ziji-token');
  const baseUrl = import.meta.env.VITE_BotAPI || '';

  useEffect(() => {
    if (!token) {
      setError("Please login to access the music player.");
      return;
    }

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setConnected(true);
      socket.send(JSON.stringify({ event: "identify", token }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "authenticated") {
        setAuthenticated(true);
        socket.send(JSON.stringify({ event: "GetVoice" }));
      } else if (data.event === "statistics") {
        setStats(data);
        setVolume(data.volume);
      } else if (data.event === "error") {
        setError(data.message);
      }
    };

    socket.onclose = () => {
      setConnected(false);
      setAuthenticated(false);
    };

    setWs(socket);

    return () => socket.close();
  }, [wsUrl, token]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (stats?.track?.title) {
      fetch(`${baseUrl}/music/lyrics?q=${encodeURIComponent(stats.track.title)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setLyrics(data?.lyrics || "Lyrics not found"))
      .catch(() => setLyrics("Lyrics error"));
    }
  }, [stats?.track?.title, baseUrl, token]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const res = await fetch(`${baseUrl}/music/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
    const totalSeconds = typeof ms === 'number' ? Math.floor(ms / 1000) : 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="glass p-10 rounded-3xl text-center">
          <p className="text-vibrant-pink font-bold mb-4">{error}</p>
          <a href="#/dashboard" className="text-xs uppercase tracking-widest font-black hover:text-discord transition-colors">Go Back</a>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="w-12 h-12 border-4 border-white/10 border-t-discord rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 top-16 bg-[#09090b] flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/5 flex flex-col p-6 gap-8 hidden md:flex">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-discord rounded-xl flex items-center justify-center shadow-glow">
             <Music className="w-6 h-6 text-white" />
           </div>
           <h2 className="font-black text-2xl tracking-tighter">Melody</h2>
        </div>

        <nav className="space-y-1">
          {[
            { icon: LayoutGrid, label: 'Home', active: !searchQuery },
            { icon: Search, label: 'Search', active: !!searchQuery },
            { icon: ListMusic, label: 'Your Library' },
          ].map((item, idx) => (
            <button 
              key={idx}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${item.active ? 'bg-white/5 text-white font-bold' : 'text-zinc-500 hover:text-white'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto">
           <div className="p-4 glass rounded-2xl bg-discord/10 border border-discord/20">
              <p className="text-[10px] font-black text-discord uppercase tracking-widest mb-1">Status</p>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {connected ? 'Live Sync' : 'Reconnecting...'}
              </p>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        <div className="p-6 md:p-8 flex-grow overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-10">
            {/* Search Bar */}
            <div className="flex items-center gap-4 sticky top-0 bg-[#09090b] py-2 z-20">
               <div className="relative flex-grow">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                 <input 
                   placeholder="Search songs, artists, albums..."
                   className="w-full bg-white/5 border border-white/10 rounded-2xl ps-12 pe-4 py-4 text-sm outline-none focus:border-discord/30 focus:bg-white/[0.08] transition-all"
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSearch()}
                 />
               </div>
               <button 
                 onClick={handleSearch}
                 className="px-6 py-4 bg-discord hover:brightness-110 text-white rounded-2xl font-bold text-sm transition-all shadow-glow"
               >
                 Search
               </button>
            </div>

            {/* Results or Queue */}
            {searchResults.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-3xl tracking-tight">Search Results</h3>
                  <button onClick={() => setSearchResults([])} className="text-xs font-bold text-zinc-500 hover:text-white uppercase transition-colors">Clear</button>
                </div>
                <div className="grid gap-2">
                  {searchResults.map((track, idx) => (
                    <div 
                      key={idx} 
                      className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/5"
                      onClick={() => sendCommand('play', { trackUrl: track.url })}
                    >
                      <img src={track.thumbnail} alt={track.title} className="w-12 h-12 rounded-xl object-cover" />
                      <div className="flex-grow overflow-hidden">
                        <h4 className="font-bold text-sm truncate">{track.title}</h4>
                        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider truncate">{track.author}</p>
                      </div>
                      <button className="p-2 opacity-0 group-hover:opacity-100 bg-discord rounded-lg text-white transition-all transform scale-90 group-hover:scale-100">
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="font-black text-3xl tracking-tight">Up Next</h3>
                   <div className="flex gap-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                     <span>{stats?.tracks || 0} tracks</span>
                   </div>
                </div>

                <div className="space-y-1">
                  {stats?.queue && stats.queue.length > 0 ? (
                    stats.queue.map((track, idx) => (
                      <div 
                        key={idx} 
                        className="group flex items-center gap-4 p-4 rounded-3xl hover:bg-white/[0.03] transition-all cursor-pointer border border-transparent hover:border-white/5"
                      >
                        <span className="w-6 text-center font-bold text-zinc-600 group-hover:text-discord transition-colors">{idx + 1}</span>
                        <img src={track.thumbnail} alt={track.title} className="w-12 h-12 rounded-xl object-cover border border-white/5 shadow-lg" />
                        <div className="flex-grow overflow-hidden">
                          <h4 className="font-bold text-sm truncate">{track.title}</h4>
                          <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider truncate">{track.author}</p>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 opacity-50">{track.duration}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                       <Music className="w-12 h-12" />
                       <p className="italic font-medium">Your queue is empty</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Now Playing Fixed Right Panel */}
      <div className="w-[450px] border-l border-white/5 flex flex-col hidden xl:flex bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="p-8 flex flex-col h-full gap-8">
           <div className="flex items-center justify-between">
              <button 
                onClick={() => setShowLyrics(!showLyrics)}
                className={`p-3 rounded-xl transition-all ${showLyrics ? 'bg-discord text-white' : 'bg-white/5 text-zinc-500 hover:text-white'}`}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Now Playing</p>
              <button className="p-3 bg-white/5 rounded-xl text-zinc-500 hover:text-white transition-all">
                <LayoutGrid className="w-5 h-5" />
              </button>
           </div>

           <AnimatePresence mode="wait">
             {showLyrics ? (
                <motion.div 
                  key="lyrics"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex-grow glass rounded-[2.5rem] p-8 overflow-y-auto custom-scrollbar"
                >
                  <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest mb-6">Lyrics</p>
                  <div className="whitespace-pre-wrap font-bold text-xl leading-relaxed text-zinc-300">
                    {lyrics || "Searching for lyrics..."}
                  </div>
                </motion.div>
             ) : (
                <motion.div 
                  key="cover"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex-grow flex flex-col gap-8 justify-center"
                >
                  <div className="relative group perspective-1000">
                    <div className="absolute inset-0 bg-discord/20 blur-[80px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <img 
                      src={stats?.track?.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop'} 
                      alt="Album Art" 
                      className="relative w-full aspect-square rounded-[3rem] shadow-2xl border border-white/10 z-10 transform-gpu transition-all duration-700 group-hover:rotate-y-12"
                    />
                  </div>

                  <div className="space-y-2 text-center px-4">
                    <div className="overflow-hidden whitespace-nowrap">
                       <motion.h2 
                        className="font-black text-3xl tracking-tighter inline-block"
                        animate={stats?.track?.title?.length && stats.track.title.length > 25 ? { x: [0, -100, 0] } : {}}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                       >
                         {stats?.track?.title || 'Ziji Music Engine'}
                       </motion.h2>
                    </div>
                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-[0.2em]">{stats?.track?.author || 'Standby Mode'}</p>
                  </div>
                </motion.div>
             )}
           </AnimatePresence>

           <div className="space-y-6 pt-4">
              <div className="space-y-3">
                <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
                   <motion.div 
                     className="absolute top-0 left-0 h-full bg-gradient-to-r from-discord to-vibrant-pink shadow-glow"
                     initial={{ width: 0 }}
                     animate={{ width: `${progress}%` }}
                   />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 font-bold px-1">
                   <span>{formatTime(stats?.timestamp || 0)}</span>
                   <span>{stats?.track?.duration || '0:00'}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6">
                 <button onClick={() => sendCommand('repeat', { mode: (parseInt(stats?.repeatMode || '0') + 1) % 3 })} className={`p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors ${stats?.repeatMode !== 'off' ? 'text-discord' : 'text-zinc-600'}`}>
                   <Repeat className="w-5 h-5" />
                 </button>
                 <div className="flex items-center gap-4">
                    <button onClick={() => sendCommand('back')} className="text-zinc-500 hover:text-white transition-colors"><SkipBack className="w-6 h-6 fill-current" /></button>
                    <button 
                      onClick={() => sendCommand('pause')}
                      className="w-20 h-20 bg-discord hover:brightness-110 rounded-[2.5rem] flex items-center justify-center shadow-glow text-white transition-transform active:scale-95"
                    >
                      {stats?.paused ? <Play className="w-8 h-8 fill-current translate-x-0.5" /> : <Pause className="w-8 h-8 fill-current" />}
                    </button>
                    <button onClick={() => sendCommand('skip')} className="text-zinc-500 hover:text-white transition-colors"><SkipForward className="w-6 h-6 fill-current" /></button>
                 </div>
                 <button onClick={() => sendCommand('shuffle')} className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-zinc-600 hover:text-white">
                   <Shuffle className="w-5 h-5" />
                 </button>
              </div>

              <div className="flex items-center gap-4 px-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                 <Volume2 className="w-4 h-4 text-zinc-500" />
                 <div className="relative flex-grow h-1 bg-white/10 rounded-full cursor-pointer group">
                   <input 
                     type="range" 
                     min="0" max="100" 
                     value={volume}
                     onChange={e => {
                       const val = parseInt(e.target.value);
                       setVolume(val);
                       sendCommand('volume', { volume: val });
                     }}
                     className="absolute inset-0 w-full opacity-0 z-10 cursor-pointer" 
                   />
                   <div className="absolute top-0 left-0 h-full bg-discord rounded-full shadow-glow" style={{ width: `${volume}%` }} />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
