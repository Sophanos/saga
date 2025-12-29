import type { Config } from "tailwindcss";
import { bg, text, accent, entity } from "@mythos/theme";

const config: Partial<Config> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Mythos IDE brand colors - imported from @mythos/theme
        mythos: {
          bg: {
            primary: bg.primary,
            secondary: bg.secondary,
            tertiary: bg.tertiary,
          },
          text: {
            primary: text.primary,
            secondary: text.secondary,
            muted: text.muted,
          },
          accent: {
            cyan: accent.cyan,
            purple: accent.purple,
            green: accent.green,
            amber: accent.amber,
            red: accent.red,
          },
          entity: {
            character: entity.character,
            location: entity.location,
            item: entity.item,
            magic: entity.magic,
          },
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Merriweather", "Georgia", "serif"],
      },
      animation: {
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "glow": {
          "from": { boxShadow: "0 0 5px currentColor" },
          "to": { boxShadow: "0 0 20px currentColor" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
