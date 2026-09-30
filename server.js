const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const { LANGS, DEFAULT_LANG, PAGES, pathFor, findBySlug } = require('./src/pages');
const assessments = require('./src/assessments');
const interest = require('./src/interest');
const { applyNbsp } = require('./src/typography');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
const isProd = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');
app.set('trust proxy', 1); // Hostinger runs the app behind a reverse proxy
app.use(compression());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
// All site CSS served as one file (fewer render-blocking requests)
const CSS_PARTS = ['styles.css', 'pages.css', 'effects.css', 'components.css', 'visual.css'];
let cssBundle = null;
app.get('/css/site.css', (req, res) => {
  if (!isProd || !cssBundle) cssBundle = CSS_PARTS.map((f) => fs.readFileSync(path.join(__dirname, 'public/css', f), 'utf8')).join('\n');
  res.type('text/css').set('Cache-Control', isProd ? 'public, max-age=604800' : 'no-cache').send(cssBundle);
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));

// Content is plain JSON so it can be edited without touching code.
// In development it is re-read on every request so edits show up on refresh.
const cache = {};
function loadJson(file) {
  if (isProd && cache[file]) return cache[file];
  let data = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  // Vietnamese copy: keep compound words together on one line
  if (/(^|\/)vi(\.json|\/)/.test(file)) data = applyNbsp(data);
  cache[file] = data;
  return data;
}
function loadContent(lang, name) {
  const file = `content/${lang}/${name}.json`;
  return fs.existsSync(path.join(__dirname, file)) ? loadJson(file) : null;
}

function render(req, res, lang, page, status = 200) {
  const t = loadJson(`locales/${lang}.json`);
  const ready = page.ready && fs.existsSync(path.join(__dirname, 'views/pages', `${page.view}.ejs`));
  const content = loadContent(lang, page.view);
  const alternates = Object.fromEntries(LANGS.map((l) => [l, pathFor(page.key, l)]));
  res.status(status).render(ready ? `pages/${page.view}` : 'pages/coming-soon', {
    lang,
    t,
    c: content,
    page,
    pages: PAGES,
    pathFor: (key) => pathFor(key, lang),
    alternates,
    siteUrl: SITE_URL || `${req.protocol}://${req.get('host')}`,
    currentPath: pathFor(page.key, lang),
    year: new Date().getFullYear()
  });
}

app.get('/', (req, res) => {
  const lang = req.acceptsLanguages('vi', 'en') === 'en' ? 'en' : DEFAULT_LANG;
  res.redirect(302, `/${lang}/`);
});

app.post('/api/assessments', express.json({ limit: '2kb' }), assessments.record);
app.get('/api/assessments/count', assessments.getCount);
app.post('/api/interest', express.json({ limit: '8kb' }), interest.record);

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ''}`);
});

app.get('/sitemap.xml', (req, res) => {
  const urls = PAGES.filter((p) => p.ready)
    .flatMap((p) => LANGS.map((l) => `  <url><loc>${SITE_URL}${pathFor(p.key, l)}</loc></url>`))
    .join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
});

// Non-strict routing: matches both /vi and /vi/
app.get('/:lang(vi|en)',(req, res) => render(req, res, req.params.lang, PAGES[0]));
app.get('/:lang(vi|en)/:slug', (req, res, next) => {
  const page = findBySlug(req.params.lang, req.params.slug);
  if (!page) return next();
  render(req, res, req.params.lang, page);
});

app.use((req, res) => {
  const lang = req.path.startsWith('/en') ? 'en' : DEFAULT_LANG;
  const t = loadJson(`locales/${lang}.json`);
  res.status(404).render('pages/404', {
    lang, t, c: null, page: { key: '404' }, pages: PAGES,
    pathFor: (key) => pathFor(key, lang),
    alternates: { vi: '/vi/', en: '/en/' },
    siteUrl: SITE_URL, currentPath: req.path, year: new Date().getFullYear()
  });
});

app.listen(PORT, () => {
  console.log(`Patent Insurance Strategy running at http://localhost:${PORT}`);
});
