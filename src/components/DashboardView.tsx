import { motion } from "motion/react";
import { ReactNode, useState, useEffect } from "react";
import {
	Activity,
	ShieldCheck,
	Hash,
	UserCircle,
	Globe,
	Terminal,
	Info,
	AlertCircle,
	Settings,
	Server,
	Save,
	ChevronRight,
	Volume2,
	Palette,
	Languages,
	MoreHorizontal,
} from "lucide-react";
import { BotInfo, apiUrl } from "../services/discordActivity";
import { useLanguage } from "../context/LanguageContext";

interface DashboardViewProps {
	botInfo: BotInfo | null;
	loading: boolean;
	error: string | null;
}

type Tab = "status" | "settings" | "servers";

export function DashboardView({ botInfo, loading, error }: DashboardViewProps) {
	const { t, language } = useLanguage();
	const [user, setUser] = useState<any>(null);
	const [activeTab, setActiveTab] = useState<Tab>("status");
	const [guilds, setGuilds] = useState<any[]>([]);
	const [userSettings, setUserSettings] = useState<any>(null);
	const [saving, setSaving] = useState(false);
	const [selectedGuild, setSelectedGuild] = useState<any>(null);
	const [guildSettings, setGuildSettings] = useState<any>(null);
	const [autoResponders, setAutoResponders] = useState<any[]>([]);
	const [welcomeSettings, setWelcomeSettings] = useState<any>(null);
	const [confessSettings, setConfessSettings] = useState<any>(null);
	const [editingResponder, setEditingResponder] = useState<any>(null);
	const [newResponder, setNewResponder] = useState({
		trigger: "",
		response: "",
		options: { matchMode: "exactly" },
	});

	const token = localStorage.getItem("ziji-token");

	useEffect(() => {
		if (token) {
			fetch(apiUrl("/user/me"), {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			})
				.then((res) => res.json())
				.then((data) => setUser(data))
				.catch((err) => console.error("Dashboard: Failed to fetch user info", err));

			fetch(apiUrl("/user/settings"), {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			})
				.then((res) => res.json())
				.then((data) => setUserSettings(data))
				.catch((err) => console.error("Dashboard: Failed to fetch user settings", err));

			fetch(apiUrl("/user/guilds"), {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			})
				.then((res) => res.json())
				.then((data) => setGuilds(data))
				.catch((err) => console.error("Dashboard: Failed to fetch user guilds", err));
		}
	}, [token, apiUrl]);

	const fetchGuildSettings = async (guildId: string) => {
		try {
			const res = await fetch(apiUrl(`/guild/${guildId}`), {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			});
			const data = await res.json();
			setGuildSettings(data);

			// Fetch extras
			fetchAutoResponders(guildId);
			fetchWelcomeSettings(guildId);
			fetchConfessSettings(guildId);
		} catch (err) {
			console.error(err);
		}
	};

	const fetchAutoResponders = async (guildId: string) => {
		try {
			const res = await fetch(apiUrl(`/guild/${guildId}/autoresponder`), {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			});
			const data = await res.json();
			setAutoResponders(data);
		} catch (err) {
			console.error(err);
		}
	};

	const fetchWelcomeSettings = async (guildId: string) => {
		try {
			const res = await fetch(apiUrl(`/guild/${guildId}/welcome`), {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			});
			const data = await res.json();
			setWelcomeSettings(data);
		} catch (err) {
			console.error(err);
		}
	};

	const fetchConfessSettings = async (guildId: string) => {
		try {
			const res = await fetch(apiUrl(`/guild/${guildId}/confess`), {
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			});
			const data = await res.json();
			setConfessSettings(data);
		} catch (err) {
			console.error(err);
		}
	};

	const addAutoResponder = async () => {
		if (!token || !selectedGuild || !newResponder.trigger || !newResponder.response) return;
		setSaving(true);
		try {
			await fetch(apiUrl(`/guild/${selectedGuild.id}/autoresponder`), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"ngrok-skip-browser-warning": "true",
				},
				body: JSON.stringify(
					editingResponder ? { ...newResponder, id: editingResponder._id || editingResponder.id } : newResponder,
				),
			});
			setNewResponder({ trigger: "", response: "", options: { matchMode: "exactly" } });
			setEditingResponder(null);
			fetchAutoResponders(selectedGuild.id);
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	};

	const handleEditResponder = (ar: any) => {
		setEditingResponder(ar);
		setNewResponder({
			trigger: ar.trigger,
			response: ar.response,
			options: ar.options || { matchMode: "exactly" },
		});
		document.getElementById("autoresponder-form")?.scrollIntoView({ behavior: "smooth" });
	};

	const deleteAutoResponder = async (id: string) => {
		if (!token || !selectedGuild) return;
		setSaving(true);
		try {
			await fetch(apiUrl(`/guild/${selectedGuild.id}/autoresponder/${id}`), {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
					"ngrok-skip-browser-warning": "true",
				},
			});
			fetchAutoResponders(selectedGuild.id);
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	};

	const saveWelcome = async () => {
		if (!token || !selectedGuild) return;
		setSaving(true);
		try {
			await fetch(apiUrl(`/guild/${selectedGuild.id}/welcome`), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"ngrok-skip-browser-warning": "true",
				},
				body: JSON.stringify(welcomeSettings),
			});
			alert("Welcome settings saved!");
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	};

	const saveConfess = async () => {
		if (!token || !selectedGuild) return;
		setSaving(true);
		try {
			await fetch(apiUrl(`/guild/${selectedGuild.id}/confess`), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"ngrok-skip-browser-warning": "true",
				},
				body: JSON.stringify(confessSettings),
			});
			alert("Confess settings saved!");
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	};

	const saveGuildSettings = async () => {
		if (!token || !selectedGuild) return;
		setSaving(true);
		try {
			await fetch(apiUrl(`/guild/${selectedGuild.id}`), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"ngrok-skip-browser-warning": "true",
				},
				body: JSON.stringify(guildSettings),
			});
			alert("Guild settings saved!");
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	};

	const saveUserSettings = async () => {
		if (!token) return;
		setSaving(true);
		try {
			await fetch(apiUrl("/user/settings"), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"ngrok-skip-browser-warning": "true",
				},
				body: JSON.stringify(userSettings),
			});
			alert("Settings saved!");
		} catch (err) {
			console.error(err);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className='pt-32 px-6 flex flex-col items-center justify-center min-h-[60vh]'>
				<div className='w-12 h-12 border-4 border-discord/20 border-t-discord rounded-full animate-spin'></div>
				<p className='mt-4 text-zinc-400 font-bold uppercase tracking-widest text-xs'>...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className='pt-32 px-6 flex flex-col items-center justify-center min-h-[60vh] text-center'>
				<div className='p-6 bg-red-500/10 rounded-3xl text-red-500 mb-6 glow'>
					<AlertCircle className='w-16 h-16' />
				</div>
				<h2 className='text-3xl font-extrabold mb-3 tracking-tight'>API Error</h2>
				<p className='text-zinc-400 max-w-md font-medium leading-relaxed'>{error}</p>
				<button
					onClick={() => window.location.reload()}
					className='mt-8 px-10 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-bold transition-all hover:scale-105'>
					Retry
				</button>
			</div>
		);
	}

	return (
		<div className='pt-32 pb-24 px-6 max-w-7xl mx-auto'>
			{/* Header Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className='flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12'>
				<div>
					<div className='inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-bold text-discord uppercase tracking-widest mb-4'>
						<span className='w-2 h-2 rounded-full bg-green-500 animate-pulse'></span>
						{t("systemOnline")}
					</div>
					<h2 className='text-5xl font-extrabold tracking-tighter'>
						{/* {t("dashboardTitle")
              .split(" ")
              .map((word, i, arr) => (
                <span
                  key={i}
                  className={i === arr.length - 1 ? "text-discord" : ""}
                >
                  {word}{" "}
                </span>
              ))} */}
						<span
							key={1}
							className='text-discord'>
							{botInfo?.clientName}
						</span>
						dashboard
					</h2>
					<p className='text-zinc-500 font-medium mt-2'>{t("dashboardSub")}</p>
				</div>
				<div className='flex flex-col md:items-end gap-2'>
					<div className='flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-2xl text-xs font-black uppercase tracking-widest border border-green-500/20'>
						<Activity className='w-4 h-4' />
						{t("stableOperation")}
					</div>
					<span className='text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]'>{t("lastUpdate")}</span>
				</div>
			</motion.div>

			{/* Tabs Selection */}
			<div className='flex flex-wrap gap-2 mb-12 p-1.5 glass rounded-3xl w-fit'>
				<button
					onClick={() => setActiveTab("status")}
					className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === "status" ? "bg-discord text-white shadow-lg" : "text-zinc-500 hover:text-white"}`}>
					<Activity className='w-4 h-4' /> {t("status")}
				</button>
				<button
					onClick={() => setActiveTab("settings")}
					className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === "settings" ? "bg-discord text-white shadow-lg" : "text-zinc-500 hover:text-white"}`}>
					<Settings className='w-4 h-4' /> {t("settings")}
				</button>
				<button
					onClick={() => setActiveTab("servers")}
					className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === "servers" ? "bg-discord text-white shadow-lg" : "text-zinc-500 hover:text-white"}`}>
					<Server className='w-4 h-4' /> {t("guildManagement")}
				</button>
			</div>

			<div className='min-h-[400px]'>
				{activeTab === "status" && (
					<div className='animate-in fade-in slide-in-from-bottom-4 duration-500'>
						<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12'>
							<StatCard
								icon={<Terminal className='text-discord' />}
								label={t("botName")}
								value={botInfo?.clientName || "Ziji"}
							/>
							<StatCard
								icon={<UserCircle className='text-vibrant-pink' />}
								label={t("botId")}
								value={botInfo?.clientId || "..."}
								subValue='Click to copy'
							/>
							<StatCard
								icon={<ShieldCheck className='text-blue-400' />}
								label={t("status")}
								value={botInfo?.status || "OK"}
								accent={botInfo?.status === "OK" ? "text-green-500" : "text-yellow-500"}
							/>
							<StatCard
								icon={<Globe className='text-orange-400' />}
								label={t("serverRegion")}
								value='Singapore'
								subValue='24ms Latency'
							/>
						</div>

						<div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
							<motion.div
								initial={{ opacity: 0, x: -20 }}
								animate={{ opacity: 1, x: 0 }}
								className='lg:col-span-5 glass rounded-[2.5rem] p-10 flex flex-col gap-8'>
								<div className='flex items-center justify-between'>
									<h3 className='font-extrabold text-2xl tracking-tight flex items-center gap-3'>
										<UserCircle className='w-7 h-7 text-discord' />
										{t("account")}
									</h3>
									{!user && (
										<a
											href={`${apiUrl("/auth/discord/login")}`}
											className='text-[10px] uppercase tracking-widest font-bold text-discord hover:text-white transition-colors'>
											{t("login")}
										</a>
									)}
								</div>
								<div className='flex items-center gap-6'>
									{user ?
										<div className='relative group'>
											<img
												src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
												alt={user.username}
												className='w-20 h-20 rounded-[2rem] border-2 border-discord group-hover:rotate-6 transition-transform'
											/>
										</div>
									:	<div className='w-20 h-20 rounded-[2rem] bg-zinc-900 border border-white/5 flex items-center justify-center text-3xl font-black text-zinc-700'>
											U
										</div>
									}
									<div>
										<p className='font-black text-2xl tracking-tight'>{user ? user.username : t("guest")}</p>
										<p className='text-zinc-600 font-mono text-sm'>{user ? `#${user.id.slice(-4)}` : "#guest_1337"}</p>
									</div>
								</div>
								<div className='grid grid-cols-1 gap-4'>
									<div className='flex justify-between items-center p-5 bg-white/[0.02] border border-white/5 rounded-2xl'>
										<span className='text-zinc-500 font-bold uppercase text-[10px] tracking-widest'>{t("level")}</span>
										<span className='font-mono text-xl font-bold text-discord'>{user ? user.level : 0}</span>
									</div>
									<div className='flex justify-between items-center p-5 bg-white/[0.02] border border-white/5 rounded-2xl'>
										<span className='text-zinc-500 font-bold uppercase text-[10px] tracking-widest'>{t("balance")}</span>
										<span className='font-mono text-xl font-bold text-yellow-500'>{user ? user.coin : 0} 🪙</span>
									</div>
								</div>
								{!user && (
									<div className='p-4 bg-discord/5 border border-discord/10 rounded-2xl'>
										<p className='text-[10px] font-bold text-discord text-center uppercase tracking-[0.1em]'>{t("syncPrompt")}</p>
									</div>
								)}
							</motion.div>

							<motion.div
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								className='lg:col-span-7 glass rounded-[2.5rem] p-10 flex flex-col'>
								<h3 className='font-extrabold text-2xl tracking-tight mb-8 flex items-center gap-3'>
									<Info className='w-7 h-7 text-vibrant-pink' />
									{t("opsLog")}
								</h3>
								<div className='space-y-8 flex-grow'>
									<div className='p-8 bg-white/[0.02] border border-white/5 rounded-[2rem]'>
										<p className='text-zinc-600 font-bold uppercase text-[10px] tracking-widest mb-4'>{t("apiMsg")}</p>
										<blockquote className='text-2xl font-bold italic border-l-4 border-vibrant-pink pl-6 py-2 tracking-tight'>
											"{botInfo?.content || "Welcome to Ziji Engine"}"
										</blockquote>
									</div>
									<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
										<div className='p-6 border border-white/5 rounded-2xl bg-zinc-900/30'>
											<div className='flex items-center gap-2 text-zinc-600 font-bold uppercase text-[10px] tracking-widest mb-3'>
												<Hash className='w-3 h-3' /> {t("version")}
											</div>
											<p className='font-mono text-2xl font-bold'>2.4.1-STABLE</p>
										</div>
										<div className='p-6 border border-white/5 rounded-2xl bg-zinc-900/30'>
											<div className='flex items-center gap-2 text-zinc-600 font-bold uppercase text-[10px] tracking-widest mb-3'>
												<Hash className='w-3 h-3' /> {t("runtime")}
											</div>
											<p className='font-mono text-2xl font-bold'>NODE 20 LTS</p>
										</div>
									</div>
								</div>
								<div className='mt-8 flex items-center gap-4 p-5 bg-discord/10 rounded-2xl border border-discord/20'>
									<div className='p-2 bg-discord rounded-lg text-white'>
										<Terminal className='w-5 h-5' />
									</div>
									<p className='text-xs font-bold text-discord uppercase tracking-wider'>{t("clusterStable")}</p>
								</div>
							</motion.div>
						</div>
					</div>
				)}

				{/* User Settings Tab */}
				{activeTab === "settings" && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className='glass rounded-[2.5rem] p-10 max-w-3xl mx-auto'>
						<h3 className='font-extrabold text-2xl tracking-tight mb-8'>{t("userSettings")}</h3>

						{!userSettings ?
							<p className='text-zinc-500 text-center py-12'>{t("syncPrompt")}</p>
						:	<div className='space-y-8'>
								<div className='space-y-4'>
									<label className='flex items-center gap-3 text-sm font-bold text-zinc-400 uppercase tracking-widest'>
										<Languages className='w-4 h-4 text-discord' /> {t("language")}
									</label>
									<div className='flex gap-4'>
										{["vi", "en", "ja"].map((l) => (
											<button
												key={l}
												onClick={() => setUserSettings({ ...userSettings, lang: l })}
												className={`px-6 py-3 rounded-2xl font-bold border-2 transition-all ${userSettings.lang === l ? "bg-discord border-discord text-white shadow-glow" : "border-white/5 bg-white/5 text-zinc-500"}`}>
												{l.toUpperCase()}
											</button>
										))}
									</div>
								</div>

								<div className='space-y-4'>
									<label className='flex items-center gap-3 text-sm font-bold text-zinc-400 uppercase tracking-widest'>
										<Volume2 className='w-4 h-4 text-discord' /> {t("volume")} ({userSettings.volume}%)
									</label>
									<input
										title='volume'
										type='range'
										min='0'
										max='100'
										value={userSettings.volume}
										onChange={(e) =>
											setUserSettings({
												...userSettings,
												volume: parseInt(e.target.value),
											})
										}
										className='w-full accent-discord'
									/>
								</div>

								<div className='space-y-4'>
									<label className='flex items-center gap-3 text-sm font-bold text-zinc-400 uppercase tracking-widest'>
										<Palette className='w-4 h-4 text-discord' /> {t("color")}
									</label>
									<select
										title='color'
										value={userSettings.color}
										onChange={(e) =>
											setUserSettings({
												...userSettings,
												color: e.target.value,
											})
										}
										className='w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-discord transition-colors'>
										<option value='Random'>Random</option>
										<option value='Blue'>Blue</option>
										<option value='Pink'>Pink</option>
										<option value='Gold'>Gold</option>
									</select>
								</div>

								<div className='pt-8'>
									<button
										onClick={saveUserSettings}
										disabled={saving}
										className='flex items-center justify-center gap-2 w-full py-5 bg-discord hover:brightness-110 disabled:opacity-50 text-white rounded-[1.5rem] font-black text-lg transition-all shadow-xl hover:glow'>
										{saving ?
											<div className='w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin'></div>
										:	<Save className='w-5 h-5' />}
										{t("save")}
									</button>
								</div>
							</div>
						}
					</motion.div>
				)}

				{/* Guild Management Tab */}
				{activeTab === "servers" && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className='space-y-6'>
						<div className='flex items-center justify-between px-2'>
							<h3 className='font-extrabold text-2xl tracking-tight'>
								{selectedGuild ? selectedGuild.name : t("guildManagement")}
							</h3>
							{selectedGuild && (
								<button
									onClick={() => {
										setSelectedGuild(null);
										setGuildSettings(null);
									}}
									className='px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all'>
									Back
								</button>
							)}
						</div>

						{!selectedGuild ?
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
								{guilds.map((guild) => (
									<div
										key={guild.id}
										className='glass rounded-[2rem] p-6 hover:bg-white/[0.05] transition-all group'>
										<div className='flex items-center gap-4 mb-6'>
											<img
												src={
													guild.icon ?
														`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
													:	"https://cdn.discordapp.com/embed/avatars/0.png"
												}
												alt={guild.name}
												className='w-14 h-14 rounded-2xl border border-white/10 shadow-lg group-hover:scale-105 transition-transform'
											/>
											<div className='flex-grow overflow-hidden'>
												<h4 className='font-black text-lg truncate group-hover:text-discord transition-colors'>{guild.name}</h4>
												<p className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>ID: {guild.id}</p>
											</div>
										</div>
										<button
											onClick={() => {
												setSelectedGuild(guild);
												fetchGuildSettings(guild.id);
											}}
											className='flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-discord text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all'>
											{t("manage")} <ChevronRight className='w-4 h-4' />
										</button>
									</div>
								))}
								<a
									href={botInfo?.inviteUrl || "#"}
									target='_blank'
									rel='noreferrer'
									className='glass rounded-[2rem] p-6 border-dashed border-2 border-white/10 flex flex-col items-center justify-center gap-3 hover:border-discord/50 transition-all group'>
									<div className='w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-discord group-hover:text-white transition-all text-zinc-400'>
										<MoreHorizontal className='w-6 h-6' />
									</div>
									<p className='text-zinc-500 font-bold uppercase tracking-widest text-[10px]'>{t("invite")}</p>
								</a>
							</div>
						:	<div className='glass rounded-[2.5rem] p-10 max-w-3xl mx-auto space-y-8'>
								{!guildSettings ?
									<div className='flex justify-center py-10'>
										<div className='w-10 h-10 border-4 border-discord/10 border-t-discord rounded-full animate-spin'></div>
									</div>
								:	<div className='space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300'>
										<div className='flex flex-col gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl'>
											<div className='flex items-center justify-between'>
												<div className='flex items-center gap-3'>
													<div className='p-3 bg-discord/10 rounded-2xl text-discord'>
														<ShieldCheck className='w-5 h-5' />
													</div>
													<span className='font-black text-sm uppercase tracking-widest'>{t("autoRole")}</span>
												</div>
												<button
													title='guildSettings'
													onClick={() =>
														setGuildSettings({
															...guildSettings,
															autoRole: {
																...guildSettings.autoRole,
																enabled: !guildSettings.autoRole?.enabled,
															},
														})
													}
													className={`w-12 h-6 rounded-full transition-colors relative ${guildSettings.autoRole?.enabled ? "bg-discord" : "bg-zinc-800"}`}>
													<div
														className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${guildSettings.autoRole?.enabled ? "translate-x-6" : ""}`}
													/>
												</button>
											</div>
											{guildSettings.autoRole?.enabled && (
												<div className='mt-4'>
													<p className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3'>
														Role IDs (Comma separated)
													</p>
													<input
														title='guildSettings'
														type='text'
														value={guildSettings.autoRole.roleIds?.join(", ") || ""}
														onChange={(e) =>
															setGuildSettings({
																...guildSettings,
																autoRole: {
																	...guildSettings.autoRole,
																	roleIds: e.target.value.split(",").map((s) => s.trim()),
																},
															})
														}
														className='w-full bg-black/20 border border-white/5 rounded-xl p-3 font-mono text-sm outline-none focus:border-discord/50 transition-colors'
													/>
												</div>
											)}
										</div>

										<div className='flex flex-col gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl'>
											<div className='flex items-center justify-between'>
												<div className='flex items-center gap-3'>
													<div className='p-3 bg-vibrant-pink/10 rounded-2xl text-vibrant-pink'>
														<Activity className='w-5 h-5' />
													</div>
													<span className='font-black text-sm uppercase tracking-widest'>{t("joinToCreate")}</span>
												</div>
												<button
													title='setGuildSettings'
													onClick={() =>
														setGuildSettings({
															...guildSettings,
															joinToCreate: {
																...guildSettings.joinToCreate,
																enabled: !guildSettings.joinToCreate?.enabled,
															},
														})
													}
													className={`w-12 h-6 rounded-full transition-colors relative ${guildSettings.joinToCreate?.enabled ? "bg-vibrant-pink" : "bg-zinc-800"}`}>
													<div
														className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${guildSettings.joinToCreate?.enabled ? "translate-x-6" : ""}`}
													/>
												</button>
											</div>
											{guildSettings.joinToCreate?.enabled && (
												<div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-4'>
													<div>
														<p className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2'>Voice Channel ID</p>
														<input
															title='voiceChannelId'
															className='w-full bg-black/20 border border-white/5 rounded-xl p-3 font-mono text-sm outline-none focus:border-discord/50 transition-colors'
															value={guildSettings.joinToCreate.voiceChannelId || ""}
															onChange={(e) =>
																setGuildSettings({
																	...guildSettings,
																	joinToCreate: { ...guildSettings.joinToCreate, voiceChannelId: e.target.value },
																})
															}
														/>
													</div>
													<div>
														<p className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2'>Category ID</p>
														<input
															title='categoryId'
															className='w-full bg-black/20 border border-white/5 rounded-xl p-3 font-mono text-sm outline-none focus:border-discord/50 transition-colors'
															value={guildSettings.joinToCreate.categoryId || ""}
															onChange={(e) =>
																setGuildSettings({
																	...guildSettings,
																	joinToCreate: { ...guildSettings.joinToCreate, categoryId: e.target.value },
																})
															}
														/>
													</div>
												</div>
											)}
										</div>

										<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
											<div className='p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4'>
												<div className='flex items-center justify-between'>
													<span className='font-black text-sm uppercase tracking-widest'>Voice Log</span>
													<button
														title='voiceLog'
														onClick={() =>
															setGuildSettings({
																...guildSettings,
																voice: { ...guildSettings.voice, logMode: !guildSettings.voice?.logMode },
															})
														}
														className={`w-10 h-5 rounded-full transition-colors relative ${guildSettings.voice?.logMode ? "bg-discord" : "bg-zinc-800"}`}>
														<div
															className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${guildSettings.voice?.logMode ? "translate-x-5" : ""}`}
														/>
													</button>
												</div>
												<div>
													<p className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2'>Music Channel ID</p>
													<input
														title='musicChannel'
														className='w-full bg-black/20 border border-white/5 rounded-xl p-3 font-mono text-sm outline-none focus:border-discord/50 transition-colors'
														value={guildSettings.music_channel || ""}
														onChange={(e) => setGuildSettings({ ...guildSettings, music_channel: e.target.value })}
													/>
												</div>
											</div>

											<div className='p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4'>
												<div className='flex items-center justify-between'>
													<span className='font-black text-sm uppercase tracking-widest'>Noi Tu (Word Game)</span>
													<button
														title='noitu'
														onClick={() =>
															setGuildSettings({
																...guildSettings,
																noitu: { ...guildSettings.noitu, enabled: !guildSettings.noitu?.enabled },
															})
														}
														className={`w-10 h-5 rounded-full transition-colors relative ${guildSettings.noitu?.enabled ? "bg-discord" : "bg-zinc-800"}`}>
														<div
															className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${guildSettings.noitu?.enabled ? "translate-x-5" : ""}`}
														/>
													</button>
												</div>
												{guildSettings.noitu?.enabled && (
													<div>
														<p className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2'>Game Channel ID</p>
														<input
															title='noituChannel'
															className='w-full bg-black/20 border border-white/5 rounded-xl p-3 font-mono text-sm outline-none focus:border-discord/50 transition-colors'
															value={guildSettings.noitu.channel || ""}
															onChange={(e) =>
																setGuildSettings({
																	...guildSettings,
																	noitu: { ...guildSettings.noitu, channel: e.target.value },
																})
															}
														/>
													</div>
												)}
											</div>
										</div>

										<div className='pt-8'>
											<button
												onClick={saveGuildSettings}
												disabled={saving}
												className='flex items-center justify-center gap-2 w-full py-5 bg-discord hover:brightness-110 disabled:opacity-50 text-white rounded-[1.5rem] font-black text-lg transition-all shadow-xl hover:glow'>
												{saving ?
													<div className='w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin'></div>
												:	<Save className='w-5 h-5' />}
												{t("save")}
											</button>
										</div>

										{/* Autoresponder Section */}
										<div className='space-y-6 pt-10 border-t border-white/5'>
											<div className='flex items-center gap-3'>
												<Terminal className='w-6 h-6 text-discord' />
												<h4 className='font-black text-xl uppercase tracking-tighter'>Autoresponder</h4>
											</div>

											<div className='grid gap-4'>
												{autoResponders.map((ar, idx) => (
													<div
														key={idx}
														className='p-4 bg-white/5 rounded-2xl flex justify-between items-center border border-white/5 group relative overflow-hidden'>
														<div>
															<p className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
																Trigger ({ar.options?.matchMode || "exactly"})
															</p>
															<p className='font-bold text-sm'>{ar.trigger}</p>
														</div>
														<div className='text-right pr-10'>
															<p className='text-[10px] font-bold text-discord uppercase tracking-widest'>Response</p>
															<p className='font-mono text-xs opacity-70 truncate max-w-[200px]'>{ar.response}</p>
														</div>
														<div className='flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity'>
															<button
																title='Edit Responder'
																onClick={() => handleEditResponder(ar)}
																className='p-2 text-zinc-500 hover:text-discord transition-colors'>
																<Settings className='w-4 h-4' />
															</button>
															<button
																title='Delete Responder'
																onClick={() => deleteAutoResponder(ar._id || ar.id)}
																className='p-2 text-zinc-500 hover:text-red-500 transition-colors'>
																<AlertCircle className='w-5 h-5' />
															</button>
														</div>
													</div>
												))}
											</div>

											<div
												id='autoresponder-form'
												className='p-6 bg-white/5 rounded-3xl space-y-4 border border-white/10'>
												<div className='flex items-center justify-between'>
													<p className='font-bold text-xs uppercase tracking-widest text-zinc-400'>
														{editingResponder ? "Edit Responder" : "Add New Responder"}
													</p>
													{editingResponder && (
														<button
															onClick={() => {
																setEditingResponder(null);
																setNewResponder({ trigger: "", response: "", options: { matchMode: "exactly" } });
															}}
															className='text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest'>
															Cancel Edit
														</button>
													)}
												</div>
												<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
													<input
														placeholder='Trigger (e.g. hello)'
														className='bg-black/40 p-4 rounded-xl text-sm border border-white/10 outline-none focus:border-discord/50 transition-all font-mono'
														value={newResponder.trigger}
														onChange={(e) =>
															setNewResponder({
																...newResponder,
																trigger: e.target.value,
															})
														}
													/>
													<input
														placeholder='Response (e.g. hi there!)'
														className='bg-black/40 p-4 rounded-xl text-sm border border-white/10 outline-none focus:border-discord/50 transition-all font-mono'
														value={newResponder.response}
														onChange={(e) =>
															setNewResponder({
																...newResponder,
																response: e.target.value,
															})
														}
													/>
												</div>
												<div className='flex items-center gap-4'>
													<span className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>Match Mode:</span>
													{["exactly", "includes", "startsWith", "endsWith"].map((m) => (
														<button
															key={m}
															onClick={() =>
																setNewResponder({
																	...newResponder,
																	options: { ...newResponder.options, matchMode: m },
																})
															}
															className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${newResponder.options.matchMode === m ? "bg-discord text-white" : "bg-white/5 text-zinc-500 hover:text-white"}`}>
															{m}
														</button>
													))}
												</div>
												<button
													onClick={addAutoResponder}
													disabled={saving}
													className='w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-xs uppercase tracking-widest transition-all'>
													{editingResponder ? "Update Responder" : "Add Responder"}
												</button>
											</div>
										</div>

										{/* Welcome System Section */}
										<div className='space-y-6 pt-10 border-t border-white/5'>
											<div className='flex items-center gap-3'>
												<Globe className='w-6 h-6 text-green-400' />
												<h4 className='font-black text-xl uppercase tracking-tighter'>Welcome & Goodbye</h4>
											</div>

											{welcomeSettings && (
												<div className='space-y-6'>
													<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
														<div className='space-y-3'>
															<label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
																Welcome Channel ID
															</label>
															<input
																title='welcomeSettings'
																className='w-full bg-white/5 p-4 rounded-xl text-sm border border-white/10 font-mono'
																value={welcomeSettings.channel || ""}
																onChange={(e) =>
																	setWelcomeSettings({
																		...welcomeSettings,
																		channel: e.target.value,
																	})
																}
															/>
														</div>
														<div className='space-y-3'>
															<label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
																Welcome Content
															</label>
															<textarea
																title='welcomeSettings'
																className='w-full bg-white/5 p-4 rounded-xl text-sm border border-white/10 h-24 font-mono'
																value={welcomeSettings.content || ""}
																onChange={(e) =>
																	setWelcomeSettings({
																		...welcomeSettings,
																		content: e.target.value,
																	})
																}
															/>
														</div>
													</div>

													<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
														<div className='space-y-3'>
															<label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
																Goodbye Channel ID
															</label>
															<input
																title='welcomeSettings'
																className='w-full bg-white/5 p-4 rounded-xl text-sm border border-white/10 font-mono'
																value={welcomeSettings.Bchannel || ""}
																onChange={(e) =>
																	setWelcomeSettings({
																		...welcomeSettings,
																		Bchannel: e.target.value,
																	})
																}
															/>
														</div>
														<div className='space-y-3'>
															<label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
																Goodbye Content
															</label>
															<textarea
																title='welcomeSettings'
																className='w-full bg-white/5 p-4 rounded-xl text-sm border border-white/10 h-24 font-mono'
																value={welcomeSettings.Bcontent || ""}
																onChange={(e) =>
																	setWelcomeSettings({
																		...welcomeSettings,
																		Bcontent: e.target.value,
																	})
																}
															/>
														</div>
													</div>

													<button
														onClick={saveWelcome}
														disabled={saving}
														className='w-full py-4 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-xl font-black text-sm uppercase tracking-widest transition-all'>
														Save Welcome Settings
													</button>
												</div>
											)}
										</div>

										{/* Confession System Section */}
										<div className='space-y-6 pt-10 border-t border-white/5'>
											<div className='flex items-center gap-3'>
												<ShieldCheck className='w-6 h-6 text-discord' />
												<h4 className='font-black text-xl uppercase tracking-tighter'>Confession System</h4>
											</div>

											{confessSettings && (
												<div className='space-y-6'>
													<div className='flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-3xl'>
														<div className='flex items-center gap-3'>
															<span className='font-black text-sm uppercase tracking-widest'>Enable System</span>
														</div>
														<button
															title='enableConfess'
															onClick={() =>
																setConfessSettings({
																	...confessSettings,
																	enabled: !confessSettings.enabled,
																})
															}
															className={`w-12 h-6 rounded-full transition-colors relative ${confessSettings.enabled ? "bg-discord" : "bg-zinc-800"}`}>
															<div
																className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${confessSettings.enabled ? "translate-x-6" : ""}`}
															/>
														</button>
													</div>

													<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
														<div className='space-y-3'>
															<label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
																Confession Channel ID
															</label>
															<input
																title='confessChannel'
																className='w-full bg-white/5 p-4 rounded-xl text-sm border border-white/10 font-mono'
																value={confessSettings.channelId || ""}
																onChange={(e) =>
																	setConfessSettings({
																		...confessSettings,
																		channelId: e.target.value,
																	})
																}
															/>
														</div>
														<div className='space-y-3'>
															<div className='flex items-center justify-between mb-1'>
																<label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
																	Review System
																</label>
																<button
																	title='reviewSystem'
																	onClick={() =>
																		setConfessSettings({
																			...confessSettings,
																			reviewSystem: !confessSettings.reviewSystem,
																		})
																	}
																	className={`w-10 h-5 rounded-full transition-colors relative ${confessSettings.reviewSystem ? "bg-discord" : "bg-zinc-800"}`}>
																	<div
																		className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${confessSettings.reviewSystem ? "translate-x-5" : ""}`}
																	/>
																</button>
															</div>
															{confessSettings.reviewSystem && (
																<input
																	placeholder='Review Channel ID'
																	title='reviewChannelId'
																	className='w-full bg-white/5 p-4 rounded-xl text-sm border border-white/10 font-mono'
																	value={confessSettings.reviewChannelId || ""}
																	onChange={(e) =>
																		setConfessSettings({
																			...confessSettings,
																			reviewChannelId: e.target.value,
																		})
																	}
																/>
															)}
														</div>
													</div>

													<button
														onClick={saveConfess}
														disabled={saving}
														className='w-full py-4 bg-discord/20 hover:bg-discord/30 text-discord border border-discord/30 rounded-xl font-black text-sm uppercase tracking-widest transition-all'>
														Save Confession Settings
													</button>
												</div>
											)}
										</div>
									</div>
								}
							</div>
						}
					</motion.div>
				)}
			</div>
		</div>
	);
}

function StatCard({
	icon,
	label,
	value,
	subValue,
	accent,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	subValue?: string;
	accent?: string;
}) {
	return (
		<motion.div
			whileHover={{ y: -8, scale: 1.02 }}
			className='glass rounded-[2rem] p-8 transition-all duration-300'>
			<div className='flex items-center justify-between mb-6'>
				<div className='p-4 bg-white/5 border border-white/10 rounded-2xl group-hover:glow transition-all'>{icon}</div>
				<div className='w-2 h-2 bg-green-500 rounded-full glow animate-pulse' />
			</div>
			<p className='text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2'>{label}</p>
			<p className={`text-3xl font-black tracking-tight truncate ${accent || "text-white"}`}>{value}</p>
			{subValue && <p className='text-[10px] font-bold text-zinc-700 uppercase tracking-widest mt-2'>{subValue}</p>}
		</motion.div>
	);
}
