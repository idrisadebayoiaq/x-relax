import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Monorepo: keep Turbopack rooted on this app, not the repo root lockfile.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'bfilhkxyjiofkfqwqyep.supabase.co' },
    ],
  },
};

export default nextConfig;
