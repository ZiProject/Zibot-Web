import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { proxyImage } from "../../services/discordActivity";
import type { Track } from "../../types/track";

interface MineRadioBackgroundProps {
	track: Track | null;
	intensity?: number;
	videoUrl?: string | null;
}

function artworkOf(track: Track | null): string {
	return (
		proxyImage(track?.thumbnail) ||
		"https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1800&auto=format&fit=crop"
	);
}

function hashColor(source: string): string {
	let hash = 0;
	for (let index = 0; index < source.length; index += 1) {
		hash = (hash << 5) - hash + source.charCodeAt(index);
		hash |= 0;
	}
	const hue = Math.abs(hash) % 360;
	return `hsl(${hue} 75% 58%)`;
}

export function MineRadioBackground({ track, intensity = 1, videoUrl }: MineRadioBackgroundProps) {
	const artwork = useMemo(() => artworkOf(track), [track?.thumbnail]);
	const fallbackAccent = useMemo(() => hashColor(`${track?.id ?? "idle"}:${artwork}`), [track?.id, artwork]);
	const [accent, setAccent] = useState(fallbackAccent);

	useEffect(() => {
		setAccent(fallbackAccent);
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.src = artwork;
		image.onload = () => {
			try {
				const size = 24;
				const canvas = document.createElement("canvas");
				canvas.width = size;
				canvas.height = size;
				const context = canvas.getContext("2d", { willReadFrequently: true });
				if (!context) return;
				context.drawImage(image, 0, 0, size, size);
				const pixels = context.getImageData(0, 0, size, size).data;
				let r = 0;
				let g = 0;
				let b = 0;
				let weight = 0;
				for (let index = 0; index < pixels.length; index += 16) {
					const alpha = pixels[index + 3] / 255;
					const luminance = (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
					const sampleWeight = alpha * (0.35 + luminance);
					r += pixels[index] * sampleWeight;
					g += pixels[index + 1] * sampleWeight;
					b += pixels[index + 2] * sampleWeight;
					weight += sampleWeight;
				}
				if (weight > 0) setAccent(`rgb(${Math.round(r / weight)} ${Math.round(g / weight)} ${Math.round(b / weight)})`);
			} catch {
				// Cross-origin artwork can deny canvas sampling; keep the deterministic fallback.
			}
		};
		return () => {
			image.onload = null;
		};
	}, [artwork, fallbackAccent]);

	const glow = Math.max(0, Math.min(1.4, intensity));

	return (
		<div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
			{videoUrl ? (
				<video
					key={videoUrl}
					className="absolute inset-0 h-full w-full object-cover opacity-70"
					src={videoUrl}
					autoPlay
					muted
					loop
					playsInline
				/>
			) : null}

			<motion.div
				key={artwork}
				initial={{ opacity: 0, scale: 1.08 }}
				animate={{ opacity: 0.92, scale: 1.02 }}
				transition={{ duration: 1.1, ease: "easeOut" }}
				className="absolute -inset-8 bg-cover bg-center"
				style={{ backgroundImage: `url(${artwork})`, filter: "blur(34px) saturate(1.35)" }}
			/>
			<motion.div
				key={`sharp-${artwork}`}
				initial={{ opacity: 0 }}
				animate={{ opacity: 0.22 }}
				transition={{ duration: 0.8 }}
				className="absolute inset-0 bg-cover bg-center"
				style={{ backgroundImage: `url(${artwork})` }}
			/>

			<div
				className="absolute inset-0 transition-[background] duration-700"
				style={{
					background: `radial-gradient(circle at 50% 42%, color-mix(in srgb, ${accent} ${Math.round(30 * glow)}%, transparent), transparent 42%), linear-gradient(180deg, rgba(4,5,9,.16), rgba(4,5,9,.56))`,
				}}
			/>
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_20%,rgba(0,0,0,.38)_100%)]" />
			<div className="absolute inset-0 bg-black/20" />
			<div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
		</div>
	);
}
