import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

function resolveWebAppPort(env: Record<string, string>, fallback: number): number {
  const explicitPort = Number(env["VITE_WEB_APP_PORT"]);
  if (!Number.isNaN(explicitPort) && explicitPort > 0) {
    return explicitPort;
  }

  const baseUrl = env["VITE_WEB_APP_URL"]?.trim();
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      const urlPort = Number(parsed.port);
      if (!Number.isNaN(urlPort) && urlPort > 0) {
        return urlPort;
      }
    } catch {
      // Ignore invalid URL and fall back to default.
    }
  }

  return fallback;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, "../.."), "");
  const port = resolveWebAppPort(env, 3005);

  return {
    plugins: [react()],
    envDir: resolve(__dirname, "../.."),
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        "react-native": resolve(__dirname, "../../node_modules/react-native-web"),
      },
      dedupe: ["react", "react-dom", "react-native-web"],
    },
    server: {
      port,
      fs: {
        // Allow serving files from bun's node_modules cache
        allow: [
          resolve(__dirname, "../.."),
          resolve(__dirname, "../../node_modules/.bun"),
        ],
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
