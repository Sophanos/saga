import type { Config } from "tailwindcss";
import { colors } from "../../packages/theme/src/colors";

/**
 * Minimal Tailwind config - Cursor.ai inspired
 * Uses centralized @mythos/theme colors
 */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Backgrounds - very dark, almost black
        bg: {
          primary: colors.bg.primary,
          secondary: colors.bg.secondary,
          tertiary: colors.bg.tertiary,
        },
        // Text - simple grayscale hierarchy
        text: {
          primary: colors.text.primary,
          secondary: colors.text.secondary,
          muted: colors.text.muted,
        },
        // Single accent - used sparingly
        accent: colors.accent.cyan,
        // Borders - subtle
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.15)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out forwards",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
