const express = require("express");
const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const { pipeline } = require("stream/promises");

const router = express.Router();
const Logger = useHooks.get("logger");

module.exports.data = {
	name: "streamRoutes",
	description: "Hybrid progressive streaming route",
	version: "2.0.0",
	enable: true,
	priority: 9,
};

function parseTrackData(value) {
	if (!value || typeof value !== "string") return null;

	try {
		const track = JSON.parse(value);
		if (!track || typeof track !== "object") return null;
		if (typeof track.id !== "string" || typeof track.url !== "string") return null;
		return track;
	} catch {
		return null;
	}
}

async function pipeStream(req, res, createStream, contentType) {
	const trackData = parseTrackData(req.query.trackData);
	if (!trackData) return res.status(400).json({ error: "Invalid trackData" });

	const controller = new AbortController();
	let closed = false;

	const abort = () => {
		closed = true;
		controller.abort();
	};

	req.once("aborted", abort);
	res.once("close", abort);

	try {
		const player = await getManager().create("webid");
		const stream = await createStream(player, trackData, controller.signal);

		if (!stream || typeof stream.pipe !== "function") {
			throw new TypeError("ZiPlayer did not return a readable stream");
		}

		if (!res.headersSent) {
			res.writeHead(200, {
				"Accept-Ranges": "bytes",
				"Content-Type": contentType,
				"Cache-Control": "no-store",
			});
		}

		await pipeline(stream, res, { signal: controller.signal });
	} catch (error) {
		if (closed || controller.signal.aborted) return;

		Logger?.error?.(`[Stream] ${error?.stack || error}`);

		if (res.headersSent) res.destroy(error);
		else res.status(500).json({ error: error?.message || "Stream failed" });
	} finally {
		req.off("aborted", abort);
		res.off("close", abort);
	}
}

router.get("/audio", (req, res) =>
	pipeStream(req, res, (player, trackData, signal) => player.save(trackData, { signal }), "audio/webm"),
);

router.get("/video", (req, res) =>
	pipeStream(req, res, (player, trackData, signal) => player.saveVideo(trackData, { signal }), "application/vnd.yt-ump"),
);

module.exports.execute = () => {
	const server = useHooks.get("server");
	server.use("/api/stream", router);
};
