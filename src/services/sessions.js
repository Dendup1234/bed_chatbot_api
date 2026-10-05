import { randomUUID } from 'node:crypto';

export function createSessionStore({ systemPrompt, maxHistoryMessages, ttlMinutes }) {
  const sessions = new Map();
  const ttlMs = ttlMinutes * 60 * 1000;

  function isExpired(session, now = Date.now()) {
    return now - session.lastUsed > ttlMs;
  }

  function create() {
    const sessionId = randomUUID();
    const session = {
      messages: [{ role: 'system', content: systemPrompt }],
      lastUsed: Date.now(),
    };
    sessions.set(sessionId, session);
    return { sessionId, session };
  }

  function getOrCreate(sessionId) {
    if (typeof sessionId === 'string' && sessionId) {
      const existing = sessions.get(sessionId);
      if (existing && !isExpired(existing)) {
        existing.lastUsed = Date.now();
        return { sessionId, session: existing };
      }
      if (existing) sessions.delete(sessionId);
    }
    return create();
  }

  function trim(session) {
    session.messages = [session.messages[0], ...session.messages.slice(-maxHistoryMessages)];
  }

  function remove(sessionId) {
    return sessions.delete(sessionId);
  }

  function cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [sessionId, session] of sessions) {
      if (isExpired(session, now)) {
        sessions.delete(sessionId);
        removed += 1;
      }
    }
    return removed;
  }

  return { getOrCreate, trim, remove, cleanup };
}
