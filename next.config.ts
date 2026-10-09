import type { NextConfig } from 'next';
import { wwwRedirects } from './lib/canonical';
const config: NextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,
  experimental: { authInterrupts: true },
  async redirects() {
    return wwwRedirects(process.env.AUTH_URL);
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/tela',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), display-capture=(self), geolocation=()' },
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
    ];
  },
};
export default config;
