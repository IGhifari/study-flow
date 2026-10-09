import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@studyflow/shared'],
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
