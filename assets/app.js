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
     Segmented like the app timeline: tall "speech" runs are kept,
     flat "gap" runs are hatched and collapse to zero (the cut being
     applied), "quiet" runs carry a hatch that fades in as the
     threshold sweeps. Widths are n*5px so the bar count sets the span. */
  var WAVES = {
    hero:     { seed: 7,  dur: '10s', spec: [['s', 20], ['g', 14], ['s', 26], ['g', 10], ['s', 22], ['g', 22], ['s', 26], ['g', 8], ['s', 20], ['g', 16], ['s', 18]] },
    meetings: { seed: 11, dur: '9s',  spec: [['s', 10], ['g', 8], ['s', 14], ['g', 26, 'app processing · 46s'], ['s', 12], ['g', 8], ['s', 10]] },
    tutorial: { seed: 23, spec: [['s', 14], ['g', 11], ['s', 16], ['q', 14], ['s', 14], ['q', 8], ['s', 14]] }
  };

  function barHeight(type, r) {
    if (type === 's') return 38 + r() * 54; // speech: tall
    if (type === 'q') return 28 + r() * 14; // quiet: medium
    return 3 + r() * 7;                     // gap: near-flat silence
  }

  function buildWave(el) {
    var cfg = WAVES[el.getAttribute('data-wave')];
    if (!cfg) return;
    var r = seeded(cfg.seed);
    var frag = document.createDocumentFragment();

    cfg.spec.forEach(function (item) {
      var type = item[0], n = item[1], tag = item[2];
      var w = (n * 5) + 'px';
      var isCut = type === 'g';
      var seg = document.createElement('span');
      seg.className = 'wave__seg' + (isCut ? ' wave__seg--cut' : '');
      seg.style.setProperty('--w', w);
      seg.style.width = w;
      if (isCut && cfg.dur) seg.style.setProperty('--anim', 'gpCollapse ' + cfg.dur + ' ease-in-out infinite');

      var bars = document.createElement('span');
      bars.className = 'wave__bars';
      bars.style.width = w;
      for (var i = 0; i < n; i++) {
        var b = document.createElement('span');
        b.className = 'wave__bar';
        b.style.height = Math.max(6, Math.min(100, barHeight(type, r))) + '%';
        bars.appendChild(b);
      }
      seg.appendChild(bars);

      if (isCut) {
        var h = document.createElement('span'); h.className = 'wave__hatch'; seg.appendChild(h);
      } else if (type === 'q') {
        var hb = document.createElement('span'); hb.className = 'wave__hatch wave__hatch--anim'; seg.appendChild(hb);
      }
      if (tag) {
        var t = document.createElement('span'); t.className = 'wave__tag mono'; t.textContent = tag; seg.appendChild(t);
      }
      frag.appendChild(seg);
    });
    el.appendChild(frag);
  }

  Array.prototype.slice.call(document.querySelectorAll('.wave')).forEach(buildWave);
})();

/* ============================================================
   Live release + architecture-aware downloads
   Reads the GitHub Releases API at runtime so the version and the
   DMG links track the latest release with no edits to this site.
   Everything degrades to the hardcoded fallbacks (v0.1.0, the
   releases page) when offline, rate-limited, or pre-release.
   Release assets are named  Gapless-<ver>-macos-arm64-*.dmg
   and  ...-macos-x64-*.dmg  (see the app's package_dmg.sh).
   ============================================================ */
(function () {
  'use strict';

  var APP_REPO = 'navnit/gapless-app';
  var API = 'https://api.github.com/repos/' + APP_REPO + '/releases/latest';
  var CACHE_KEY = 'gapless-release';
  var CACHE_MS = 30 * 60 * 1000; // 30 min
  var ARCH_NAME = { arm64: 'Apple Silicon', x64: 'Intel' };

  function isMac() {
    var p = (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform || navigator.userAgent || '';
    return /mac/i.test(p);
  }

  // Best-effort: 'arm64' | 'x64' | null. Never rejects — a blocked
  // client-hint API (Permissions-Policy on some hosts) must not break downloads.
  function detectArch() {
    return new Promise(function (resolve) {
      try {
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
          navigator.userAgentData.getHighEntropyValues(['architecture']).then(function (h) {
            resolve(h && h.architecture ? (h.architecture === 'arm' ? 'arm64' : 'x64') : webglArch());
          }, function () { resolve(webglArch()); });
          return;
        }
      } catch (e) {}
      resolve(webglArch());
    });
  }
  function webglArch() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      var ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      var r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/apple/i.test(r)) return 'arm64';           // Apple GPU => Apple Silicon
      if (/intel|amd|radeon|nvidia|geforce/i.test(r)) return 'x64';
    } catch (e) {}
    return null;
  }

  function fetchRelease() {
    try {
      var hit = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (hit && (Date.now() - hit.t) < CACHE_MS) return Promise.resolve(hit.d);
    } catch (e) {}
    return fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
        return d;
      })
      .catch(function () { return null; });
  }

  function dmgFor(assets, target) {
    for (var i = 0; i < assets.length; i++) {
      var n = assets[i].name || '';
      if (/\.dmg$/i.test(n) && n.indexOf('macos-' + target) !== -1) return assets[i].browser_download_url;
    }
    return null;
  }

  var archP = Promise.resolve(isMac() ? detectArch() : null).catch(function () { return null; });
  Promise.all([archP, fetchRelease()])
    .then(function (out) {
      var arch = out[0], rel = out[1];
      var downloads = document.querySelectorAll('.js-download');

      // 1) Version string
      if (rel && rel.tag_name) {
        var v = /^v/i.test(rel.tag_name) ? rel.tag_name : 'v' + rel.tag_name;
        Array.prototype.forEach.call(document.querySelectorAll('.js-version'), function (el) { el.textContent = v; });
      }

      // 2) Pick the DMGs
      if (!rel || !rel.assets) return; // keep fallbacks (releases page)
      var dmg = { arm64: dmgFor(rel.assets, 'arm64'), x64: dmgFor(rel.assets, 'x64') };
      var chosen = (arch === 'x64' && dmg.x64) ? 'x64' : (dmg.arm64 ? 'arm64' : (dmg.x64 ? 'x64' : null));
      if (!chosen) return; // no dmg assets — keep fallbacks

      var primaryUrl = dmg[chosen];
      Array.prototype.forEach.call(downloads, function (el) { el.href = primaryUrl; });

      // 3) Hint: which build + link to the other one
      var archEl = document.querySelector('.js-dl-arch');
      if (archEl) { archEl.textContent = ARCH_NAME[chosen] + ' build'; archEl.hidden = false; }
      var other = chosen === 'arm64' ? 'x64' : 'arm64';
      var altEl = document.querySelector('.js-dl-alt');
      if (altEl && dmg[other]) {
        altEl.textContent = 'Get the ' + ARCH_NAME[other] + ' build';
        altEl.href = dmg[other];
        altEl.hidden = false;
      }
    })
    .catch(function () { /* keep the hardcoded fallbacks */ });
})();
