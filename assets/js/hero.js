/* MEHAK hero: scrolling moves a camera through the scene.
   With footage (assets/film/manifest.json -> { "video": { "src", "bytes", "w", "h" } }) the video is
   streamed as a Blob and scrubbed frame by frame onto the canvas. Without footage, the same journey
   is filmed from the hero photograph: the camera starts inside the cut glass and pulls back to the
   whole bottle, with smoke and a sweep of lamp light, so the hero is never a flat picture. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const stage = hero.querySelector('.stage');
  const canvas = hero.querySelector('.scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const ringFg = hero.querySelector('.ring-fg');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const COARSE = matchMedia('(pointer: coarse)').matches;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (p, a, b) => { const t = clamp((p - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let W = 0, H = 0, DPR = 1;
  function size() {
    const r = stage.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
    const nd = Math.min(window.devicePixelRatio || 1, COARSE ? 1.5 : 2);
    if (nw === W && nh === H && nd === DPR) return false;
    W = nw; H = nh; DPR = nd;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    return true;
  }

  /* ---------------- the still: the hero photograph ---------------- */
  const still = new Image();
  let stillReady = false;
  still.decoding = 'async';
  still.onload = () => { stillReady = true; stage.classList.add('painted'); kick(true); };
  still.src = 'assets/img/hero-wide.jpg';

  // the bottle's glass sits at about 44% across and 58% down in this frame
  const FOCUS = { x: .44, y: .6 };

  function drawCover(src, sw, sh, zoom, fx, fy) {
    // cover the canvas, then zoom toward a focus point that drifts to the centre as we pull back
    const s = Math.max(W / sw, H / sh) * zoom;
    const dw = sw * s, dh = sh * s;
    let x = W / 2 - fx * dw, y = H / 2 - fy * dh;
    x = clamp(x, W - dw, 0);
    y = clamp(y, H - dh, 0);
    ctx.drawImage(src, x, y, dw, dh);
  }

  // smoke: a few soft plumes, seeded so every load looks the same
  const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
  const R = rng(4721);
  const PLUMES = Array.from({ length: COARSE ? 5 : 9 }, () => ({
    x: .3 + R() * .5, y: R(), r: .12 + R() * .16, sp: .02 + R() * .03, sway: R() * 6.28, a: .05 + R() * .07
  }));

  function drawSmoke(t, p) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const pl of PLUMES) {
      const y = ((pl.y - t * pl.sp) % 1 + 1) % 1;
      const x = pl.x + Math.sin(t * .6 + pl.sway) * .03;
      const cx = x * W, cy = (1.1 - y * 1.3) * H, rr = pl.r * Math.max(W, H);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      const a = pl.a * (0.55 + .45 * (1 - p));
      g.addColorStop(0, 'rgba(235,210,175,' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(235,210,175,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  }

  function drawSweep(p) {
    // a band of lamp light crosses the glass once, early in the journey
    const s = smooth(p, .08, .5);
    if (s <= 0 || s >= 1) return;
    const x = lerp(-.3, 1.3, s) * W;
    const g = ctx.createLinearGradient(x - W * .18, 0, x + W * .18, H);
    const a = Math.sin(s * Math.PI) * .16;
    g.addColorStop(0, 'rgba(255,214,150,0)');
    g.addColorStop(.5, 'rgba(255,214,150,' + a.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  let posterMode = false;
  function drawStill(p, t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#0E0A07';
    ctx.fillRect(0, 0, W, H);
    if (!stillReady) return;
    if (posterMode) { drawCover(still, still.naturalWidth, still.naturalHeight, 1, .5, .5); return; }
    const e = easeIO(clamp(p / .78, 0, 1));
    // start inside the cut glass, pull back to the whole bottle
    const zoom = lerp(COARSE ? 1.9 : 2.05, 1.04, e) + Math.sin(t * .25) * .006;
    const endX = H > W ? .38 : .5;
    const fx = lerp(FOCUS.x, endX, e), fy = lerp(FOCUS.y, .5, e);
    drawCover(still, still.naturalWidth, still.naturalHeight, zoom, fx, fy);
    drawSweep(p);
    if (!reduced.matches) drawSmoke(t, p);
  }

  /* ---------------- footage, when it exists ---------------- */
  let video = null, vReady = false, vInfo = null, seekBusy = false, pendingT = null;

  function requestSeek(tSec) {
    if (!video || !video.duration) return;
    tSec = clamp(tSec, 0, video.duration - .04);
    if (seekBusy) { pendingT = tSec; return; }
    seekBusy = true;
    try { video.currentTime = tSec; } catch (e) { seekBusy = false; }
  }

  // stream a file into memory as a Blob (seeking then works on any host), filling the ring if asked
  async function fetchBlob(url, bytes, ring) {
    const ctrl = new AbortController();
    let dog = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('video ' + res.status);
    const total = Number(res.headers.get('Content-Length')) || bytes || 1;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      clearTimeout(dog); dog = setTimeout(() => ctrl.abort(), 20000);
      chunks.push(r.value); got += r.value.length;
      if (ring && ringFg) ringFg.style.strokeDashoffset = String(126 * (1 - Math.min(1, got / total)));
    }
    clearTimeout(dog);
    return URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
  }

  function makeVideo(src) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.addEventListener('seeked', () => {
      if (v !== video) return;
      seekBusy = false;
      kick(true);
      if (pendingT !== null) { const t = pendingT; pendingT = null; requestSeek(t); }
    });
    v.addEventListener('error', () => { if (v === video) { seekBusy = false; pendingT = null; } });
    v.src = src;
    return new Promise((ok, bad) => {
      v.addEventListener('loadeddata', () => ok(v), { once: true });
      v.addEventListener('error', bad, { once: true });
    });
  }

  // a light copy gets the film moving within a second or two; the sharp one swaps in when it lands
  async function loadVideo(info) {
    vInfo = info;
    stage.classList.add('loading');
    const first = await fetchBlob(info.lite || info.src, info.lite ? info.liteBytes : info.bytes, true);
    video = await makeVideo(first);
    vReady = true;
    stage.classList.remove('loading');
    requestSeek(shown * video.duration);
    kick(true);
    if (!info.lite) return;
    try {
      const sharpUrl = await fetchBlob(info.src, info.bytes, false);
      const sharp = await makeVideo(sharpUrl);
      await new Promise(done => {
        sharp.addEventListener('seeked', done, { once: true });
        sharp.currentTime = Math.min(shown * sharp.duration, sharp.duration - .04);
      });
      video = sharp;
      seekBusy = false; pendingT = null;
      requestSeek(shown * video.duration);
      kick(true);
    } catch (e) { /* the light copy keeps playing */ }
  }

  function drawVideo() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawCover(video, video.videoWidth, video.videoHeight, 1, .5, .5);
  }

  /* ---------------- caption bands ---------------- */
  const bands = [...hero.querySelectorAll('.band')].map(el => ({
    el, a: +el.dataset.a, b: +el.dataset.b, op: -1, k: -1
  }));

  // split each headline into words once; each word rises with the band's progress
  bands.forEach(B => {
    B.el.querySelectorAll('[data-split]').forEach(h => {
      const text = h.textContent.trim();
      h.setAttribute('aria-label', text);
      h.innerHTML = text.split(' ').map((w, i, arr) =>
        '<span class="w" aria-hidden="true" style="--i:' + (i / Math.max(1, arr.length - 1)).toFixed(3) + '">' + w + '</span>'
      ).join(' ');
    });
  });

  function updateBands(p) {
    for (let i = 0; i < bands.length; i++) {
      const B = bands[i], a = B.a, b = B.b;
      const f = Math.min(.05, (b - a) / 4);
      const inOp = i === 0 ? 1 : smooth(p, a, a + f);
      const outOp = i === bands.length - 1 ? 1 : 1 - smooth(p, b - f, b);
      const op = inOp * outOp;
      const k = i === 0 ? Math.max(loadK, clamp((p - a) / .06, 0, 1)) : clamp((p - a) / Math.min(.1, (b - a) * .45), 0, 1);
      if (Math.abs(op - B.op) > .004) { B.el.style.opacity = op.toFixed(3); B.el.style.visibility = op < .01 ? 'hidden' : 'visible'; B.op = op; }
      if (Math.abs(k - B.k) > .006) { B.el.style.setProperty('--k', k.toFixed(3)); B.k = k; }
    }
  }

  /* ---------------- the loop that rests ---------------- */
  let target = 0, shown = 0, raf = null, last = 0, onScreen = true, loadK = 0, loadT0 = 0, t0 = performance.now(), movedNow = null;

  function progress() {
    const range = hero.offsetHeight - window.innerHeight;
    if (range <= 0) return 0;
    return clamp((window.pageYOffset - hero.offsetTop) / range, 0, 1);
  }

  function frame(now) {
    const dt = Math.min(100, now - (last || now));
    last = now;
    shown += (target - shown) * (1 - Math.pow(1 - .2, dt / 16.667));
    if (loadK < 1) { if (!loadT0) loadT0 = now; loadK = clamp((now - loadT0) / 1100, 0, 1); }
    const t = (now - t0) / 1000;

    if (vReady) { requestSeek(shown * video.duration); drawVideo(); }
    else drawStill(shown, t);
    updateBands(shown);
    const moved = shown > .03;
    if (moved !== movedNow) { stage.classList.toggle('moved', moved); movedNow = moved; }

    // the smoke keeps drifting while the hero is on screen; everything else rests when settled
    const settled = Math.abs(target - shown) < .0004 && loadK >= 1;
    if (onScreen && (!settled || (!vReady && !posterMode && !reduced.matches))) raf = requestAnimationFrame(frame);
    else { raf = null; last = 0; }
  }

  function kick(force) {
    if (force) size();
    if (raf === null && onScreen) raf = requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', () => { target = progress(); kick(); }, { passive: true });
  window.addEventListener('resize', () => { size(); target = progress(); kick(true); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) kick(); }, { rootMargin: '60px' }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(true); });

  size();
  target = shown = progress();
  kick(true);

  // footage is optional: laptops load it if the manifest lists it; phones keep the still film
  // the manifest ships inside the page, so the film does not wait on an extra round trip
  const inline = document.getElementById('film');
  const manifest = inline
    ? Promise.resolve().then(() => JSON.parse(inline.textContent))
    : fetch('assets/film/manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {}));
  manifest
    .then(m => {
      if (!(m && m.video && !COARSE && !reduced.matches)) return;
      if (m.video.poster) { posterMode = true; stillReady = false; still.src = m.video.poster; }
      return loadVideo(m.video);
    })
    .catch(() => { stage.classList.remove('loading'); vReady = false; });
})();
