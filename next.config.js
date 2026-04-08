/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg'],
    instrumentationHook: true,
  },
}

module.exports = nextConfig
