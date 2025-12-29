const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

// Find the project root (monorepo root)
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Force Metro to resolve (sub)dependencies only from monorepo root
config.resolver.disableHierarchicalLookup = true;

// 4. Add support for monorepo packages
config.resolver.extraNodeModules = {
  "@mythos/core": path.resolve(monorepoRoot, "packages/core/src"),
  "@mythos/theme": path.resolve(monorepoRoot, "packages/theme/src"),
  "@mythos/db": path.resolve(monorepoRoot, "packages/db/src"),
  "@mythos/prompts": path.resolve(monorepoRoot, "packages/prompts/src"),
};

module.exports = withNativeWind(config, { input: "./global.css" });
