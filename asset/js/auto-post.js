'use strict';

// ── STATE ──
let currentMode = 'single';
let batchItems = [];
let batchIdCounter = 0;

// ── MODE ──
function setMode(mode, btn) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('singleMode').style.display = mode === 'single' ? 'block' : 'none';
  document.getElementById('batchMode').style.display = mode === 'batch' ? 'block' : 'none';
}

// ── MODULE TOGGLE ──
function toggleMod(el) {
  el.classList.toggle('on');
}

function getActiveModules() {
  return [...document.querySelectorAll('.mod-toggle.on')]
    .map(el => el.querySelector('.mod-label').textContent.replace(/🎨|🖼/g,'').trim());
}

// ── BATCH ──
function addBatchItem() {
  const id = ++batchIdCounter;
  const title = prompt('Post title or topic (for label):');
  if (!title) return;
  const content = prompt('Paste the post content (title + body):');
  if (!content) return;
  batchItems.push({ id, title, content, status: 'pending', result: null });
  renderBatchQueue();
}

function removeBatchItem(id) {
  batchItems = batchItems.filter(b => b.id !== id);
  renderBatchQueue();
}

function renderBatchQueue() {
  const q = document.getElementById('batchQueue');
  if (!batchItems.length) { q.innerHTML = '<div style="font-size:0.72rem;color:var(--txt3);padding:6px 0">No posts queued. Add posts above.</div>'; return; }
  q.innerHTML = batchItems.map((item, i) => `
    <div class="batch-item">
      <span class="batch-num">${String(i+1).padStart(2,'0')}</span>
      <span class="batch-title">${escH(item.title)}</span>
      <span class="batch-status bs-${item.status}">${item.status}</span>
      ${item.status === 'pending' ? `<button class="batch-remove" onclick="removeBatchItem(${item.id})">✕</button>` : ''}
    </div>`).join('');
}

// ── UTILS ──
function escH(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function setPhase(n) {
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById('ph'+i);
    if (!el) continue;
    if (i < n) el.className = 'ph done';
    else if (i === n) el.className = 'ph active';
    else el.className = 'ph';
  }
}

function resetPhases() { for (let i=1;i<=7;i++) { const e=document.getElementById('ph'+i); if(e) e.className='ph'; } }

async function apiCall(apiKey, system, user, maxT=4000) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxT,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error?.message || `API ${r.status}`); }
  const d = await r.json();
  return d.content.map(b => b.text||'').join('');
}

function copyText(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btnEl.textContent;
    btnEl.textContent = '✓ Copied!';
    setTimeout(() => btnEl.textContent = orig, 2000);
  });
}

function switchTab(btn, paneId, cardEl) {
  cardEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  cardEl.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const pane = cardEl.querySelector('#'+paneId);
  if (pane) pane.classList.add('active');
}

// ── LOADING STATE ──
const PHASE_LABELS = [
  { label: 'Content Audit & E-E-A-T Gap Analysis', sub: 'Scoring quality, readability, keyword density...' },
  { label: 'Keyword Intelligence Stack', sub: 'Primary · LSI · AEO · Entity · Long-tail mapping...' },
  { label: 'SEO Architecture Blueprint', sub: 'H1→H2→H3, meta, FAQ, internal link plan...' },
  { label: 'Full Content Rewrite', sub: 'Generating Blogger-ready HTML, word-count calibrated...' },
  { label: 'Schema JSON-LD Generation', sub: 'Article + FAQPage + BreadcrumbList + WebPage...' },
  { label: '🎨 Image Intelligence Engine', sub: 'Featured + in-post prompts, SEO filename/alt/title...' },
  { label: 'Final SEO Pack', sub: 'Meta tags, OG, AdSense safety, Google News check...' },
];

function showLoadingUI() {
  const area = document.getElementById('contentArea');
  area.innerHTML = `<div class="loading-wall">${
    PHASE_LABELS.map((p, i) => `
    <div class="lw-item" id="lwi${i}">
      <div class="lw-idle" id="lw-idle${i}"></div>
      <div class="lw-spinner" id="lw-spin${i}" style="display:none"></div>
      <div class="lw-check" id="lw-chk${i}" style="display:none">✓</div>
      <div>
        <div class="lw-txt">${p.label}</div>
        <div class="lw-sub">${p.sub}</div>
      </div>
    </div>`).join('')
  }</div>`;
}

async function activateLW(i) {
  const item = document.getElementById('lwi'+i);
  if (!item) return;
  item.className = 'lw-item lw-active';
  document.getElementById('lw-idle'+i).style.display = 'none';
  document.getElementById('lw-spin'+i).style.display = 'block';
}

async function completeLW(i) {
  const item = document.getElementById('lwi'+i);
  if (!item) return;
  item.className = 'lw-item lw-done';
  document.getElementById('lw-spin'+i).style.display = 'none';
  document.getElementById('lw-chk'+i).style.display = 'block';
}

// ════════════════════════════════════
// MAIN ENGINE
// ════════════════════════════════════
async function runEngine() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) return alert('⚠️ Enter your Anthropic API key.');

  if (currentMode === 'batch') {
    await runBatchEngine(apiKey);
    return;
  }

  // Single mode
  const content = document.getElementById('postContent').value.trim();
  const niche = document.getElementById('niche').value.trim();
  if (!content) return alert('⚠️ Paste your post content.');
  if (!niche) return alert('⚠️ Enter the niche/topic.');

  await runSinglePost(apiKey, { content, niche });
}

async function runSinglePost(apiKey, { content, niche }) {
  const market = document.getElementById('targetMarket').value;
  const competition = document.getElementById('competition').value;
  const tone = document.getElementById('tone').value;
  const wc = document.getElementById('wc').value;
  const competitors = document.getElementById('competitors').value.trim();
  const postUrl = document.getElementById('postUrl')?.value.trim() || '';
  const featuredStyle = document.getElementById('featuredStyle').value;
  const imgCount = document.getElementById('imgCount').value;
  const imgRatio = document.getElementById('imgRatio').value;
  const aiTool = document.getElementById('aiTool').value;
  const brandColors = document.getElementById('brandColors').value.trim();
  const modules = getActiveModules();

  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="lw-spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#fff;border-color:rgba(255,255,255,0.2)"></div><span>Optimizing...</span>';

  document.getElementById('emptyState')?.remove();
  resetPhases();
  showLoadingUI();

  const SYS = `You are an enterprise-level SEO content strategist, Blogger specialist, and AI prompt engineer for Malaysian digital publishing.
Expert in: E-E-A-T, AEO (Answer Engine Optimization), semantic SEO, entity-based SEO, structured data, Core Web Vitals, Google News eligibility, AdSense compliance.
Site: thebukitbesi.com — high-authority Malaysian lifestyle and tools Blogger site. Author: Ismal.
Return DENSE, structured, production-ready output only. Zero filler. Every output line must be actionable.`;

  const BASE = `CONTENT:\n${content}\n\nNICHE: ${niche}\nMARKET: ${market}\nCOMPETITION: ${competition}\nTONE: ${tone}\nWORD COUNT: ${wc}\n${postUrl?'URL: '+postUrl:''}${competitors?'\nCOMPETITOR CONTEXT: '+competitors:''}`;

  try {
    const R = {};

    // ── PHASE 1: AUDIT ──
    setPhase(1); await activateLW(0);
    R.audit = await apiCall(apiKey, SYS, `${BASE}\n\nTASK — CONTENT AUDIT:
Return this exact structure, no extra text:

CONTENT SCORE: [0-100]
READABILITY SCORE: [0-100]
E-E-A-T SCORE: [0-10]
KEYWORD DENSITY: [%]
WORD COUNT: [current]
CONTENT AGE SIGNAL: [fresh/stale/outdated]
TOP 5 ISSUES:
1. [issue]
2. [issue]
3. [issue]
4. [issue]
5. [issue]
CONTENT GAPS: [3-5 missing subtopics]
SERP OPPORTUNITY: [assessment]
QUICK WINS: [top 3 immediate actions]
VERDICT: [2-sentence priority summary]`);
    await completeLW(0); await delay(200);

    // ── PHASE 2: KEYWORDS ──
    setPhase(2); await activateLW(1);
    R.keywords = await apiCall(apiKey, SYS, `${BASE}\n\nTASK — KEYWORD INTELLIGENCE:
PRIMARY KEYWORD: [single KW]
PRIMARY INTENT: [informational/navigational/transactional/commercial]
SECONDARY KEYWORDS (5):
- [kw]
- [kw]
- [kw]
- [kw]
- [kw]
LSI KEYWORDS (12):
- [kw] | [relevance note]
[repeat x12]
AEO/PAA QUESTIONS (8):
Q1: [question]
Q2: [question]
[...Q8]
ENTITY KEYWORDS (brands/places/concepts to mention):
- [entity]
[x5]
LONG-TAIL KWs (5 low-competition):
- [long-tail kw]
[x5]
FEATURED SNIPPET TARGET: [single best KW for snippet]
SNIPPET FORMAT: [paragraph/list/table/definition]
KEYWORD PLACEMENT GUIDE:
- Title: [instruction]
- H1: [instruction]
- First 100 words: [instruction]
- H2s: [instruction]
- Meta desc: [instruction]
- Image alt: [instruction]`);
    await completeLW(1); await delay(200);

    // ── PHASE 3: BLUEPRINT ──
    setPhase(3); await activateLW(2);
    R.blueprint = await apiCall(apiKey, SYS, `${BASE}\nKEYWORDS:\n${R.keywords}\n\nTASK — SEO ARCHITECTURE BLUEPRINT:
SEO TITLE (≤60 chars): [title]
META DESCRIPTION (≤155 chars): [description]
URL SLUG: [slug]
H1: [heading]

POST OUTLINE:
INTRO: [3-point hook strategy]
H2: [heading] — [what to cover]
  H3: [subheading]
  H3: [subheading]
H2: [heading] — [what to cover]
  H3: [subheading]
[continue — minimum 6 H2s, relevant H3s]
FAQ SECTION (5 Q&As for AEO):
Q: [question] A: [concise answer ≤50 words]
[x5]
CONCLUSION: [3-point summary strategy]

INTERNAL LINKS (4):
- Anchor: [text] → Page type: [description]
[x4]
EXTERNAL AUTHORITY LINKS (2):
- [domain/resource]: [why cite this]
CTA: [specific call-to-action text]`);
    await completeLW(2); await delay(200);

    // ── PHASE 4: REWRITE ──
    setPhase(4); await activateLW(3);
    R.rewrite = await apiCall(apiKey, SYS, `${BASE}\nBLUEPRINT:\n${R.blueprint}\nKEYWORDS:\n${R.keywords}\n\nTASK — FULL REWRITE:
Write the COMPLETE optimized post as production-ready Blogger HTML.
Rules:
- ~${wc} words
- NO <h1> (Blogger post title handles H1)
- Use <h2> and <h3> only
- Integrate PRIMARY keyword in first 80 words naturally
- Weave LSI keywords organically — no stuffing
- FAQ section using <div class="faq-section"><div class="faq-item"><h3 class="faq-q">[Q]</h3><div class="faq-a">[A]</div></div></div>
- Include <!-- IMG_PLACEHOLDER_1 -->, <!-- IMG_PLACEHOLDER_2 -->, etc. where images should be inserted
- Include <!-- INTERNAL_LINK_1 -->, <!-- INTERNAL_LINK_2 --> placeholders
- AdSense safe: no prohibited content, no excessive repetition
- Language: ${market}
- Open with <div class="tbb-post-content"> close with </div>
- Make it GENUINELY superior — unique angles, data, Malaysian context where relevant`, 5000);
    await completeLW(3); await delay(200);

    // ── PHASE 5: SCHEMA ──
    setPhase(5); await activateLW(4);
    R.schema = await apiCall(apiKey, SYS, `${BASE}\nBLUEPRINT:\n${R.blueprint}\n\nTASK — SCHEMA JSON-LD:
Generate ONE complete <script type="application/ld+json"> block containing an @graph array with:
1. Article — with headline, description, datePublished (today), dateModified (today), author (Ismal, @type Person), publisher (thebukitbesi.com, logo: https://thebukitbesi.com/logo.png), image
2. FAQPage — using all 5 Q&As from blueprint
3. BreadcrumbList — homepage > category > post
4. WebPage — with @id, url, name, description, isPartOf
Return ONLY the complete script block. No explanation.`);
    await completeLW(4); await delay(200);

    // ── PHASE 6: IMAGE INTELLIGENCE ──
    setPhase(6); await activateLW(5);
    R.images = await apiCall(apiKey, SYS, `${BASE}\nBLUEPRINT:\n${R.blueprint}\n\nTASK — IMAGE INTELLIGENCE ENGINE:
AI Tool: ${aiTool}
Featured Image Style: ${featuredStyle}
In-Post Count: ${imgCount} images
Aspect Ratio: ${imgRatio}
Brand Colors: ${brandColors || 'professional, site-appropriate'}

Generate the following. For EACH image return ALL fields precisely:

=== FEATURED IMAGE ===
TYPE: ${featuredStyle}
PLACEMENT: Hero / Featured (above title or first image in post)
PROMPT: [Ultra-detailed ${aiTool}-optimized prompt. Min 80 words. Include: subject, style, lighting, mood, composition, color palette, technical camera/render specs, negative prompts guidance]
STYLE_NOTES: [2-3 sentences on why this visual direction works for SEO CTR and this topic]
FILENAME: [seo-optimized-filename-with-hyphens.jpg] (include primary keyword, descriptive, ≤70 chars)
ALT_TEXT: [complete alt text, 8-15 words, includes primary keyword naturally, describes image]
TITLE_ATTR: [image title attribute, 5-10 words, keyword-rich]
CAPTION: [optional image caption for SEO, 1 sentence]
SCHEMA_IMAGE_URL: https://thebukitbesi.com/images/[filename]

=== IN-POST IMAGE 1 ===
TYPE: [choose best type: Infographic/Illustration/Diagram/Photorealistic/Flat Design/3D Render/Data Visualization/Mockup/Step-by-Step Visual]
PLACEMENT: [where in article — e.g. "After H2: [section name]", "After intro paragraph"]
PROMPT: [Ultra-detailed prompt, min 60 words, ${aiTool}-optimized]
STYLE_NOTES: [why this image type at this position boosts engagement]
FILENAME: [seo-filename.jpg]
ALT_TEXT: [descriptive, keyword-relevant alt text]
TITLE_ATTR: [title attribute]
CAPTION: [caption text]

[REPEAT for IN-POST IMAGE 2 through ${imgCount}, each with different type/style/angle]

=== IMAGE SEO SUMMARY ===
TOTAL_IMAGES: [count]
PRIMARY_KW_IN_ALTS: [how many alts contain primary KW]
LSI_DISTRIBUTION: [which LSI keywords appear in which image alts]
COMPRESSION_NOTE: [recommended max file sizes]
LAZY_LOAD_NOTE: loading="lazy" on all images except featured
SCHEMA_NOTE: First image used as Article schema image property`, 5000);
    await completeLW(5); await delay(200);

    // ── PHASE 7: FINAL PACK ──
    setPhase(7); await activateLW(6);
    R.finalPack = await apiCall(apiKey, SYS, `${BASE}\nBLUEPRINT:\n${R.blueprint}\n\nTASK — FINAL SEO PACK:

=== BLOGGER HEAD META TAGS ===
[Complete HTML block: charset, viewport, title, meta description, robots, canonical, author, OG tags (og:title, og:description, og:image, og:url, og:type, og:site_name), Twitter Card (twitter:card, twitter:title, twitter:description, twitter:image), hreflang if bilingual]

=== ADSENSE SAFETY AUDIT ===
Content Policy: [PASS/FAIL + note]
Ad Placement Recommendation: [specific Blogger ad positions]
Max Ads Recommended: [number]
Prohibited Content Check: [CLEAR/ISSUES]

=== GOOGLE NEWS ELIGIBILITY ===
☑/☐ Unique, original reporting
☑/☐ Author byline visible
☑/☐ Publication date visible
☑/☐ No excessive ads
☑/☐ HTTPS
☑/☐ Mobile-friendly
☑/☐ Fast loading

=== SOCIAL SHARE COPY ===
Facebook: [post, 2-3 sentences, no hashtags]
Twitter/X: [≤280 chars + 3 relevant hashtags]
WhatsApp: [short, conversational]
LinkedIn: [professional, 2-3 sentences]

=== CONTENT FRESHNESS SIGNALS ===
1. [specific update to make]
2. [specific update]
3. [specific update]
4. [specific update]
5. [specific update]

=== SEO PROJECTION ===
Content Score: [0-100]
E-E-A-T Rating: [0-10]
Featured Snippet Probability: [Low/Medium/High] — [reason]
Top-3 Ranking Timeline: [realistic estimate]
CTR Improvement Estimate: [%]
Expected Traffic Lift: [%]`);
    await completeLW(6); await delay(400);

    // ── RENDER ──
    renderResults(R, { niche, market, aiTool, imgCount });

  } catch(err) {
    document.getElementById('contentArea').innerHTML = `
      <div style="padding:28px">
        <div class="notice n-gold">
          <span>⚠️</span><div><b>Error:</b> ${escH(err.message)}</div>
        </div>
      </div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>✦</span><span>Run Intelligence Engine</span>';
  }
}

// ════════════════════
// BATCH ENGINE
// ════════════════════
async function runBatchEngine(apiKey) {
  if (!batchItems.length) return alert('⚠️ Add at least one post to the batch queue.');
  
  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  const prog = document.getElementById('batchProg');
  prog.classList.add('show');
  
  const area = document.getElementById('contentArea');
  area.innerHTML = '';
  document.getElementById('emptyState')?.remove();

  for (let i = 0; i < batchItems.length; i++) {
    const item = batchItems[i];
    item.status = 'running';
    renderBatchQueue();
    
    document.getElementById('bpLabel').textContent = `Processing: ${item.title}`;
    document.getElementById('bpCount').textContent = `${i}/${batchItems.length}`;
    document.getElementById('bpFill').style.width = `${(i/batchItems.length)*100}%`;

    // Show loading for this item
    resetPhases();
    showLoadingUI();

    const niche = document.getElementById('niche').value.trim() || item.title;
    
    try {
      await runSinglePost(apiKey, { content: item.content, niche });
      item.status = 'done';
    } catch(e) {
      item.status = 'error';
    }
    renderBatchQueue();
    
    if (i < batchItems.length - 1) await delay(2000); // rate limit buffer
  }

  document.getElementById('bpLabel').textContent = `Batch Complete!`;
  document.getElementById('bpCount').textContent = `${batchItems.length}/${batchItems.length}`;
  document.getElementById('bpFill').style.width = '100%';

  btn.disabled = false;
  btn.innerHTML = '<span>✦</span><span>Run Intelligence Engine</span>';
}

// ════════════════════
// RENDER RESULTS
// ════════════════════
function renderResults(R, meta) {
  const area = document.getElementById('contentArea');
  area.innerHTML = '';

  // ── 1. SCORES ──
  const cs = parseInt(R.audit?.match(/CONTENT SCORE:\s*(\d+)/)?.[1] || 65);
  const rs = parseInt(R.audit?.match(/READABILITY SCORE:\s*(\d+)/)?.[1] || 60);
  const es = parseInt((R.audit?.match(/E-E-A-T SCORE:\s*([\d.]+)/)?.[1] || 5) * 10);
  const newCards = [];

  newCards.push(buildScoreCard(cs, rs, es));
  newCards.push(buildAuditCard(R.audit));
  newCards.push(buildKeywordCard(R.keywords));
  newCards.push(buildBlueprintCard(R.blueprint));
  newCards.push(buildRewriteCard(R.rewrite));
  newCards.push(buildSchemaCard(R.schema));
  newCards.push(buildImageCard(R.images, meta));
  newCards.push(buildFinalPackCard(R.finalPack));
  newCards.push(buildDeployCard());

  newCards.forEach((html, i) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const card = div.firstElementChild;
    card.style.animationDelay = `${i * 0.08}s`;
    area.appendChild(card);
  });

  // Animate score bars
  setTimeout(() => {
    area.querySelectorAll('.bar-fill').forEach(el => {
      const w = el.dataset.w;
      if (w) { el.style.width = '0%'; setTimeout(() => el.style.width = w, 100); }
    });
  }, 300);
}

function buildScoreCard(cs, rs, es) {
  const bars = [
    { label: 'Content Quality', old: cs, New: 97, cls: 'bf-iris' },
    { label: 'Readability', old: rs, New: 93, cls: 'bf-teal' },
    { label: 'E-E-A-T Signal', old: es, New: 90, cls: 'bf-gold' },
    { label: 'Keyword Coverage', old: 20, New: 98, cls: 'bf-iris' },
    { label: 'Schema Markup', old: 0, New: 100, cls: 'bf-teal' },
    { label: 'Image SEO', old: 5, New: 100, cls: 'bf-gold' },
  ];
  return `<div class="card c-iris">
    <div class="card-head">
      <span class="card-badge cb-iris">AUDIT SCORES</span>
      <span class="card-title">Before → After Optimization Dashboard</span>
    </div>
    <div class="score-panel">
      ${bars.map(b => `
      <div class="score-row">
        <div class="score-meta">
          <span class="score-name">${b.label}</span>
          <span class="score-nums">
            <span class="score-old">${b.old}/100</span>
            <span class="score-arrow">→</span>
            <span class="score-new">${b.New}/100</span>
          </span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${b.cls}" data-w="${b.New}%" style="width:0%"></div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

function buildAuditCard(txt) {
  return `<div class="card c-rose">
    <div class="card-head">
      <span class="card-badge cb-rose">AUDIT REPORT</span>
      <span class="card-title">Content Audit & E-E-A-T Gap Analysis</span>
    </div>
    <div class="card-body">${escH(txt||'')}</div>
  </div>`;
}

function buildKeywordCard(txt) {
  // Parse chips
  const primary = txt?.match(/PRIMARY KEYWORD:\s*(.+)/)?.[1]?.trim() || '';
  const lsiSection = txt?.match(/LSI KEYWORDS[^:]*:([\s\S]*?)AEO/)?.[1] || '';
  const aeoSection = txt?.match(/AEO[^:]*:([\s\S]*?)ENTITY/)?.[1] || '';
  const entitySection = txt?.match(/ENTITY[^:]*:([\s\S]*?)LONG-TAIL/)?.[1] || '';
  const ltSection = txt?.match(/LONG-TAIL[^:]*:([\s\S]*?)FEATURED/)?.[1] || '';

  function toChips(text, cls, dotColor, limit=8) {
    return text.split('\n')
      .map(l => l.replace(/^[\-\*\d\.\|Q:]+\s*/,'').split('|')[0].trim())
      .filter(l => l.length > 2 && l.length < 70 && !l.startsWith('['))
      .slice(0, limit)
      .map(l => `<span class="kw-chip ${cls}"><span class="kw-dot" style="background:${dotColor}"></span>${escH(l)}</span>`)
      .join('');
  }

  const chipsHTML = `<div class="kw-cloud">
    ${primary ? `<span class="kw-chip kc-primary"><span class="kw-dot" style="background:#c4b5fd"></span>⭐ ${escH(primary)}</span>` : ''}
    ${toChips(lsiSection, 'kc-lsi', '#38bdf8')}
    ${toChips(aeoSection, 'kc-aeo', '#f0a500', 5)}
    ${toChips(entitySection, 'kc-entity', '#00d4aa', 4)}
    ${toChips(ltSection, 'kc-longtail', '#ffa0b4', 4)}
  </div>`;

  return `<div class="card c-iris">
    <div class="card-head">
      <span class="card-badge cb-iris">KEYWORD INTEL</span>
      <span class="card-title">Full Keyword Stack — Primary · LSI · AEO · Entity · Long-tail</span>
    </div>
    ${chipsHTML}
    <div class="card-body" style="border-top:1px solid var(--line)">${escH(txt||'')}</div>
  </div>`;
}

function buildBlueprintCard(txt) {
  const title = txt?.match(/SEO TITLE[^:]*:\s*(.+)/)?.[1]?.trim() || '';
  const meta = txt?.match(/META DESCRIPTION[^:]*:\s*(.+)/)?.[1]?.trim() || '';
  const slug = txt?.match(/URL SLUG[^:]*:\s*(.+)/)?.[1]?.trim() || '';

  const quickMeta = (title||meta||slug) ? `
    <div style="padding:14px 18px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:8px">
      ${title ? `<div class="notice n-teal" style="margin:0"><span>📝</span><div><b>Title:</b> ${escH(title)}</div></div>` : ''}
      ${meta ? `<div class="notice n-iris" style="margin:0"><span>📋</span><div><b>Meta:</b> ${escH(meta)}</div></div>` : ''}
      ${slug ? `<div class="notice n-gold" style="margin:0"><span>🔗</span><div><b>Slug:</b> <code style="font-family:JetBrains Mono,monospace">${escH(slug)}</code></div></div>` : ''}
    </div>` : '';

  return `<div class="card c-gold">
    <div class="card-head">
      <span class="card-badge cb-gold">BLUEPRINT</span>
      <span class="card-title">SEO Architecture — Title · Meta · H-Structure · FAQ</span>
    </div>
    ${quickMeta}
    <div class="card-body">${escH(txt||'')}</div>
  </div>`;
}

function buildRewriteCard(txt) {
  const safePreview = (txt||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/on\w+="[^"]*"/gi,'');
  return `<div class="card c-teal">
    <div class="card-head">
      <span class="card-badge cb-teal">FULL REWRITE</span>
      <span class="card-title">Optimized Post HTML — Blogger Ready</span>
      <button class="card-action" onclick="copyText(document.getElementById('rwCode').innerText, this)">Copy HTML</button>
    </div>
    <div class="tab-nav">
      <button class="tab-btn active" onclick="switchTab(this,'rw-preview',this.closest('.card'))">👁 Preview</button>
      <button class="tab-btn" onclick="switchTab(this,'rw-source',this.closest('.card'))">‹/› HTML Source</button>
    </div>
    <div class="tab-pane active" id="rw-preview">
      <div class="html-preview">${safePreview}</div>
    </div>
    <div class="tab-pane" id="rw-source">
      <div class="code-wrap">
        <button class="cp-btn" onclick="copyText(document.getElementById('rwCode').innerText, this)">Copy</button>
        <pre id="rwCode">${escH(txt||'')}</pre>
      </div>
    </div>
  </div>`;
}

function buildSchemaCard(txt) {
  return `<div class="card c-sky">
    <div class="card-head">
      <span class="card-badge cb-sky">SCHEMA JSON-LD</span>
      <span class="card-title">Structured Data — Article + FAQPage + Breadcrumb + WebPage</span>
      <button class="card-action" onclick="copyText(document.getElementById('schCode').innerText, this)">Copy</button>
    </div>
    <div class="notice n-teal">
      <span>💡</span><span>Paste this block immediately before <code style="font-family:JetBrains Mono,monospace">&lt;/head&gt;</code> in your Blogger theme HTML.</span>
    </div>
    <div class="code-wrap">
      <button class="cp-btn" onclick="copyText(document.getElementById('schCode').innerText, this)">Copy</button>
      <pre id="schCode">${escH(txt||'')}</pre>
    </div>
  </div>`;
}

function buildImageCard(txt, meta) {
  // Parse image blocks
  const raw = txt || '';
  
  // Extract featured image
  const featuredMatch = raw.match(/=== FEATURED IMAGE ===([\s\S]*?)(?==== IN-POST|$)/);
  const inPostMatches = [...raw.matchAll(/=== IN-POST IMAGE (\d+) ===([\s\S]*?)(?==== IN-POST|=== IMAGE SEO|$)/g)];
  const summaryMatch = raw.match(/=== IMAGE SEO SUMMARY ===([\s\S]*?)$/);

  function parseImageBlock(blockTxt) {
    const get = (key) => {
      const m = blockTxt?.match(new RegExp(key+':\\s*([^\\n]+)'));
      return m ? m[1].trim() : '';
    };
    const getMultiline = (key) => {
      const m = blockTxt?.match(new RegExp(key+':\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)'));
      return m ? m[1].trim() : '';
    };
    return {
      type: get('TYPE'),
      placement: get('PLACEMENT'),
      prompt: getMultiline('PROMPT'),
      styleNotes: getMultiline('STYLE_NOTES'),
      filename: get('FILENAME'),
      alt: get('ALT_TEXT'),
      title: get('TITLE_ATTR'),
      caption: get('CAPTION'),
    };
  }

  function renderImgCard(data, isFeatured, index) {
    if (!data.prompt && !data.type) return '';
    
    const typeClass = {
      'Photorealistic': 'ipt-photo',
      'Digital Illustration': 'ipt-illustration',
      'Flat Design': 'ipt-illustration',
      'Infographic': 'ipt-infographic',
      'Diagram': 'ipt-diagram',
      '3D Render': 'ipt-mockup',
      'Data Visualization': 'ipt-infographic',
      'Mockup': 'ipt-mockup',
      'Step-by-Step Visual': 'ipt-diagram',
      'Illustration': 'ipt-illustration',
    };
    const getTypeClass = (t) => {
      for (const [key, cls] of Object.entries(typeClass)) {
        if (t?.includes(key)) return cls;
      }
      return isFeatured ? 'ipt-featured' : 'ipt-illustration';
    };

    const tid = `img-${isFeatured?'feat':index}-${Date.now()}`;

    return `<div class="img-prompt-card">
      <div class="ipc-head">
        <span class="ipc-type ${isFeatured ? 'ipt-featured' : getTypeClass(data.type)}">${isFeatured ? '⭐ FEATURED' : `IN-POST #${index}`}</span>
        <span class="ipc-placement">${escH(data.type||'')}</span>
        <span class="ipc-pos">${escH(data.placement||'')}</span>
      </div>
      ${data.prompt ? `<div class="ipc-prompt">${escH(data.prompt)}</div>` : ''}
      <div class="ipc-seo">
        ${data.filename ? `<div class="seo-row"><span class="seo-key">filename</span><span class="seo-val"><b>${escH(data.filename)}</b></span></div>` : ''}
        ${data.alt ? `<div class="seo-row"><span class="seo-key">alt text</span><span class="seo-val">${escH(data.alt)}</span></div>` : ''}
        ${data.title ? `<div class="seo-row"><span class="seo-key">title attr</span><span class="seo-val">${escH(data.title)}</span></div>` : ''}
        ${data.caption ? `<div class="seo-row"><span class="seo-key">caption</span><span class="seo-val">${escH(data.caption)}</span></div>` : ''}
        ${data.styleNotes ? `<div class="seo-row"><span class="seo-key">strategy</span><span class="seo-val" style="color:var(--gold2)">${escH(data.styleNotes)}</span></div>` : ''}
      </div>
      <div class="ipc-actions">
        <button class="ipc-btn ipc-btn-copy" id="${tid}" onclick="copyText(document.getElementById('${tid}').closest('.img-prompt-card').querySelector('.ipc-prompt')?.innerText||'', this)">📋 Copy Prompt</button>
        <button class="ipc-btn ipc-btn-mid" onclick="copyText(\`filename: ${escH(data.filename)}\\nalt: ${escH(data.alt)}\\ntitle: ${escH(data.title)}\\ncaption: ${escH(data.caption)}\`, this)">📦 Copy SEO Pack</button>
      </div>
    </div>`;
  }

  const featuredData = featuredMatch ? parseImageBlock(featuredMatch[1]) : {};
  const inPostCards = inPostMatches.map((m, i) => renderImgCard(parseImageBlock(m[2]), false, i+1));

  return `<div class="card c-gold">
    <div class="card-head">
      <span class="card-badge cb-gold">🎨 IMAGE INTELLIGENCE</span>
      <span class="card-title">AI Image Prompts + Full SEO Pack — ${meta.aiTool}</span>
      <button class="card-action" onclick="copyText(document.getElementById('imgRaw').innerText, this)">Copy All</button>
    </div>
    <div class="notice n-gold">
      <span>🎯</span><span>1 Featured Image + ${meta.imgCount} In-Post Images. Each includes: AI prompt, filename, alt text, title attribute, caption. Copy-paste ready for ${meta.aiTool}.</span>
    </div>
    <div class="img-grid">
      ${renderImgCard(featuredData, true, 0)}
      ${inPostCards.join('')}
    </div>
    ${summaryMatch ? `<div class="card-body" style="border-top:1px solid var(--line);font-size:0.75rem">${escH(summaryMatch[1])}</div>` : ''}
    <div class="code-wrap">
      <button class="cp-btn" onclick="copyText(document.getElementById('imgRaw').innerText, this)">Copy Raw</button>
      <pre id="imgRaw">${escH(raw)}</pre>
    </div>
  </div>`;
}

function buildFinalPackCard(txt) {
  const metaMatch = txt?.match(/=== BLOGGER HEAD META TAGS ===([\s\S]*?)(?===)/)?.[1] || '';
  const socialMatch = txt?.match(/=== SOCIAL SHARE COPY ===([\s\S]*?)(?===)/)?.[1] || '';
  const projMatch = txt?.match(/=== SEO PROJECTION ===([\s\S]*?)$/)?.[1] || '';

  return `<div class="card c-iris">
    <div class="card-head">
      <span class="card-badge cb-iris">FINAL PACK</span>
      <span class="card-title">Meta Tags · AdSense Audit · Social Copy · SEO Projection</span>
    </div>
    <div class="tab-nav">
      <button class="tab-btn active" onclick="switchTab(this,'fp-all',this.closest('.card'))">All Output</button>
      <button class="tab-btn" onclick="switchTab(this,'fp-meta',this.closest('.card'))">Meta Tags</button>
      <button class="tab-btn" onclick="switchTab(this,'fp-social',this.closest('.card'))">Social Copy</button>
      <button class="tab-btn" onclick="switchTab(this,'fp-proj',this.closest('.card'))">Projection</button>
    </div>
    <div class="tab-pane active" id="fp-all">
      <div class="card-body">${escH(txt||'')}</div>
    </div>
    <div class="tab-pane" id="fp-meta">
      <div class="code-wrap">
        <button class="cp-btn" onclick="copyText(document.getElementById('fpMetaCode').innerText, this)">Copy</button>
        <pre id="fpMetaCode">${escH(metaMatch)}</pre>
      </div>
    </div>
    <div class="tab-pane" id="fp-social">
      <div class="card-body">${escH(socialMatch)}</div>
    </div>
    <div class="tab-pane" id="fp-proj">
      <div class="card-body">${escH(projMatch)}</div>
    </div>
  </div>`;
}

function buildDeployCard() {
  const steps = [
    { n:'01', title:'Replace Post HTML', desc:'Blogger → Post → HTML Editor. Replace entire content with the rewritten HTML. Find IMG_PLACEHOLDER comments and insert your generated images.' },
    { n:'02', title:'Upload AI Images', desc:'Generate images using the prompts in your chosen AI tool. Save with the exact filenames provided. Compress to ≤150KB WebP. Upload to Blogger media.' },
    { n:'03', title:'Inject Schema JSON-LD', desc:'Blogger → Theme → Edit HTML. Paste the JSON-LD <script> block immediately before </head>. Save theme.' },
    { n:'04', title:'Insert Meta Tags', desc:'Paste the Blogger head meta tags from the Final Pack. If using a custom theme, insert in the <head> section after existing meta tags.' },
    { n:'05', title:'Replace Internal Links', desc:'Find <!-- INTERNAL_LINK_1 --> and <!-- INTERNAL_LINK_2 --> placeholders in the HTML. Replace with actual URLs from thebukitbesi.com.' },
    { n:'06', title:'Publish & Request Index', desc:'Publish post → Google Search Console → URL Inspection → Request Indexing. Monitor position in 7-14 days via GSC Performance.' },
  ];
  return `<div class="card c-teal">
    <div class="card-head">
      <span class="card-badge cb-teal">DEPLOY</span>
      <span class="card-title">Blogger Implementation Checklist</span>
    </div>
    <div class="deploy-list">
      ${steps.map(s => `
      <div class="deploy-step">
        <div class="step-num">${s.n}</div>
        <div class="step-body">
          <div class="step-title">${s.title}</div>
          <div class="step-desc">${s.desc}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── INIT ──
renderBatchQueue();
