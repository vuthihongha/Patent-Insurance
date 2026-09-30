(function () {
  'use strict';

  // Header background once the page scrolls
  var header = document.querySelector('[data-header]');
  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Parallax: the hero scene drifts slower than the page, and the hero copy fades out
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var heroFade = document.querySelector('[data-hero-fade]');
  if (!reduce && (layers.length || heroFade)) {
    var ticking = false;
    var paint = function () {
      var y = window.scrollY;
      var vh = window.innerHeight || 1;
      if (y < vh * 1.2) {
        layers.forEach(function (el) { el.style.transform = 'translate3d(0,' + (y * parseFloat(el.dataset.parallax)).toFixed(1) + 'px,0)'; });
        if (heroFade) {
          var k = Math.min(1, y / (vh * 0.7));
          heroFade.style.opacity = String(1 - k);
          heroFade.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0)';
        }
      }
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
  }

  // Mobile navigation
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? toggle.dataset.labelClose : toggle.dataset.labelOpen);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 1201px)').addEventListener('change', function (mq) {
      if (mq.matches) setOpen(false);
    });
  }

  // Reveal on scroll
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Accessible tabs (WAI-ARIA pattern, automatic activation)
  document.querySelectorAll('[data-tabs]').forEach(function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (tab) { return document.getElementById(tab.getAttribute('aria-controls')); });
    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var active = i === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
      });
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = tabs.length - 1;
        if (next !== null) { e.preventDefault(); select(next, true); }
      });
    });
    select(0, false);
  });

  // Demo video in a modal dialog
  var modal = document.querySelector('[data-video-modal]');
  if (modal && typeof modal.showModal === 'function') {
    var video = modal.querySelector('[data-video]');
    var opener = null;
    document.querySelectorAll('[data-video-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        opener = btn;
        modal.showModal();
        var p = video.play(); if (p && p.catch) p.catch(function () {});
      });
    });
    var closeModal = function () { video.pause(); modal.close(); };
    modal.querySelector('[data-video-close]').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    modal.addEventListener('close', function () { video.pause(); if (opener) opener.focus(); });
  }

  // Copy buttons (e.g. the citation on the About page)
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = document.querySelector(btn.dataset.copy);
      if (!src) return;
      var text = src.textContent.trim();
      var done = function () {
        var label = btn.textContent;
        btn.textContent = btn.dataset.copied;
        setTimeout(function () { btn.textContent = label; }, 1800);
      };
      var fallback = function () {
        var range = document.createRange();
        range.selectNodeContents(src);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else { fallback(); }
    });
  });

  // Table-of-contents scrollspy
  var tocLinks = document.querySelectorAll('[data-toc-link]');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (a) { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
        var link = byId[entry.target.id];
        if (link) { link.classList.add('is-active'); link.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }
})();
