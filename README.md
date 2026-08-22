# Social Publishing Engine

Single-user publishing dashboard: capture source material once, generate platform-native posts with OpenAI, review one queue, then send Facebook/Threads/LinkedIn to Buffer. Substack Notes remain a one-click copy queue until Substack exposes a supported publishing endpoint.

## Environment
Copy `.env.example` to `.env.local` and set:
- `DATABASE_URL` Neon Postgres connection string
- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional, defaults to `gpt-5.6`
- `BUFFER_API_KEY`
- `APP_USERNAME` / `APP_PASSWORD` for simple Basic Auth

## Run
```bash
npm install
npm run dev
```

## Workflow
1. Paste thoughts/passages into Inbox.
2. Generate Day creates 3 Threads, 2 Facebook, 1 LinkedIn, 3 Substack Notes.
3. Edit any draft if needed.
4. Load Buffer channels once and map Threads/Facebook/LinkedIn.
5. Approve Day schedules the social posts in Buffer and marks Substack Notes ready to copy.
