import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) {
            return "recharts";
          }
          if (id.includes("@dnd-kit")) {
            return "dnd-kit";
          }
          if (id.includes("socket.io-client") || id.includes("engine.io-client")) {
            return "socket";
          }
          if (id.includes("react-dom") || id.includes("node_modules/react/") || id.includes("react-router")) {
            return "react-vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
});

