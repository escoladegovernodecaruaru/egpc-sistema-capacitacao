import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Portal EGPC | Escola de Governo de Caruaru",
  description: "Sistema de gestão e educação institucional da Escola de Governo de Caruaru – Pernambuco.",
  icons: {
    icon: "/logo_egpc.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        {/* Toaster global - utilizado em todas as páginas para feedback elegante */}
<Toaster
          richColors
          theme="dark"
          position="top-right"
        />
      </body>
    </html>
  );
}
