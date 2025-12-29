import type { Config } from "tailwindcss";
import baseConfig from "@mythos/tailwind-config";
import { colors } from "../../packages/theme/src/colors";

const config: Config = {
  ...baseConfig,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../website/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      colors: {
        ...baseConfig.theme?.extend?.colors,
        // Website colors (unprefixed for LandingPage compatibility)
        bg: {
          primary: colors.bg.primary,
          secondary: colors.bg.secondary,
          tertiary: colors.bg.tertiary,
        },
        text: {
          primary: colors.text.primary,
          secondary: colors.text.secondary,
          muted: colors.text.muted,
        },
        accent: colors.accent.cyan,
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.15)",
        },
      },
    },
  },
};

export default config;
