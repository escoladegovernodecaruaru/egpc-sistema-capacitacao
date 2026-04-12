import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Paleta oficial EGPC
      colors: {
        primary: {
          DEFAULT: "#004036",
          dark:    "#002a24",
          light:   "#005c4d",
          muted:   "#004036/20",
        },
        secondary: {
          DEFAULT: "#00919f",
          dark:    "#007380",
          light:   "#00b2c2",
        },
        success: {
          DEFAULT: "#32a536",
          dark:    "#26822a",
          light:   "#3ecf43",
        },
      },
      // Fonte base
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      // Animações customizadas
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 15px rgba(0,145,159,0.15)" },
          "50%":       { boxShadow: "0 0 30px rgba(0,145,159,0.35)" },
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
