/* negaflow — page behaviour */

(function () {
  'use strict';

  var doc = document.documentElement;
  var I18N = window.NF_I18N;
  var LANG_NAMES = window.NF_LANG_NAMES;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = matchMedia('(pointer: coarse)');

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

    document.title = dict['doc.title'];
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = dict['doc.desc'];

    var now = document.getElementById('langNow');
    if (now) now.textContent = 'Language';
    document.querySelectorAll('#langMenu button').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.lang === lang));
    });

    document.querySelectorAll('.view').forEach(function (v) {
      var img = v.querySelector('.shot');
      var h = v.querySelector('h3');
      if (img && h) img.alt = h.textContent.trim();
    });

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
    return 'assets/shots/' + view + '-' + doc.dataset.lang + '-' + doc.dataset.theme + '.webp';
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

  /* ── boot ───────────────────────────────────────────── */

  applyLang(doc.dataset.lang);
  applyScheme(doc.dataset.scheme);

  var relayout = function () { layoutPill(schemeSeg); };
  addEventListener('resize', relayout);
  addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
})();
