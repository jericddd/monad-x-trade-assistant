import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "*.r2.dev" },
    ],
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "@react-native-async-storage/async-storage", "encoding");
    return config;
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
