import { timingSafeEqual } from 'node:crypto';

function keysMatch(providedKey, expectedKey) {
  const provided = Buffer.from(providedKey || '');
  const expected = Buffer.from(expectedKey);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function createApiKeyAuth(clientApiKey) {
  return function apiKeyAuth(req, res, next) {
    if (!clientApiKey) {
      next();
      return;
    }

    if (!keysMatch(req.get('x-api-key'), clientApiKey)) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    next();
  };
}
