const CHAT_TIMEOUT_MS = 120_000;
const HEALTH_TIMEOUT_MS = 5_000;

export class OllamaRequestError extends Error {
  constructor(message, { timedOut = false } = {}) {
    super(message);
    this.name = 'OllamaRequestError';
    this.timedOut = timedOut;
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function createOllamaService({ baseUrl, apiKey, model, numCtx, keepAlive }) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  async function chat(messages) {
    let response;
    try {
      response = await fetchWithTimeout(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          keep_alive: keepAlive,
          options: { num_ctx: numCtx },
        }),
      }, CHAT_TIMEOUT_MS);
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      throw new OllamaRequestError(
        timedOut ? 'The model response timed out.' : 'The model service is unavailable.',
        { timedOut },
      );
    }

    if (!response.ok) {
      throw new OllamaRequestError('The model service returned an error.');
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new OllamaRequestError('The model service returned an invalid response.');
    }

    const reply = data?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      throw new OllamaRequestError('The model service returned an invalid response.');
    }
    return reply;
  }

  async function isReachable() {
    try {
      const healthHeaders = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
      await fetchWithTimeout(baseUrl, {
        method: 'GET',
        headers: healthHeaders,
      }, HEALTH_TIMEOUT_MS);
      return true;
    } catch {
      return false;
    }
  }

  return { chat, isReachable };
}
