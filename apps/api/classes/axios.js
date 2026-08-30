const dns = require("dns");
const axios = require("axios");
const https = require("https");
const http = require("http");
const CacheableLookup = require("cacheable-lookup").default;

// Prefer IPv4 when dual-stack DNS returns unreachable IPv6 (common on LAN/Cloudflare setups).
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const cacheable = new CacheableLookup();
const preferIpv4 = String(process.env.JS_PREFER_IPV4 || "true").toLowerCase() !== "false";
const agentOptions = {
  rejectUnauthorized: (process.env.REJECT_SELF_SIGNED_CERTIFICATES || "true").toLowerCase() === "true",
  keepAlive: true,
  maxSockets: 25,
  ...(preferIpv4 ? { family: 4 } : {}),
};

const httpsAgent = new https.Agent(agentOptions);
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 25,
  ...(preferIpv4 ? { family: 4 } : {}),
});

cacheable.install(httpsAgent);
cacheable.install(httpAgent);

const axios_instance = axios.create({
  httpAgent,
  httpsAgent,
  timeout: Number(process.env.JS_HTTP_TIMEOUT_MS || 20000),
});

module.exports = {
  axios: axios_instance,
};
