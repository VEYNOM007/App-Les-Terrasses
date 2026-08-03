/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Build autonome (apps/web/Dockerfile) : sortie .next/standalone avec un
  // serveur Node minimal — nécessaire pour l'image de production.
  output: 'standalone',
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;
