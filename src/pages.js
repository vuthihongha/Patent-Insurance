// Page registry: one entry per page, with the URL slug for each language.
// The order here is the order of the navigation: the project introduction comes
// first, then the content pages, then the applied tool and supporting pages.
// `ready: false` pages render the "coming soon" template until their content is written.
const LANGS = ['vi', 'en'];
const DEFAULT_LANG = 'vi';

const PAGES = [
  { key: 'home', slug: { vi: '', en: '' }, view: 'home', ready: true },
  { key: 'about', slug: { vi: 've-du-an', en: 'about' }, view: 'about', ready: true },
  { key: 'insurance', slug: { vi: 'bao-hiem-sang-che', en: 'patent-insurance' }, view: 'insurance', ready: true },
  { key: 'strategy', slug: { vi: 'chien-luoc', en: 'strategy' }, view: 'strategy', ready: true },
  { key: 'international', slug: { vi: 'kinh-nghiem-quoc-te', en: 'international-experience' }, view: 'international', ready: true },
  { key: 'legal', slug: { vi: 'khung-phap-ly', en: 'legal-framework' }, view: 'legal', ready: true },
  { key: 'tool', slug: { vi: 'tu-danh-gia', en: 'self-assessment' }, view: 'tool', ready: true },
  { key: 'experts', slug: { vi: 'goc-chuyen-gia', en: 'expert-insights' }, view: 'experts', ready: true },
  { key: 'library', slug: { vi: 'thu-vien', en: 'library' }, view: 'library', ready: true },
  { key: 'privacy', slug: { vi: 'chinh-sach-bao-mat', en: 'privacy' }, view: 'privacy', ready: true }
];

function pathFor(key, lang) {
  const page = PAGES.find((p) => p.key === key);
  if (!page) return `/${lang}/`;
  const slug = page.slug[lang];
  return slug ? `/${lang}/${slug}` : `/${lang}/`;
}

function findBySlug(lang, slug) {
  return PAGES.find((p) => p.slug[lang] === slug);
}

module.exports = { LANGS, DEFAULT_LANG, PAGES, pathFor, findBySlug };
