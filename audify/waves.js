(() => {
  const configs = [
    { amp: 46, freq: 1.55, speed: 0.00062, phase: 0.0, y: 132 },
    { amp: 36, freq: 1.85, speed: -0.00050, phase: 1.1, y: 126 },
    { amp: 27, freq: 2.15, speed: 0.00072, phase: 2.2, y: 140 },
    { amp: 58, freq: 1.30, speed: -0.00039, phase: 3.0, y: 118 }
  ];

  function makePath(time, cfg) {
    const width = 1600;
    const left = -120;
    const right = 1720;
    const step = 55;
    let d = '';
    for (let x = left, i = 0; x <= right; x += step, i++) {
      const p = x / width;
      const envelope = 0.62 + 0.38 * Math.sin(Math.PI * Math.max(0, Math.min(1, p)));
      const primary = Math.sin((p * Math.PI * 2 * cfg.freq) + cfg.phase + time * cfg.speed);
      const secondary = Math.sin((p * Math.PI * 5.2) - cfg.phase * 0.7 + time * cfg.speed * 0.53) * 0.24;
      const y = cfg.y + (primary + secondary) * cfg.amp * envelope;
      d += `${i === 0 ? 'M' : ' L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }

  function frame(t) {
    const nowPlaying = document.querySelector('#nowPlaying');
    if (nowPlaying && nowPlaying.classList.contains('playing')) {
      const paths = document.querySelectorAll('#waves .wave path');
      paths.forEach((path, i) => {
        const cfg = configs[i % configs.length];
        path.setAttribute('d', makePath(t, cfg));
      });
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
