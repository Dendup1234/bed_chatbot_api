# BetterEveryday Chatbot API

A small Node.js/Express API that keeps short-lived chat sessions in memory and sends conversations to an Ollama model. The contents of `context.md` are loaded once at startup and used as the system prompt for every session.

## Requirements

- Node.js 18 or newer
- A reachable Ollama server with the configured model available
- A non-empty `context.md` in the project root

## Install and run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Fill in `.env`. At minimum, set `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. See `.env.example` for every supported setting.

3. Start the server:

   ```bash
   npm run dev
   ```

   For production, use `npm start`.

## Test the API

The health endpoint is public. Its `ollama` boolean reports whether the configured Ollama base URL responded successfully:

```bash
curl http://localhost:3000/health
```

Start a chat and copy the `sessionId` from the response:

```bash
curl -X POST http://localhost:3000/chat \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_CLIENT_API_KEY' \
  -d '{"message":"How can BetterEveryday help me?"}'
```

Send a follow-up with that returned ID:

```bash
curl -X POST http://localhost:3000/chat \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_CLIENT_API_KEY' \
  -d '{"message":"Tell me more about that.","sessionId":"RETURNED_SESSION_ID"}'
```

If `CLIENT_API_KEY` is left unset, omit the `x-api-key` header. To clear a session, send `DELETE /session/RETURNED_SESSION_ID` with the same header when authentication is enabled.

## Configuration

`PORT`, `OLLAMA_NUM_CTX`, `OLLAMA_KEEP_ALIVE`, `MAX_HISTORY_MESSAGES`, `SESSION_TTL_MINUTES`, and `RATE_LIMIT_PER_MINUTE` have defaults. `OLLAMA_API_KEY`, `CLIENT_API_KEY`, and `ALLOWED_ORIGINS` are optional. With no allowed origins configured, cross-origin browser access is disabled; requests without an `Origin` header (such as curl and server-to-server calls) still work.
