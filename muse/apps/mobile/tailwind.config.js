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
        // Backgrounds - from @mythos/theme
        bg: {
          primary: "#0a0a0f",
          secondary: "#12121a",
          tertiary: "#1a1a24",
        },
        // Text - from @mythos/theme
        text: {
          primary: "#e4e4e7",
          secondary: "#a1a1aa",
          muted: "#71717a",
        },
        // Single accent
        accent: "#22d3ee",
        // Borders
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
