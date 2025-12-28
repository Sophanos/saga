import type { Config } from "tailwindcss";

const config: Partial<Config> = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Mythos IDE brand colors
        mythos: {
          bg: {
            primary: "#0a0a0f",
            secondary: "#12121a",
            tertiary: "#1a1a24",
          },
          text: {
            primary: "#e4e4e7",
            secondary: "#a1a1aa",
            muted: "#71717a",
          },
          accent: {
            cyan: "#22d3ee",
            purple: "#a855f7",
            green: "#22c55e",
            amber: "#f59e0b",
            red: "#ef4444",
          },
          entity: {
            character: "#22d3ee",
            location: "#22c55e",
            item: "#f59e0b",
            magic: "#a855f7",
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
