import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  webpack(config, { isServer }) {


    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer/'),
      };
    }
    return config;
  },
};
export default nextConfig;
