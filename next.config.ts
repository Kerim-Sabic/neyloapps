import type { NextConfig } from 'next';
import { securityHeaders } from './src/security-headers';

const nextConfig: NextConfig = {
  distDir: '.next-native',
  poweredByHeader: false,
  async redirects() {
    return [{ source: '/:path*', has: [{ type: 'host', value: 'www.neylo.xyz' }], destination: 'https://neylo.xyz/:path*', permanent: true }];
  },
  async headers() {
    return [{ source: '/:path*', headers: Object.entries(securityHeaders(process.env.NODE_ENV==='development')).map(([key,value])=>({key,value})) }, { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }] }];
  }
};
export default nextConfig;
