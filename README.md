# 🦋 Cricket Butterfly Effect

Change one moment. Watch cricket history unravel.

A "what if" alternate-universe simulator for cricket's most legendary matches —
pick a butterfly moment from 6 classic matches (2011 WC Final, 2019 Super Over,
1983 Kapil's catch, Edgbaston 2005, 2007 T20 WC, 1999 SA semi-final), or create
your own twist and let AI write the alternate timeline.

## Run it

```bash
npm install
npm start        # or: npm run dev (auto-reload)
```

Then open **http://localhost:3000**

## AI setup (optional but 10x more fun)

Copy your key into `.env`:

```
CEREBRAS_API_KEY=csk-...    # PRIMARY — free 1M tokens/day at https://cloud.cerebras.ai
GROQ_API_KEY=gsk_...        # fallback — free at https://console.groq.com/keys (~60 stories/day)
GEMINI_API_KEY=AIza...      # fallback — free at https://aistudio.google.com/app/apikey (1,500 req/day)
PORT=3000
DAILY_STORY_CAP=150         # global AI stories/day (raise it — Cerebras allows ~500)
HOURLY_IP_CAP=6             # AI stories per visitor per hour
```

Any one key is enough — the server prefers Cerebras, then Groq, then Gemini,
and falls back through the others automatically if one fails. Keys live only
on the server — the browser talks to `/api/generate`. No key? Custom stories
fall back to a built-in template.

## How it works

- `server.js` — Express backend: `/api/generate` (Groq Llama 3.3 70B / Gemini 2.5 Flash),
  `/api/vote` + `/api/votes/:id` (fan verdicts, persisted to `votes.json`), `/api/health`
- `public/` — the frontend (this is what's served; edit files here)
- `_archive/` — old pre-server version of the frontend, kept for reference
