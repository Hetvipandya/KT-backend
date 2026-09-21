const http = require('http');
const https = require('https');

/**
 * Self-ping service to prevent Render free instance from sleeping.
 * Runs every 10 minutes if RENDER_EXTERNAL_URL is set in environment.
 */
function initKeepAlive() {
  const serverUrl = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL;

  if (!serverUrl) {
    console.log('ℹ️ Keep-alive service disabled (No RENDER_EXTERNAL_URL configured).');
    return;
  }

  const pingIntervalMs = 10 * 60 * 1000; // 10 minutes

  console.log(`⏱️ Initializing Keep-Alive ping service for: ${serverUrl} (Interval: 10m)`);

  setInterval(() => {
    try {
      const isHttps = serverUrl.startsWith('https');
      const client = isHttps ? https : http;
      const targetUrl = `${serverUrl.replace(/\/$/, '')}/api/ping`;

      client.get(targetUrl, (res) => {
        console.log(`💓 Keep-alive ping to ${targetUrl} - Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.warn(`⚠️ Keep-alive ping failed: ${err.message}`);
      });
    } catch (err) {
      console.warn(`⚠️ Keep-alive ping exception: ${err.message}`);
    }
  }, pingIntervalMs);
}

module.exports = { initKeepAlive };
