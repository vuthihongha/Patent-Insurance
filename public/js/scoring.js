/*
 * Self-assessment scoring. Shared by the browser (window.BHSCScoring) and the
 * server (require), so results and stored records always agree.
 * Weights follow the strategy's pilot criteria: S&T / high-tech firms, owned or
 * exploited patents, Hanoi & HCMC pilot locations, priority core technologies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BHSCScoring = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var QUESTIONS = {
    type: ['st', 'hitech', 'startup', 'sme', 'institute', 'individual'],
    patent: ['none', 'preparing', 'pending', 'granted'],
    use: ['produce', 'license', 'acquire', 'notyet'],
    market: ['domestic', 'export'],
    dispute: ['never', 'accused', 'infringed', 'ongoing'],
    sector: ['semi', 'quantum', 'energy', 'digital', 'bio', 'other'],
    city: ['hanoi', 'hcmc', 'other'],
    budget: ['yes', 'hard', 'no']
  };

  // Pilot readiness, max 100
  var READINESS = {
    type: { st: 30, hitech: 30, startup: 22, institute: 16, sme: 12, individual: 8 },
    patent: { granted: 20, pending: 15, preparing: 8, none: 0 },
    use: { produce: 15, license: 15, acquire: 10, notyet: 3 },
    city: { hanoi: 20, hcmc: 20, other: 8 },
    sector: { semi: 15, quantum: 15, energy: 15, digital: 11, bio: 11, other: 6 }
  };

  var PRIORITY_SECTORS = ['semi', 'quantum', 'energy'];

  function isValid(a) {
    if (!a || typeof a !== 'object') return false;
    return Object.keys(QUESTIONS).every(function (k) {
      return QUESTIONS[k].indexOf(a[k]) !== -1;
    });
  }

  function money(a) { return a.budget === 'no' ? 2 : a.budget === 'hard' ? 1 : 0; }
  function fitOf(pct) { return pct >= 60 ? 'high' : pct >= 30 ? 'mid' : 'low'; }

  function score(a) {
    var readiness = 0;
    Object.keys(READINESS).forEach(function (k) { readiness += READINESS[k][a[k]]; });

    var application = { preparing: 6, pending: 6, none: 2, granted: 0 }[a.patent]
      + ({ individual: 2, startup: 2, institute: 1, sme: 1 }[a.type] || 0)
      + money(a);
    var legal = { granted: 4, pending: 2, preparing: 0, none: 0 }[a.patent]
      + (a.market === 'export' ? 2 : 0)
      + { infringed: 3, ongoing: 3, accused: 1, never: 0 }[a.dispute]
      + money(a)
      + (a.use === 'license' ? 1 : 0);
    var liability = { produce: 4, acquire: 4, license: 1, notyet: 0 }[a.use]
      + { accused: 4, ongoing: 2, infringed: 0, never: 0 }[a.dispute]
      + (a.market === 'export' ? 2 : 0);

    var products = [
      { id: 'application', pct: Math.round((application / 10) * 100) },
      { id: 'legal', pct: Math.round((legal / 12) * 100) },
      { id: 'liability', pct: Math.round((liability / 10) * 100) }
    ].map(function (p) { p.fit = fitOf(p.pct); return p; })
      .sort(function (x, y) { return y.pct - x.pct; });

    var tips = [];
    if (['sme', 'startup', 'institute'].indexOf(a.type) !== -1) tips.push('certify');
    if (a.patent === 'none') tips.push('file');
    if (a.use === 'notyet') tips.push('exploit');
    if (a.market === 'export') tips.push('export');
    if ((a.use === 'produce' || a.use === 'acquire') && a.dispute === 'never') tips.push('fto');
    if (a.budget !== 'yes') tips.push('support');
    if (a.city === 'other') tips.push('city');
    if (PRIORITY_SECTORS.indexOf(a.sector) !== -1) tips.push('priority');

    return {
      readiness: readiness,
      level: readiness >= 75 ? 'high' : readiness >= 50 ? 'mid' : 'low',
      products: products,
      tips: tips
    };
  }

  return { QUESTIONS: QUESTIONS, isValid: isValid, score: score };
});
