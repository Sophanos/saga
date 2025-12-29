/** @type {import('tailwindcss').Config} */

// Note: We duplicate colors here since NativeWind can't import from packages at build time
// Keep in sync with packages/theme/src/colors.ts

module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Mythos theme colors - match class names used in components
        mythos: {
          // Backgrounds
          bg: {
            primary: "#0a0a0f",
            secondary: "#12121a",
            tertiary: "#1a1a24",
          },
          // Text
          text: {
            primary: "#e4e4e7",
            secondary: "#a1a1aa",
            muted: "#71717a",
          },
          // Accents
          accent: {
            cyan: "#22d3ee",
            red: "#f87171",
            amber: "#fbbf24",
            green: "#4ade80",
          },
          // Borders
          border: {
            DEFAULT: "rgba(255, 255, 255, 0.08)",
            subtle: "rgba(255, 255, 255, 0.08)",
            hover: "rgba(255, 255, 255, 0.15)",
          },
        },
        // Legacy flat structure for backwards compatibility
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
        accent: "#22d3ee",
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.15)",
        },
      },
      fontFamily: {
        sans: ["Inter", "System"],
        mono: ["JetBrains Mono", "Menlo"],
      },
    },
  },
  plugins: [],
};
