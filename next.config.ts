import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev-mode route badge out of review/e2e screenshots.
  devIndicators: false,
};

export default nextConfig;
