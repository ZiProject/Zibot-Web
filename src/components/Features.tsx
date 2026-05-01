
import { motion } from "motion/react";
import { Music, Quote, Coins, ShieldCheck, Heart, Gamepad2 } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export function Features() {
  const { t } = useLanguage();

  const features = [
    {
      icon: <Music className="w-8 h-8 text-blue-400" />,
      title: t('musicTitle'),
      desc: t('musicDesc')
    },
    {
      icon: <Quote className="w-8 h-8 text-red-400" />,
      title: t('quoteTitle'),
      desc: t('quoteDesc')
    },
    {
      icon: <Coins className="w-8 h-8 text-yellow-400" />,
      title: t('ecoTitle'),
      desc: t('ecoDesc')
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-green-400" />,
      title: t('modTitle'),
      desc: t('modDesc')
    },
    {
      icon: <Heart className="w-8 h-8 text-pink-400" />,
      title: t('funTitle'),
      desc: t('funDesc')
    },
    {
      icon: <Gamepad2 className="w-8 h-8 text-purple-400" />,
      title: t('gameTitle'),
      desc: t('gameDesc')
    }
  ];

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto border-t border-white/5">
      <div className="text-center mb-20">
        <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tighter leading-none">
          {t('featTitle').split(' ').map((word, i, arr) => (
            <span key={i} className={i === arr.length - 1 ? 'text-gradient' : ''}>
              {word}{' '}
            </span>
          ))}
        </h2>
        <p className="text-zinc-500 max-w-2xl mx-auto font-medium text-lg">
          {t('featSub')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group p-10 glass rounded-[3rem] hover:bg-white/5 transition-all duration-500 border-white/5 hover:border-discord/30"
          >
            <div className="mb-8 p-5 bg-white/5 border border-white/10 rounded-[2rem] w-fit group-hover:glow group-hover:scale-110 transition-all duration-500">
              {f.icon}
            </div>
            <h3 className="text-2xl font-bold mb-4 tracking-tight">{f.title}</h3>
            <p className="text-zinc-400 font-medium leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
