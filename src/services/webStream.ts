import { apiUrl, isDiscordActivity } from "./discordActivity";
import type { StreamMode, StreamTrackDescriptor, Track } from "../types/track";
import { toStreamTrack } from "../types/track";

function buildUrl(path: string, track: Track): string {
	const descriptor: StreamTrackDescriptor = toStreamTrack(track);
	const query = encodeURIComponent(JSON.stringify(descriptor));
	return `${apiUrl(path)}?trackData=${query}`;
}

function streamPath(path: "/audio" | "/video"): string {
	return isDiscordActivity() ? `/stream${path}` : `/api/stream${path}`;
}

export function getAudioStreamUrl(track: Track): string {
	return buildUrl(streamPath("/audio"), track);
}

export function getVideoStreamUrl(track: Track): string {
	return buildUrl(streamPath("/video"), track);
}

export function getStreamUrl(track: Track, mode: StreamMode): string | null {
	if (mode === "audio") return getAudioStreamUrl(track);
	if (mode === "video") return getVideoStreamUrl(track);
	return null;
}
