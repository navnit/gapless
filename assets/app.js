/* ============================================================
   Gapless — site behaviour
   Theme toggle, copy-to-clipboard, scroll reveal, and the
   procedurally-drawn waveform / timeline visuals.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme toggle ---------- */
  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('gapless-theme', next); } catch (e) {}
    });
  }
  // Follow the OS if the user has not made an explicit choice.
  try {
    if (!localStorage.getItem('gapless-theme')) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
        if (!localStorage.getItem('gapless-theme')) {
          root.setAttribute('data-theme', e.matches ? 'light' : 'dark');
        }
      });
    }
  } catch (e) {}

  /* ---------- Homebrew copy ---------- */
  var copyBtn = document.getElementById('brewCopy');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var cmd = copyBtn.closest('.brew').getAttribute('data-copy');
      var done = function () {
        copyBtn.classList.add('is-copied');
        copyBtn.textContent = 'Copied';
        setTimeout(function () {
          copyBtn.classList.remove('is-copied');
          copyBtn.textContent = 'Copy';
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd).then(done).catch(fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = cmd;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  }

  /* ---------- Nav shadow on scroll ---------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('is-stuck', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Scroll reveal ---------- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Deterministic pseudo-random (stable across renders) ---------- */
  function seeded(seed) {
    var s = seed;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /* ---------- Waveform builder ----------
     patterns describe alternating "kept" and "cut" runs so the
     bars read the way the timeline does in the app. */
  var PATTERNS = {
    hero:     { seed: 7,  bars: 68, runs: [9, 4, 12, 5, 10, 6, 11, 5] },
    meetings: { seed: 21, bars: 58, runs: [7, 6, 10, 7, 9, 5, 8] },
    tutorial: { seed: 33, bars: 56, threshold: true }
  };

  function buildWave(el) {
    var name = el.getAttribute('data-wave');
    var cfg = PATTERNS[name] || PATTERNS.hero;
    var rnd = seeded(cfg.seed);
    var frag = document.createDocumentFragment();

    // Precompute which bars belong to a "cut" run.
    var cutFlags = new Array(cfg.bars).fill(false);
    if (cfg.runs) {
      var idx = 0, cut = false;
      for (var r = 0; r < cfg.runs.length && idx < cfg.bars; r++) {
        for (var k = 0; k < cfg.runs[r] && idx < cfg.bars; k++) { cutFlags[idx++] = cut; }
        cut = !cut;
      }
      while (idx < cfg.bars) { cutFlags[idx++] = cut; }
    }

    for (var i = 0; i < cfg.bars; i++) {
      var bar = document.createElement('span');
      bar.className = 'wave__bar';
      var base = cfg.threshold ? rnd() : (cutFlags[i] ? 0.18 + rnd() * 0.35 : 0.35 + rnd() * 0.65);
      var h = Math.max(0.08, Math.min(1, base));
      bar.style.height = (h * 100) + '%';
      if (cfg.threshold) {
        // bars quieter than the dashed threshold line are dimmed (they get cut)
        if (h < 0.54) { bar.classList.add('below'); }
      } else if (cutFlags[i]) {
        bar.classList.add('is-cut');
      }
      frag.appendChild(bar);
    }
    el.appendChild(frag);
  }

  Array.prototype.slice.call(document.querySelectorAll('.wave')).forEach(buildWave);
})();
