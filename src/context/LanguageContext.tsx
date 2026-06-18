import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "vi" | "en" | "ja";

interface Translations {
	[key: string]: {
		[K in Language]: string;
	};
}

export const translations: Translations = {
	// Navigation
	home: { vi: "Trang chủ", en: "Home", ja: "ホーム" },
	dashboard: { vi: "Bảng điều khiển", en: "Dashboard", ja: "ダッシュボード" },
	enterDashboard: { vi: "Đăng nhập Discord", en: "Login Discord", ja: "Discordでログイン" },
	loginDiscord: { vi: "Đăng nhập Discord", en: "Login with Discord", ja: "Discordでログイン" },

	// Hero
	heroTitle: {
		vi: "Nâng tầm cộng đồng Discord của bạn",
		en: "Elevate your Discord community",
		ja: "あなたのDiscordコミュニティを高める",
	},
	heroSub: {
		vi: "là bot Discord đa năng, hiệu suất cao được thiết kế để phát triển linh hoạt. Từ âm nhạc giải trí đến quản trị hệ thống - Ziji xử lý mọi thứ mượt mà.",
		en: "is a versatile, high-performance Discord bot designed for modular growth. From entertainment music to system administration - Ziji handles everything smoothly.",
		ja: "は、モジュール式の成長のために設計された多目的で高性能なDiscordボットです。エンターテインメントミュージックからシステム管理まで、Zijiはすべてをスムーズに処理します。",
	},
	inviteBot: { vi: "Mời Ziji Bot", en: "Invite Ziji Bot", ja: "Zijiボットを招待" },
	openDashboard: { vi: "Đăng nhập", en: "Login", ja: "ログイン" },

	// Features
	featTitle: { vi: "Mô-đun hóa sự Phát triển", en: "Modularize the Growth", ja: "成長をモジュール化する" },
	featSub: {
		vi: "Ziji được xây dựng với kiến trúc hiện đại, hỗ trợ hàng loạt tính năng mạnh mẽ cho mọi quy mô cộng đồng.",
		en: "Ziji is built with a modern architecture, supporting a wide range of powerful features for communities of all sizes.",
		ja: "Zijiは現代的なアーキテクチャで構築されており、あらゆる規模のコミュニティに対応する強力な機能をサポートしています。",
	},

	musicTitle: { vi: "Âm nhạc chất lượng cao", en: "High Quality Music", ja: "高品質な音楽" },
	musicDesc: {
		vi: "Phát nhạc từ YouTube, Spotify, SoundCloud với độ trễ cực thấp và âm thanh sống động.",
		en: "Play music from YouTube, Spotify, SoundCloud with ultra-low latency and vivid sound.",
		ja: "YouTube、Spotify、SoundCloudから超低遅延で鮮やかなサウンドで音楽を再生します。",
	},

	quoteTitle: { vi: "Tạo thẻ trích dẫn", en: "Create Quote Cards", ja: "引用カードの作成" },
	quoteDesc: {
		vi: "Biến những câu nói bất hủ trong máy chủ thành những tấm thẻ trích dẫn (quote card) đẹp mắt chỉ với một lệnh.",
		en: "Turn immortal server sayings into beautiful quote cards with just one command.",
		ja: "サーバーの不朽の格言を、たった一つのコマンドで美しい引用カードに変えます。",
	},

	ecoTitle: { vi: "Nền kinh tế (Economy)", en: "Economy System", ja: "経済システム" },
	ecoDesc: {
		vi: "Hệ thống tiền tệ đầy đủ với công việc, đánh bạc và cửa hàng vật phẩm ảo.",
		en: "Full currency system with jobs, gambling, and virtual item shops.",
		ja: "仕事、ギャンブル、仮想アイテムショップを備えた完全な通貨システム。",
	},

	modTitle: { vi: "Quản trị máy chủ", en: "Server Administration", ja: "サーバー管理" },
	modDesc: {
		vi: "Tự động hóa việc lọc tin nhắn, quản lý vai trò và bảo vệ máy chủ khỏi spam.",
		en: "Automate message filtering, role management, and protect server from spam.",
		ja: "メッセージフィルタリング、ロール管理を自動化し、サーバーをスパムから保護します。",
	},

	funTitle: { vi: "Giải trí & Anime", en: "Entertainment & Anime", ja: "エンターテインメント＆アニメ" },
	funDesc: {
		vi: "Tìm kiếm thông tin anime, waifu và các lệnh vui vẻ cho cộng đồng.",
		en: "Search for anime, waifu info and fun commands for the community.",
		ja: "アニメ、ワイフの情報検索や、コミュニティ向けの楽しいコマンド。",
	},

	gameTitle: { vi: "Trò chơi tương tác", en: "Interactive Games", ja: "インタラクティブゲーム" },
	gameDesc: {
		vi: "Các trò chơi mini ngay trong Discord để gắn kết các thành viên.",
		en: "Mini-games right inside Discord to bond members together.",
		ja: "メンバーの絆を深めるための、Discord内のミニゲーム。",
	},

	// Dashboard
	systemOnline: { vi: "Hệ thống trực tuyến", en: "System Online", ja: "システムオンライン" },
	dashboardTitle: { vi: "Bảng điều khiển Ziji", en: "Ziji Dashboard", ja: "Zijiダッシュボード" },
	dashboardSub: {
		vi: "Giám sát trạng thái và vận hành hệ thống theo thời gian thực.",
		en: "Monitor system status and operation in real-time.",
		ja: "システムステータスと運用をリアルタイムで監視します。",
	},
	stableOperation: { vi: "Vận hành ổn định", en: "Stable Operation", ja: "安定稼働" },
	lastUpdate: { vi: "Cập nhật: v2.4.1-stable", en: "Update: v2.4.1-stable", ja: "更新: v2.4.1-stable" },

	botName: { vi: "Tên Bot", en: "Bot Name", ja: "ボット名" },
	botId: { vi: "ID Bot", en: "Bot ID", ja: "ボットID" },
	status: { vi: "Trạng thái", en: "Status", ja: "ステータス" },
	serverRegion: { vi: "Máy chủ", en: "Server", ja: "サーバー" },

	account: { vi: "Tài khoản", en: "Account", ja: "アカウント" },
	login: { vi: "Đăng nhập", en: "Login", ja: "ログイン" },
	guest: { vi: "Khách", en: "Guest", ja: "ゲスト" },
	level: { vi: "Cấp độ", en: "Level", ja: "レベル" },
	balance: { vi: "Số dư", en: "Balance", ja: "残高" },
	syncPrompt: {
		vi: "Vui lòng đăng nhập Discord để đồng bộ dữ liệu thực tế",
		en: "Please login to Discord to sync real data",
		ja: "実際のデータを同期するにはDiscordにログインしてください",
	},

	opsLog: { vi: "Nhật ký vận hành", en: "Operations Log", ja: "運用ログ" },
	apiMsg: { vi: "Thông điệp API:", en: "API Message:", ja: "APIメッセージ:" },
	version: { vi: "Phiên bản", en: "Version", ja: "バージョン" },
	runtime: { vi: "Runtime", en: "Runtime", ja: "ランタイム" },
	clusterStable: {
		vi: "Cụm máy chủ Asia-Northeast vận hành ổn định 99.98%",
		en: "Asia-Northeast cluster operating stable 99.98%",
		ja: "アジア・北東クラスターは99.98%安定稼働中",
	},

	// Stats
	speed: { vi: "Tốc độ", en: "Speed", ja: "スピード" },
	security: { vi: "Bảo mật", en: "Security", ja: "セキュリティ" },
	versatility: { vi: "Đa năng", en: "Versatility", ja: "多才" },
	support: { vi: "Hỗ trợ", en: "Support", ja: "サポート" },
	speedDesc: { vi: "Phản hồi siêu tốc", en: "Super fast response", ja: "超高速レスポンス" },
	securityDesc: { vi: "An tâm quản trị", en: "Secure management", ja: "安心の管理" },
	versatilityDesc: { vi: "Hơn 140+ lệnh", en: "Over 140+ commands", ja: "140以上のコマンド" },
	supportDesc: { vi: "Cộng đồng 85k+", en: "85k+ Community", ja: "85k+ コミュニティ" },

	// Legal
	terms: { vi: "Điều khoản dịch vụ", en: "Terms of Service", ja: "利用規約" },
	privacy: { vi: "Chính sách bảo mật", en: "Privacy Policy", ja: "プライバシーポリシー" },
	backToHome: { vi: "Quay lại trang chủ", en: "Back to home", ja: "ホームに戻る" },

	// New Translations
	settings: { vi: "Cài đặt", en: "Settings", ja: "設定" },
	userSettings: { vi: "Cài đặt cá nhân", en: "User Settings", ja: "ユーザー設定" },
	save: { vi: "Lưu thay đổi", en: "Save Changes", ja: "変更を保存" },
	language: { vi: "Ngôn ngữ bot", en: "Bot Language", ja: "ボットの言語" },
	volume: { vi: "Âm lượng mặc định", en: "Default Volume", ja: "デフォルト音量" },
	guildManagement: { vi: "Quản lý máy chủ", en: "Server Management", ja: "サーバー管理" },
	manage: { vi: "Quản lý", en: "Manage", ja: "管理" },
	invite: { vi: "Mời bot", en: "Invite Bot", ja: "ボットを招待" },
	autoRole: { vi: "Tự động cấp vai trò", en: "Auto Role", ja: "オートロール" },
	joinToCreate: { vi: "Phòng chờ (Join to Create)", en: "Join to Create", ja: "Join to Create" },
};

interface LanguageContextType {
	language: Language;
	setLanguage: (lang: Language) => void;
	t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [language, setLanguageState] = useState<Language>("en");

	useEffect(() => {
		const savedLang = localStorage.getItem("ziji-lang") as Language;
		if (savedLang && (savedLang === "vi" || savedLang === "en" || savedLang === "ja")) {
			setLanguageState(savedLang);
		} else {
			// Auto detect from browser
			const browserLang = navigator.language.split("-")[0];
			if (browserLang === "vi") setLanguageState("vi");
			else if (browserLang === "ja") setLanguageState("ja");
			else setLanguageState("en");
		}
	}, []);

	const setLanguage = (lang: Language) => {
		setLanguageState(lang);
		localStorage.setItem("ziji-lang", lang);
	};

	const t = (key: string) => {
		return translations[key]?.[language] || key;
	};

	return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
	const context = useContext(LanguageContext);
	if (context === undefined) {
		throw new Error("useLanguage must be used within a LanguageProvider");
	}
	return context;
}
