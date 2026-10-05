import { Router } from 'express';
import { OllamaRequestError } from '../services/ollama.js';

export function createChatRouter({ sessionStore, ollamaService }) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    const { message, sessionId: requestedSessionId } = req.body ?? {};

    if (typeof message !== 'string' || !message.trim() || message.length > 1000) {
      res.status(400).json({ error: 'Message must be a non-empty string of at most 1000 characters.' });
      return;
    }

    const { sessionId, session } = sessionStore.getOrCreate(requestedSessionId);
    const previousMessages = session.messages;
    session.messages = [...previousMessages, { role: 'user', content: message }];
    session.lastUsed = Date.now();

    try {
      const reply = await ollamaService.chat(session.messages);
      session.messages.push({ role: 'assistant', content: reply });
      session.lastUsed = Date.now();
      sessionStore.trim(session);
      res.json({ sessionId, reply });
    } catch (error) {
      session.messages = previousMessages;
      session.lastUsed = Date.now();

      if (error instanceof OllamaRequestError) {
        console.error(`[ollama] ${error.name}: ${error.message}`);
        res.status(error.timedOut ? 504 : 502).json({
          error: error.timedOut
            ? 'The chatbot took too long to respond. Please try again.'
            : 'The chatbot service is temporarily unavailable. Please try again.',
        });
        return;
      }

      next(error);
    }
  });

  return router;
}
