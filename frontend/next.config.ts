import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Avoid running heavy TypeScript AST type checking during production container build
    // This prevents massive RAM consumption and swap thrashing on 2GB EC2 instances
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@tanstack/react-table",
      "@tanstack/react-query",
      "clsx",
    ],
  },
  async redirects() {
    return [
      {
        source: "/indices",
        destination: "/market-indices",
        permanent: true,
      },
      {
        source: "/athena",
        destination: "/pead-drift-screener",
        permanent: true,
      },
      {
        source: "/athena-omega",
        destination: "/pead-drift-screener",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
