// "Register interest" submissions. Stored as JSON Lines in data/interest.jsonl.
// Only what the person typed is kept, plus an optional anonymous self-assessment
// summary; IP addresses are used in memory for throttling and never written.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'interest.jsonl');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.start > 3600000) { hits.set(ip, { start: now, n: 1 }); return false; }
  e.n += 1;
  return e.n > 10;
}

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function record(req, res) {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill hidden fields
  const org = clip(b.org, 160);
  const email = clip(b.email, 160);
  if (!org || !EMAIL.test(email) || b.consent !== true) return res.status(400).json({ ok: false });
  if (throttled(req.ip)) return res.status(429).json({ ok: false });

  const row = {
    date: new Date().toISOString(),
    lang: b.lang === 'en' ? 'en' : 'vi',
    org,
    contact: clip(b.contact, 120),
    email,
    type: clip(b.type, 80),
    sector: clip(b.sector, 80),
    topics: Array.isArray(b.topics) ? b.topics.slice(0, 5).map((t) => clip(t, 80)) : [],
    message: clip(b.message, 1000),
    assessment: b.assessment && typeof b.assessment === 'object'
      ? { readiness: Number(b.assessment.readiness) || null, top: clip(b.assessment.top, 20) }
      : null,
    consent: true
  };
  fs.mkdir(DATA_DIR, { recursive: true }, (mkErr) => {
    if (mkErr) return res.status(500).json({ ok: false });
    fs.appendFile(FILE, JSON.stringify(row) + '\n', (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true });
    });
  });
}

module.exports = { record };
