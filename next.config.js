/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false,
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    forceSwcTransforms: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'k.kakaocdn.net' },
    ],
  },
};

module.exports = nextConfig;
