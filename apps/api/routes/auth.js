const express = require("express");
const CryptoJS = require("crypto-js");
const { randomUUID } = require("crypto");
const db = require("../db");
const jwt = require("jsonwebtoken");
const configClass = require("../classes/config");
const packageJson = require("../package.json");
const API = require("../classes/api-loader");
const { axios } = require("../classes/axios");

const JWT_SECRET = process.env.JWT_SECRET;
const JS_USER = process.env.JS_USER;
const JS_PASSWORD = process.env.JS_PASSWORD;
if (JWT_SECRET === undefined) {
  console.log("JWT Secret cannot be undefined");
  process.exit(1); // end the program with error status code
}

const router = express.Router();

function signSetupToken(username) {
  return new Promise((resolve, reject) => {
    const user = { id: 1, username };
    jwt.sign({ user }, JWT_SECRET, (err, token) => {
      if (err) {
        reject(err);
      } else {
        resolve(token);
      }
    });
  });
}

function getJellyfinAuthHeaders(deviceId = "jellyglance-web") {
  const authHeader = `MediaBrowser Client="JellyGlance", Device="JellyGlance Web", DeviceId="${deviceId}", Version="${packageJson.version}"`;

  return {
    Authorization: authHeader,
    "X-Emby-Authorization": authHeader,
    "User-Agent": `JellyGlance/${packageJson.version}`,
  };
}

function normalizeJellyfinUrl(url) {
  return url?.trim()?.replace(/\/+$/, "");
}

async function getQuickConnectConfig() {
  const config = await new configClass().getConfig();

  if (config.error || config.state < 1 || !config.JF_HOST) {
    return { errorMessage: "Jellyfin must be connected before Quick Connect can be used" };
  }

  return {
    host: normalizeJellyfinUrl(config.JF_HOST),
    settings: config.settings || {},
  };
}

async function authenticateWithQuickConnect(host, secret) {
  const headers = getJellyfinAuthHeaders();
  const payloads = [{ Secret: secret }, { secret }];
  let lastError = null;

  for (const payload of payloads) {
    try {
      return await axios.post(`${host}/Users/AuthenticateWithQuickConnect`, payload, {
        headers,
        timeout: 12000,
      });
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 400) {
        throw error;
      }
    }
  }

  throw lastError;
}

function normalizeIssuerUrl(url) {
  return url?.trim()?.replace(/\/+$/, "");
}

async function testOidcDiscovery(issuerUrl) {
  const normalizedIssuer = normalizeIssuerUrl(issuerUrl);
  if (!normalizedIssuer) {
    return { isValid: false, errorMessage: "OIDC issuer URL is required" };
  }

  try {
    const response = await axios.get(`${normalizedIssuer}/.well-known/openid-configuration`, { timeout: 8000 });
    const discovery = response?.data || {};
    const hasRequiredEndpoints = discovery.authorization_endpoint && discovery.token_endpoint && discovery.issuer;

    if (!hasRequiredEndpoints) {
      return { isValid: false, errorMessage: "OIDC discovery document is missing required endpoints" };
    }

    return {
      isValid: true,
      issuerUrl: normalizedIssuer,
      discovery: {
        issuer: discovery.issuer,
        authorization_endpoint: discovery.authorization_endpoint,
        token_endpoint: discovery.token_endpoint,
        userinfo_endpoint: discovery.userinfo_endpoint,
        jwks_uri: discovery.jwks_uri,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      errorMessage: `Unable to reach OIDC discovery: ${error?.response?.status || error.message}`,
    };
  }
}

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const query = "SELECT * FROM app_config";
    const { rows: login } = await db.query(query);

    const authMode = login[0]?.settings?.auth?.mode;
    const isEmptyLogin = !username || !password || password === CryptoJS.SHA3("").toString();

    if (isEmptyLogin && login.length > 0 && (login[0].REQUIRE_LOGIN == true || authMode === "quick-connect")) {
      res.sendStatus(401);
      return;
    }

    const localUsers = login[0]?.settings?.localUsers || [];
    const loginUser = login.filter(
      (user) =>
        (user.APP_USER === username && user.APP_PASSWORD === password) ||
        localUsers.some((localUser) => localUser.role !== "Disabled" && localUser.username === username && localUser.password === password) ||
        user.REQUIRE_LOGIN == false
    );

    if (loginUser.length > 0 || (username === JS_USER && password === CryptoJS.SHA3(JS_PASSWORD).toString())) {
      const user = { id: 1, username: username };

      jwt.sign({ user }, JWT_SECRET, (err, token) => {
        if (err) {
          console.log(err);
          res.sendStatus(500);
        } else {
          res.json({ token });
        }
      });
    } else {
      res.sendStatus(401);
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/jellyfin-quick-connect/initiate", async (req, res) => {
  try {
    const config = await getQuickConnectConfig();

    if (config.errorMessage) {
      res.status(400).json({ errorMessage: config.errorMessage });
      return;
    }

    const response = await axios.post(`${config.host}/QuickConnect/Initiate`, null, {
      headers: getJellyfinAuthHeaders(),
      timeout: 12000,
    });

    const data = response?.data || {};
    if (!data.Code || !data.Secret) {
      res.status(502).json({ errorMessage: "Jellyfin did not return a Quick Connect code" });
      return;
    }

    res.json({
      code: data.Code,
      secret: data.Secret,
      quickConnectUrl: `${config.host}/web/#/quickconnect`,
      authenticated: data.Authenticated === true,
      dateAdded: data.DateAdded || null,
    });
  } catch (error) {
    const status = error?.response?.status || 500;
    const errorMessage =
      status === 401 || status === 403
        ? "Quick Connect is disabled or blocked on Jellyfin"
        : `Unable to start Jellyfin Quick Connect: ${error?.response?.status || error.message}`;

    console.log("[QUICK-CONNECT] initiate failed", error?.response?.status || error.message);
    res.status(status === 404 ? 404 : status >= 500 ? 502 : status).json({ errorMessage });
  }
});

router.get("/jellyfin-quick-connect/status", async (req, res) => {
  try {
    const { secret } = req.query;
    const config = await getQuickConnectConfig();

    if (!secret) {
      res.status(400).json({ errorMessage: "Quick Connect secret is required" });
      return;
    }

    if (config.errorMessage) {
      res.status(400).json({ errorMessage: config.errorMessage });
      return;
    }

    const response = await axios.get(`${config.host}/QuickConnect/Connect`, {
      headers: getJellyfinAuthHeaders(),
      params: { secret },
      timeout: 12000,
    });

    const data = response?.data || {};
    res.json({
      authenticated: data.Authenticated === true,
      code: data.Code || null,
    });
  } catch (error) {
    console.log("[QUICK-CONNECT] status failed", error?.response?.status || error.message);
    res.status(error?.response?.status || 502).json({
      errorMessage: `Unable to check Jellyfin Quick Connect: ${error?.response?.status || error.message}`,
    });
  }
});

router.post("/jellyfin-quick-connect/complete", async (req, res) => {
  try {
    const { secret } = req.body;
    const config = await getQuickConnectConfig();

    if (!secret) {
      res.status(400).json({ errorMessage: "Quick Connect secret is required" });
      return;
    }

    if (config.errorMessage) {
      res.status(400).json({ errorMessage: config.errorMessage });
      return;
    }

    const response = await authenticateWithQuickConnect(config.host, secret);
    const jellyfinUser = response?.data?.User;

    if (!jellyfinUser?.Policy?.IsAdministrator) {
      res.status(403).json({ errorMessage: "Approve Quick Connect with a Jellyfin administrator account" });
      return;
    }

    const settings = config.settings || {};
    settings.auth = {
      ...(settings.auth || {}),
      mode: "quick-connect",
      label: "Jellyfin Quick Connect",
      jellyfinUser: {
        id: jellyfinUser.Id,
        name: jellyfinUser.Name,
        primaryImageTag: jellyfinUser.PrimaryImageTag || null,
      },
    };

    await db.query('UPDATE app_config SET settings=$1 where "ID"=1', [settings]);

    const token = await signSetupToken(jellyfinUser.Name || "jellyfin-quick-connect");
    res.json({
      token,
      mode: "quick-connect",
      user: {
        id: jellyfinUser.Id,
        name: jellyfinUser.Name,
      },
    });
  } catch (error) {
    const status = error?.response?.status || 502;
    console.log("[QUICK-CONNECT] complete failed", error?.response?.status || error.message);
    res.status(status).json({
      errorMessage: `Unable to complete Jellyfin Quick Connect: ${error?.response?.status || error.message}`,
    });
  }
});

router.get("/isConfigured", async (req, res) => {
  try {
    const config = await new configClass().getConfig();
    res.json({
      state: config.state,
      version: packageJson.version,
      auth: config.settings?.auth || null,
      requireLogin: config.REQUIRE_LOGIN,
    });
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

router.get("/background-posters", async (req, res) => {
  try {
    const config = await new configClass().getConfig();
    const requestedLimit = Number(req.query.limit) || 24;
    const limit = Math.min(Math.max(requestedLimit, 18), 30);

    if (config.error || config.state < 1 || !config.JF_HOST || !config.JF_API_KEY) {
      res.set("Cache-Control", "no-store");
      res.json({ configured: false, posters: [] });
      return;
    }

    const headers = {
      Authorization: 'MediaBrowser Token="' + config.JF_API_KEY + '"',
      "User-Agent": "JellyGlance/" + packageJson.version,
    };
    const itemTypes = ["Movie", "Series", "BoxSet"];
    const perTypeLimit = Math.ceil(limit / itemTypes.length) + 10;

    const posterGroups = await Promise.all(
      itemTypes.map(async (type) => {
        try {
          const response = await axios.get(`${config.JF_HOST}/Items`, {
            headers,
            params: {
              Recursive: true,
              IncludeItemTypes: type,
              ImageTypes: "Primary,Backdrop",
              Fields: "ImageTags,BackdropImageTags",
              SortBy: "Random",
              Limit: perTypeLimit,
              EnableImages: true,
              ExcludeLocationTypes: "Virtual",
            },
          });

          return (response?.data?.Items || [])
            .filter((item) => item?.Id && (item?.BackdropImageTags?.length > 0 || item?.ImageTags?.Primary))
            .flatMap((item, index) => {
              const hasBackdrop = item?.BackdropImageTags?.length > 0;
              const hasPoster = Boolean(item?.ImageTags?.Primary);
              const artwork = [];

              if (hasBackdrop) {
                artwork.push({
                  id: item.Id,
                  type: item.Type,
                  imageType: "backdrop",
                  imageTag: item.BackdropImageTags[0],
                });
              }

              if (hasPoster && (!hasBackdrop || index % 4 === 0)) {
                artwork.push({
                  id: item.Id,
                  type: item.Type,
                  imageType: "poster",
                  imageTag: item.ImageTags.Primary,
                });
              }

              return artwork;
            });
        } catch (error) {
          console.log(`[AUTH-BACKGROUND] Unable to fetch ${type} artwork`, error?.response?.status || error.message);
          return [];
        }
      })
    );

    const artwork = posterGroups
      .flat()
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);

    res.set("Cache-Control", "private, max-age=300");
    res.json({ configured: true, artwork, posters: artwork });
  } catch (error) {
    console.log(error);
    res.status(500).json({ configured: false, posters: [] });
  }
});

router.post("/createuser", async (req, res) => {
  try {
    const { username, password } = req.body;
    const config = await new configClass().getConfig();

    if (config.state != null && config.state < 2) {
      const user = { id: 1, username: username };

      let query = 'INSERT INTO app_config ("ID","APP_USER","APP_PASSWORD") VALUES (1,$1,$2)';
      if (config.state > 0) {
        query = 'UPDATE app_config SET  "APP_USER"=$1, "APP_PASSWORD"=$2 where "ID"=1';
      }

      await db.query(query, [username, password]);

      jwt.sign({ user }, JWT_SECRET, (err, token) => {
        if (err) {
          console.log(err);
          res.sendStatus(500);
        } else {
          res.json({ token });
        }
      });
    } else {
      res.sendStatus(403);
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/setup-auth", async (req, res) => {
  try {
    const { mode, username, password, issuerUrl, clientId, clientSecret, redirectUri } = req.body;
    const config = await new configClass().getConfig();

    if (config.state == null || config.state >= 2) {
      res.sendStatus(403);
      return;
    }

    const settings = config.settings || {};
    let query = "";
    let params = [];
    let tokenUsername = username || mode;

    if (mode === "quick-connect") {
      settings.auth = {
        ...(settings.auth || {}),
        mode: "quick-connect",
        label: "Jellyfin Login / Quick Connect",
      };

      query =
        'UPDATE app_config SET "APP_USER"=$1, "APP_PASSWORD"=$2, "REQUIRE_LOGIN"=$3, settings=$4 where "ID"=1';
      params = ["jellyfin-quick-connect", null, true, settings];
      tokenUsername = "jellyfin-quick-connect";
    } else if (mode === "local") {
      if (!username || !password || password === CryptoJS.SHA3("").toString()) {
        res.status(400).json({ errorMessage: "Username and password are required for local login" });
        return;
      }

      settings.auth = {
        mode: "local",
        label: "Local JellyGlance login",
      };
      settings.localUsers = [
        ...(settings.localUsers || []).filter((user) => user.username !== username),
        {
          id: randomUUID(),
          username,
          password,
          role: "Admin",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      query =
        'UPDATE app_config SET "APP_USER"=$1, "APP_PASSWORD"=$2, "REQUIRE_LOGIN"=$3, settings=$4 where "ID"=1';
      params = ["local-auth", null, true, settings];
    } else if (mode === "oidc") {
      if (!clientId) {
        res.status(400).json({ errorMessage: "OIDC client ID is required" });
        return;
      }

      const oidcTest = await testOidcDiscovery(issuerUrl);
      if (!oidcTest.isValid) {
        res.status(400).json(oidcTest);
        return;
      }

      settings.auth = {
        mode: "oidc",
        label: "OIDC / Authentik",
        issuerUrl: oidcTest.issuerUrl,
        clientId,
        clientSecret: clientSecret || null,
        redirectUri: redirectUri || null,
        discovery: oidcTest.discovery,
      };

      query =
        'UPDATE app_config SET "APP_USER"=$1, "APP_PASSWORD"=$2, "REQUIRE_LOGIN"=$3, settings=$4 where "ID"=1';
      params = ["oidc", null, true, settings];
      tokenUsername = "oidc";
    } else {
      res.status(400).json({ errorMessage: "Invalid authentication mode" });
      return;
    }

    await db.query(query, params);
    const token = await signSetupToken(tokenUsername);
    res.json({ token, mode });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: "Unable to save authentication setup" });
  }
});

router.post("/configSetup", async (req, res) => {
  try {
    const { JF_HOST, JF_API_KEY } = req.body;
    const config = await new configClass().getConfig();

    if (JF_HOST === undefined && JF_API_KEY === undefined) {
      res.status(400);
      res.send("JF_HOST and JF_API_KEY are required for configuration");
      return;
    }

    var url = JF_HOST;

    const validation = await API.validateSettings(url, JF_API_KEY);
    if (validation.isValid === false) {
      res.status(validation.status);
      res.send(validation);
      return;
    }

    const { rows: getConfig } = await db.query('SELECT * FROM app_config where "ID"=1');

    if (config.state != null && config.state < 2) {
      let query = 'UPDATE app_config SET "JF_HOST"=$1, "JF_API_KEY"=$2 where "ID"=1';
      if (getConfig.length === 0) {
        query = 'INSERT INTO app_config ("ID","JF_HOST","JF_API_KEY","APP_USER","APP_PASSWORD") VALUES (1,$1,$2,null,null)';
      }

      const { rows } = await db.query(query, [validation.cleanedUrl, JF_API_KEY]);

      const systemInfo = await API.systemInfo();

      if (systemInfo && systemInfo != {}) {
        const settingsjson = await db.query('SELECT settings FROM app_config where "ID"=1').then((res) => res.rows);

        if (settingsjson.length > 0) {
          const settings = settingsjson[0].settings || {};

          settings.Tasks = systemInfo?.Id || null;

          let query = 'UPDATE app_config SET settings=$1 where "ID"=1';

          await db.query(query, [settings]);
        }
      }
      res.send(rows);
    } else {
      res.sendStatus(500);
    }
  } catch (error) {
    console.log(error);
  }
});

// Handle other routes
router.use((req, res) => {
  res.status(404).send({ error: "Not Found" });
});

module.exports = router;
