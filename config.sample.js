/**
 * config.sample.js
 * ----------------
 * COPY THIS to "config.js" for local testing on your own computer only.
 * Never commit a real config.js to GitHub — it holds the GAS Web App URL
 * and the shared token. On the live site, config.js is generated
 * automatically by the GitHub Actions workflow from your repository
 * Secrets (see .github/workflows/deploy.yml and README.md).
 */
window.APP_CONFIG = {
  GAS_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",
  SHARED_TOKEN: "PASTE_THE_SAME_SHARED_TOKEN_YOU_SET_IN_SCRIPT_PROPERTIES"
};
