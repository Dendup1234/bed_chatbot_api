import 'dotenv/config';

function readPositiveInteger(name, defaultValue, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue.trim() === '') {
    return defaultValue;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0 || value > max) {
    throw new Error(`${name} must be a positive integer no greater than ${max}.`);
  }

  return value;
}

function readRequiredString(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readOptionalString(name) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readBaseUrl() {
  const rawValue = readRequiredString('OLLAMA_BASE_URL');

  try {
    const url = new URL(rawValue);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('unsupported protocol');
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('OLLAMA_BASE_URL must be a valid HTTP or HTTPS URL.');
  }
}

function readAllowedOrigins() {
  const rawValue = process.env.ALLOWED_ORIGINS?.trim();
  if (!rawValue) return [];

  return [...new Set(rawValue.split(',').map((origin) => origin.trim()).filter(Boolean))];
}

export const config = Object.freeze({
  port: readPositiveInteger('PORT', 3000, { max: 65535 }),
  ollamaBaseUrl: readBaseUrl(),
  ollamaApiKey: readOptionalString('OLLAMA_API_KEY'),
  ollamaModel: readRequiredString('OLLAMA_MODEL'),
  ollamaNumCtx: readPositiveInteger('OLLAMA_NUM_CTX', 8192),
  ollamaKeepAlive: readOptionalString('OLLAMA_KEEP_ALIVE') || '30m',
  clientApiKey: readOptionalString('CLIENT_API_KEY'),
  allowedOrigins: readAllowedOrigins(),
  maxHistoryMessages: readPositiveInteger('MAX_HISTORY_MESSAGES', 10),
  sessionTtlMinutes: readPositiveInteger('SESSION_TTL_MINUTES', 60),
  rateLimitPerMinute: readPositiveInteger('RATE_LIMIT_PER_MINUTE', 20),
});
