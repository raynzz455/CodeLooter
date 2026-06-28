import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Prevent webpack from bundling these CJS-only packages
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
