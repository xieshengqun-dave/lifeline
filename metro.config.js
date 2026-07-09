// Two independent Expo projects (this one and /operator-app) sit side by
// side in one git repo. Metro's Haste module resolution can throw "duplicate
// module name" errors if it ever crawls into a sibling Expo project's
// node_modules — excluding it here is cheap, standard insurance.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.blockList = [/operator-app\/.*/];

module.exports = config;
