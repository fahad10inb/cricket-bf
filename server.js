// =====================================================
// CRICKET BUTTERFLY EFFECT — EXPRESS BACKEND
// =====================================================
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const VOTES_FILE = path.join(__dirname, 'votes.json');

// ── Middleware ───────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Vote helpers ─────────────────────────────────────
function loadVotes() {
  try {
    if (fs.existsSync(VOTES_FILE)) {
      return JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveVotes(votes) {
  fs.writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
}

// ── Rate limiter (protects free-tier AI quota) ───────
// Groq free: ~100K tokens/day ≈ 50-70 stories. Gemini free: 1,500 req/day.
// Cerebras free: 1M tokens/day. Raise DAILY_STORY_CAP in .env accordingly.
const RATE = {
  perIpHour:    parseInt(process.env.HOURLY_IP_CAP   || '6',   10),
  globalPerDay: parseInt(process.env.DAILY_STORY_CAP || '150', 10)
};
const ipHits = new Map(); // ip -> [timestamps]
let dayCount = 0, dayStart = Date.now();

function rateLimit(req, res, next) {
  const now = Date.now();
  if (now - dayStart > 24 * 60 * 60 * 1000) { dayCount = 0; dayStart = now; ipHits.clear(); }
  if (dayCount >= RATE.globalPerDay) {
    return res.status(429).json({ error: "Today's AI story quota is used up — come back tomorrow! Legendary matches still work." });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const hits = (ipHits.get(ip) || []).filter(t => now - t < 60 * 60 * 1000);
  if (hits.length >= RATE.perIpHour) {
    return res.status(429).json({ error: `Easy, champ — max ${RATE.perIpHour} AI stories per hour. Explore a legendary match meanwhile!` });
  }
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount++;
  next();
}

// ══════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════

// ── GET /api/health ──────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    groq:     !!process.env.GROQ_API_KEY,
    gemini:   !!process.env.GEMINI_API_KEY,
    cerebras: !!process.env.CEREBRAS_API_KEY
  });
});

// ── POST /api/generate ──────────────────────────────
// Calls Groq (or Gemini) with the prompt, returns story
app.post('/api/generate', rateLimit, async (req, res) => {
  const { team1, team2, tournament, realMoment, twist, ripples, headline, provider } = req.body;

  if (!team1 || !team2 || !realMoment || !twist) {
    return res.status(400).json({ error: 'Missing required fields: team1, team2, realMoment, twist' });
  }

  const prompt = buildPrompt({ team1, team2, tournament, realMoment, twist, ripples, headline });

  const PROVIDERS = {
    groq:     { key: process.env.GROQ_API_KEY,     call: callGroq },
    gemini:   { key: process.env.GEMINI_API_KEY,   call: callGemini },
    cerebras: { key: process.env.CEREBRAS_API_KEY, call: callCerebras }
  };
  // Preference when caller doesn't specify: cerebras (1M tok/day) > groq > gemini
  const configured = ['cerebras', 'groq', 'gemini'].filter(p => PROVIDERS[p].key);
  if (configured.length === 0) {
    return res.status(503).json({ error: 'No AI provider configured on server.' });
  }

  // Try requested provider first, fall back to the others on failure
  const order = configured.includes(provider)
    ? [provider, ...configured.filter(p => p !== provider)]
    : configured;

  try {
    let story = null, useProvider = null, lastErr = null;
    for (const p of order) {
      try {
        story = await PROVIDERS[p].call(prompt);
        if (!story || !story.trim()) throw new Error('empty response');
        useProvider = p;
        break;
      } catch (err) {
        console.warn(`[/api/generate] ${p} failed: ${err.message} — trying next provider`);
        lastErr = err;
      }
    }
    if (!story) throw lastErr || new Error('All AI providers failed');

    // Parse the structured JSON response (models sometimes wrap it in
    // fences or add stray text — extract the outermost {...} first)
    let paragraphs = null, dossier = null;
    const parsedExtra = {};
    try {
      const start = story.indexOf('{'), end = story.lastIndexOf('}');
      const parsed = JSON.parse(story.slice(start, end + 1));
      if (Array.isArray(parsed.paragraphs) && parsed.paragraphs.length >= 3) {
        if (parsed.headline) parsedExtra.headline = String(parsed.headline).slice(0, 160);
        if (Array.isArray(parsed.ripples)) parsedExtra.ripples = parsed.ripples.slice(0, 5).map(r => String(r).slice(0, 200)).filter(Boolean);
        if (parsed.factCheck && typeof parsed.factCheck === 'object') {
          const v = String(parsed.factCheck.verdict || '').toLowerCase();
          if (['accurate','inaccurate','fictional'].includes(v)) {
            parsedExtra.factCheck = { verdict: v, note: String(parsed.factCheck.note || '').slice(0, 200) };
          }
        }
        paragraphs = parsed.paragraphs.map(p => String(p).trim()).filter(Boolean);
        dossier = {
          commentary: String(parsed.commentary || '').slice(0, 400),
          channel:    String(parsed.channel    || '').slice(0, 80),
          scoreline:  String(parsed.scoreline  || '').slice(0, 200),
          retro:      String(parsed.retro      || '').slice(0, 300),
          socials: (Array.isArray(parsed.socials) ? parsed.socials : []).slice(0, 3).map(s => ({
            handle: String(s.handle || '').slice(0, 60),
            text:   String(s.text   || '').slice(0, 280),
            likes:  String(s.likes  || '—').slice(0, 12)
          })),
          records: (Array.isArray(parsed.records) ? parsed.records : []).slice(0, 4).map(r => ({
            label:     String(r.label     || '').slice(0, 80),
            reality:   String(r.reality   || '').slice(0, 90),
            alternate: String(r.alternate || '').slice(0, 90)
          })).filter(r => r.label && r.reality && r.alternate)
        };
        if (!dossier.commentary) dossier = null;
      }
    } catch (_) { /* fall through to plain-prose handling */ }

    if (!paragraphs) {
      const split = story.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 20);
      paragraphs = split.length >= 3 ? split : [story];
    }

    const aiHeadline = parsedExtra.headline || null;
    const aiRipples  = parsedExtra.ripples  || null;
    res.json({ success: true, provider: useProvider, paragraphs, dossier, headline: aiHeadline, ripples: aiRipples, factCheck: parsedExtra.factCheck || null });

  } catch (err) {
    console.error('[/api/generate] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/vote ───────────────────────────────────
app.post('/api/vote', (req, res) => {
  const { momentId, vote } = req.body; // vote: 'agree' | 'disagree'

  if (!momentId || !['agree', 'disagree'].includes(vote)) {
    return res.status(400).json({ error: 'momentId and vote (agree|disagree) required' });
  }

  const votes = loadVotes();
  if (!votes[momentId]) votes[momentId] = { agree: 0, disagree: 0 };
  votes[momentId][vote]++;
  saveVotes(votes);

  const total = votes[momentId].agree + votes[momentId].disagree;
  res.json({
    success: true,
    agree:    votes[momentId].agree,
    disagree: votes[momentId].disagree,
    pctAgree:    total ? Math.round(votes[momentId].agree / total * 100) : 0,
    pctDisagree: total ? Math.round(votes[momentId].disagree / total * 100) : 0
  });
});

// ── GET /api/votes/:momentId ─────────────────────────
app.get('/api/votes/:momentId', (req, res) => {
  const votes = loadVotes();
  const data  = votes[req.params.momentId] || { agree: 0, disagree: 0 };
  const total = data.agree + data.disagree;
  res.json({
    ...data,
    pctAgree:    total ? Math.round(data.agree / total * 100) : 50,
    pctDisagree: total ? Math.round(data.disagree / total * 100) : 50
  });
});

// ── GET /api/votes-all ───────────────────────────────
app.get('/api/votes-all', (req, res) => {
  res.json(loadVotes());
});

// ── Shared stories (shareable links) ─────────────────
const STORIES_FILE = path.join(__dirname, 'stories.json');

function loadStories() {
  try {
    if (fs.existsSync(STORIES_FILE)) return JSON.parse(fs.readFileSync(STORIES_FILE, 'utf8'));
  } catch (_) {}
  return {};
}

// ── Share limiter (protects the stories file from spam) ──
const SHARE_RATE = { perIpHour: 10, globalPerDay: 300 };
const shareHits = new Map();
let shareDayCount = 0, shareDayStart = Date.now();

function shareLimit(req, res, next) {
  const now = Date.now();
  if (now - shareDayStart > 24 * 60 * 60 * 1000) { shareDayCount = 0; shareDayStart = now; shareHits.clear(); }
  if (shareDayCount >= SHARE_RATE.globalPerDay) {
    return res.status(429).json({ error: 'Sharing is taking a breather — try again tomorrow!' });
  }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const hits = (shareHits.get(ip) || []).filter(t => now - t < 60 * 60 * 1000);
  if (hits.length >= SHARE_RATE.perIpHour) {
    return res.status(429).json({ error: `Max ${SHARE_RATE.perIpHour} shared stories per hour — quality over quantity!` });
  }
  hits.push(now);
  shareHits.set(ip, hits);
  shareDayCount++;
  next();
}

// ── GET /api/stories/featured — community timelines ──
// Locally: mark a story by adding  "featured": true  in stories.json
app.get('/api/stories/featured', (req, res) => {
  const stories = loadStories();
  const featured = Object.entries(stories)
    .filter(([, s]) => s.featured === true)
    .sort((a, b) => (b[1].created || 0) - (a[1].created || 0))
    .slice(0, 12)
    .map(([id, s]) => ({ id, matchPill: s.matchPill || '', headline: s.headline || '' }));
  res.json(featured);
});

// ── POST /api/story — save a story, get a share id ───
app.post('/api/story', shareLimit, (req, res) => {
  const { matchPill, headline, verdictQ, ripples, story, dossier, factCheck } = req.body;
  if (!headline || !Array.isArray(story) || story.length === 0) {
    return res.status(400).json({ error: 'headline and story[] required' });
  }
  let safeDossier = null;
  if (dossier && typeof dossier === 'object') {
    safeDossier = {
      commentary: String(dossier.commentary || '').slice(0, 400),
      channel:    String(dossier.channel    || '').slice(0, 80),
      scoreline:  String(dossier.scoreline  || '').slice(0, 200),
      retro:      String(dossier.retro      || '').slice(0, 300),
      socials: (Array.isArray(dossier.socials) ? dossier.socials : []).slice(0, 3).map(s => ({
        handle: String(s.handle || '').slice(0, 60),
        text:   String(s.text   || '').slice(0, 280),
        likes:  String(s.likes  || '—').slice(0, 12)
      })),
      records: (Array.isArray(dossier.records) ? dossier.records : []).slice(0, 4).map(r => ({
        label:     String(r.label     || '').slice(0, 80),
        reality:   String(r.reality   || '').slice(0, 90),
        alternate: String(r.alternate || '').slice(0, 90)
      })).filter(r => r.label && r.reality && r.alternate)
    };
  }
  let safeFactCheck = null;
  if (factCheck && ['accurate', 'inaccurate', 'fictional'].includes(factCheck.verdict)) {
    safeFactCheck = { verdict: factCheck.verdict, note: String(factCheck.note || '').slice(0, 200) };
  }
  const stories = loadStories();
  // Bound total storage: keep the newest 2000
  const keys = Object.keys(stories);
  if (keys.length >= 2000) {
    keys.sort((a, b) => (stories[a].created || 0) - (stories[b].created || 0))
        .slice(0, keys.length - 1999).forEach(k => delete stories[k]);
  }
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  stories[id] = {
    matchPill: String(matchPill || '').slice(0, 120),
    headline:  String(headline).slice(0, 160),
    verdictQ:  String(verdictQ || '').slice(0, 200),
    ripples:   (Array.isArray(ripples) ? ripples : []).slice(0, 6).map(r => String(r).slice(0, 200)),
    story:     story.slice(0, 8).map(p => String(p).slice(0, 1500)),
    dossier:   safeDossier,
    factCheck: safeFactCheck,
    created:   Date.now()
  };
  fs.writeFileSync(STORIES_FILE, JSON.stringify(stories, null, 2));
  res.json({ id });
});

// ── GET /api/story/:id ───────────────────────────────
app.get('/api/story/:id', (req, res) => {
  const s = loadStories()[req.params.id];
  if (!s) return res.status(404).json({ error: 'Story not found' });
  res.json(s);
});

// ── Catch-all → serve frontend ───────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════════════════
// AI FUNCTIONS
// ══════════════════════════════════════════════════════

async function callGroq(prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a world-class literary sports journalist and cricket historian. Write vivid, emotional, cinematic alternate history stories.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
      max_tokens: 1400
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || `Groq error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callCerebras(prompt) {
  // Free tier: 1M tokens/day, OpenAI-compatible. Model catalog shifts —
  // override with CEREBRAS_MODEL in .env if the default disappears.
  const model = process.env.CEREBRAS_MODEL || 'gpt-oss-120b';
  const body = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a world-class literary sports journalist and cricket historian. Write vivid, emotional, cinematic alternate history stories.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.9,
    // Reasoning models (gpt-oss) burn tokens thinking before the story
    // appears — give them headroom and keep the thinking short.
    max_tokens: model.startsWith('gpt-oss') ? 4096 : 1400
  };
  if (model.startsWith('gpt-oss')) body.reasoning_effort = 'low';

  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Cerebras error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 1400 }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || `Gemini error ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ══════════════════════════════════════════════════════
// PROMPT BUILDER
// ══════════════════════════════════════════════════════

function buildPrompt({ team1, team2, tournament, realMoment, twist, ripples, headline }) {
  return `You are a world-class cricket historian and literary sports journalist — think Gideon Haigh meets ESPN Cricinfo meets Fever Pitch.

Write an alternate history story for this cricket moment. Make it emotional, vivid, and literary — not like a Wikipedia article. Use specific details, player psychology, crowd atmosphere, and lasting consequences. Write in past tense as if this actually happened.

MATCH: ${team1} vs ${team2}${tournament ? ', ' + tournament : ''}

WHAT REALLY HAPPENED: ${realMoment}

THE BUTTERFLY TWIST — WHAT IF INSTEAD: ${twist}

${ripples && ripples.length > 0 ? 'RIPPLE EFFECTS TO WEAVE IN:\n' + ripples.map((r, i) => `${i + 1}. ${r}`).join('\n') : ''}

${headline ? 'THE ALTERNATE HEADLINE (use as inspiration for the narrative arc): ' + headline : ''}

OUTPUT: Respond with ONLY a valid JSON object (no markdown fences, no commentary) in exactly this shape:
{
  "commentary": "1-3 sentences of LIVE broadcast call at the exact second history forks. Present tense, breathless, exclamatory — iconic-commentary energy.",
  "channel": "a plausible generic broadcaster name for this match's era (e.g. 'Star Sports', 'Sky Sports Cricket')",
  "scoreline": "the alternate final scoreboard in authentic compact cricket notation",
  "socials": [
    {"handle": "@FictionalFanHandle", "text": "viral fan reaction from the alternate timeline — funny, heartbroken or furious", "likes": "12.4K"},
    {"handle": "@AnotherFan", "text": "...", "likes": "8.1K"},
    {"handle": "@ThirdFan", "text": "...", "likes": "31K"}
  ],
  "retro": "one killer sentence looking back decades later, like a documentary narrator's closing line",
  "headline": "ALL-CAPS alternate-universe newspaper headline, max 90 chars",
  "factCheck": {"verdict": "accurate OR inaccurate OR fictional — judge whether WHAT REALLY HAPPENED above matches real cricket history", "note": "empty if accurate; if inaccurate, one short line stating what actually happened; if fictional, empty"},
  "ripples": ["4 one-line consequences cascading outward: near-term, career, legacy, cricket-wide"],
  "records": [
    {"label": "a real record/stat this twist changes", "reality": "the TRUE real-world value", "alternate": "the value in this alternate universe"},
    {"label": "a player-legacy line", "reality": "...", "alternate": "..."},
    {"label": "a quirky/emotional one (nickname, chant, curse)", "reality": "...", "alternate": "..."}
  ],
  "paragraphs": ["para 1", "para 2", "para 3", "para 4", "para 5"]
}

PARAGRAPH RULES:
- Exactly 5 paragraphs: (1) scene/tension before the moment, (2) the moment unfolding differently in cinematic detail, (3) immediate aftermath, (4) the cascade over weeks/months, (5) lasting legacy.
- Use real player names, venue details, and match context wherever you know them.
- Maximum 300 words across all paragraphs. Literary, emotional, gripping.
- Fan handles must be fictional — never real journalists, orgs, or players.

Return ONLY the JSON object.`;
}

// ── Start ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏏 Cricket Butterfly Effect`);
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`⚡ Groq:   ${process.env.GROQ_API_KEY ? '✓ configured' : '✗ not set'}`);
  console.log(`🔵 Gemini: ${process.env.GEMINI_API_KEY ? '✓ configured' : '✗ not set'}`);
  console.log(`📁 Serving frontend from /public\n`);
});
