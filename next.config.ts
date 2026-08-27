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
  // officeparser memuat pdfjs worker secara dinamis; tandai sebagai
  // server-external supaya tidak dibundle oleh webpack/turbopack.
  serverExternalPackages: ["officeparser"],
};

export default nextConfig;
