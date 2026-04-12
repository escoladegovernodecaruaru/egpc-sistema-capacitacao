import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Portal EGPC | Escola de Governo de Caruaru",
  description: "Sistema de gestão e educação institucional da Escola de Governo de Caruaru – Pernambuco.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        {/* Toaster global - utilizado em todas as páginas para feedback elegante */}
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            style: {
              background: "#0d1f1b",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f4f4f5",
              fontSize: "14px",
              borderRadius: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
