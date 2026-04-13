import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Nova Paleta Slate & Blue (Credibilidade e Inovação)
        primary: {
          DEFAULT: "#2563eb", // blue-600
          dark:    "#1d4ed8", // blue-700
          light:   "#3b82f6", // blue-500
          muted:   "#2563eb/20",
        },
        secondary: {
          DEFAULT: "#06b6d4", // cyan-500
          dark:    "#0891b2", // cyan-600
          light:   "#22d3ee", // cyan-400
        },
        success: {
          DEFAULT: "#10b981", // emerald-500
          dark:    "#059669", // emerald-600
          light:   "#34d399", // emerald-400
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 15px rgba(37,99,235,0.15)" },
          "50%":      { boxShadow: "0 0 30px rgba(37,99,235,0.35)" },
        },
      },
      animation: {
        shimmer:     "shimmer 1.5s infinite",
        "fade-in":   "fade-in 0.4s ease-out",
        "pulse-glow":"pulse-glow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;