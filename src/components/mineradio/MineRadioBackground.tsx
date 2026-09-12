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
	const [pointer, setPointer] = useState({ x: 50, y: 42 });

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

	useEffect(() => {
		let frame = 0;
		const onPointerMove = (event: PointerEvent) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				setPointer({
					x: (event.clientX / Math.max(1, window.innerWidth)) * 100,
					y: (event.clientY / Math.max(1, window.innerHeight)) * 100,
				});
			});
		};
		window.addEventListener("pointermove", onPointerMove, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("pointermove", onPointerMove);
		};
	}, []);

	const glow = Math.max(0, Math.min(1.4, intensity));

	return (
		<div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
			<style>{`
				@keyframes mineradio-glass-sweep {
					0%, 58% { transform: translate3d(-115%, 0, 0) rotate(18deg); opacity: 0; }
					66% { opacity: .18; }
					82% { transform: translate3d(610%, 0, 0) rotate(18deg); opacity: .04; }
					100% { transform: translate3d(610%, 0, 0) rotate(18deg); opacity: 0; }
				}
				@keyframes mineradio-glass-shimmer {
					0%, 100% { opacity: .08; }
					50% { opacity: .16; }
				}
			`}</style>

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

			{/* Glass optics: a broad Fresnel reflection follows the cursor as if light
			    were sliding across a transparent pane in front of the artwork. */}
			<div
				className="absolute -inset-[35%] mix-blend-screen blur-2xl transition-transform duration-700 ease-out"
				style={{
					opacity: 0.13 * glow,
					transform: `translate3d(${(pointer.x - 50) * 0.14}%, ${(pointer.y - 50) * 0.06}%, 0) rotate(-9deg)`,
					background: "linear-gradient(112deg, transparent 39%, rgba(255,255,255,.025) 44%, rgba(255,255,255,.18) 49%, rgba(255,255,255,.045) 53%, transparent 60%)",
				}}
			/>

			{/* Thin specular streak, intentionally slow so it reads as reflected light,
			    not a loading animation. */}
			<div
				className="absolute inset-y-[-35%] left-0 w-[13%] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-xl"
				style={{ animation: "mineradio-glass-sweep 9s ease-in-out infinite", opacity: 0.9 * glow }}
			/>

			{/* Pointer hotspot + soft halo gives glass a parallax/Fresnel response. */}
			<div
				className="absolute h-[46vw] max-h-[620px] w-[46vw] max-w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen blur-3xl transition-[left,top] duration-500 ease-out"
				style={{
					left: `${pointer.x}%`,
					top: `${pointer.y}%`,
					opacity: 0.055 * glow,
					background: `radial-gradient(circle, ${accent}, transparent 66%)`,
				}}
			/>

			{/* Fine edge reflection around the viewport, similar to a coated glass surface. */
			<div
				className="absolute inset-0"
				style={{
					opacity: 0.18 * glow,
					background: "linear-gradient(115deg, rgba(255,255,255,.11), transparent 13%, transparent 72%, rgba(255,255,255,.055)), radial-gradient(ellipse at center, transparent 58%, rgba(255,255,255,.07) 100%)",
					animation: "mineradio-glass-shimmer 6s ease-in-out infinite",
				}}
			/>

			<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_20%,rgba(0,0,0,.38)_100%)]" />
			<div className="absolute inset-0 bg-black/20" />
			<div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
		</div>
	);
}
