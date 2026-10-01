const JellyfinAPI = require("./jellyfin-api");
const EmbyAPI = require("./emby-api");
const { getActiveServerType } = require("./server-type");

// One client per server type, created on first use. The exported proxy always
// forwards to the client for the active server type, so switching between
// Jellyfin and Emby in settings takes effect without a restart.
const clients = {};

function client() {
  const type = getActiveServerType();
  if (!clients[type]) clients[type] = type === "emby" ? new EmbyAPI() : new JellyfinAPI();
  return clients[type];
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
      client()[prop] = value;
      return true;
    },
    has(_target, prop) {
      return prop in client();
    },
  }
);
