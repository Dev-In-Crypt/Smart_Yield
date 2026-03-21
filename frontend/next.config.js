const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pg runs server-side only — exclude from browser bundle
  serverExternalPackages: ['pg'],

  // Force InterwovenKit through webpack so it picks up the correct React instance
  transpilePackages: ['@initia/interwovenkit-react'],

  // Prevent Next.js from picking wrong workspace root
  outputFileTracingRoot: path.join(__dirname),

  // Remove the dev toolbar overlay
  devIndicators: false,

  webpack: (config, { isServer }) => {
    // Stub out native/optional packages not needed in the bundle
    const emptyModule = require.resolve('./lib/empty-module.js');
    config.resolve.alias['pino-pretty'] = emptyModule;
    config.resolve.alias['@react-native-async-storage/async-storage'] = emptyModule;

    if (!isServer) {
      // Override the `react` alias so InterwovenKit gets a React that exports
      // useEffectEvent. Next.js 15 vendors a React canary that lacks it.
      // Our shim wraps the vendored React and adds the missing export.
      config.resolve.alias['react'] = path.resolve(__dirname, 'lib/react-shim');
    }

    return config;
  },
};

module.exports = nextConfig;
