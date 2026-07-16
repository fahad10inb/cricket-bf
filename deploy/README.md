# Deploying Cricket Butterfly Effect

Self-contained Vercel deploy — everything (frontend + API) ships from this folder.

## 1. Supabase (your account, any project)

Dashboard → SQL Editor → run `supabase-setup.sql`. That creates two isolated
`cricket_*` tables + two functions. Nothing else is touched.

Grab from Settings → API: the **Project URL** and the **anon/publishable key**.

## 2. Deploy to Vercel

```
cd deploy
npx vercel login
npx vercel --prod
```

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Supabase is already baked in (project wpjerityybwdueqlmyzm, publishable key —
safe to embed). Only the two AI keys are needed:

| Name | Value |
|---|---|
| `CEREBRAS_API_KEY` | from d:\cricket\.env (primary AI) |
| `GROQ_API_KEY` | from d:\cricket\.env (fallback AI) |

Then Deployments → ⋯ → **Redeploy**.

Missing AI keys degrade gracefully: custom stories use the built-in template.
(SUPABASE_URL / SUPABASE_ANON_KEY env vars override the baked defaults if you
ever move projects.)

## 4. After deploy

- Edit `public/index.html`: replace the two `og:image` values `/og-image.png`
  with your absolute URL `https://<your-app>.vercel.app/og-image.png`, redeploy.
- Put the live URL into `../launch/launch-posts.md` (replaces `[APP-URL]`).

## Keeping it updated

This folder is a copy. After changing files in `../public/`, re-copy them here
(or ask Claude to sync) and run `npx vercel --prod` again.
