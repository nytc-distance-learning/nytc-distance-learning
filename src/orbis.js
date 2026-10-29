let disposeCurrent;

/** Decorative motion only: course text, controls, and destinations stay still. */
export function initOrbisMotion() {
  disposeCurrent?.();
  const body = document.body;
  if (!body) return () => {};

  const hero = document.querySelector('.space-hero');
  const field = hero?.querySelector('.star-field');
  const button = document.querySelector('#ambient-motion-toggle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const cards = [...document.querySelectorAll('.course-card')];
  const intro = hero?.querySelector('.orbis-intro');
  const cleanups = [];
  const createdStars = [];
  const previousHidden = field?.getAttribute('aria-hidden');
  let userPaused = false;
  let disposed = false;

  if (field) {
    field.setAttribute('aria-hidden', 'true');
    const fragment = document.createDocumentFragment();
    let seed = 47;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let index = 0; index < 32; index += 1) {
      const star = document.createElement('span');
      const size = 1 + random() * 2;
      star.className = 'orbis-star';
      Object.assign(star.style, {
        left: `${(random() * 100).toFixed(2)}%`,
        top: `${(random() * 90).toFixed(2)}%`,
        width: `${size.toFixed(2)}px`,
        height: `${size.toFixed(2)}px`,
        animationDuration: `${(4 + random() * 5).toFixed(2)}s`,
        animationDelay: `${(-random() * 8).toFixed(2)}s`,
      });
      fragment.append(star);
      createdStars.push(star);
    }
    field.append(fragment);
  }

  const canTrack = () => !disposed && !userPaused && !reduced.matches && finePointer.matches && !document.hidden;
  const pointerRegions = [
    ...(intro ? [{ region: intro, stages: [...intro.querySelectorAll('.crew-robot')] }] : []),
    ...cards.map(card => ({ region: card, stages: [...card.querySelectorAll('.robot-stage')] })),
  ];
  const trackers = pointerRegions.map(({ region, stages }) => {
    if (!stages.length) return null;
    const robots = stages.map(stage => ({
      stage,
      anchor: stage.closest('.crew-member') || stage.closest('.orbis-card-art') || region,
      rectangle: undefined,
      facing: 1,
      direction: undefined,
      bias: { x: 0, y: 0, roll: 0 },
    }));
    let regionRectangle;
    let frame = 0;
    let point;
    let inView = true;
    let sampledPoint;
    let sampledAt = -Infinity;
    const clear = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      point = undefined;
      sampledPoint = undefined;
      sampledAt = -Infinity;
      robots.forEach(robot => {
        robot.stage.style.transform = '';
        robot.stage.style.scale = '';
        robot.stage.classList.remove('is-pointing');
        robot.stage.removeAttribute('data-robot-direction');
        robot.stage.removeAttribute('data-facing');
        robot.facing = 1;
        robot.direction = undefined;
      });
    };
    const invalidate = () => {
      regionRectangle = undefined;
      robots.forEach(robot => { robot.rectangle = undefined; });
    };
    const clamp = (value, max = 1) => Math.max(-max, Math.min(max, value));
    const paint = () => {
      frame = 0;
      if (!point || !inView || !canTrack()) return clear();
      regionRectangle ||= region.getBoundingClientRect();
      if (!regionRectangle.width || !regionRectangle.height) return clear();
      const travelled = sampledPoint ? Math.hypot(point.x - sampledPoint.x, point.y - sampledPoint.y) : Infinity;
      if (!sampledPoint || (travelled >= 45 && point.time - sampledAt >= 450)) {
        sampledPoint = { x: point.x, y: point.y };
        sampledAt = point.time;
        robots.forEach(robot => {
          robot.bias = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, roll: Math.random() * 6 - 3 };
        });
      }
      robots.forEach(robot => {
        robot.rectangle ||= robot.anchor.getBoundingClientRect();
        const rectangle = robot.rectangle;
        if (!rectangle.width || !rectangle.height) return;
        const xRange = Math.max(48, rectangle.width / 2);
        const yRange = Math.max(48, rectangle.height / 2);
        const x = clamp((point.x - rectangle.left - rectangle.width / 2) / xRange);
        const y = clamp((point.y - rectangle.top - rectangle.height / 2) / yRange);
        const lookX = clamp(x + robot.bias.x * .16);
        const lookY = clamp(y + robot.bias.y * .16);
        // Separate turn thresholds prevent center jitter without leaving a fast crossing stale.
        if (lookX * robot.facing < -.32) robot.facing = lookX < 0 ? -1 : 1;
        if (Math.max(Math.abs(lookX), Math.abs(lookY)) > .16) {
          robot.direction = Math.abs(lookY) > Math.abs(lookX) * 1.12
            ? lookY < 0 ? 'up' : 'down'
            : lookX < 0 ? 'left' : 'right';
        }
        const translateX = clamp(x * 8 + robot.bias.x * 2, 10);
        const translateY = clamp(y * 8 + robot.bias.y * 2, 10);
        const rotateX = clamp(-y * 8 + robot.bias.y * 2, 10);
        const rotateY = clamp(x * 14 + robot.bias.x * 4, 18);
        robot.stage.classList.add('is-pointing');
        robot.stage.style.transform = `perspective(850px) translate3d(${translateX.toFixed(2)}px,${translateY.toFixed(2)}px,0) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${robot.bias.roll.toFixed(2)}deg)`;
        // Independent scale flips artwork immediately; transform transitions do not squash it through zero.
        robot.stage.style.scale = `${robot.facing} 1`;
        robot.stage.dataset.facing = robot.facing < 0 ? 'left' : 'right';
        if (robot.direction) robot.stage.dataset.robotDirection = robot.direction;
      });
    };
    const move = event => {
      if (event.pointerType === 'touch' || !canTrack()) return;
      point = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const enter = event => { invalidate(); move(event); };
    region.addEventListener('pointerenter', enter, { passive: true });
    region.addEventListener('pointermove', move, { passive: true });
    region.addEventListener('pointerleave', clear);
    region.addEventListener('pointercancel', clear);
    cleanups.push(() => {
      region.removeEventListener('pointerenter', enter);
      region.removeEventListener('pointermove', move);
      region.removeEventListener('pointerleave', clear);
      region.removeEventListener('pointercancel', clear);
      clear();
      region.classList.remove('orbis-card-offscreen', 'orbis-crew-offscreen');
    });
    return { region, clear, invalidate, setVisible(value) { inView = value; if (!value) clear(); } };
  }).filter(Boolean);

  const resetPointers = () => trackers.forEach(tracker => tracker.clear());
  const invalidateRects = () => trackers.forEach(tracker => tracker.invalidate());
  const updateState = () => {
    const paused = userPaused || reduced.matches;
    body.classList.toggle('orbis-motion-paused', paused);
    body.classList.toggle('orbis-document-hidden', document.hidden);
    if (paused || document.hidden || !finePointer.matches) resetPointers();
    if (button) {
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', reduced.matches ? 'Ambient motion reduced by your device preference' : paused ? 'Play ambient motion' : 'Pause ambient motion');
      button.disabled = reduced.matches;
      const text = button.querySelector('span');
      if (text) text.textContent = reduced.matches ? 'Reduced motion' : paused ? 'Play motion' : 'Pause motion';
      const icon = button.querySelector('svg, [data-lucide]');
      if (icon) icon.setAttribute('aria-hidden', 'true');
    }
  };
  const toggle = () => { userPaused = !userPaused; updateState(); };
  const keyboard = event => { if (event.key === 'Tab' || event.key.startsWith('Arrow')) resetPointers(); };
  button?.addEventListener('click', toggle);
  reduced.addEventListener('change', updateState);
  finePointer.addEventListener('change', updateState);
  document.addEventListener('visibilitychange', updateState);
  document.addEventListener('keydown', keyboard);
  window.addEventListener('resize', invalidateRects, { passive: true });
  window.addEventListener('scroll', invalidateRects, { passive: true, capture: true });

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const visible = entry.isIntersecting;
      if (entry.target === hero) hero.classList.toggle('orbis-offscreen', !visible);
      else {
        entry.target.classList.toggle(entry.target === intro ? 'orbis-crew-offscreen' : 'orbis-card-offscreen', !visible);
        trackers.find(tracker => tracker.region === entry.target)?.setVisible(visible);
      }
    }
  }, { threshold: .01 }) : null;
  if (hero) observer?.observe(hero);
  trackers.forEach(tracker => observer?.observe(tracker.region));
  updateState();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    button?.removeEventListener('click', toggle);
    reduced.removeEventListener('change', updateState);
    finePointer.removeEventListener('change', updateState);
    document.removeEventListener('visibilitychange', updateState);
    document.removeEventListener('keydown', keyboard);
    window.removeEventListener('resize', invalidateRects);
    window.removeEventListener('scroll', invalidateRects, true);
    cleanups.forEach(cleanup => cleanup());
    createdStars.forEach(star => star.remove());
    if (field) {
      if (previousHidden === null) field.removeAttribute('aria-hidden');
      else field.setAttribute('aria-hidden', previousHidden);
    }
    hero?.classList.remove('orbis-offscreen');
    body.classList.remove('orbis-motion-paused', 'orbis-document-hidden');
    if (disposeCurrent === dispose) disposeCurrent = undefined;
  };
  disposeCurrent = dispose;
  return dispose;
}
