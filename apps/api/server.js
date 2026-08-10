// core
require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const knex = require("knex");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");
const sanitizeFilename = require("./utils/sanitizer");
const { getBackupDir } = require("./utils/storage-paths");

// db
const dbInstance = require("./db");
const createdb = require("./create_database");
const knexConfig = require("./migrations");

// routes
const authRouter = require("./routes/auth");
const apiRouter = require("./routes/api");
const proxyRouter = require("./routes/proxy");
const { router: syncRouter } = require("./routes/sync");
const statsRouter = require("./routes/stats");
const backupRouter = require("./routes/backup");
const tautulliRouter = require("./routes/tautulli");
const jellystatRouter = require("./routes/jellystat");
const logRouter = require("./routes/logging");
const utilsRouter = require("./routes/utils");
const webhooksRouter = require("./routes/webhooks");
const newsletterRouter = require("./routes/newsletter");

// tasks
const ActivityMonitor = require("./tasks/ActivityMonitor");
const TaskManager = require("./classes/task-manager-singleton");
const TaskScheduler = require("./classes/task-scheduler-singleton");
// const WebhookScheduler = require("./classes/webhook-scheduler");
// const tasks = require("./tasks/tasks");

// websocket
const { setupWebSocketServer } = require("./ws");
const writeEnvVariables = require("./classes/env");

process.env.POSTGRES_USER = process.env.POSTGRES_USER ?? "postgres";
process.env.POSTGRES_ROLE = process.env.POSTGRES_ROLE ?? process.env.POSTGRES_USER;

const app = express();
const db = knex(knexConfig.development);

const ensureSlashes = (url) => {
  if (!url.startsWith("/")) {
    url = "/" + url;
  }
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
};

const PORT = 3000;
const LISTEN_IP = process.env.JS_LISTEN_IP || "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_NAME = process.env.JS_BASE_URL ? ensureSlashes(process.env.JS_BASE_URL) : "";
const DEFAULT_ALLOWED_ORIGINS = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];
const configuredAllowedOrigins = (process.env.CORS_ORIGINS || process.env.JS_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredAllowedOrigins]);

function normalizeOrigin(origin = "") {
  return String(origin).trim().replace(/\/+$/, "");
}

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.headers.host;

  return protocol && host ? `${protocol}://${host}` : "";
}

function isLocalOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
  } catch {
    return false;
  }
}

function isAllowedCorsOrigin(origin, req) {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  return (
    allowedOrigins.has(normalizedOrigin) ||
    normalizedOrigin === normalizeOrigin(getRequestOrigin(req)) ||
    isLocalOrigin(normalizedOrigin) ||
    process.env.CORS_ALLOW_ALL === "true"
  );
}

if (JWT_SECRET === undefined) {
  console.log("JWT Secret cannot be undefined");
  process.exit(1); // end the program with error status code
}

const DEFAULT_ROLE_PERMISSIONS = {
  Owner: { dashboard: true, users: true, settings: true, apiKeys: true },
  Admin: { dashboard: true, users: true, settings: true, apiKeys: true },
  Manager: { dashboard: true, users: true, settings: false, apiKeys: false },
  Viewer: { dashboard: true, users: false, settings: false, apiKeys: false },
  Disabled: { dashboard: false, users: false, settings: false, apiKeys: false },
};

// middlewares
app.set("trust proxy", 1);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" })); // middleware to parse JSON request bodies
app.use((req, res, next) =>
  cors({
    origin(origin, callback) {
      callback(null, isAllowedCorsOrigin(origin, req));
    },
  })(req, res, next)
);
app.disable("x-powered-by");
app.use(compression());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://track.nerdytech.dev",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' ws: wss: http: https:",
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ")
  );
  next();
});

function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const current = hits.get(key) || { count: 0, resetAt: now + windowMs };

    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    hits.set(key, current);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - current.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      res.status(429).json({ message });
      return;
    }

    next();
  };
}

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 60),
  message: "Too many authentication requests. Try again later.",
});
const taskRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.TASK_RATE_LIMIT_MAX || 20),
  message: "Too many task requests. Try again shortly.",
});

function typeInferenceMiddleware(req, res, next) {
  Object.keys(req.query).forEach((key) => {
    const value = req.query[key];
    if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
      // Convert to boolean
      req.query[key] = value.toLowerCase() === "true";
    } else if (!isNaN(value) && value.trim() !== "") {
      // Convert to number if it's a valid number
      req.query[key] = +value;
    }
  });
  next();
}

app.use(typeInferenceMiddleware);

const root = process.env.JS_CLIENT_DIST || path.join(__dirname, "..", "web", "dist");
const staticAssetIndex = new Map();
const STATIC_FILE_EXTENSION_REGEX = /\.(css|ico|js|json|png|jpg|jpeg|webp|svg|woff2?|ttf|map)$/i;

function indexStaticAssets(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      indexStaticAssets(fullPath, baseDir);
    } else if (!staticAssetIndex.has(file)) {
      const relativePath = `/${path.relative(baseDir, fullPath).split(path.sep).join("/")}`;
      staticAssetIndex.set(relativePath, fullPath);
      staticAssetIndex.set(file, fullPath);
    }
  }
}

function getRequestPathname(req) {
  try {
    return decodeURIComponent(new URL(req.originalUrl || req.url, "http://jellyglance.local").pathname);
  } catch {
    return req.path || req.url.split("?")[0];
  }
}

function getStaticAssetPath(req) {
  let pathname = getRequestPathname(req);
  if (BASE_NAME && pathname.startsWith(BASE_NAME)) {
    pathname = pathname.slice(BASE_NAME.length) || "/";
  }

  const exactPath = staticAssetIndex.get(pathname);
  if (exactPath) {
    return exactPath;
  }

  const fileName = path.basename(pathname);
  if (fileName !== "translation.json") {
    return staticAssetIndex.get(fileName);
  }

  return null;
}

function getTranslationFilePath(req) {
  let pathname = getRequestPathname(req);
  if (BASE_NAME && pathname.startsWith(BASE_NAME)) {
    pathname = pathname.slice(BASE_NAME.length) || "/";
  }

  const match = pathname.match(/^\/locales\/([^/]+)\/translation\.json$/);
  if (!match) {
    return null;
  }

  const locale = sanitizeFilename(match[1]);
  const filePath = path.join(root, "locales", locale, "translation.json");
  const localesRoot = path.join(root, "locales");

  if (!filePath.startsWith(localesRoot) || !fs.existsSync(filePath)) {
    return null;
  }

  return filePath;
}

//hacky middleware to handle basename changes for UI

app.use((req, res, next) => {
  if (BASE_NAME && BASE_NAME != "" && (req.url == "/" || req.url == "")) {
    return res.redirect(BASE_NAME);
  }
  // Ignore requests containing 'socket.io'
  if (req.url.includes("socket.io") || req.url.includes("swagger") || req.url.startsWith("/backup")) {
    return next();
  }

  const pathname = getRequestPathname(req);
  const translationFilePath = getTranslationFilePath(req);
  if (translationFilePath) {
    res.set("Cache-Control", "no-store");
    return res.type("application/json").sendFile(translationFilePath);
  }

  if (STATIC_FILE_EXTENSION_REGEX.test(pathname)) {
    const filePath = getStaticAssetPath(req);
    if (filePath) {
      if ([".js", ".css", ".html"].includes(path.extname(filePath))) {
        res.set("Cache-Control", "no-store");
      }
      return res.sendFile(filePath);
    }

    return res.status(404).type("text/plain").send("Static asset not found");
  }

  if (BASE_NAME && req.url.startsWith(BASE_NAME) && req.url !== BASE_NAME) {
    req.url = req.url.slice(BASE_NAME.length);
    // console.log("URL: " + req.url);
  }
  next();
});

// initiate routes
app.use(`/auth`, authRateLimit, authRouter, () => {
  /*  #swagger.tags = ['Auth'] */
}); // mount the API router at /auth
app.use("/proxy", proxyRouter, () => {
  /*  #swagger.tags = ['Proxy']*/
}); // mount the API router at /proxy
app.use("/api/startTask", taskRateLimit);
app.use("/api/server-management/action", taskRateLimit);
app.use("/sync", taskRateLimit);
app.use("/backup/beginBackup", taskRateLimit);
app.use("/api", authenticate, authorizeApiRoute, apiRouter, () => {
  /*  #swagger.tags = ['API']*/
}); // mount the API router at /api, with JWT middleware
app.use("/sync", authenticate, requirePermission("settings"), syncRouter, () => {
  /*  #swagger.tags = ['Sync']*/
}); // mount the API router at /sync, with JWT middleware
app.use("/stats", authenticate, statsRouter, () => {
  /*  #swagger.tags = ['Stats']*/
}); // mount the API router at /stats, with JWT middleware
app.use("/backup", authenticate, requirePermission("settings"), backupRouter, () => {
  /*  #swagger.tags = ['Backup']*/
}); // mount the API router at /backup, with JWT middleware
app.use("/tautulli", authenticate, requirePermission("settings"), tautulliRouter, () => {
  /*  #swagger.tags = ['Tautulli']*/
}); // mount the Tautulli import router with settings permission
app.use("/jellystat", authenticate, requirePermission("settings"), jellystatRouter, () => {
  /*  #swagger.tags = ['Jellystat']*/
}); // mount the Jellystat import router with settings permission
app.use("/logs", authenticate, requirePermission("settings"), logRouter, () => {
  /*  #swagger.tags = ['Logs']*/
}); // mount the API router at /logs, with JWT middleware
app.use("/utils", authenticate, requirePermission("settings"), utilsRouter, () => {
  /*  #swagger.tags = ['Utils']*/
}); // mount the API router at /utils, with JWT middleware
app.use("/webhooks", authenticate, requirePermission("settings"), webhooksRouter, () => {
  /*  #swagger.tags = ['Webhooks']*/
}); // mount the API router at /webhooks, with JWT middleware
app.use("/newsletter", authenticate, requirePermission("settings"), newsletterRouter, () => {
  /*  #swagger.tags = ['Newsletter']*/
}); // mount the newsletter router with settings permission

app.get("/backup-download/:filename", (req, res) => {
  try {
    const filename = sanitizeFilename(req.params.filename);
    const ticket = req.query.ticket;

    if (!ticket || typeof ticket !== "string") {
      res.status(401).send("Download ticket is required");
      return;
    }

    const decoded = jwt.verify(ticket, JWT_SECRET);
    if (decoded.purpose !== "backup-download" || decoded.filename !== filename) {
      res.status(403).send("Invalid download ticket");
      return;
    }

    const filePath = path.join(getBackupDir(), filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).send("Backup file not found");
      return;
    }

    res.download(filePath, filename, (error) => {
      if (error && !res.headersSent) {
        console.error(error);
        res.status(500).send("Unable to download backup file");
      }
    });
  } catch (error) {
    console.error(error);
    res.status(401).send("Invalid or expired download ticket");
  }
});

// Swagger
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// for deployment of static page
writeEnvVariables().then(() => {
  staticAssetIndex.clear();
  indexStaticAssets(root);
  app.use(
    express.static(root, {
      setHeaders: (res, filePath) => {
        if ([".js", ".css", ".html"].includes(path.extname(filePath))) {
          res.set("Cache-Control", "no-store");
        }
      },
    })
  );
  app.get("*", (req, res, next) => {
    if (req.url.includes("socket.io")) {
      return next();
    }
    if (STATIC_FILE_EXTENSION_REGEX.test(getRequestPathname(req))) {
      return res.status(404).type("text/plain").send("Static asset not found");
    }
    res.set("Cache-Control", "no-store");
    res.sendFile(path.join(root, "index.html"));
  });
});

// JWT middleware
async function authenticate(req, res, next) {
  const token = req.headers.authorization;
  const apiKey = req.headers["x-api-token"];

  if (!token && !apiKey) {
    return res.status(401).json({
      message: "Authentication failed. No token or API key provided.",
    });
  }

  if (token) {
    const extracted_token = token.split(" ")[1];
    if (!extracted_token || extracted_token === "null") {
      return res.sendStatus(403);
    }

    try {
      const decoded = jwt.verify(extracted_token, JWT_SECRET);
      const access = await resolveTokenAccess(decoded.user);
      if (!access.permissions.dashboard) {
        return res.status(403).json({ message: "This account is disabled in JellyGlance" });
      }

      req.user = access.user;
      req.permissions = access.permissions;
      next();
    } catch (error) {
      console.log("Invalid token");
      return res.status(401).json({ message: "Invalid token" });
    }
  } else {
    if (apiKey) {
      const keysjson = await dbInstance.query('SELECT api_keys FROM app_config where "ID"=1').then((res) => res.rows[0].api_keys);

      if (!keysjson || Object.keys(keysjson).length === 0) {
        return res.status(404).json({ message: "No API keys configured" });
      }
      const keys = keysjson || [];

      const keyExists = keys.some((obj) => obj.key === apiKey);

      if (keyExists) {
        req.permissions = DEFAULT_ROLE_PERMISSIONS.Owner;
        next();
      } else {
        return res.status(403).json({ message: "Invalid API key" });
      }
    }
  }
}

function getTokenPermissions(user) {
  if (user === "internal") {
    return DEFAULT_ROLE_PERMISSIONS.Owner;
  }

  if (user?.permissions) {
    return user.permissions;
  }

  if (user?.role && DEFAULT_ROLE_PERMISSIONS[user.role]) {
    return DEFAULT_ROLE_PERMISSIONS[user.role];
  }

  return DEFAULT_ROLE_PERMISSIONS.Owner;
}

function getRolePermissions(settings, role) {
  return {
    ...(DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.Viewer),
    ...((settings.rolePermissions || {})[role] || {}),
  };
}

async function resolveTokenAccess(user) {
  if (user === "internal") {
    return { user, permissions: DEFAULT_ROLE_PERMISSIONS.Owner };
  }

  if (user?.authMode === "quick-connect" && user?.id) {
    const { rows } = await dbInstance.query('SELECT settings FROM app_config where "ID"=1');
    const settings = rows[0]?.settings || {};
    const role = settings.userRoles?.[user.id] || (user.jellyfinUser?.isAdministrator ? "Admin" : "Viewer");
    const permissions = getRolePermissions(settings, role);

    return {
      user: {
        ...user,
        role,
        permissions,
      },
      permissions,
    };
  }

  if (user?.authMode === "oidc" && user?.jellyfinUser?.id) {
    const { rows } = await dbInstance.query('SELECT settings FROM app_config where "ID"=1');
    const settings = rows[0]?.settings || {};
    const role = settings.userRoles?.[user.jellyfinUser.id] || (user.jellyfinUser?.isAdministrator ? "Admin" : "Viewer");
    const permissions = getRolePermissions(settings, role);

    return {
      user: {
        ...user,
        role,
        permissions,
      },
      permissions,
    };
  }

  if (user?.authMode === "local") {
    const { rows } = await dbInstance.query('SELECT "APP_USER", settings FROM app_config where "ID"=1');
    const config = rows[0] || {};
    const settings = config.settings || {};
    const localUser = (settings.localUsers || []).find((item) => item.id === user.id || item.username === user.username);
    const role = user.id === 1 || config.APP_USER === user.username ? "Owner" : localUser?.role || user.role || "Viewer";
    const permissions = getRolePermissions(settings, role);

    return {
      user: {
        ...user,
        role,
        permissions,
      },
      permissions,
    };
  }

  const permissions = getTokenPermissions(user);
  return { user, permissions };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (req.permissions?.[permission]) {
      next();
      return;
    }

    res.status(403).json({ message: `Permission required: ${permission}` });
  };
}

function authorizeApiRoute(req, res, next) {
  const pathName = req.path.toLowerCase();

  if (pathName === "/getconfig") {
    next();
    return;
  }

  if (pathName.startsWith("/server-management")) {
    if (!req.permissions?.settings || !["Owner", "Admin"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Admin role required" });
    }
    next();
    return;
  }

  const permission =
    pathName.startsWith("/keys")
      ? "apiKeys"
      : pathName.startsWith("/useraccess") ||
          pathName.startsWith("/roles") ||
          pathName.startsWith("/localusers") ||
          pathName.startsWith("/primarylocalpassword") ||
          pathName.startsWith("/userroles") ||
          pathName.startsWith("/setpreferredadmin") ||
          pathName.startsWith("/untrackedusers") ||
          pathName.startsWith("/setuntrackedusers")
        ? "users"
        : pathName.startsWith("/set") ||
            pathName.includes("/purge") ||
            pathName.startsWith("/integrations") ||
            pathName.startsWith("/jellyfin/") ||
            pathName.startsWith("/first-run") ||
            pathName.startsWith("/downloads/add") ||
            pathName.startsWith("/starttask") ||
            pathName.startsWith("/stoptask") ||
            pathName.startsWith("/gettasksettings") ||
            pathName.startsWith("/getactivitymonitorsettings") ||
            pathName.startsWith("/checkforupdates") ||
            pathName.startsWith("/admin-audit") ||
            pathName.startsWith("/deleteplaybackactivity") ||
            pathName.startsWith("/getbackuptables")
          ? "settings"
          : "dashboard";

  return requirePermission(permission)(req, res, next);
}

// start server
try {
  createdb.createDatabase().then((result) => {
    if (result) {
      console.log("[JellyGlance] Database created");
    } else {
      console.log("[JellyGlance] Database exists. Skipping creation");
    }

    db.migrate.latest().then(() => {
      const server = http.createServer(app);

      setupWebSocketServer(server, BASE_NAME);
      server.listen(PORT, LISTEN_IP, async () => {
        console.log(`[JellyGlance] Server listening on http://${LISTEN_IP}:${PORT}`);
        ActivityMonitor.ActivityMonitor(1000);
        new TaskManager();
        new TaskScheduler();
        // new WebhookScheduler();
      });
    });
  });
} catch (error) {
  console.log("[JellyGlance] An error has occured on startup: " + error);
}
