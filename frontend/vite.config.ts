import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    // Dev-server-only setting; not prefixed with VITE_, so it is never bundled into the client.
    const { API_PROXY_TARGET = "http://localhost:5000" } = loadEnv(mode, process.cwd(), "");

    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                "@": fileURLToPath(new URL("./src", import.meta.url)),
            },
        },
        server: {
            port: 5173,
            // In development, forward API calls to the backend so the browser only talks to our own origin.
            proxy: {
                "/api": {
                    target: API_PROXY_TARGET,
                    changeOrigin: true,
                },
            },
        },
    };
});
