/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 — URL pública (pub-*.r2.dev) ou domínio customizado
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      // Caso use um domínio customizado no R2 (ex: media.egpc.gov.br)
      // Adicione aqui conforme necessário:
      // { protocol: "https", hostname: "media.egpc.caruaru.pe.gov.br" },
    ],
  },
};

export default nextConfig;
