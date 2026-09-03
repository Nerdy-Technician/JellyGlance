import axios from "../lib/axios_instance";

function asConfigPayload(data) {
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || data.response) return null;
  if (data.settings || data.hostUrl || data.JF_HOST) {
    return {
      hostUrl: data.hostUrl || data.JF_HOST,
      username: data.username || data.APP_USER,
      token: data.token || localStorage.getItem("token"),
      requireLogin: data.requireLogin ?? data.REQUIRE_LOGIN,
      settings: data.settings,
      IS_JELLYFIN: data.IS_JELLYFIN,
    };
  }
  return null;
}

class Config {
  async fetchConfig() {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get("/api/getconfig", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = asConfigPayload(response.data);
      if (!payload) {
        throw new Error("Invalid configuration payload");
      }
      return payload;
    } catch (error) {
      return error;
    }
  }

  async setConfig(config) {
    if (config == undefined) {
      config = await this.fetchConfig();
    }

    const payload = asConfigPayload(config);
    if (payload) {
      localStorage.setItem("config", JSON.stringify(payload));
      return payload;
    }
    return config;
  }

  async getConfig(refreshConfig) {
    let config = localStorage.getItem("config");
    if (config != undefined && !refreshConfig) {
      return JSON.parse(config);
    }
    return await this.setConfig();
  }
}

export default new Config();
