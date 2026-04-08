import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@alook/shared"],
  async rewrites() {
    return [
      { source: "/health", destination: "/api/health" },
      { source: "/auth/:path*", destination: "/api/auth/:path*" },
    ];
  },
};

export default nextConfig;
