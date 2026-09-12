export interface Track {
	id: string;
	title: string;
	url: string;
	duration: number;
	thumbnail?: string;
	requestedBy: string;
	source: string;
	metadata?: Record<string, unknown>;
	isLive?: boolean;
	author?: string;
}

export type StreamMode = "off" | "audio" | "video";

export interface StreamTrackDescriptor {
	id: string;
	title: string;
	url: string;
	duration: number;
	thumbnail?: string;
	requestedBy: string;
	source: string;
	isLive?: boolean;
	author?: string;
}

export function toStreamTrack(track: Track): StreamTrackDescriptor {
	return {
		id: track.id,
		title: track.title,
		url: track.url,
		duration: track.duration,
		thumbnail: track.thumbnail,
		requestedBy: track.requestedBy,
		source: track.source,
		isLive: track.isLive,
		author: track.author,
	};
}
