const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the monorepo root
const monorepoRoot = path.resolve(__dirname, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable CSS support for web
config.resolver.sourceExts.push('css');

// Watch all packages in the monorepo
config.watchFolders = [monorepoRoot];

// Ensure all packages resolve to the same React instance
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
};

// Dedupe React across the monorepo
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName === 'react-dom' || moduleName === 'react-native') {
    return {
      filePath: require.resolve(moduleName, { paths: [__dirname] }),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
