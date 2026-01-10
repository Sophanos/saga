module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            'better-auth/react': './node_modules/better-auth/dist/client/react/index.mjs',
            'better-auth/client/plugins': './node_modules/better-auth/dist/client/plugins/index.mjs',
            '@better-auth/expo/client': './node_modules/@better-auth/expo/dist/client.mjs',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
