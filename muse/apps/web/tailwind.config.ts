import type { Config } from "tailwindcss";
import baseConfig from "@mythos/tailwind-config";

const config: Config = {
  ...baseConfig,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
