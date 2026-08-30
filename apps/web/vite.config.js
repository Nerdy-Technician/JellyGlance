import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../api", "JS_");
  const apiTarget = process.env.JS_API_URL || env.JS_API_URL || "http://127.0.0.1:3000";
  const devPort = Number(process.env.JS_DEV_PORT || env.JS_DEV_PORT || 3001);

  return {
    envPrefix: "JS_",
    base: env.JS_BASE_URL ?? "/",
    envDir: "../api",

    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom", "axios", "react-toastify"],
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },

    resolve: {
      dedupe: ["react", "react-dom"],
    },

    server: {
      port: devPort,
      strictPort: false,
      proxy: (() => {
        const proxyPaths = [
          "/api",
          "/proxy",
          "/stats",
          "/sync",
          "/auth",
          "/backup",
          "/logs",
          "/swagger",
          "/utils",
          "/webhooks",
          "/newsletter",
          "/tautulli",
          "/jellystat",
          "/env.js",
        ];
        const proxy = Object.fromEntries(
          proxyPaths.map((pathName) => [
            pathName,
            {
              target: apiTarget,
              changeOrigin: true,
              ...(pathName === "/backup"
                ? { timeout: 0, proxyTimeout: 0 }
                : {}),
            },
          ])
        );
        proxy["/socket.io"] = { target: apiTarget, changeOrigin: true, ws: true };
        return proxy;
      })(),
    },

    build: {
      target: "es2015",
      rolldownOptions: {
        output: {
          codeSplitting: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            // MUI icons is enormous — keep it separate
            if (id.includes("/@mui/icons-material")) return "vendor-mui-icons";
            // MUI X (data grid, date pickers) separate from core MUI
            if (id.includes("/@mui/x-")) return "vendor-mui-x";
            if (id.includes("/@mui/") || id.includes("/@emotion/")) return "vendor-mui";
            if (id.includes("/material-react-table/") || id.includes("/@tanstack/")) return "vendor-table";
            if (id.includes("/recharts/") || id.includes("/d3-") || id.includes("/victory-")) return "vendor-charts";
            if (id.includes("/i18next") || id.includes("/react-i18next")) return "vendor-i18n";
            if (id.includes("/react-dom/") || id.includes("/react-router") || id.includes("/react/")) return "vendor-react";
            if (
              id.includes("/axios/") ||
              id.includes("/dayjs/") ||
              id.includes("/react-toastify/") ||
              id.includes("/socket.io-client/") ||
              id.includes("/bootstrap/") ||
              id.includes("/react-bootstrap/") ||
              id.includes("/remixicon-react/")
            ) return "vendor-misc";
          },
        },
      },
    },

    plugins: [react()],
  };
});
