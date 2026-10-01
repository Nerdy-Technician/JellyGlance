const JellyfinAPI = require("./jellyfin-api");
const EmbyAPI = require("./emby-api");
const { getActiveServerType } = require("./server-type");

// One client per server type, created on first use. The exported proxy always
// forwards to the client for the active server type, so switching between
// Jellyfin and Emby in settings takes effect without a restart.
const clients = new Map();
const BLOCKED_PROPS = new Set(["__proto__", "constructor", "prototype"]);

function client() {
  const type = getActiveServerType() === "emby" ? "emby" : "jellyfin";
  if (!clients.has(type)) clients.set(type, type === "emby" ? new EmbyAPI() : new JellyfinAPI());
  return clients.get(type);
}

module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      const api = client();
      const value = api[prop];
      return typeof value === "function" ? value.bind(api) : value;
    },
    set(_target, prop, value) {
      if (typeof prop !== "string" || BLOCKED_PROPS.has(prop)) return false;
      Reflect.set(client(), prop, value);
      return true;
    },
    has(_target, prop) {
      return prop in client();
    },
  }
);
