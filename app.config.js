// Extends app.json rather than duplicating it: local `expo start` keeps
// today's LAN-IP default from app.json untouched, while EAS builds override
// apiBaseUrl via the API_BASE_URL env var set per build profile in eas.json.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.API_BASE_URL || config.extra.apiBaseUrl,
    // Runtime can't reliably read android.config.googleMaps.apiKey out of
    // Constants.expoConfig in standalone builds — surface presence (not the
    // key itself) as a build-time flag for the map module's crash guard.
    androidMapsKeyPresent: !!config.android?.config?.googleMaps?.apiKey,
  },
});
