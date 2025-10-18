const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const MESSAGE_STORE = path.join(__dirname, "data", "messages.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const ensureStoreExists = () => {
  if (!fs.existsSync(MESSAGE_STORE)) {
    fs.writeFileSync(MESSAGE_STORE, "[]", "utf8");
  }
};

const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
};

const collectRequestBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Payload too large"));
        req.connection.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const saveMessage = (message) => {
  ensureStoreExists();
  const now = new Date();
  const entry = {
    ...message,
    receivedAt: now.toISOString()
  };
  const existing = JSON.parse(fs.readFileSync(MESSAGE_STORE, "utf8"));
  existing.push(entry);
  fs.writeFileSync(MESSAGE_STORE, JSON.stringify(existing, null, 2));
  return entry;
};

const serveStaticFile = (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.access(filePath, fs.constants.R_OK, (error) => {
    if (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("500 Internal Server Error");
      }
      return;
    }

    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600"
    });
    stream.pipe(res);
    stream.on("error", () => {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("500 Internal Server Error");
    });
  });
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = requestUrl;

  if (req.method === "POST" && pathname === "/api/contact") {
    try {
      const body = await collectRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const name = String(payload.name || "").trim();
      const email = String(payload.email || "").trim();
      const project = String(payload.project || "").trim();

      if (!name || !email || !project) {
        sendJson(res, 400, { ok: false, error: "Please fill out all fields." });
        return;
      }

      const message = saveMessage({ name, email, project });
      console.log("📬 New contact message: ", message);
      sendJson(res, 200, { ok: true, message: "Thanks for reaching out!" });
    } catch (error) {
      console.error("Failed to process contact submission", error);
      sendJson(res, 500, { ok: false, error: "Something went wrong. Please try again." });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/api/messages") {
    try {
      ensureStoreExists();
      const store = JSON.parse(fs.readFileSync(MESSAGE_STORE, "utf8"));
      sendJson(res, 200, { ok: true, data: store });
    } catch (error) {
      console.error("Failed to read messages", error);
      sendJson(res, 500, { ok: false, error: "Unable to load messages." });
    }
    return;
  }

  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const normalizedPath = path
    .normalize(requestedPath)
    .replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  serveStaticFile(res, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`📫 Messages will be stored in ${MESSAGE_STORE}`);
});
