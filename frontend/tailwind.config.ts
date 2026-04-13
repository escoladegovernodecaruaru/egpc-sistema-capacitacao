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
        // Nova Paleta Premium Light Mode (Baseada na imagem fornecida)
        primary: {
          DEFAULT: "#4f46e5", // indigo-600 (Para ações primárias como botões "Alunos")
          dark:    "#4338ca", // indigo-700
          light:   "#818cf8", // indigo-400
          muted:   "#e0e7ff", // indigo-100 para hovers suaves
        },
        secondary: {
          DEFAULT: "#0f172a", // slate-900 (Textos de título, botões contrastantes)
          dark:    "#020617", // slate-950
          light:   "#334155", // slate-700
        },
        success: {
          DEFAULT: "#10b981", // emerald-500 (Status Concluído / Botão Gerar Certificados)
          dark:    "#059669", // emerald-600
          light:   "#34d399", // emerald-400
        },
        warning: {
          DEFAULT: "#f97316", // orange-500 (Para status Pendente/Diário)
          light:   "#ffedd5", // orange-100
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in":   "fade-in 0.4s ease-out",
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'float': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
};
export default config;