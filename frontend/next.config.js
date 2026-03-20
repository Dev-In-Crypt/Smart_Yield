/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg runs server-side only — exclude from browser bundle
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Stub out native/optional packages that wagmi connectors pull in
      // but are not needed in the browser bundle.
      config.resolve.alias = {
        ...config.resolve.alias,
        'pino-pretty': require.resolve('./lib/empty-module.js'),
        '@react-native-async-storage/async-storage': require.resolve('./lib/empty-module.js'),
      };
    }
    return config;
  },
};

module.exports = nextConfig;
