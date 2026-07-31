/* negaflow — page behaviour */

(function () {
  'use strict';

  var doc = document.documentElement;
  var I18N = window.NF_I18N;
  var LANG_NAMES = window.NF_LANG_NAMES;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = matchMedia('(pointer: coarse)');

  /* Prerendered pages live under /<lang>/ and carry data-base, so any path
   * built in JS needs that prefix; the root page leaves it empty. */
  function asset(path) {
    return (doc.dataset.base || '') + path;
  }

  /* ── language ───────────────────────────────────────── */

  function applyLang(lang) {
    var dict = I18N[lang];
    if (!dict) return;

    doc.dataset.lang = lang;
    doc.lang = lang === 'zh' ? 'zh-Hans' : lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.dataset.i18n];
      if (v != null) el.innerHTML = v;
    });

    /* A prerendered page already carries the title and description that belong
     * to it — a topic page has its own — so only the root page rewrites them. */
    if (!doc.dataset.langLocked) {
      document.title = dict['doc.title'];
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.content = dict['doc.desc'];
    }

    document.querySelectorAll('#langMenu button').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.lang === lang));
    });

    /* The root page is one document that switches language in place, so the
     * links that name a page have to follow it. A German visitor reading the
     * root must land on the German page, not the English one. Generated pages
     * are locked to their language and already point at the right place. */
    if (!doc.dataset.langLocked) {
      var dir = lang === 'en' ? '' : lang + '/';
      document.querySelectorAll('a[data-path]').forEach(function (a) {
        a.setAttribute('href', (dir + a.dataset.path) || './');
      });
    }

    document.querySelectorAll('.view').forEach(function (v) {
      var img = v.querySelector('.shot');
      var h = v.querySelector('h3');
      if (img && h) img.alt = h.textContent.trim();
    });

    layoutPill(gmSeg);
    if (syncTarget) syncTarget();
    if (syncLayout) syncLayout();
    refreshShots();
  }

  /* ── appearance ─────────────────────────────────────── */

  var systemDark = matchMedia('(prefers-color-scheme: dark)');

  function applyScheme(scheme) {
    doc.dataset.scheme = scheme;
    doc.dataset.theme =
      scheme === 'dark' || (scheme === 'auto' && systemDark.matches) ? 'dark' : 'light';

    document.querySelectorAll('#scheme button').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.scheme === scheme));
    });
    layoutPill(schemeSeg);
    refreshShots();
  }

  systemDark.addEventListener('change', function () {
    if (doc.dataset.scheme === 'auto') applyScheme('auto');
  });

  /* ── screenshots ────────────────────────────────────── */

  function shotPath(view) {
    return asset('assets/shots/ui/' + view + '/' + doc.dataset.lang + '-' + doc.dataset.theme + '.webp');
  }

  function setShot(img, view) {
    var next = shotPath(view);
    if (img.getAttribute('src') === next) return;
    img.dataset.view = view;
    img.src = next;
    if (!reduce.matches) {
      img.style.animation = 'none';
      void img.offsetWidth;
      img.style.animation = '';
    }
  }

  function refreshShots() {
    document.querySelectorAll('.shot').forEach(function (img) {
      setShot(img, img.dataset.view);
    });
  }

  /* ── screenshot lightbox ────────────────────────────── */

  var lightbox = document.getElementById('shotLightbox');
  var lightboxImage = lightbox.querySelector('.shot-lightbox-image');
  var activeShot = null;
  var lightboxHistoryEntry = false;
  var lightboxAnimation = null;

  function visibleShotRect(shot) {
    var box = shot.getBoundingClientRect();
    if (getComputedStyle(shot).objectFit !== 'contain' || !shot.naturalWidth || !shot.naturalHeight) {
      return box;
    }

    var imageRatio = shot.naturalWidth / shot.naturalHeight;
    var boxRatio = box.width / box.height;
    if (boxRatio > imageRatio) {
      var width = box.height * imageRatio;
      return { left: box.left + (box.width - width) / 2, top: box.top, width: width, height: box.height };
    }

    var height = box.width / imageRatio;
    return { left: box.left, top: box.top + (box.height - height) / 2, width: box.width, height: height };
  }

  function shotTransform(from, to) {
    var dx = from.left + from.width / 2 - (to.left + to.width / 2);
    var dy = from.top + from.height / 2 - (to.top + to.height / 2);
    return 'translate(' + dx + 'px, ' + dy + 'px) scale(' +
      from.width / to.width + ', ' + from.height / to.height + ')';
  }

  function animateShot(opening) {
    if (reduce.matches || !lightboxImage.animate || !activeShot) return null;

    var source = visibleShotRect(activeShot);
    var target = lightboxImage.getBoundingClientRect();
    if (!source.width || !source.height || !target.width || !target.height) return null;

    if (lightboxAnimation) lightboxAnimation.cancel();
    var thumbnailTransform = shotTransform(source, target);
    var thumbnailRadius = getComputedStyle(activeShot).borderRadius;
    var fullRadius = getComputedStyle(lightboxImage).borderRadius;

    lightboxAnimation = lightboxImage.animate(
      opening
        ? [
            { transform: thumbnailTransform, borderRadius: thumbnailRadius },
            { transform: 'none', borderRadius: fullRadius }
          ]
        : [
            { transform: 'none', borderRadius: fullRadius },
            { transform: thumbnailTransform, borderRadius: thumbnailRadius }
          ],
      {
        duration: opening ? 480 : 360,
        easing: opening ? 'cubic-bezier(.32, .72, 0, 1)' : 'cubic-bezier(.4, 0, .2, 1)',
        fill: 'both'
      }
    );
    return lightboxAnimation;
  }

  function finishLightboxClose() {
    lightbox.hidden = true;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxImage.removeAttribute('src');
    lightboxImage.alt = '';
    if (activeShot) activeShot.focus({ preventScroll: true });
    activeShot = null;
    lightboxAnimation = null;
  }

  function closeLightbox(fromHistory) {
    if (lightbox.hidden) return;
    if (!fromHistory && lightboxHistoryEntry) {
      history.back();
      return;
    }

    lightboxHistoryEntry = false;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    var animation = animateShot(false);
    if (animation) animation.finished.then(finishLightboxClose, finishLightboxClose);
    else finishLightboxClose();
  }

  function openLightbox(shot) {
    if (!lightbox.hidden) return;

    activeShot = shot;
    lightboxImage.src = shot.currentSrc || shot.src;
    lightboxImage.alt = shot.alt;
    lightbox.setAttribute('aria-label', shot.alt);
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');

    requestAnimationFrame(function () {
      lightbox.classList.add('is-open');
      animateShot(true);
      lightbox.focus({ preventScroll: true });
    });

    history.pushState(
      Object.assign({}, history.state || {}, { nfShotLightbox: true }),
      '',
      location.href
    );
    lightboxHistoryEntry = true;
  }

  document.querySelectorAll('.shot').forEach(function (shot) {
    shot.tabIndex = 0;
    shot.setAttribute('role', 'button');
    shot.setAttribute('aria-haspopup', 'dialog');
    shot.addEventListener('click', function () { openLightbox(shot); });
    shot.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      openLightbox(shot);
    });
  });

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox(false);
  });
  addEventListener('popstate', function () {
    if (!lightbox.hidden) closeLightbox(true);
  });
  document.addEventListener('keydown', function (e) {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox(false);
    if (e.key === 'Tab') {
      e.preventDefault();
      lightbox.focus();
    }
  });

  /* ── segmented controls ─────────────────────────────── */

  function layoutPill(seg) {
    if (!seg) return;
    var pill = seg.querySelector('.seg-pill');
    var active = seg.querySelector('[aria-checked="true"], [aria-selected="true"]');
    if (!pill || !active) return;
    pill.style.width = active.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + active.offsetLeft + 'px)';
  }

  /* a .cmp-seg can scroll sideways, so keep the active tab in view */
  function keepVisible(button) {
    if (!button) return;
    var seg = button.parentNode;
    if (seg.scrollWidth <= seg.clientWidth) return;
    var left = button.offsetLeft - (seg.clientWidth - button.offsetWidth) / 2;
    if (seg.scrollTo) seg.scrollTo({ left: left, behavior: reduce.matches ? 'auto' : 'smooth' });
    else seg.scrollLeft = left;
  }

  var schemeSeg = document.getElementById('scheme');

  schemeSeg.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    localStorage.setItem('nf-scheme', b.dataset.scheme);
    applyScheme(b.dataset.scheme);
  });

  /* ── language menu ──────────────────────────────────── */

  var langBtn = document.getElementById('langBtn');
  var langMenu = document.getElementById('langMenu');

  function closeMenu() {
    langMenu.hidden = true;
    langBtn.setAttribute('aria-expanded', 'false');
  }

  langBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = langMenu.hidden;
    langMenu.hidden = !open;
    langBtn.setAttribute('aria-expanded', String(open));
  });

  langMenu.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    localStorage.setItem('nf-lang', b.dataset.lang);
    /* every language has its own crawlable URL, so switching navigates there */
    if (b.dataset.href && b.dataset.lang !== doc.dataset.lang) {
      location.assign(b.dataset.href);
      return;
    }
    applyLang(b.dataset.lang);
    closeMenu();
  });

  document.addEventListener('click', function (e) {
    if (!langMenu.hidden && !langMenu.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  /* ── reveal on scroll ───────────────────────────────── */

  var revealables = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window) || reduce.matches) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var group = el.parentElement;
        var peers = group ? Array.prototype.slice.call(group.querySelectorAll(':scope > .reveal')) : [];
        var idx = Math.max(0, peers.indexOf(el));
        el.style.transitionDelay = Math.min(idx * 60, 300) + 'ms';
        el.classList.add('in');
        io.unobserve(el);
        if (el.querySelector('[data-count]')) countUp(el.querySelector('[data-count]'));
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ── counters ───────────────────────────────────────── */

  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';

    var target = parseInt(el.dataset.count, 10);
    var settle = function () { el.textContent = target.toLocaleString(); };

    if (reduce.matches || document.hidden) { settle(); return; }

    var dur = 1100;
    var t0 = performance.now();
    /* rAF is throttled in background tabs — always land on the real number */
    var guard = setTimeout(settle, dur + 400);

    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
      else clearTimeout(guard);
    })(t0);
  }

  /* ── nav state ──────────────────────────────────────── */

  var nav = document.getElementById('nav');
  var lastY = -1;

  function onScroll() {
    var y = window.scrollY;
    if (y === lastY) return;
    lastY = y;
    nav.classList.toggle('scrolled', y > 12);
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── hero tilt ──────────────────────────────────────── */

  var frame = document.getElementById('heroFrame');

  if (frame && !reduce.matches && !coarse.matches) {
    var raf = 0;
    var tick = function () {
      raf = 0;
      var r = frame.getBoundingClientRect();
      var progress = Math.min(1, Math.max(0, 1 - r.top / innerHeight));
      var deg = (1 - progress) * 7;
      frame.style.transform = 'rotateX(' + deg.toFixed(2) + 'deg) translateZ(0)';
    };
    addEventListener('scroll', function () {
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    tick();
  }

  /* ── glass sheen follows the pointer ────────────────── */

  if (!coarse.matches) {
    document.querySelectorAll('.glass').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  /* ── print: layout picker ───────────────────────────── */

  var PRINT_LAYOUTS = ['contact', 'single', 'cyanotype', 'glass', 'gelatin'];

  var plSeg = document.getElementById('plLayouts');
  var syncLayout = null;

  (function initLayouts() {
    var frame = document.getElementById('plFrame');
    var hint = document.getElementById('plHint');
    if (!frame || !plSeg) return;

    var stills = {};
    frame.querySelectorAll('.pl-img').forEach(function (img) {
      stills[img.dataset.layout] = img;
    });

    var current = 'contact';

    syncLayout = function () {
      var dict = I18N[doc.dataset.lang] || I18N.en;
      var copy = dict && dict['print.hint.' + current];
      if (hint && copy != null) hint.innerHTML = copy;
      layoutPill(plSeg);
    };

    function select(id) {
      if (!stills[id]) return;

      plSeg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-selected', String(b.dataset.layout === id));
      });

      Object.keys(stills).forEach(function (key) {
        stills[key].classList.toggle('is-on', key === id);
      });

      current = id;
      syncLayout();
      keepVisible(plSeg.querySelector('[data-layout="' + id + '"]'));
    }

    plSeg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && b.dataset.layout) select(b.dataset.layout);
    });

    plSeg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var i = PRINT_LAYOUTS.indexOf(current);
      var to = PRINT_LAYOUTS[(i + (e.key === 'ArrowRight' ? 1 : PRINT_LAYOUTS.length - 1)) % PRINT_LAYOUTS.length];
      var button = plSeg.querySelector('[data-layout="' + to + '"]');
      if (button) button.focus();
      select(to);
      e.preventDefault();
    });

    syncLayout();
  })();

  /* ── chroma engine: development target picker ───────── */

  /*
   * Five renders of one frame. Only the development target differs, so the
   * stills cross-fade in place instead of sliding or zooming.
   */
  var TARGETS = [
    { id: 'main', i18n: 'target.main' },
    { id: 'hs',   text: 'Noritsu HS-1800' },
    { id: 'sp',   text: 'Fujifilm Frontier SP-3000' },
    { id: 'f135', text: 'Pakon F-135 Plus' },
    { id: 'hr',   text: 'Kodak Professional HR 500 Plus' }
  ];

  var tgSeg = document.getElementById('tgTargets');
  var tgVarSeg = document.getElementById('tgVariants');
  var tgRow = tgVarSeg && tgVarSeg.parentNode;
  var syncTarget = null;

  /*
   * The target picker and the auto-correction control share one line. Label
   * widths change with the language, so the fit is measured rather than
   * guessed: when the pair overflows, the row collapses the second control to
   * its "Auto" button alone and that button becomes a plain on/off toggle.
   */
  function fitTargetRow() {
    if (!tgRow || !tgSeg || !tgVarSeg) return;

    tgRow.classList.remove('is-compact');
    var gap = parseFloat(getComputedStyle(tgRow).columnGap) || 0;
    /* the row is shrink-to-fit, so the space it has to live in is the bar's */
    var room = tgRow.parentNode.clientWidth;
    if (tgSeg.scrollWidth + tgVarSeg.scrollWidth + gap > room) {
      tgRow.classList.add('is-compact');
    }
  }

  function tgCompact() {
    return !!tgRow && tgRow.classList.contains('is-compact');
  }

  (function initTargets() {
    var frame = document.getElementById('tgFrame');
    var code = document.getElementById('tgCode');
    var hint = document.getElementById('tgHint');
    var variantTag = document.getElementById('tgVariantTag');
    if (!frame || !tgSeg) return;

    /* two renders per target: the untouched inversion and the same frame with
       auto colour, levels and tone applied. stills[target][variant] */
    var stills = {};
    frame.querySelectorAll('.tg-img').forEach(function (img) {
      var t = img.dataset.target;
      (stills[t] || (stills[t] = {}))[img.dataset.variant] = img;
    });

    var current = 'main';
    var variant = 'auto';

    function dict() {
      return I18N[doc.dataset.lang] || I18N.en || {};
    }

    function label(id) {
      var t = TARGETS.filter(function (x) { return x.id === id; })[0];
      if (!t) return '';
      if (!t.i18n) return t.text;
      return dict()[t.i18n] || t.text || '';
    }

    syncTarget = function () {
      var d = dict();
      var key = variant === 'auto' ? 'chroma.variant.auto' : 'chroma.variant.original';

      if (code) code.textContent = current.toUpperCase();
      if (variantTag) {
        variantTag.dataset.i18n = key;
        variantTag.textContent = d[key] || (variant === 'auto' ? 'Auto-corrected' : 'Original');
      }
      if (hint) {
        var note = variant === 'auto' ? d['chroma.variant.note'] : '';
        hint.innerHTML = label(current) + (note ? ' · ' + note : '');
      }
      fitTargetRow();
      layoutPill(tgSeg);
      layoutPill(tgVarSeg);
    };

    function show() {
      Object.keys(stills).forEach(function (t) {
        Object.keys(stills[t]).forEach(function (v) {
          stills[t][v].classList.toggle('is-on', t === current && v === variant);
        });
      });
    }

    function select(id) {
      if (!stills[id]) return;

      tgSeg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-selected', String(b.dataset.target === id));
      });

      current = id;
      show();
      syncTarget();
      keepVisible(tgSeg.querySelector('[data-target="' + id + '"]'));
    }

    function selectVariant(v) {
      if (!tgVarSeg || (v !== 'orig' && v !== 'auto')) return;

      tgVarSeg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-selected', String(b.dataset.variant === v));
      });

      variant = v;
      show();
      syncTarget();
    }

    if (tgVarSeg) {
      tgVarSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b || !b.dataset.variant) return;

        /* collapsed to a single button: pressing it flips the state */
        if (tgCompact() && b.dataset.variant === variant) {
          selectVariant(variant === 'auto' ? 'orig' : 'auto');
          return;
        }
        selectVariant(b.dataset.variant);
      });

      tgVarSeg.addEventListener('keydown', function (e) {
        if (tgCompact() && (e.key === ' ' || e.key === 'Enter')) return; /* the click handler toggles */
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        var buttons = Array.prototype.slice.call(tgVarSeg.querySelectorAll('button'))
          .filter(function (b) { return b.offsetParent !== null; });
        var i = buttons.indexOf(document.activeElement);
        if (i < 0) return;
        var to = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
        to.focus();
        selectVariant(to.dataset.variant);
        e.preventDefault();
      });
    }

    tgSeg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b && b.dataset.target) select(b.dataset.target);
    });

    tgSeg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var buttons = Array.prototype.slice.call(tgSeg.querySelectorAll('button'));
      var i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      var to = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      to.focus();
      select(to.dataset.target);
      e.preventDefault();
    });

    syncTarget();
  })();

  /* ── grainmend before / after compare ───────────────── */

  /*
   * All three stills come from the same 2000x1339 frame: the crop and brush
   * shots are the 436x266 region at (1449, 954). Switching in or out of them
   * therefore zooms that region up to full width instead of hard-cutting.
   */
  var GM_ZOOM = 'scale(5.042) translate(-33.35%, -31.18%)';

  var GM_MODES = {
    'auto': {
      before: asset('assets/shots/grainmend/auto-before.webp'),
      after: asset('assets/shots/grainmend/auto-after.webp'),
      crop: false
    },
    'guided-crop': {
      before: asset('assets/shots/grainmend/crop-before.webp'),
      after: asset('assets/shots/grainmend/crop-after.webp'),
      crop: true
    },
    'brush': {
      before: asset('assets/shots/grainmend/brush-before.webp'),
      after: asset('assets/shots/grainmend/brush-after.webp'),
      crop: true
    }
  };

  var gmSeg = document.getElementById('gmModes');

  (function initCompare() {
    var compare = document.getElementById('gmCompare');
    var frame = document.getElementById('gmFrame');
    var zoom = document.getElementById('gmZoom');
    var handle = document.getElementById('gmHandle');
    var before = document.getElementById('gmBefore');
    var after = document.getElementById('gmAfter');
    var hint = document.getElementById('gmHint');
    if (!compare || !frame || !zoom || !handle || !gmSeg) return;

    var pos = 50;
    var mode = 'auto';

    function render() {
      compare.style.setProperty('--gm-pos', pos + '%');
      handle.setAttribute('aria-valuenow', String(Math.round(pos)));
    }

    function setPos(next) {
      pos = Math.max(0, Math.min(100, next));
      render();
    }

    function posFromEvent(e) {
      var box = frame.getBoundingClientRect();
      if (!box.width) return pos;
      return ((e.clientX - box.left) / box.width) * 100;
    }

    /* ── drag: press anywhere on the frame, then drag ── */

    var pointerId = null;

    frame.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      pointerId = e.pointerId;
      compare.classList.add('is-dragging');
      setPos(posFromEvent(e));
      handle.focus({ preventScroll: true });
      if (frame.setPointerCapture) frame.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    frame.addEventListener('pointermove', function (e) {
      if (pointerId !== e.pointerId) return;
      setPos(posFromEvent(e));
      e.preventDefault();
    });

    function endDrag(e) {
      if (pointerId !== e.pointerId) return;
      pointerId = null;
      compare.classList.remove('is-dragging');
      if (frame.releasePointerCapture && frame.hasPointerCapture && frame.hasPointerCapture(e.pointerId)) {
        frame.releasePointerCapture(e.pointerId);
      }
    }

    frame.addEventListener('pointerup', endDrag);
    frame.addEventListener('pointercancel', endDrag);

    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowLeft') setPos(pos - step);
      else if (e.key === 'ArrowRight') setPos(pos + step);
      else if (e.key === 'Home') setPos(0);
      else if (e.key === 'End') setPos(100);
      else return;
      e.preventDefault();
    });

    /* ── mode tabs ── */

    function applyStills(next) {
      before.src = GM_MODES[next].before;
      after.src = GM_MODES[next].after;
      if (hint) hint.hidden = next !== 'auto';
      mode = next;
      setPos(50);
    }

    var swapToken = 0;

    function swap(next) {
      var wasCrop = GM_MODES[mode].crop;
      var nowCrop = GM_MODES[next].crop;
      var token = ++swapToken;
      var spring = 'cubic-bezier(.32, .72, 0, 1)';
      var out, into, outMs, intoMs;

      if (!wasCrop && nowCrop) {              /* zoom in */
        out = [{ transform: 'none', opacity: 1 }, { transform: GM_ZOOM, opacity: 0 }];
        into = [{ opacity: 0 }, { opacity: 1 }];
        outMs = 460; intoMs = 240;
      } else if (wasCrop && !nowCrop) {       /* zoom out */
        out = [{ opacity: 1 }, { opacity: 0 }];
        into = [{ transform: GM_ZOOM, opacity: 0 }, { transform: 'none', opacity: 1 }];
        outMs = 190; intoMs = 500;
      } else {                                /* crop to crop */
        out = [{ opacity: 1 }, { opacity: 0 }];
        into = [{ opacity: 0 }, { opacity: 1 }];
        outMs = 150; intoMs = 220;
      }

      compare.classList.add('is-zooming');
      var leaving = zoom.animate(out, { duration: outMs, easing: spring, fill: 'forwards' });

      leaving.finished.then(function () {
        if (token !== swapToken) return null;
        applyStills(next);
        leaving.cancel();
        return zoom.animate(into, { duration: intoMs, easing: spring }).finished;
      }).then(function () {
        if (token === swapToken) compare.classList.remove('is-zooming');
      }).catch(function () {
        if (token === swapToken) compare.classList.remove('is-zooming');
      });
    }

    function selectMode(next, animate) {
      if (!GM_MODES[next]) return;

      gmSeg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-selected', String(b.dataset.mode === next));
      });
      layoutPill(gmSeg);
      keepVisible(gmSeg.querySelector('[data-mode="' + next + '"]'));

      if (next === mode) return;
      if (animate && !reduce.matches && zoom.animate) swap(next);
      else applyStills(next);
    }

    gmSeg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !b.dataset.mode) return;
      selectMode(b.dataset.mode, true);
    });

    gmSeg.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var buttons = Array.prototype.slice.call(gmSeg.querySelectorAll('button'));
      var i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      var to = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      to.focus();
      selectMode(to.dataset.mode, true);
      e.preventDefault();
    });

    /* warm the other modes so a switch never shows a gap */
    Object.keys(GM_MODES).forEach(function (key) {
      [GM_MODES[key].before, GM_MODES[key].after].forEach(function (src) {
        var img = new Image();
        img.src = src;
      });
    });

    render();
    layoutPill(gmSeg);
  })();

  /* ── boot ───────────────────────────────────────────── */

  function detectLanguage() {
    /* a prerendered page serves one language; the URL wins over the browser */
    if (doc.dataset.langLocked) return doc.dataset.lang;

    var saved = localStorage.getItem('nf-lang');
    if (saved && I18N[saved]) return saved;

    var langs = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ''];

    for (var i = 0; i < langs.length; i++) {
      var code = (langs[i] || '').toLowerCase();
      if (!code) continue;

      if (code.indexOf('ko') === 0) return 'ko';
      if (code.indexOf('ja') === 0) return 'ja';
      if (code.indexOf('zh') === 0) return 'zh';
      if (code.indexOf('fr') === 0) return 'fr';
      if (code.indexOf('de') === 0) return 'de';
      if (code.indexOf('en') === 0) return 'en';
    }

    return doc.dataset.lang || 'en';
  }

  applyLang(detectLanguage());
  applyScheme(doc.dataset.scheme);

  var relayout = function () {
    layoutPill(schemeSeg);
    layoutPill(gmSeg);
    fitTargetRow();
    layoutPill(tgSeg);
    layoutPill(tgVarSeg);
    layoutPill(plSeg);
  };
  addEventListener('resize', relayout);
  addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
})();
