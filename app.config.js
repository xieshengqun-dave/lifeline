// Extends app.json rather than duplicating it: local `expo start` keeps
// today's LAN-IP default from app.json untouched, while EAS builds override
// apiBaseUrl via the API_BASE_URL env var set per build profile in eas.json.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.API_BASE_URL || config.extra.apiBaseUrl,
  },
});
