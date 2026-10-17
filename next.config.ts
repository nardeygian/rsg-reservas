import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
