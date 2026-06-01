import { motion } from "motion/react";
import { ReactNode, useState } from "react";
import {
  Sparkles,
  MessageSquare,
  Zap,
  Shield,
  ChevronDown,
} from "lucide-react";
import { BotInfo } from "../services/api";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

interface HeroProps {
  botInfo: BotInfo | null;
}

export function Hero({ botInfo }: HeroProps) {
  const { t } = useLanguage();
  const [openBots, setOpenBots] = useState(false);
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-1/4 -left-20 w-[400px] h-[400px] bg-discord opacity-10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-[400px] h-[400px] bg-vibrant-pink opacity-10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-discord to-vibrant-pink rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <img
              src={
                botInfo?.avatars ||
                "https://cdn.discordapp.com/avatars/1005716197259612193/a_a5edfffd377c12de479af9139b26eb5d.gif?size=1024"
              }
              alt="Ziji Avatar"
              className="relative w-32 h-32 rounded-3xl glow border-2 border-discord/30 shadow-2xl"
            />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-6 leading-[1.05]"
        >
          {t("heroTitle")
            .split("Discord")
            .map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="text-gradient">Discord</span>
                )}
              </span>
            ))}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-zinc-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed font-medium"
        >
          {botInfo?.clientName} {t("heroSub")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href={
              botInfo?.inviteUrl ||
              "https://discord.com/oauth2/authorize?client_id=1005716197259612193&permissions=8&scope=bot"
            }
            target="_blank"
            rel="noreferrer"
            className="px-10 py-4 bg-white text-black hover:bg-zinc-200 rounded-2xl font-bold text-lg transition-all shadow-xl"
          >
            Invite {botInfo?.clientName}
          </a>

          {botInfo?.playerNetClient?.length && (
            <div className="relative">
              <button
                onClick={() => setOpenBots(!openBots)}
                className="flex items-center gap-2 px-6 py-4 glass hover:bg-white/10 rounded-2xl font-bold transition-all"
              >
                Music Bots
                <ChevronDown
                  size={18}
                  className={`transition-transform ${
                    openBots ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openBots && (
                <div className="absolute top-full mt-2 left-0 min-w-[280px] glass rounded-2xl border border-white/10 overflow-hidden z-50">
                  {botInfo.playerNetClient.map((bot) => (
                    <a
                      key={bot.clientId ?? "unknown"}
                      href={`https://discord.com/oauth2/authorize?client_id=${bot.clientId}&permissions=8&scope=bot`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition"
                    >
                      <img
                        src={bot.avatars}
                        alt={bot.clientName}
                        className="w-10 h-10 rounded-full"
                      />

                      <div className="flex flex-col text-left">
                        <span className="font-semibold">{bot.clientName}</span>
                        <span className="text-xs text-zinc-400">
                          {bot.clientId}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <a
            href={`${import.meta.env.VITE_BotAPI || ""}/auth/discord/login`}
            className="px-10 py-4 glass hover:bg-white/10 text-white rounded-2xl font-bold text-lg transition-all"
          >
            {t("loginDiscord")}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 w-full max-w-4xl"
        >
          <HeroFeature icon={<Zap />} label={t("speed")} sub={t("speedDesc")} />
          <HeroFeature
            icon={<Shield />}
            label={t("security")}
            sub={t("securityDesc")}
          />
          <HeroFeature
            icon={<Sparkles />}
            label={t("versatility")}
            sub={t("versatilityDesc")}
          />
          <HeroFeature
            icon={<MessageSquare />}
            label={t("support")}
            sub={t("supportDesc")}
          />
        </motion.div>
      </div>
    </section>
  );
}

function HeroFeature({
  icon,
  label,
  sub,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-discord transition-transform hover:scale-110">
        {icon}
      </div>
      <div>
        <h3 className="font-extrabold text-sm tracking-widest uppercase mb-1">
          {label}
        </h3>
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
          {sub}
        </p>
      </div>
    </div>
  );
}
