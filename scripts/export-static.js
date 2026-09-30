// Export a static, self-contained preview of the site into dist/ (one HTML file
// per page, CSS/JS/images inlined) so it can be shared without a Node server.
// Usage: start the server (npm start), then run: node scripts/export-static.js
const fs = require('fs');
const path = require('path');
const { LANGS, PAGES, pathFor } = require('../src/pages');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function fileFor(key, lang) {
  if (key === 'home') return lang === 'vi' ? 'index.html' : 'en.html';
  return `${lang}-${PAGES.find((p) => p.key === key).slug[lang]}.html`;
}

// URL path -> exported file name
const routeMap = {};
LANGS.forEach((lang) => PAGES.forEach((p) => { routeMap[pathFor(p.key, lang)] = fileFor(p.key, lang); }));

const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(ROOT, file)).toString('base64')}`;
const images = {
  '/images/mark.svg': dataUri('public/images/mark.svg', 'image/svg+xml'),
  '/images/hlu-logo.webp': dataUri('public/images/hlu-logo.webp', 'image/webp')
};
// large media ship as separate files next to the pages (published alongside them)
const relMedia = (s) => s.split('/images/hero-city').join('images/hero-city')
  .split('/media/demo.mp4').join('media/demo-lite.mp4')
  .split('/media/demo-poster.jpg').join('media/demo-poster.jpg');

// The shared preview has no server: show everything at rest, hide what cannot work there.
const exportCss = `
:root { color-scheme: dark; }
body { background: #030a1c; }
.js .reveal { opacity: 1; transform: none; filter: none; }
.js .bar-fill, .js .reveal .flow-bar { transform: none; }
[data-print] { display: none !important; }
.preview-note { margin: 0; color: var(--muted); font-size: 0.875rem; }
`;

async function exportPage(key, lang) {
  const res = await fetch(BASE + pathFor(key, lang));
  if (!res.ok) throw new Error(`${pathFor(key, lang)} -> ${res.status}`);
  const html = await res.text();
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));

  body = body.replace(/<script src="\/js\/([\w-]+\.js)"[^>]*><\/script>/g, (m, f) => `<script>\n${read('public/js/' + f)}\n</script>`);
  body = body.replace(/(href|src)="(\/[^"#]*)(#[^"]*)?"/g, (m, attr, url, hash = '') => {
    if (images[url]) return `${attr}="${images[url]}"`;
    const clean = url.split('?')[0];
    if (routeMap[clean]) return `${attr}="${routeMap[clean]}${hash}"`;
    if (routeMap[clean + '/']) return `${attr}="${routeMap[clean + '/']}${hash}"`;
    return m;
  });

  // In the shared Claude preview there is no server: the interest form saves to the
  // artifact's own data store instead (each person writes only their own entry;
  // only the owner can read the list). Viewers who cannot write see a short note.
  const previewNote = lang === 'vi'
    ? 'Bản xem thử: form sẽ nhận đăng ký khi website chính thức ra mắt.'
    : 'Preview: the form will accept registrations once the website launches.';
  const interestJs = (key === 'home' || key === 'tool') ? `<script>
window.BHSCInterestSubmit = async function (payload) {
  if (!window.claude || !window.claude.use) return false;
  const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
  if (!db || !user) return false;
  const uid = await user.id();
  if (!uid) return false;
  const entry = Object.assign({}, payload, { date: new Date().toISOString() });
  delete entry.website;
  try { await db.doc('interest/' + uid).set(entry); return true; } catch (e) { return false; }
};
(async function () {
  const user = window.claude && window.claude.use ? await window.claude.use('user') : null;
  const canWrite = user ? await user.can('data.write') : false;
  if (canWrite === false) {
    document.querySelectorAll('[data-interest]').forEach(function (f) {
      f.querySelector('button[type="submit"]').disabled = true;
      const note = document.createElement('p');
      note.className = 'form-status preview-note';
      note.textContent = ${JSON.stringify(previewNote)};
      f.querySelector('.form-actions').after(note);
    });
  }
})();
</script>` : '';
  if (interestJs) body = body.replace('</main>', interestJs + '\n</main>');
  body = relMedia(body);

  const css = relMedia(read('public/css/styles.css') + read('public/css/pages.css') + read('public/css/effects.css') + read('public/css/components.css') + read('public/css/visual.css') + (key === 'tool' ? read('public/css/tool.css') : ''));
  const isMain = key === 'home' && lang === 'vi';
  // The main page is wrapped in a document skeleton by the host; the others are served as-is.
  const prefix = isMain ? '' : `<!doctype html>\n<html lang="${lang}">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n`;
  return `${prefix}<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,500;1,500&display=swap" rel="stylesheet">
<style>
${css}
${exportCss}
</style>
<script>document.documentElement.classList.add('js');document.documentElement.lang='${lang}';</script>
${body}`;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const lang of LANGS) {
    for (const p of PAGES.filter((pg) => pg.ready)) {
      const file = fileFor(p.key, lang);
      fs.writeFileSync(path.join(OUT, file), await exportPage(p.key, lang));
      console.log('wrote', file);
    }
  }
  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'media'), { recursive: true });
  for (const f of ['images/hero-city.webp', 'images/hero-city-md.webp', 'media/demo-lite.mp4', 'media/demo-poster.jpg'])
    fs.copyFileSync(path.join(ROOT, 'public', f), path.join(OUT, f));
})().catch((err) => { console.error(err); process.exit(1); });
