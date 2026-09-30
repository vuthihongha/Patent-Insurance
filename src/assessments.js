// Anonymous assessment log. Stores only the multiple-choice answers and the score
// (no names, emails or IP addresses) as JSON Lines, so the number of completed
// assessments can be shown as evidence of real-world use.
const fs = require('fs');
const path = require('path');
const { isValid, score } = require('../public/js/scoring');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'assessments.jsonl');

let count = 0;
try {
  count = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).length;
} catch (e) {
  count = 0;
}

// Light per-IP throttle kept in memory only (IPs are never written to disk).
const hits = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;
function throttled(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    return false;
  }
  entry.n += 1;
  return entry.n > MAX_PER_WINDOW;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) if (now - entry.start > WINDOW_MS) hits.delete(ip);
}, WINDOW_MS).unref();

function record(req, res) {
  const body = req.body || {};
  const answers = body.answers;
  if (!isValid(answers)) return res.status(400).json({ ok: false });
  if (throttled(req.ip)) return res.status(429).json({ ok: false });

  const clean = {};
  Object.keys(answers).forEach((k) => { clean[k] = answers[k]; });
  const result = score(clean);
  const row = {
    date: new Date().toISOString().slice(0, 10),
    lang: body.lang === 'en' ? 'en' : 'vi',
    answers: clean,
    readiness: result.readiness,
    top: result.products[0].id
  };
  fs.mkdir(DATA_DIR, { recursive: true }, (mkErr) => {
    if (mkErr) return res.status(500).json({ ok: false });
    fs.appendFile(FILE, JSON.stringify(row) + '\n', (err) => {
      if (err) return res.status(500).json({ ok: false });
      count += 1;
      res.json({ ok: true, count });
    });
  });
}

function getCount(req, res) {
  res.json({ count });
}

module.exports = { record, getCount };
