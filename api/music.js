const { getManager } = require("ziplayer");
const { useHooks } = require("zihooks");
const { lyricsExt } = require("@ziplayer/extension");
const jwt = require("jsonwebtoken");

module.exports.data = {
	name: "musicRoutes",
	description: "Music route for querying tracks",
	version: "1.0.0",
	enable: true,
	priority: 9,
};

const authenticate = (req, res, next) => {
	const authHeader = req.headers.authorization;
	if (!authHeader) return res.status(401).send("No token provided");
	const token = authHeader.split(" ")[1];
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded;
		next();
	} catch (error) {
		res.status(401).send("Invalid token");
	}
};

router.get("/music/search", authenticate, async (req, res) => {
	try {
		const { q } = req.query;
		if (!q) return res.status(400).json({ error: "Missing query" });
		const manager = getManager();
		// source can be youtube, spotify, etc. default to youtube for searching
		const result = await manager.search(q, "youtube");
		res.json({ results: result.tracks, total: result.tracks.length });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

router.get("/music/lyrics", authenticate, async (req, res) => {
	try {
		const { q } = req.query;
		if (!q) return res.status(400).json({ error: "Missing query" });
		const lyricsext = new lyricsExt();
		const lyrics = await lyricsext.fetch({ title: q });
		res.json(lyrics);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

module.exports.execute = () => {
	const server = useHooks.get("server");
	server.use("/", router);
	return;
};
