const { ApolloError } = require('apollo-server-core');

// A gateway egy pm2 forkban fut. Közös számláló kell a kérésenként létrejövő
// DataSource-oknak; a sikertelen upstream kísérlet is fogyasztja a keretet.
const createPropertyLimiter = (now = () => Date.now()) => {
  const attempts = new Map();
  // pm2 restart után az előző process számlálóját nem ismerjük: egy teljes
  // ablakot kivárunk. Így nincs restart miatti kvóta-túllépés vagy új tár.
  const safeStart = now() + 60000;
  return (route, propertyIds) => {
    const at = now();
    for (const [key, times] of attempts) {
      const recent = times.filter((time) => time > at - 60000);
      if (recent.length) attempts.set(key, recent);
      else attempts.delete(key);
    }
    const keys = [...new Set(propertyIds)].map((id) => `${route}:${id}`);
    const blocked = keys.map((key) => attempts.get(key) || []).filter((times) => times.length >= 10);
    const availableAt = Math.max(safeStart, ...blocked.map((times) => times[0] + 60000));
    if (at < availableAt) {
      const seconds = Math.ceil((availableAt - at) / 1000);
      throw new ApolloError('429: Too Many Requests', 'CHANNEX_RATE_LIMIT', {
        response: { status: 429, retryAfter: String(seconds), path: `/${route}` },
      });
    }
    for (const key of keys) attempts.set(key, [...(attempts.get(key) || []), at]);
  };
};
module.exports = { createPropertyLimiter, reservePropertyRequest: createPropertyLimiter() };
