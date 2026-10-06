/* MEHAK: smooth scroll, the pinned chapters, the dial, the finder and the bag.
   Every animated state has a readable resting state, so the page is complete if any script fails. */
(() => {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const PKR = new Intl.NumberFormat('en-PK');
  const money = n => 'Rs ' + PKR.format(n);
  const img = name => new URL('assets/img/' + name + '.jpg', document.baseURI).href;

  $('#yr').textContent = new Date().getFullYear();
  window.__rv = true;

  /* ---------------- header and menu ---------------- */
  const head = $('#head'), burger = $('#burger');
  let solid = null;
  const headTick = () => { const s = window.pageYOffset > 30; if (s !== solid) { head.classList.toggle('solid', s); solid = s; } };
  window.addEventListener('scroll', headTick, { passive: true });
  headTick();
  const closeMenu = () => { head.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); };
  burger.addEventListener('click', () => {
    const open = !head.classList.contains('open');
    head.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('#nav a').forEach(a => a.addEventListener('click', closeMenu));

  /* ---------------- lenis and gsap ---------------- */
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  let lenis = null;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  if (typeof window.Lenis !== 'undefined' && !reduced.matches) {
    lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = t => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }
  const goTo = el => lenis ? lenis.scrollTo(el, { offset: -10 }) : el.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault(); closeMenu(); goTo(el);
  }));

  document.documentElement.classList.add('shown');

  /* ---------------- the hour dial ---------------- */
  const PHASES = [
    { when: 'The first minute', name: 'Bright and close', say: 'The top notes lift first: pepper, citrus, green leaf. Stronger now than it will ever be again, and only for a few minutes.', glow: .25, zoom: 1.18 },
    { when: 'After an hour', name: 'The heart opens', say: 'The flower or the wood you chose comes through. Rose, jasmine, clay, resin. This is the scent people remember.', glow: .55, zoom: 1.1 },
    { when: 'Four hours in', name: 'Warm on the skin', say: 'It sits closer now and smells a little of you. Someone standing next to you still notices it.', glow: .8, zoom: 1.04 },
    { when: 'At night', name: 'Still there', say: 'The base notes: musk, sandalwood, oud. Soft, but there on your wrist and on your collar until the next morning.', glow: 1, zoom: 1 }
  ];
  const range = $('#hourRange'), phaseBox = $('#phase'), hoursImg = $('#hoursImg'), glow = $('#hoursGlow');
  let phaseNow = -1;
  function setPhase(n, fromScroll) {
    n = clamp(Math.round(n), 0, PHASES.length - 1);
    if (n === phaseNow) return;
    phaseNow = n;
    const P = PHASES[n];
    if (!fromScroll || String(range.value) !== String(n)) range.value = n;
    range.style.setProperty('--fill', (n / (PHASES.length - 1) * 100).toFixed(1) + '%');
    phaseBox.classList.add('out');
    setTimeout(() => {
      $('#phaseWhen').textContent = P.when;
      $('#phaseName').textContent = P.name;
      $('#phaseSay').textContent = P.say;
      phaseBox.classList.remove('out');
    }, reduced.matches ? 0 : 220);
    glow.style.opacity = P.glow;
    hoursImg.style.setProperty('--zoom', P.zoom);
  }
  range.addEventListener('input', () => setPhase(+range.value));
  $$('.dial-marks button').forEach(b => b.addEventListener('click', () => setPhase(+b.dataset.hour)));
  setPhase(0);

  /* ---------------- the oils: a row the visitor moves ---------------- */
  (() => {
    const vp = $('#colViewport'), bar = $('#colBar');
    if (!vp) return;
    const step = () => {
      const card = vp.querySelector('.oil');
      return card ? card.getBoundingClientRect().width + 24 : vp.clientWidth * .8;
    };
    const paint = () => {
      const max = vp.scrollWidth - vp.clientWidth;
      const p = max > 0 ? vp.scrollLeft / max : 0;
      bar.style.transform = 'scaleX(' + Math.max(.08, p).toFixed(3) + ')';
      $('#colPrev').disabled = vp.scrollLeft < 8;
      $('#colNext').disabled = vp.scrollLeft > max - 8;
    };
    $('#colPrev').addEventListener('click', () => vp.scrollBy({ left: -step(), behavior: reduced.matches ? 'auto' : 'smooth' }));
    $('#colNext').addEventListener('click', () => vp.scrollBy({ left: step(), behavior: reduced.matches ? 'auto' : 'smooth' }));
    vp.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', paint);
    paint();

    // a mouse can drag the row, like a phone swipes it
    let down = false, x0 = 0, s0 = 0, moved = false;
    vp.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.target.closest('button')) return;
      down = true; moved = false; x0 = e.clientX; s0 = vp.scrollLeft;
      vp.classList.add('dragging');
    });
    window.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - x0;
      if (Math.abs(dx) > 4) moved = true;
      vp.scrollLeft = s0 - dx;
    });
    window.addEventListener('pointerup', () => { down = false; vp.classList.remove('dragging'); });
    vp.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  })();

  /* ---------------- the scent finder ---------------- */
  const PICKS = {
    'day-flowers': { n: 'Gulab', img: 'attar-gulab', price: 4200, why: 'Soft rose with green edges. Light enough for the office, and it still lasts until you get home.' },
    'night-flowers': { n: 'Motia', img: 'motia', price: 4200, why: 'Jasmine on warm sandalwood. It gets richer as the evening goes on.' },
    'day-earth': { n: 'Khus', img: 'khus', price: 3800, why: 'Cool green grass and cedar. The one that feels good in the heat.' },
    'night-earth': { n: 'Mitti', img: 'attar-mitti', price: 3800, why: 'First rain on dry clay. Quiet, grounding, and people will ask what it is.' },
    'day-warm': { n: 'Amber Shaam', img: 'attar-amber', price: 5400, why: 'Saffron and soft resin. Warm without being heavy, so one swipe carries the day.' },
    'night-warm': { n: 'Amber Shaam', img: 'attar-amber', price: 5400, why: 'Saffron, resin and vanilla. Made for cool evenings and weddings.' },
    'day-smoke': { n: 'Mitti', img: 'attar-mitti', price: 3800, why: 'Earthy and dry, with a smoky vetiver base. The daytime way into deeper scents.' },
    'night-smoke': { n: 'Oudh Purana', img: 'attar-oudh', price: 9500, why: 'Real aged oud. Smoke and leather first, then honey and wood for hours.' }
  };
  (() => {
    const form = $('#finderForm'), box = $('#fr'), fImg = $('#frImg'), fName = $('#frName'), fWhy = $('#frWhy'), fAdd = $('#frAdd');
    let t = null;
    form.addEventListener('change', () => {
      const P = PICKS[form.when.value + '-' + form.like.value];
      if (!P) return;
      box.classList.add('out');
      clearTimeout(t);
      t = setTimeout(() => {
        fImg.src = img(P.img);
        fName.textContent = P.n;
        fWhy.textContent = P.why;
        fAdd.textContent = 'Add ' + P.n + ' to bag';
        fAdd.dataset.name = P.n; fAdd.dataset.price = P.price; fAdd.dataset.img = P.img;
        box.classList.remove('out');
      }, reduced.matches ? 0 : 280);
    });
  })();

  /* ---------------- the bag ---------------- */
  (() => {
    const drawer = $('#bag'), backdrop = $('#backdrop'), body = $('#bagBody'), count = $('#bagCount'), total = $('#bagTotal');
    const items = [];
    let lastFocus = null;
    function render() {
      const q = items.reduce((s, it) => s + it.q, 0);
      count.textContent = String(q);
      count.hidden = q === 0;
      total.textContent = money(items.reduce((s, it) => s + it.q * it.price, 0));
      if (!items.length) { body.innerHTML = '<p class="empty">Your bag is empty. The sample set is a good start.</p>'; return; }
      body.innerHTML = '';
      items.forEach((it, n) => {
        const row = document.createElement('div');
        row.className = 'bi';
        row.innerHTML = '<img src="' + img(it.img) + '" alt="" width="52" height="64">' +
          '<div><b>' + it.name + '</b><span>' + money(it.price) + '</span></div>' +
          '<div class="qty"><button type="button" aria-label="One less ' + it.name + '">&minus;</button><b>' + it.q +
          '</b><button type="button" aria-label="One more ' + it.name + '">+</button></div>';
        const [minus, plus] = $$('.qty button', row);
        minus.addEventListener('click', () => { it.q--; if (it.q <= 0) items.splice(n, 1); render(); });
        plus.addEventListener('click', () => { it.q++; render(); });
        body.appendChild(row);
      });
    }
    function open() {
      lastFocus = document.activeElement;
      backdrop.hidden = false;
      requestAnimationFrame(() => backdrop.classList.add('on'));
      drawer.classList.add('on');
      drawer.setAttribute('aria-hidden', 'false');
      if (lenis) lenis.stop();
      $('#bagClose').focus();
    }
    function close() {
      backdrop.classList.remove('on');
      drawer.classList.remove('on');
      drawer.setAttribute('aria-hidden', 'true');
      setTimeout(() => { backdrop.hidden = true; }, 400);
      if (lenis) lenis.start();
      if (lastFocus) lastFocus.focus();
    }
    $('#bagBtn').addEventListener('click', open);
    $('#bagClose').addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('on')) close(); });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      const name = b.dataset.name, price = Number(b.dataset.price || 0), pic = b.dataset.img || 'attar-amber';
      const found = items.find(it => it.name === name);
      if (found) found.q++; else items.push({ name, price, q: 1, img: pic });
      render(); open();
    });
    $('#checkout').addEventListener('click', () => {
      $('#checkoutNote').textContent = items.length ? 'Demo store: this is where the payment step would open.' : 'Add something to the bag first.';
    });
    render();
  })();

  $('#newsForm').addEventListener('submit', e => {
    e.preventDefault();
    const m = $('#newsMail');
    if (!m.reportValidity()) return;
    $('#newsNote').textContent = 'You are on the list. The next batch reaches you first.';
    m.value = '';
  });

  /* ---------------- counters ---------------- */
  function countUp(el) {
    const to = +el.dataset.count;
    if (reduced.matches || !to) { el.textContent = String(to); return; }
    const t0 = performance.now();
    const step = now => {
      const t = clamp((now - t0) / 1200, 0, 1);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); } }), { threshold: .6 });
    $$('[data-count]').forEach(el => io.observe(el));
  }

  /* ---------------- the scroll chapters ---------------- */
  if (!hasGsap || reduced.matches) {
    $$('[data-reveal]').forEach(el => el.classList.add('in'));
    return;
  }

  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 981px)', narrow: '(max-width: 980px)' }, c => {
    const wide = c.conditions.wide;

    // soft entrances everywhere
    $$('[data-reveal]').forEach(el => {
      gsap.fromTo(el, { opacity: 0, y: 50 }, {
        opacity: 1, y: 0, duration: 1.2, ease: 'power4.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
    $$('.craft-head > *, .voices .eyebrow, .voices .h2, .finder .fq > *, .set-copy > *').forEach(el => {
      gsap.from(el, { opacity: 0, y: 36, duration: 1.1, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    // the idea: each word lights up as you read down
    const ideaText = $('.idea-text');
    if (ideaText && typeof window.SplitText !== 'undefined') {
      const sp = SplitText.create(ideaText, { type: 'words', wordsClass: 'iw' });
      gsap.fromTo(sp.words, { opacity: .14 }, {
        opacity: 1, ease: 'none', stagger: .1,
        scrollTrigger: { trigger: ideaText, start: 'top 85%', end: 'bottom 45%', scrub: true }
      });
    }

    // the oils: the cards rise in once, then the row belongs to the visitor
    gsap.from('.oil', { opacity: 0, y: 50, duration: 1.1, ease: 'power4.out', stagger: .08,
      scrollTrigger: { trigger: '.collection', start: 'top 75%', once: true } });

    // on the skin: a gentle entrance only; the dial is the visitor's
    gsap.from(['.hours-media', '.hours-copy'], { opacity: 0, y: 50, duration: 1.2, ease: 'power4.out', stagger: .12,
      scrollTrigger: { trigger: '.hours', start: 'top 75%', once: true } });

    // the craft: a line runs down through the steps
    gsap.fromTo('.steps-line i', { scaleY: 0 }, {
      scaleY: 1, ease: 'none',
      scrollTrigger: { trigger: '.steps', start: 'top 70%', end: 'bottom 60%', scrub: true }
    });

    // gallery: each frame opens upward and the photo settles inside it
    $$('.tile').forEach(t => {
      gsap.fromTo(t, { clipPath: 'inset(100% 0% 0% 0% round 18px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 1.4, ease: 'power4.inOut',
        scrollTrigger: { trigger: t, start: 'top 90%', once: true }
      });
      gsap.fromTo(t.querySelector('img'), { yPercent: -6, scale: 1.16 }, {
        yPercent: 6, scale: 1.02, ease: 'none',
        scrollTrigger: { trigger: t, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    // the sample set: the bottle drifts slowly behind the offer
    gsap.fromTo('.set-bg img', { yPercent: -8, scale: 1.15 }, {
      yPercent: 8, scale: 1.05, ease: 'none',
      scrollTrigger: { trigger: '.set', start: 'top bottom', end: 'bottom top', scrub: true }
    });

    // the footer word rises behind the card
    gsap.fromTo('.foot-word', { yPercent: 40 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true }
    });
  });

  // images arriving late change the layout; measure again once everything is in
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
