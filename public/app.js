// =====================================================
// CRICKET BUTTERFLY EFFECT — FRONTEND
// All AI calls go through /api/* — no keys in browser
// =====================================================

// ── State ────────────────────────────────────────────
let currentMatch  = null;
let currentMoment = null;
let isCustom      = false;
let customData    = null;
let localVotes    = {}; // cache of real counts from the server

// ── Escape user/AI text before innerHTML ──────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Screens ───────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) { el.classList.add('active'); el.scrollTop = 0; window.scrollTo(0,0); }
}

// ── Particle Canvas ───────────────────────────────────
const canvas = document.getElementById('bg-canvas');
const ctx    = canvas.getContext('2d');
let particles = [];

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function mkParticle() {
  return {
    x: Math.random()*canvas.width, y: Math.random()*canvas.height,
    r: Math.random()*1.5+0.3, vx:(Math.random()-0.5)*0.2, vy:-Math.random()*0.3-0.1,
    alpha: Math.random()*0.5+0.1, color: Math.random()>0.7 ? '#f5c842' : '#7070a0'
  };
}
for (let i=0;i<120;i++) particles.push(mkParticle());

(function animateParticles() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  particles.forEach((p,i) => {
    p.x+=p.vx; p.y+=p.vy;
    if (p.y<-5) { particles[i]=mkParticle(); particles[i].y=canvas.height+5; }
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle=p.color; ctx.globalAlpha=p.alpha; ctx.fill();
  });
  ctx.globalAlpha=1;
  requestAnimationFrame(animateParticles);
})();

// ── Check server health on load ───────────────────────
async function checkHealth() {
  try {
    const res  = await fetch('/api/health');
    const data = await res.json();
    const hasAI = !!(data.cerebras || data.groq || data.gemini);
    const badge = document.getElementById('server-status');
    if (badge) {
      badge.textContent = hasAI ? '✨ AI Stories Ready' : '🦋 Template Stories Mode';
      badge.className   = 'server-badge ' + (hasAI ? 'ready' : 'warn');
    }
    // Load all votes from server
    const vRes = await fetch('/api/votes-all');
    const vData = await vRes.json();
    Object.assign(localVotes, vData);
  } catch (_) {
    // Server might not be running (file:// mode) — silent fail
  }
}

// ── Build Match Cards ─────────────────────────────────
function buildMatchGrid() {
  const grid = document.getElementById('matches-grid');
  grid.innerHTML = '';
  const ERAS = [
    { test: (m, i) => i < 6,                     label: '⭐ The Iconic Six' },
    { test: m => parseInt(m.year, 10) < 1990,    label: '🏛 The Classics · 1933–1987' },
    { test: m => parseInt(m.year, 10) < 2000,    label: '📼 The Nineties' },
    { test: m => parseInt(m.year, 10) < 2013,    label: '🏆 The 2000s' },
    { test: () => true,                          label: '🚀 The Modern Era' }
  ];
  let lastEra = null;
  MATCHES.forEach((match, i) => {
    const era = ERAS.find(e => e.test(match, i)).label;
    if (era !== lastEra) {
      lastEra = era;
      const h = document.createElement('div');
      h.className = 'match-era-header';
      h.textContent = era;
      grid.appendChild(h);
    }
    const card = document.createElement('div');
    card.className = 'match-card';
    card.dataset.search = `${match.team1} ${match.team2} ${match.year} ${match.tournament}`.toLowerCase();
    card.innerHTML = `
      <div class="card-accent" style="background:${match.accentColor}"></div>
      <div class="card-year">${match.year}</div>
      <div class="card-tournament">${match.tournament.split('·')[0].trim()}</div>
      <div class="card-teams">${match.team1} <span class="vs">vs</span> ${match.team2}</div>
      <div class="card-summary">${match.summary}</div>
      <div class="card-moments-count">🦋 ${match.moments.length} butterfly moment${match.moments.length>1?'s':''}</div>
    `;
    card.addEventListener('click', () => { location.hash = '#/match/' + match.id; });
    grid.appendChild(card);
  });
}

// ── Community timelines (featured shared stories) ─────
async function loadCommunityStrip() {
  try {
    const res = await fetch('/api/stories/featured');
    const list = await res.json();
    const strip = document.getElementById('community-strip');
    const row   = document.getElementById('community-row');
    if (!strip || !row || !Array.isArray(list) || list.length === 0) return;
    row.innerHTML = '';
    list.forEach(s => {
      const card = document.createElement('div');
      card.className = 'community-card';
      card.innerHTML = `
        <div class="community-card-pill">${esc(s.matchPill || 'Fan timeline')}</div>
        <div class="community-card-headline">${esc(s.headline || '')}</div>
        <div class="community-card-cta">Enter this universe →</div>
      `;
      card.addEventListener('click', () => { location.hash = '#/shared/' + s.id; });
      row.appendChild(card);
    });
    strip.classList.remove('hidden');
  } catch (_) { /* section stays hidden */ }
}

// ── Match search filter ───────────────────────────────
function setupMatchSearch() {
  const input = document.getElementById('match-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll('.match-card').forEach(card => {
      card.classList.toggle('filtered-out', q !== '' && !card.dataset.search.includes(q));
    });
    // Era headers only make sense in the unfiltered view
    document.querySelectorAll('.match-era-header').forEach(h => h.classList.toggle('filtered-out', q !== ''));
  });
}

// ── Surprise me: random butterfly moment ──────────────
function surpriseMe() {
  const match  = MATCHES[Math.floor(Math.random() * MATCHES.length)];
  const moment = match.moments[Math.floor(Math.random() * match.moments.length)];
  if ('#/twist/' + moment.id === location.hash) { route(); return; }
  location.hash = '#/twist/' + moment.id;
}

// ── Match → Moments ───────────────────────────────────
function selectMatch(match) {
  currentMatch = match; isCustom = false;
  document.getElementById('moment-nav-title').textContent = `${match.team1} vs ${match.team2}, ${match.year}`;
  document.getElementById('match-banner').innerHTML = `
    <div class="banner-top">
      <div class="banner-teams">${match.team1} <span style="color:var(--muted);font-size:1.2rem">vs</span> ${match.team2}</div>
      <div class="banner-year">${match.year}</div>
    </div>
    <div class="banner-real-tag">What really happened</div>
    <div class="banner-result">${match.realResult}</div>
  `;
  const list = document.getElementById('moments-list');
  list.innerHTML = '';
  match.moments.forEach(moment => {
    const card = document.createElement('div');
    card.className = 'moment-card';
    card.innerHTML = `
      <div class="moment-icon">${moment.icon}</div>
      <div class="moment-info">
        <div class="moment-label">${moment.label}</div>
        <div class="moment-what">${moment.what}</div>
        <div class="moment-desc">${moment.desc}</div>
      </div>
      <div class="moment-arrow">→</div>
    `;
    card.addEventListener('click', () => { location.hash = '#/twist/' + moment.id; });
    list.appendChild(card);
  });
  showScreen('screen-moments');
}

// ── Moment → Fork ─────────────────────────────────────
function selectMoment(moment) {
  currentMoment = moment; isCustom = false;
  document.getElementById('twist-match-label').textContent = `${currentMatch.team1} vs ${currentMatch.team2} · ${currentMatch.year}`;
  document.getElementById('real-branch-card').textContent = moment.realMoment;
  document.getElementById('alt-branch-card').textContent  = moment.altMoment;
  showScreen('screen-twist');
}

// ── Loading overlay ───────────────────────────────────
const loadingSteps = [
  'Analysing the original match...',
  'Calculating butterfly effect...',
  'Consulting alternate timelines...',
  'Writing the story...',
  'Polishing the narrative...'
];

function showLoading() {
  const overlay = document.getElementById('ai-loading-overlay');
  const stepsEl = document.getElementById('ai-loading-steps');
  const fill    = document.getElementById('ai-loading-fill');
  const sub     = document.getElementById('ai-loading-sub');
  stepsEl.innerHTML = loadingSteps.map((s,i)=>
    `<div class="ai-step" id="ai-step-${i}"><div class="ai-step-dot"></div>${s}</div>`).join('');
  fill.style.width = '0%';
  overlay.classList.add('show');
  loadingSteps.forEach((_,i) => setTimeout(() => {
    document.getElementById(`ai-step-${i}`)?.classList.add('done');
    sub.textContent = loadingSteps[i];
    fill.style.width = `${((i+1)/loadingSteps.length)*85}%`;
  }, i*1100));
}

function hideLoading() {
  document.getElementById('ai-loading-fill').style.width = '100%';
  setTimeout(() => document.getElementById('ai-loading-overlay').classList.remove('show'), 500);
}

// ── Custom Generate ───────────────────────────────────
async function generateCustomStory() {
  const t1         = document.getElementById('team1-input').value.trim();
  const t2         = document.getElementById('team2-input').value.trim();
  const tournament = document.getElementById('tournament-input').value.trim();
  const realMoment = document.getElementById('real-moment-input').value.trim();
  const twist      = document.getElementById('twist-input').value.trim();
  const headline   = document.getElementById('headline-input').value.trim();

  if (!t1||!t2) { shake('team1-input'); return; }
  if (!realMoment) { shake('real-moment-input'); return; }
  if (!twist) { shake('twist-input'); return; }

  const ripples = ['ripple1','ripple2','ripple3','ripple4']
    .map(id => document.getElementById(id).value.trim()).filter(Boolean);
  const ripplesAuto  = ripples.length === 0; // blank → let the AI write them
  const headlineAuto = !headline;
  if (ripplesAuto) ripples.push('Cricket history would never look the same again.');

  customData = {
    matchPill: `${t1} vs ${t2}${tournament?' · '+tournament:''}`,
    headline:  headline || `${t1.toUpperCase()} — HISTORY REWRITTEN`,
    eyebrow:   'In Another Universe...',
    verdictQ:  `If this had happened, would it have changed cricket history forever?`,
    ripples, ripplesAuto, headlineAuto,
    story:     null,
    momentId:  'custom-' + Date.now(),
    t1, t2, tournament, realMoment, twist, headline
  };
  localVotes[customData.momentId] = { agree:0, disagree:0 };
  isCustom = true;

  document.getElementById('twist-match-label').textContent = `${t1} vs ${t2}${tournament?' · '+tournament:''}`;
  document.getElementById('real-branch-card').textContent  = realMoment;
  document.getElementById('alt-branch-card').textContent   = twist;
  showScreen('screen-twist');
}

// ── Timeline review transition (3rd umpire reviews reality) ──
const UNI_LINES = [
  'UltraEdge detects a disturbance in the timeline...',
  'Snicko picks up a whisper from another world...',
  'Ball-tracking shows history clipping the stumps...',
  'The big screen flickers. Ninety thousand hold their breath...',
  'Checking the front foot... of fate itself...',
  "Umpire's call — but not the universe's...",
  'Rewinding the tape to the exact delivery...',
  'The scorer picks up a different pen...'
];

let ueWaveBuilt = false;
function buildUeWave() {
  const w = document.getElementById('ue-wave');
  if (!w || ueWaveBuilt) return;
  ueWaveBuilt = true;
  for (let i = 0; i < 42; i++) {
    const b = document.createElement('div');
    b.className = 'ue-bar';
    b.style.height = (3 + Math.random() * 8) + 'px';
    // the edge: bars near the cursor's mid-sweep spike green
    if (i >= 19 && i <= 22) {
      b.classList.add('spike');
      b.style.setProperty('--d', (0.68 + (i - 19) * 0.045) + 's');
    }
    w.appendChild(b);
  }
}

function universeTransition() {
  return new Promise(resolve => {
    const ov = document.getElementById('universe-overlay');
    if (!ov) return resolve();
    buildUeWave();
    document.getElementById('uni-line').textContent =
      UNI_LINES[Math.floor(Math.random() * UNI_LINES.length)];
    ov.classList.remove('verdict');
    ov.classList.add('show');
    setTimeout(() => ov.classList.add('verdict'), 1450);      // stamp: OVERTURNED
    setTimeout(() => {
      ov.classList.remove('show');
      setTimeout(() => ov.classList.remove('verdict'), 300);   // reset after fade
      resolve();
    }, 2400);
  });
}

// ── Reveal Story ──────────────────────────────────────
async function revealStory() {
  // Guard: must have a match/moment or custom data
  if (!isCustom && (!currentMatch || !currentMoment)) {
    console.error('No match/moment selected'); return;
  }

  // Cricket-themed crossing for instant reveals; AI generations
  // get the dedicated loading overlay instead (never both)
  const willGenerate = isCustom && customData && customData.story === null;
  if (!willGenerate) await universeTransition();

  if (isCustom && customData && customData.story === null) {
    showLoading();
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team1:      customData.t1,
          team2:      customData.t2,
          tournament: customData.tournament,
          realMoment: customData.realMoment,
          twist:      customData.twist,
          ripples:    customData.ripplesAuto ? [] : customData.ripples,
          headline:   customData.headlineAuto ? '' : customData.headline
        })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error||'Server error'); }
      const resp = await res.json();
      customData.story       = resp.paragraphs;
      customData.dossier     = resp.dossier || templateDossier(customData);
      customData.aiGenerated = true;
      // If the user left ripples/headline blank, prefer what the AI wrote
      if (customData.ripplesAuto && Array.isArray(resp.ripples) && resp.ripples.length >= 2) {
        customData.ripples = resp.ripples;
      }
      if (customData.headlineAuto && resp.headline) {
        customData.headline = resp.headline;
      }
      customData.factCheck = resp.factCheck || null;
    } catch (err) {
      console.warn('AI failed, using template:', err.message);
      customData.story       = templateStory(customData);
      customData.dossier     = templateDossier(customData);
      customData.aiGenerated = false;
    }
    hideLoading();
  }

  // Build the data object for rendering
  const data = isCustom ? customData : {
    matchPill:  `${currentMatch.team1} vs ${currentMatch.team2} · ${currentMatch.year}`,
    headline:   currentMoment.headline,
    eyebrow:    currentMoment.eyebrow   || 'In Another Universe...',
    verdictQ:   currentMoment.verdictQ  || 'Would this have happened?',
    ripples:    currentMoment.ripples   || [],
    story:      currentMoment.story     || [],
    dossier:    currentMoment.dossier   || null,
    momentId:   currentMoment.id,
    aiGenerated: false
  };

  // Safety: make sure story is an array of strings
  const storyArr = Array.isArray(data.story) ? data.story : [String(data.story)];

  // Populate DOM
  document.getElementById('story-match-pill').textContent = data.matchPill  || '';
  document.getElementById('story-eyebrow').textContent    = data.eyebrow    || 'In Another Universe...';
  document.getElementById('story-headline').textContent   = '';
  document.getElementById('ripple-timeline').innerHTML    = '';
  document.getElementById('story-prose').innerHTML        = '';
  document.getElementById('verdict-question').textContent = data.verdictQ   || 'Would this have happened?';
  renderDossierTop(data.dossier, data.factCheck);
  const dossierTop = document.getElementById('dossier-top');
  if (dossierTop) dossierTop.classList.remove('visible');

  // Badge
  const badge = document.querySelector('.story-badge');
  if (badge) {
    if (data.aiGenerated) {
      badge.textContent = '✨ AI-Generated Timeline';
    } else {
      badge.textContent = '🦋 Alternate Timeline';
    }
  }

  // Votes
  try {
    const vRes  = await fetch(`/api/votes/${data.momentId}`);
    const vData = await vRes.json();
    localVotes[data.momentId] = vData;
  } catch (_) {}
  renderVotes(data.momentId);
  document.getElementById('verdict-agree').classList.remove('selected');
  document.getElementById('verdict-disagree').classList.remove('selected');

  // Ripples
  const rippleContainer = document.getElementById('ripple-timeline');
  (data.ripples || []).forEach((r, i) => {
    const item = document.createElement('div');
    item.className = 'ripple-item';
    item.style.transitionDelay = `${i*0.12}s`;
    const isLast = i === data.ripples.length - 1;
    item.innerHTML = `
      <div class="ripple-dot-col">
        <div class="ripple-dot"></div>
        ${!isLast ? '<div class="ripple-line"></div>' : ''}
      </div>
      <div class="ripple-text">${esc(r)}</div>
    `;
    rippleContainer.appendChild(item);
  });

  buildMoreCards(data.momentId);
  showScreen('screen-story');

  // Animate headline → live call → ripples → reactions/story (snappy —
  // shared-link visitors on phones won't wait for slow reveals)
  setTimeout(() => {
    typewriter(document.getElementById('story-headline'), data.headline || '', 18, () => {
      document.getElementById('dossier-top')?.classList.add('visible');
      setTimeout(() => {
        document.querySelectorAll('.ripple-item').forEach((el,i) =>
          setTimeout(() => el.classList.add('visible'), i*90));
      }, 300);
      setTimeout(() => {
        const prose = document.getElementById('story-prose');
        renderDossierBottom(prose, data.dossier, storyArr);
        prose.style.opacity = '0';
        prose.style.transform = 'translateY(20px)';
        prose.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        setTimeout(() => { prose.style.opacity='1'; prose.style.transform='translateY(0)'; }, 100);
      }, (data.ripples||[]).length * 90 + 400);
    });
  }, 200);
}

// ── Dossier rendering (artifacts from the alt universe) ──
// No badge for 'accurate' — a wrong green check would endorse misinformation,
// so we only ever flag problems (best-effort) or celebrate fiction.
const FACT_CHECK_PILLS = {
  inaccurate: { cls: 'warn', text: '⚠️ Reality check' },
  fictional:  { cls: 'fic',  text: '🌀 Fully fictional scenario — pure multiverse' }
};

function renderDossierTop(dossier, factCheck) {
  const top = document.getElementById('dossier-top');
  if (!top) return;
  let fcHtml = '';
  if (factCheck && FACT_CHECK_PILLS[factCheck.verdict]) {
    const p = FACT_CHECK_PILLS[factCheck.verdict];
    const note = factCheck.verdict === 'inaccurate' && factCheck.note ? `: ${esc(factCheck.note)}` : '';
    fcHtml = `<div class="fact-pill ${p.cls}">${p.text}${note}</div>`;
  }
  if (!dossier || !dossier.commentary) { top.innerHTML = fcHtml; return; }
  top.innerHTML = fcHtml + `
    <div class="dsr-commentary">
      <div class="dsr-comm-head"><span class="live-dot"></span>LIVE &nbsp;·&nbsp; ${esc(dossier.channel || 'Commentary')}</div>
      <div class="dsr-comm-text">${esc(dossier.commentary)}</div>
    </div>
    ${dossier.scoreline ? `<div class="dsr-scoreline">${esc(dossier.scoreline)}</div>` : ''}
  `;
}

function renderDossierBottom(container, dossier, storyArr) {
  let html = '';
  if (dossier && Array.isArray(dossier.records) && dossier.records.length) {
    html += `<div class="dsr-records">
      <div class="dsr-records-title">📖 The Record Books — Rewritten</div>` +
      dossier.records.map(r => `
        <div class="dsr-record-row">
          <div class="dsr-record-label">${esc(r.label)}</div>
          <div class="dsr-record-vals">
            <span class="dsr-record-real">${esc(r.reality)}</span>
            <span class="dsr-record-arrow">→</span>
            <span class="dsr-record-alt">${esc(r.alternate)}</span>
          </div>
        </div>`).join('') +
      `</div>`;
  }
  if (dossier && Array.isArray(dossier.socials) && dossier.socials.length) {
    html += `<div class="dsr-socials-label">The alternate timeline reacts</div>
      <div class="dsr-socials">` +
      dossier.socials.map(s => `
        <div class="dsr-social-card">
          <div class="dsr-social-handle">${esc(s.handle || 'Anonymous fan')}</div>
          <div class="dsr-social-text">${esc(s.text || '')}</div>
          <div class="dsr-social-likes">❤️ ${esc(s.likes || '—')}</div>
        </div>`).join('') +
      `</div>`;
  }
  if (dossier && dossier.retro) {
    html += `<div class="dsr-retro"><span class="dsr-quote">“</span>${esc(dossier.retro)}<div class="dsr-retro-tag">— decades later, in this universe</div></div>`;
  }
  if (storyArr && storyArr.length) {
    if (dossier && dossier.commentary) {
      html += `<button class="dsr-expand" id="dsr-expand">📜 Read the full story ▾</button>
               <div class="dsr-fullstory hidden" id="dsr-fullstory">${storyArr.map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
    } else {
      // No dossier available — classic prose rendering
      html += storyArr.map(p => `<p>${esc(p)}</p>`).join('');
    }
  }
  container.innerHTML = html;
  const btn = container.querySelector('#dsr-expand');
  if (btn) btn.addEventListener('click', () => {
    const full = container.querySelector('#dsr-fullstory');
    full.classList.toggle('hidden');
    btn.textContent = full.classList.contains('hidden') ? '📜 Read the full story ▾' : '📜 Hide the full story ▴';
  });
}

// ── Template fallback dossier ─────────────────────────
function templateDossier({ t1, t2, twist }) {
  return {
    commentary: `Wait... WAIT! ${twist} Scenes here you simply will not believe — the commentary box has lost all composure!`,
    channel: 'Alternate Sports Network',
    scoreline: `${(t1||'').toUpperCase()} vs ${(t2||'').toUpperCase()} — THE TIMELINE HAS SPLIT`,
    socials: [
      { handle: '@ThirdManTheories', text: `I was THERE. Still don't believe what I just watched. ${t1} vs ${t2} will never be spoken of the same way again.`, likes: '12.7K' },
      { handle: '@DeepFineLegend',   text: 'My grandkids will ask where I was when this happened. Screaming at a TV, kids. Screaming.', likes: '8.3K' },
      { handle: '@CoverDriveCafe',   text: 'Deleting every "greatest moments" list I ever made. Top spot just changed hands forever.', likes: '21K' }
    ],
    retro: 'Decades on, fans still argue about the day the timeline split in two.',
    records: [
      { label: 'This fixture', reality: 'History as you know it', alternate: 'A timeline nobody saw coming' },
      { label: 'The record books', reality: 'Intact', alternate: 'Rewritten forever' }
    ]
  };
}

// ── Template fallback ─────────────────────────────────
function templateStory({ t1, t2, tournament, realMoment, twist, ripples }) {
  const venue = tournament ? `at ${tournament.split(',').pop()?.trim()||'the ground'}` : 'on that day';
  return [
    `The moment that changed everything came suddenly ${venue}. In the universe we know, ${realMoment}. Cricket moved on.`,
    `But in this alternate timeline, something different unfolded. ${twist} The crowd sensed it immediately — something fundamental had shifted.`,
    `What followed was a cascade nobody could have predicted. ${ripples[0]||'History took a different turn entirely.'}${ripples[1]?'. Then, '+ripples[1]+'.':''}`,
    ripples.length>2 ? `The ripple effects spread further still: ${ripples.slice(2).join('. ')}. Cricket — and perhaps much more — would never look the same again.` : `Cricket — and much more — would never look the same again.`,
    `Historians of the sport would point to this as the turning point. Not a grand tactical masterstroke — just one moment, one decision. The butterfly had flapped its wings ${venue}, and the hurricane that followed reshaped everything we knew about ${t1} and ${t2}.`
  ];
}

// ── Votes ─────────────────────────────────────────────
function renderVotes(momentId) {
  const v = localVotes[momentId] || { agree:0, disagree:0 };
  const total = (v.agree||0) + (v.disagree||0);
  document.getElementById('pct-agree').textContent    = total ? (v.pctAgree    ?? Math.round(v.agree/total*100))+'%'    : '—';
  document.getElementById('pct-disagree').textContent = total ? (v.pctDisagree ?? Math.round(v.disagree/total*100))+'%' : '—';
}

function setupVoting() {
  async function castVote(type) {
    const id = isCustom ? customData.momentId : currentMoment.id;
    try {
      const res  = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentId: id, vote: type })
      });
      const data = await res.json();
      localVotes[id] = data;
      renderVotes(id);
    } catch (_) {
      // offline fallback
      if (!localVotes[id]) localVotes[id] = { agree:0, disagree:0 };
      localVotes[id][type]++;
      renderVotes(id);
    }
  }

  document.getElementById('verdict-agree').addEventListener('click', function() {
    if (this.classList.contains('selected')) return;
    this.classList.add('selected');
    document.getElementById('verdict-disagree').classList.remove('selected');
    castVote('agree');
  });

  document.getElementById('verdict-disagree').addEventListener('click', function() {
    if (this.classList.contains('selected')) return;
    this.classList.add('selected');
    document.getElementById('verdict-agree').classList.remove('selected');
    castVote('disagree');
  });
}

// ── The Great Debates ─────────────────────────────────
function getMyDebateVotes() {
  try { return JSON.parse(localStorage.getItem('debate-votes') || '{}'); } catch (_) { return {}; }
}

function buildDebates() {
  const grid = document.getElementById('debates-grid');
  if (!grid || typeof DEBATES === 'undefined') return;
  grid.innerHTML = '';
  const mine = getMyDebateVotes();

  DEBATES.forEach(d => {
    const card = document.createElement('div');
    card.className = 'debate-card';
    const related = d.momentId ? findMomentById(d.momentId) : null;
    card.innerHTML = `
      <div class="debate-tag">${esc(d.tag)}</div>
      <div class="debate-q">${esc(d.question)}</div>
      <div class="debate-options">
        <button class="debate-opt" data-side="agree">
          <span class="debate-opt-emoji">${d.optionA.emoji}</span>
          <span class="debate-opt-label">${esc(d.optionA.label)}</span>
          <span class="debate-opt-pct"></span>
          <span class="debate-opt-bar"><span class="debate-opt-fill"></span></span>
        </button>
        <div class="debate-vs">VS</div>
        <button class="debate-opt" data-side="disagree">
          <span class="debate-opt-emoji">${d.optionB.emoji}</span>
          <span class="debate-opt-label">${esc(d.optionB.label)}</span>
          <span class="debate-opt-pct"></span>
          <span class="debate-opt-bar"><span class="debate-opt-fill"></span></span>
        </button>
      </div>
      ${related ? `<button class="debate-moment-link">🦋 See this butterfly moment →</button>` : ''}
    `;

    const optEls = card.querySelectorAll('.debate-opt');
    optEls.forEach(btn => btn.addEventListener('click', () => castDebateVote(d, card, btn.dataset.side)));

    if (related) {
      card.querySelector('.debate-moment-link').addEventListener('click', () => {
        location.hash = '#/twist/' + related.moment.id;
      });
    }

    // Already voted? Show live results
    if (mine[d.id]) {
      card.classList.add('voted');
      card.querySelector(`.debate-opt[data-side="${mine[d.id]}"]`)?.classList.add('picked');
      refreshDebateResults(d.id, card);
    }
    grid.appendChild(card);
  });
}

function findMomentById(id) {
  for (const m of MATCHES) {
    const mo = m.moments.find(x => x.id === id);
    if (mo) return { match: m, moment: mo };
  }
  return null;
}

async function castDebateVote(debate, card, side) {
  if (card.classList.contains('voted')) return;
  card.classList.add('voted');
  card.querySelector(`.debate-opt[data-side="${side}"]`)?.classList.add('picked');
  const mine = getMyDebateVotes();
  mine[debate.id] = side;
  try { localStorage.setItem('debate-votes', JSON.stringify(mine)); } catch (_) {}
  try {
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ momentId: debate.id, vote: side })
    });
  } catch (_) {}
  refreshDebateResults(debate.id, card);
}

async function refreshDebateResults(debateId, card) {
  let pctA = 50, pctB = 50;
  try {
    const res = await fetch(`/api/votes/${debateId}`);
    const v = await res.json();
    const total = (v.agree || 0) + (v.disagree || 0);
    if (total > 0) {
      pctA = Math.round(v.agree / total * 100);
      pctB = 100 - pctA;
    }
  } catch (_) {}
  const opts = card.querySelectorAll('.debate-opt');
  [pctA, pctB].forEach((pct, i) => {
    opts[i].querySelector('.debate-opt-pct').textContent = pct + '%';
    opts[i].querySelector('.debate-opt-fill').style.width = pct + '%';
  });
}

// ── More Cards ────────────────────────────────────────
function buildMoreCards(currentId) {
  const grid = document.getElementById('more-grid');
  grid.innerHTML = '';
  const all = [];
  MATCHES.forEach(m => m.moments.forEach(mo => { if(mo.id!==currentId) all.push({match:m,moment:mo}); }));
  all.sort(()=>Math.random()-0.5).slice(0,4).forEach(({match,moment}) => {
    const card = document.createElement('div');
    card.className = 'more-card';
    card.innerHTML = `
      <div class="more-card-match">${match.team1} vs ${match.team2}, ${match.year}</div>
      <div class="more-card-moment">${moment.what}</div>
    `;
    card.addEventListener('click', () => { location.hash = '#/story/' + moment.id; window.scrollTo(0,0); });
    grid.appendChild(card);
  });
}

// ── Typewriter ────────────────────────────────────────
function typewriter(el, text, speed, onDone) {
  el.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  el.appendChild(cursor);
  let i = 0;
  const t = setInterval(() => {
    if (i < text.length) { el.insertBefore(document.createTextNode(text[i]), cursor); i++; }
    else { clearInterval(t); cursor.remove(); if(onDone) onDone(); }
  }, speed);
}

// ── Share (copies a real link to this story) ─────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

async function share() {
  let url, headline;
  if (isCustom && customData) {
    headline = customData.headline;
    if (!customData.shareId) {
      try {
        const res = await fetch('/api/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchPill: customData.matchPill,
            headline:  customData.headline,
            verdictQ:  customData.verdictQ,
            ripples:   customData.ripples,
            story:     customData.story,
            dossier:   customData.dossier,
            factCheck: customData.factCheck
          })
        });
        if (res.ok) customData.shareId = (await res.json()).id;
      } catch (_) {}
    }
    // /s/<id> serves story-specific link previews, then redirects into the app
    url = customData.shareId ? `${location.origin}/s/${customData.shareId}` : location.origin;
  } else {
    headline = currentMoment.headline;
    url = `${location.origin}/#/story/${encodeURIComponent(currentMoment.id)}`;
  }
  // Touch devices: native share sheet. Desktop: clipboard (less clunky there).
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({
        title: 'Cricket Butterfly Effect',
        text: `🦋 "${headline}" — In another universe...`,
        url
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // user closed the sheet
      // fall through to clipboard
    }
  }
  const text = `🦋 Cricket Butterfly Effect\n"${headline}"\n\n${url}\n\n#CricketButterflyEffect #WhatIf #Cricket`;
  try {
    await navigator.clipboard.writeText(text);
    showToast('🔗 Link copied — paste it anywhere!');
  } catch (_) {
    showToast('⚠ Could not copy — are you on http?');
  }
}

// ── Router: hash-based so refresh & back/forward work ─
async function loadSharedStory(storyId) {
  try {
    const res = await fetch('/api/story/' + encodeURIComponent(storyId));
    if (!res.ok) { location.hash = '#/'; return; }
    const s = await res.json();
    customData = {
      matchPill: s.matchPill, headline: s.headline,
      eyebrow: 'In Another Universe...',
      verdictQ: s.verdictQ || 'Would this have happened?',
      ripples: s.ripples || [], story: s.story,
      dossier: s.dossier || null,
      factCheck: s.factCheck || null,
      momentId: 'shared-' + storyId, aiGenerated: false, shareId: storyId
    };
    isCustom = true;
    revealStory();
  } catch (_) { location.hash = '#/'; }
}

function route() {
  const [view, id] = location.hash.replace(/^#\/?/, '').split('/');
  switch (view) {
    case 'matches':
      buildMatchGrid(); loadCommunityStrip(); showScreen('screen-matches'); break;
    case 'match': {
      const m = MATCHES.find(x => x.id === id);
      if (m) { isCustom = false; selectMatch(m); } else showScreen('screen-hero');
      break;
    }
    case 'twist': {
      const f = findMomentById(id);
      if (f) { isCustom = false; currentMatch = f.match; selectMoment(f.moment); }
      else showScreen('screen-hero');
      break;
    }
    case 'story': {
      const f = findMomentById(id);
      if (f) { isCustom = false; currentMatch = f.match; currentMoment = f.moment; revealStory(); }
      else showScreen('screen-hero');
      break;
    }
    case 'shared':
      if (id) loadSharedStory(id); else showScreen('screen-hero');
      break;
    case 'custom':
      showScreen('screen-custom'); break;
    case 'debates':
      buildDebates(); showScreen('screen-debates'); break;
    default:
      showScreen('screen-hero');
  }
}
window.addEventListener('hashchange', route);

function initRouting() {
  // Legacy share links (?moment= / ?story=) → hash routes
  const params  = new URLSearchParams(location.search);
  const moment  = params.get('moment');
  const storyId = params.get('story');
  if (moment)       history.replaceState(null, '', location.pathname + '#/story/' + moment);
  else if (storyId) history.replaceState(null, '', location.pathname + '#/shared/' + storyId);
  route();
}

// ── Shake ─────────────────────────────────────────────
function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor='#c0392b';
  setTimeout(()=>{ el.style.transition='border-color 0.3s'; el.style.borderColor='var(--border)'; }, 1000);
  el.focus();
}

// ── Char counters ─────────────────────────────────────
function setupCharCounters() {
  [['real-moment-input','real-char'],['twist-input','twist-char']].forEach(([id,cid])=>{
    const input=document.getElementById(id), count=document.getElementById(cid);
    if(!input||!count) return;
    input.addEventListener('input',()=>{ count.textContent=`${input.value.length} / 300`; });
  });
}

// ── Nav ───────────────────────────────────────────────
const SCREEN_ROUTES = { 'screen-hero': '#/', 'screen-matches': '#/matches', 'screen-custom': '#/custom', 'screen-debates': '#/debates' };

function setupNav() {
  document.getElementById('btn-legendary').addEventListener('click', ()=>{ location.hash = '#/matches'; });
  document.getElementById('btn-custom').addEventListener('click', ()=>{ location.hash = '#/custom'; });
  document.getElementById('btn-surprise')?.addEventListener('click', surpriseMe);
  document.getElementById('btn-debates')?.addEventListener('click', () => { location.hash = '#/debates'; });
  document.querySelectorAll('[data-to]').forEach(btn=>btn.addEventListener('click',()=>{ location.hash = SCREEN_ROUTES[btn.dataset.to] || '#/'; }));
  document.getElementById('nav-custom-btn').addEventListener('click',()=>{ location.hash = '#/custom'; });
  document.getElementById('btn-reveal').addEventListener('click', () => {
    if (isCustom) revealStory();
    else if (currentMoment) location.hash = '#/story/' + currentMoment.id;
  });
  document.getElementById('story-back-btn').addEventListener('click',()=>{
    if (isCustom) location.hash = customData?.momentId?.startsWith('shared-') ? '#/' : '#/custom';
    else location.hash = currentMatch ? '#/match/' + currentMatch.id : '#/matches';
  });
  document.getElementById('btn-generate-custom').addEventListener('click', generateCustomStory);
  document.getElementById('share-btn').addEventListener('click', share);
}

// ── Init ──────────────────────────────────────────────
setupNav();
setupCharCounters();
setupVoting();
setupMatchSearch();
buildMatchGrid();
checkHealth();
initRouting();
