// Injects the PWA head tags into the exported dist/index.html. Expo's Metro
// web export has no HTML-template hook outside expo-router, so this runs as
// a post-export step (see netlify.toml / the web:build script).
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "dist", "index.html");
let html = fs.readFileSync(file, "utf8");

const TAGS = `
  <title>Lifeline — Ambulance Booking</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#0E8C8C">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Lifeline">`;

if (html.includes('rel="manifest"')) {
  console.log("postbuild-web: tags already present, skipping");
} else {
  // Strip Expo's default <title> if present, then inject ours.
  html = html.replace(/<title>.*?<\/title>/s, "");
  html = html.replace("</head>", `${TAGS}\n</head>`);
  fs.writeFileSync(file, html);
  console.log("postbuild-web: injected PWA head tags");
}
