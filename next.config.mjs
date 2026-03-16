/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.espncdn.com" },
      { protocol: "https", hostname: "secure.espncdn.com" },
      { protocol: "https", hostname: "ufcstats.com" },
    ],
  },
};

export default nextConfig;
