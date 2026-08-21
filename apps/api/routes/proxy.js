const express = require("express");

const { axios } = require("../classes/axios");
const configClass = require("../classes/config");
const API = require("../classes/api-loader");

const router = express.Router();

function getJellyfinAuthHeaders(config) {
  return {
    Authorization: `MediaBrowser Token="${config.JF_API_KEY}"`,
    "X-Emby-Authorization": `MediaBrowser Token="${config.JF_API_KEY}"`,
    "X-MediaBrowser-Token": config.JF_API_KEY,
  };
}

function toUnsignedInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getJellyfinOrigin(config) {
  if (!config?.JF_HOST) {
    return null;
  }

  try {
    const hostUrl = new URL(config.JF_HOST);
    return `${hostUrl.protocol}//${hostUrl.host}`;
  } catch {
    return null;
  }
}

function isAllowedPluginImageUrl(url, config) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      return false;
    }

    const jellyfinOrigin = getJellyfinOrigin(config);
    if (!jellyfinOrigin) {
      return false;
    }

    if (parsed.origin === jellyfinOrigin) {
      return true;
    }

    if (config.IS_JELLYFIN == false && parsed.hostname === "raw.githubusercontent.com") {
      return parsed.pathname.startsWith("/MediaBrowser/Emby.Resources/");
    }

    return false;
  } catch {
    return false;
  }
}

router.get("/web/assets/img/devices/", async (req, res) => {
  const { devicename } = req.query; // Get the image URL from the query string
  const config = await new configClass().getConfig();

  if (config.error) {
    res.send({ error: config.error });
    return;
  }

  if (!devicename) {
    res.status(400).send("device name is required");
    return;
  }

  const encodedDevice = encodeURIComponent(String(devicename));
  let url = `${config.JF_HOST}/web/assets/img/devices/${encodedDevice}.svg`;
  if (config.IS_JELLYFIN == false) {
    url = `https://raw.githubusercontent.com/MediaBrowser/Emby.Resources/master/images/devices/${devicename}.png`;
  }

  axios
    .get(url, {
      responseType: "arraybuffer",
    })
    .then((response) => {
      res.set("Content-Type", "image/svg+xml");
      if (config.IS_JELLYFIN == false) {
        res.set("Content-Type", "image/png");
      }
      res.status(200);

      if (response.headers["content-type"].startsWith("image/")) {
        res.send(response.data);
      } else {
        res.status(500).send("Error fetching image");
      }

      return; // Add this line
    })
    .catch((error) => {
      res.status(error?.response?.status || 500).send("Error fetching image: " + error);
    });
});

router.get("/Items/Images/Backdrop/", async (req, res) => {
  const { id, fillWidth, quality, blur } = req.query; // Get the image URL from the query string
  const config = await new configClass().getConfig();

  if (config.error) {
    res.send({ error: config.error });
    return;
  }

  if (!id) {
    res.status(400).send("id is required");
    return;
  }

  const width = toUnsignedInt(fillWidth, 800);
  const imageQuality = toUnsignedInt(quality, 100);
  const blurValue = toUnsignedInt(blur, 0);
  const encodedId = encodeURIComponent(id);
  let url = `${config.JF_HOST}/Items/${encodedId}/Images/Backdrop?fillWidth=${width}&quality=${imageQuality}&blur=${blurValue}`;

  axios
    .get(url, {
      responseType: "arraybuffer",
      headers: getJellyfinAuthHeaders(config),
    })
    .then((response) => {
      res.set("Content-Type", "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.status(200);

      if (response.headers["content-type"].startsWith("image/")) {
        res.send(response.data);
      } else {
        res.status(500).send("Error fetching image");
      }
    })
    .catch((error) => {
      res.status(error?.response?.status || 500).send("Error fetching image: " + error);
    });
});

router.get("/Items/Images/Primary/", async (req, res) => {
  const { id, fillWidth, quality } = req.query; // Get the image URL from the query string
  const config = await new configClass().getConfig();

  if (config.error) {
    res.send({ error: config.error });
    return;
  }

  if (!id) {
    res.status(400).send("id is required");
    return;
  }

  const width = toUnsignedInt(fillWidth, 400);
  const imageQuality = toUnsignedInt(quality, 100);
  const encodedId = encodeURIComponent(id);
  let url = `${config.JF_HOST}/Items/${encodedId}/Images/Primary?fillWidth=${width}&quality=${imageQuality}`;

  axios
    .get(url, {
      responseType: "arraybuffer",
      headers: getJellyfinAuthHeaders(config),
    })
    .then((response) => {
      res.set("Content-Type", "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.status(200);

      if (response.headers["content-type"].startsWith("image/")) {
        res.send(response.data);
      } else {
        res.status(500).send("Error fetching image");
      }
    })
    .catch((error) => {
      res.status(error?.response?.status || 500).send("Error fetching image: " + error);
    });
});

router.get("/Users/Images/Primary/", async (req, res) => {
  const { id, tag, fillWidth, quality } = req.query;
  const config = await new configClass().getConfig();

  if (config.error) {
    res.send({ error: config.error });
    return;
  }

  if (!id) {
    res.status(400).send("id is required");
    return;
  }

  const encodedId = encodeURIComponent(id || "");
  const encodedTag = tag ? `&tag=${encodeURIComponent(tag)}` : "";
  const width = toUnsignedInt(fillWidth, 100);
  const imageQuality = toUnsignedInt(quality, 100);
  let url = `${config.JF_HOST}/Users/${encodedId}/Images/Primary?fillWidth=${width}&quality=${imageQuality}${encodedTag}`;

  axios
    .get(url, {
      responseType: "arraybuffer",
      headers: getJellyfinAuthHeaders(config),
    })
    .then((response) => {
      const contentType = response.headers["content-type"] || "";
      res.set("Content-Type", contentType.startsWith("image/") ? contentType : "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.status(200);

      if (contentType.startsWith("image/")) {
        res.send(response.data);
      } else {
        res.status(500).send("Error fetching image");
      }
    })
    .catch((error) => {
      res.status(error?.response?.status || 500).send("Error fetching image: " + error);
    });
});

router.get("/Plugins/Images/", async (req, res) => {
  const { id, url: imageUrl } = req.query;
  const config = await new configClass().getConfig();

  if (config.error) {
    res.status(503).send({ error: config.error });
    return;
  }

  if (!id && !imageUrl) {
    res.status(400).send("No plugin image provided");
    return;
  }

  const encodedId = id ? encodeURIComponent(id) : undefined;
  const candidates = imageUrl ? [imageUrl] : [
    `${config.JF_HOST}/Plugins/${encodedId}/Image`,
    `${config.JF_HOST}/Plugins/${encodedId}/Images/Primary`,
    `${config.JF_HOST}/Plugins/${encodedId}/Thumb`,
  ];

  for (const url of candidates) {
    try {
      if (!/^https?:\/\//i.test(url) || !isAllowedPluginImageUrl(url, config)) {
        continue;
      }

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        headers: {
          ...(imageUrl ? {} : { Authorization: `MediaBrowser Token="${config.JF_API_KEY}"` }),
          "User-Agent": "JellyGlance/1.0.6",
        },
      });

      const contentType = response.headers["content-type"] || "image/png";
      if (!contentType.startsWith("image/")) continue;

      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.status(200).send(response.data);
      return;
    } catch {
      // Try the next Jellyfin plugin image endpoint.
    }
  }

  res.status(404).send("Plugin image not found");
});

router.get("/getSessions", async (req, res) => {
  try {
    const sessions = await API.getSessions();
    res.send(sessions);
  } catch (error) {
    res.status(503);
    res.send(error);
  }
});

router.get("/getAdminUsers", async (req, res) => {
  try {
    const adminUser = await API.getAdmins(true);
    res.send(adminUser);
  } catch (error) {
    res.status(503);
    res.send(error);
  }
});

router.get("/getRecentlyAdded", async (req, res) => {
  try {
    const { libraryid } = req.query;

    const recentlyAdded = await API.getRecentlyAdded({ libraryid: libraryid });
    res.send(recentlyAdded);
  } catch (error) {
    res.status(503);
    res.send(error);
  }
});

//API related functions

router.post("/validateSettings", async (req, res) => {
  const { url, apikey } = req.body;

  if (url === undefined || apikey === undefined) {
    res.status(400);
    res.send("URL or API Key not provided");
    return;
  }

  const validation = await API.validateSettings(url, apikey);
  if (validation.isValid === false) {
    res.status(validation.status);
    res.send(validation.errorMessage);
  } else {
    res.send(validation);
  }
});

// Handle other routes
router.use((req, res) => {
  res.status(404).send({ error: "Not Found" });
});

module.exports = router;
