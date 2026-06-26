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
  serverExternalPackages: ["unpdf","mammoth"],
};

export default nextConfig;
