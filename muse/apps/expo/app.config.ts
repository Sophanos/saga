import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Mythos IDE",
  slug: "mythos-ide",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/icon.png",
  scheme: ["mythos", "rhei"],
  userInterfaceStyle: "automatic",
  newArchEnabled: true,

  // Web configuration
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
  },

  // iOS configuration
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.mythos.ide",
  },

  // macOS configuration (via react-native-macos)
  extra: {
    supportsMultipleWindows: true,
  },

  // Expo Router
  experiments: {
    typedRoutes: true,
  },

  plugins: [
    "expo-router",
    [
      "expo-system-ui",
      {
        backgroundColor: "#0a0a0a",
      },
    ],
  ],
});
