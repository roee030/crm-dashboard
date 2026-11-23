import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Audio uploads can be large; raise the Server Action body limit.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
