import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../api", "JS_");

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

    server: {
      port: 3001,
      proxy: {
        "/api":      { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/proxy":    { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/stats":    { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/sync":     { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/auth":     { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/backup":   { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/logs":     { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/swagger":  { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/utils":    { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/webhooks": { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/env.js":   { target: "http://127.0.0.1:3000", changeOrigin: true },
        "/socket.io": {
          target: "http://127.0.0.1:3000",
          changeOrigin: true,
          ws: true,
        },
      },
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
