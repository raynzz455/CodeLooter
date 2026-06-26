import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow up to 50MB uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
