import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createApiKeyAuth } from './middleware/auth.js';
import { createChatRouter } from './routes/chat.js';
import { createOllamaService } from './services/ollama.js';
import { createSessionStore } from './services/sessions.js';

const contextPath = fileURLToPath(new URL('../context.md', import.meta.url));

function loadSystemPrompt() {
  let prompt;
  try {
    prompt = fs.readFileSync(contextPath, 'utf8').trim();
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('context.md is missing. Add it to the project root before starting the server.');
    }
    throw new Error('context.md could not be read.');
  }

  if (!prompt) {
    throw new Error('context.md is empty. Add the chatbot system prompt before starting the server.');
  }

  console.log(`[startup] Loaded context.md (${prompt.split(/\s+/u).length} words).`);
  return prompt;
}

const systemPrompt = loadSystemPrompt();
const { config } = await import('./config.js');
const sessionStore = createSessionStore({
  systemPrompt,
  maxHistoryMessages: config.maxHistoryMessages,
  ttlMinutes: config.sessionTtlMinutes,
});
const ollamaService = createOllamaService({
  baseUrl: config.ollamaBaseUrl,
  apiKey: config.ollamaApiKey,
  model: config.ollamaModel,
  numCtx: config.ollamaNumCtx,
  keepAlive: config.ollamaKeepAlive,
});

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || config.allowedOrigins.includes(origin));
  },
}));
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(`[request] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

app.get('/health', async (req, res) => {
  res.json({ status: 'ok', ollama: await ollamaService.isReachable() });
});

app.use(createApiKeyAuth(config.clientApiKey));
app.use(express.json({ limit: '10kb' }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimitPerMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many chat requests. Please try again in a minute.' },
});
app.use('/chat', chatLimiter, createChatRouter({ sessionStore, ollamaService }));

app.delete('/session/:id', (req, res) => {
  sessionStore.remove(req.params.id);
  res.status(204).send();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((error, req, res, next) => {
  console.error(`[error] ${error?.name || 'Error'}: ${error?.message || 'Unexpected error'}`);
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large.' });
    return;
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    res.status(400).json({ error: 'Request body must contain valid JSON.' });
    return;
  }
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

const cleanupInterval = setInterval(() => {
  const removed = sessionStore.cleanup();
  if (removed > 0) console.log(`[sessions] Removed ${removed} expired session(s).`);
}, config.sessionTtlMinutes * 60 * 1000);
cleanupInterval.unref();

const server = app.listen(config.port, () => {
  console.log(`[startup] Server listening on port ${config.port}.`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received. Closing server.`);
  clearInterval(cleanupInterval);
  server.close((error) => {
    if (error) {
      console.error(`[shutdown] Error: ${error.message}`);
      process.exitCode = 1;
    }
  });
  const forceCloseTimer = setTimeout(() => {
    console.error('[shutdown] Closing remaining connections.');
    server.closeAllConnections?.();
  }, 10_000);
  forceCloseTimer.unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
