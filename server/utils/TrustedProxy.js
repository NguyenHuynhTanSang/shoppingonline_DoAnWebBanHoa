const { isIP } = require('node:net');

// No topology assumptions and no trust-all/hop-count shortcuts. Only explicit
// proxy addresses/subnets may supply the right-hand trusted forwarding chain.
function configureTrustedProxy(app, value = process.env.TRUSTED_PROXY_CIDRS) {
  if (value === undefined || value.trim() === '') {
    app.set('trust proxy', false);
    return;
  }
  const proxies = value.split(',').map(item => item.trim());
  for (const proxy of proxies) {
    const parts = proxy.split('/');
    const family = isIP(parts[0]);
    if (!family || parts.length > 2 || (parts.length === 2 &&
      (!/^\d+$/.test(parts[1]) || Number(parts[1]) < 1 || Number(parts[1]) > (family === 4 ? 32 : 128)))) {
      throw new Error('Invalid TRUSTED_PROXY_CIDRS configuration');
    }
  }
  app.set('trust proxy', proxies);
}

module.exports = { configureTrustedProxy };
