// Excludes the sibling patient app + backend from this project's Metro
// crawl — see the root project's metro.config.js for why.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);
config.resolver.blockList = [
  new RegExp(`${path.resolve(__dirname, "..", "src").replace(/[/\\]/g, "\\$&")}/.*`),
  new RegExp(`${path.resolve(__dirname, "..", "backend").replace(/[/\\]/g, "\\$&")}/.*`),
  new RegExp(`${path.resolve(__dirname, "..", "App.js").replace(/[/\\]/g, "\\$&")}`),
];

module.exports = config;
