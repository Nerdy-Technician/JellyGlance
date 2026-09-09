const swaggerAutogen = require("swagger-autogen")();
const fs = require("fs");

const outputFile = "./swagger.json";
const endpointsFiles = ["./server.js", "./routes/command-center.js"];
const config = {
  info: {
    title: "JellyGlance API Documentation",
    description: "JellyGlance REST API. Widget and most /api routes accept a Glance API key as x-api-token, or a session Bearer token.",
  },
  tags: [
    {
      name: "API",
      description: "JellyGlance API Endpoints",
    },
    {
      name: "Widgets",
      description: "Token-auth snapshots for Homepage, Homarr, and automation",
    },
    {
      name: "Auth",
      description: "JellyGlance Auth Endpoints",
    },
    {
      name: "Proxy",
      description: "Jellyfin Proxied Endpoints",
    },
    {
      name: "Stats",
      description: "JellyGlance Statisitc Endpoints",
    },
    {
      name: "Sync",
      description: "JellyGlance Sync Endpoints",
    },
    {
      name: "Backup",
      description: "JellyGlance Backup/Restore Endpoints",
    },
    {
      name: "Logs",
      description: "JellyGlance Log Endpoints",
    },
  ],
  host: "",
  schemes: ["http", "https"],
  securityDefinitions: {
    apiKey: {
      type: "apiKey",
      name: "x-api-token",
      in: "header",
    },
  },
  security: [
    {
      apiKey: [],
    },
  ],
};

module.exports = config;

const modifySwaggerFile = (filePath) => {
  const swaggerData = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const endpointsToModify = ["/api/getHistory", "/api/getLibraryHistory", "/api/getUserHistory", "/api/getItemHistory"]; // Add more endpoints as needed

  endpointsToModify.forEach((endpoint) => {
    if (swaggerData.paths[endpoint]) {
      const methods = Object.keys(swaggerData.paths[endpoint]);
      methods.forEach((method) => {
        const parameters = swaggerData.paths[endpoint][method].parameters;
        if (parameters) {
          parameters.forEach((param) => {
            if (param.name === "sort") {
              param.enum = [
                "UserName",
                "RemoteEndPoint",
                "NowPlayingItemName",
                "Client",
                "DeviceName",
                "ActivityDateInserted",
                "PlaybackDuration",
              ];

              if (endpoint.includes("getHistory") || endpoint.includes("getLibraryHistory")) {
                param.enum.push("TotalPlays");
              }
            }
          });
        }
      });
    }
  });

  const extra = JSON.parse(fs.readFileSync("./swagger-widgets-paths.json", "utf8"));
  Object.assign(swaggerData.paths, extra);
  if (!swaggerData.tags.some((tag) => tag.name === "Widgets")) {
    swaggerData.tags.splice(1, 0, {
      name: "Widgets",
      description: "Token-auth snapshots for Homepage, Homarr, and automation",
    });
  }
  swaggerData.definitions = swaggerData.definitions || {};
  swaggerData.definitions.WidgetSnapshot = swaggerData.definitions.WidgetSnapshot || {
    type: "object",
    properties: {
      jellyglance: { type: "boolean", example: true },
      sessionsRecent: { type: "integer" },
      sessionsToday: { type: "integer" },
      downloads: { type: "integer" },
      digest: { type: "integer" },
      digestOk: { type: "boolean" },
      storage: { type: "string" },
      updatedAt: { type: "string" },
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(swaggerData, null, 2));
};

swaggerAutogen(outputFile, endpointsFiles, config).then(() => {
  modifySwaggerFile(outputFile);
});
