/* Static illustrative EEG montage for the homepage. Deterministic: same trace on every load. */
(function () {
  const svg = document.getElementById('eeg');
  if (!svg) return;
  const fig = svg.parentElement;
  const NS = 'http://www.w3.org/2000/svg';

  // Bipolar montage: left temporal chain, then two right channels with late spread.
  // post = posterior alpha weight, sz = seizure amplitude, sign = polarity (phase reversal at T3),
  // delay = seconds after onset before the channel is involved.
  const CHANNELS = [
    { label: 'Fp1-F7', post: 0.30, sz: 0.45, sign:  1, delay: 0.6 },
    { label: 'F7-T3',  post: 0.40, sz: 1.00, sign:  1, delay: 0.0 },
    { label: 'T3-T5',  post: 0.65, sz: 0.95, sign: -1, delay: 0.0 },
    { label: 'T5-O1',  post: 1.00, sz: 0.50, sign: -1, delay: 0.4 },
    { label: 'Fp2-F8', post: 0.30, sz: 0.12, sign:  1, delay: 2.2 },
    { label: 'F8-T4',  post: 0.45, sz: 0.18, sign:  1, delay: 2.6 }
  ];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function el(name, attrs, text) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text) n.textContent = text;
    return n;
  }

  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  let lastW = 0;

  function render() {
    const W = Math.round(svg.getBoundingClientRect().width);
    if (!W || W === lastW) return;
    lastW = W;

    const x0 = parseFloat(getComputedStyle(fig).getPropertyValue('--x0')) || 188;
    const narrow = W < 600;
    const chH = narrow ? 30 : 36;
    const top = 30;
    const plotTop = top;
    const plotBottom = top + CHANNELS.length * chH;
    const H = plotBottom + 26;
    const plotW = W - x0;
    const T = Math.min(10, Math.max(4, plotW / 95));
    const pps = plotW / T;
    const onset = T * 0.5;
    const xOn = x0 + onset * pps;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = H + 'px';

    // Event band and one-second grid
    svg.appendChild(el('rect', { class: 'band', x: xOn, y: plotTop - 10, width: x0 + plotW - xOn, height: plotBottom - plotTop + 14 }));
    for (let s = 0; s <= Math.floor(T); s++) {
      const x = x0 + s * pps;
      svg.appendChild(el('line', { class: 'gridline', x1: x, x2: x, y1: plotTop - 10, y2: plotBottom + 4 }));
    }

    const rand = mulberry32(20261020);
    const dx = 0.5;
    const dt = dx / pps;

    CHANNELS.forEach((c, i) => {
      const base = plotTop + (i + 0.5) * chH;
      const fA = 9.4 + rand() * 1.0;
      const pA = rand() * 6.283, pT = rand() * 6.283, pB = rand() * 6.283, pD = rand() * 6.283;
      let noise = 0, szPhase = rand() * 6.283;
      let d = '';

      for (let x = 0, t = 0; x <= plotW; x += dx, t += dt) {
        noise = noise * 0.9 + (rand() - 0.5) * 0.11;

        const tt = t - onset - c.delay;
        let env = 0, sz = 0;
        if (tt > 0) {
          const f = 3.4 + 3.6 * Math.exp(-tt / 2.2);
          szPhase += 6.2832 * f * dt;
          env = smooth(0, 1.6, tt) * (0.55 + 0.45 * Math.min(1, tt / 3)) * c.sz;
          sz = Math.sin(szPhase) + 0.35 * Math.sin(2 * szPhase + 0.6);
        }

        const attenuate = 1 - 0.6 * (c.sz ? env / c.sz : 0);
        const bg =
          0.17 * c.post * attenuate * Math.sin(6.2832 * fA * t + pA) +
          0.07 * Math.sin(6.2832 * 5.6 * t + pT) +
          0.03 * Math.sin(6.2832 * 19.5 * t + pB) +
          0.06 * Math.sin(6.2832 * 0.45 * t + pD) +
          noise;

        const y = base - (bg + 0.68 * c.sign * sz * env) * chH * 0.55;
        d += (x === 0 ? 'M' : 'L') + (x0 + x).toFixed(1) + ' ' + y.toFixed(1);
      }

      svg.appendChild(el('path', { class: 'ch', d }));
      svg.appendChild(el('text', { class: 'ch-label', x: 0, y: base + 4 }, c.label));
    });

    // Onset marker
    svg.appendChild(el('line', { class: 'onset', x1: xOn, x2: xOn, y1: plotTop - 18, y2: plotBottom + 4 }));
    svg.appendChild(el('text', { class: 'onset-label', x: xOn + 6, y: plotTop - 14 }, 'Seizure onset'));

    // One-second scale bar
    const xEnd = x0 + plotW;
    const yS = H - 6;
    svg.appendChild(el('line', { class: 'scale', x1: xEnd - pps, x2: xEnd, y1: yS, y2: yS }));
    svg.appendChild(el('text', { class: 'scale-label', x: xEnd - pps - 8, y: yS + 4, 'text-anchor': 'end' }, '1 s'));
  }

  render();
  let raf;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lastW = 0; render(); });
})();

