import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "secure.espncdn.com" },
      { protocol: "https", hostname: "ufcstats.com" },
    ],
  },
};

export default nextConfig;
