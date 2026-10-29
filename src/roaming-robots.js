let disposeCurrent;

/** Every role/style guide travels in viewport space; all course links stay still. */
export function initRoamingRobots() {
  disposeCurrent?.();
  const body = document.body;
  if (!body || !Element.prototype.animate) return () => {};

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const ambientButton = document.querySelector('#ambient-motion-toggle');
  const picker = document.querySelector('.robot-picker');
  const sources = [...document.querySelectorAll('.crew-robot')].slice(0, 3);
  if (sources.length !== 3 || !ambientButton) return () => {};

  const kinds = ['scratch', 'arduino', 'games'];
  const styles = ['classic', 'pixel', 'orbit'];
  let layer;
  let control;
  let robots = [];
  let bounds;
  let paused = true;
  let disposed = false;
  let pointerSample;
  let pointerAt = 0;
  let pointerRobot = Math.floor(Math.random() * kinds.length * styles.length);
  let pickerMaskFrame = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const transform = point => `translate3d(${point.x.toFixed(2)}px, ${point.y.toFixed(2)}px, 0)`;
  const constrain = point => ({
    x: clamp(point.x, bounds.left, bounds.right),
    y: clamp(point.y, bounds.top, bounds.bottom),
  });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const separated = (a, b) => Math.abs(a.x - b.x) >= bounds.size + 12 || Math.abs(a.y - b.y) >= bounds.size + 12;
  const position = robot => {
    if (!robot.animation) return robot.point;
    const progress = clamp(Number(robot.animation.currentTime || 0) / robot.duration, 0, 1);
    return {
      x: robot.from.x + (robot.target.x - robot.from.x) * progress,
      y: robot.from.y + (robot.target.y - robot.from.y) * progress,
    };
  };

  function measure() {
    const rect = layer.getBoundingClientRect();
    const style = getComputedStyle(layer);
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    const left = parseFloat(style.paddingLeft) || 12;
    const right = parseFloat(style.paddingRight) || 12;
    const top = parseFloat(style.paddingTop) || 12;
    const bottom = parseFloat(style.paddingBottom) || 12;
    const preferred = parseFloat(style.getPropertyValue('--robot-roam-size')) || (width <= 600 ? 60 : 96);
    // Six extra pixels keep the walking bob and tilt inside the safe inset.
    const size = Math.max(20, Math.min(preferred, width - left - right - 12, height - top - bottom - 12));
    layer.style.setProperty('--robot-roam-render-size', `${size}px`);
    bounds = {
      size,
      left: left + 6,
      right: Math.max(left + 6, width - right - size - 6),
      top: top + 6,
      bottom: Math.max(top + 6, height - bottom - size - 6),
    };
  }

  // Keep the crew visible everywhere except behind the selection panel itself.
  function updatePickerMask() {
    if (pickerMaskFrame) cancelAnimationFrame(pickerMaskFrame);
    pickerMaskFrame = 0;
    if (!layer || disposed) return;
    const panel = picker?.getBoundingClientRect();
    const viewport = layer.getBoundingClientRect();
    if (!panel || panel.width <= 0 || panel.height <= 0 || panel.bottom <= viewport.top || panel.top >= viewport.bottom || panel.right <= viewport.left || panel.left >= viewport.right) {
      layer.style.removeProperty('clip-path');
      return;
    }
    const left = clamp(panel.left - viewport.left, 0, viewport.width).toFixed(2);
    const right = clamp(panel.right - viewport.left, 0, viewport.width).toFixed(2);
    const top = clamp(panel.top - viewport.top, 0, viewport.height).toFixed(2);
    const bottom = clamp(panel.bottom - viewport.top, 0, viewport.height).toFixed(2);
    const width = viewport.width.toFixed(2);
    const height = viewport.height.toFixed(2);
    layer.style.clipPath = `path(evenodd, "M0 0H${width}V${height}H0Z M${left} ${top}H${right}V${bottom}H${left}Z")`;
  }

  function schedulePickerMask() {
    if (layer && !disposed && !pickerMaskFrame) pickerMaskFrame = requestAnimationFrame(updatePickerMask);
  }

  function stop(robot) {
    robot.point = position(robot);
    robot.mover.style.transform = transform(robot.point);
    if (robot.animation) {
      robot.animation.onfinish = null;
      robot.animation.cancel();
      robot.animation = null;
    }
    clearTimeout(robot.timer);
    robot.timer = undefined;
    robot.dwell = undefined;
  }

  function destination(robot, near) {
    const occupied = robots.filter(other => other !== robot).flatMap(other => [other.target || other.point, position(other)]);
    let best = constrain(near || robot.point);
    let bestScore = -Infinity;
    const minimumTrip = Math.min(150, Math.hypot(bounds.right - bounds.left, bounds.bottom - bounds.top) * .24);
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const candidate = constrain(near ? {
        x: near.x + (Math.random() - .5) * 220,
        y: near.y + (Math.random() - .5) * 180,
      } : {
        x: bounds.left + Math.random() * (bounds.right - bounds.left),
        y: bounds.top + Math.random() * (bounds.bottom - bounds.top),
      });
      // Long displays use several natural-speed legs rather than a sudden sprint.
      const length = distance(robot.point, candidate);
      const maxLength = robot.speed * 16;
      if (length > maxLength) {
        candidate.x = robot.point.x + (candidate.x - robot.point.x) * maxLength / length;
        candidate.y = robot.point.y + (candidate.y - robot.point.y) * maxLength / length;
      }
      const clearance = occupied.length ? Math.min(...occupied.map(other => Math.max(Math.abs(candidate.x - other.x), Math.abs(candidate.y - other.y)))) : Infinity;
      const farEnough = distance(robot.point, candidate) >= minimumTrip;
      const score = clearance + (farEnough ? bounds.size : 0);
      if (score > bestScore) { best = candidate; bestScore = score; }
      if (farEnough && occupied.every(other => separated(candidate, other))) return candidate;
    }
    // A very small viewport may not fit nine disjoint sprites. Keep every bot in bounds.
    return best;
  }

  function spreadPositions() {
    const placed = [];
    const columns = Math.max(1, Math.min(3, Math.floor((bounds.right - bounds.left) / (bounds.size + 12)) + 1));
    const rows = Math.ceil(robots.length / columns);
    const grid = robots.map((_, index) => ({
      x: bounds.left + (bounds.right - bounds.left) * (columns > 1 ? (index % columns) / (columns - 1) : .5),
      y: bounds.top + (bounds.bottom - bounds.top) * (rows > 1 ? Math.floor(index / columns) / (rows - 1) : .5),
    }));
    robots.forEach(robot => {
      robot.point = constrain(robot.point);
      if (placed.some(other => !separated(robot.point, other.point))) {
        const choices = [...grid].sort((a, b) => distance(robot.point, a) - distance(robot.point, b));
        robot.point = choices.find(candidate => placed.every(other => separated(candidate, other.point))) || choices.reduce((best, candidate) => {
          const clearance = point => Math.min(...placed.map(other => Math.max(Math.abs(point.x - other.point.x), Math.abs(point.y - other.point.y))));
          return clearance(candidate) > clearance(best) ? candidate : best;
        });
      }
      robot.mover.style.transform = transform(robot.point);
      placed.push(robot);
    });
  }

  function schedule(robot, delay) {
    robot.dwell = delay;
    if (paused || disposed) return;
    robot.due = performance.now() + delay;
    robot.timer = window.setTimeout(() => {
      robot.timer = undefined;
      robot.dwell = undefined;
      travel(robot);
    }, delay);
  }

  function travel(robot, near) {
    if (disposed || paused || !layer) return;
    stop(robot);
    robot.from = { ...robot.point };
    robot.target = destination(robot, near);
    const dx = robot.target.x - robot.from.x;
    const dy = robot.target.y - robot.from.y;
    const length = Math.hypot(dx, dy);
    if (length < 2) { schedule(robot, 500); return; }
    robot.duration = clamp(length / robot.speed * 1000, 3000, 16000);
    if (Math.abs(dx) > 8) robot.facing = dx < 0 ? -1 : 1;
    robot.facingNode.style.transform = `scaleX(${robot.facing}) rotate(${(dy / length * 3 * robot.facing).toFixed(2)}deg)`;
    robot.mover.dataset.direction = Math.abs(dy) > Math.abs(dx) ? dy < 0 ? 'up' : 'down' : dx < 0 ? 'left' : 'right';
    robot.mover.classList.add('is-walking');
    robot.animation = robot.mover.animate([
      { transform: transform(robot.from) },
      { transform: transform(robot.target) },
    ], { duration: robot.duration, easing: 'linear', fill: 'forwards' });
    robot.animation.onfinish = () => {
      robot.point = { ...robot.target };
      robot.mover.style.transform = transform(robot.point);
      robot.animation.onfinish = null;
      robot.animation.cancel();
      robot.animation = null;
      robot.mover.classList.remove('is-walking');
      schedule(robot, 120 + Math.random() * 620);
    };
  }

  function mount() {
    layer = document.createElement('div');
    layer.className = 'robot-roam-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('inert', '');
    body.append(layer);
    control = document.createElement('button');
    control.className = 'roam-motion-control';
    control.setAttribute('type', 'button');
    control.addEventListener('click', toggleMotion);
    body.append(control);
    measure();
    robots = sources.flatMap((source, roleIndex) => styles.map((styleName, styleIndex) => {
      const mover = document.createElement('span');
      const facingNode = document.createElement('span');
      const art = document.createElement('span');
      mover.className = `robot-roam-mover robot-roam-${kinds[roleIndex]} robot-roam-style-${styleName}`;
      mover.dataset.robotRole = kinds[roleIndex];
      mover.dataset.robotStyle = styleName;
      facingNode.className = 'robot-roam-facing';
      art.className = 'robot-roam-art';
      facingNode.append(art);
      mover.append(facingNode);
      layer.append(mover);
      const rect = source.getBoundingClientRect();
      const offset = styleIndex === 0 ? 0 : styleIndex === 1 ? -1 : 1;
      const point = constrain({
        x: rect.left + (rect.width - bounds.size) / 2 + offset * bounds.size * .55,
        y: rect.top + (rect.height - bounds.size) / 2 + offset * (bounds.size + 12),
      });
      return { mover, facingNode, point, facing: 1, speed: 50 + Math.random() * 20 };
    }));
    // Variant offsets and a fallback grid separate guides even when anchors are offscreen.
    spreadPositions();
    body.classList.add('robots-roaming');
    updatePickerMask();
  }

  function unmount() {
    if (pickerMaskFrame) cancelAnimationFrame(pickerMaskFrame);
    pickerMaskFrame = 0;
    robots.forEach(stop);
    robots = [];
    layer?.remove();
    layer = undefined;
    control?.removeEventListener('click', toggleMotion);
    control?.remove();
    control = undefined;
    body.classList.remove('robots-roaming');
    paused = true;
    pointerSample = undefined;
  }

  function syncState() {
    if (disposed) return;
    if (reduced.matches) { if (layer) unmount(); return; }
    const fresh = !layer;
    if (fresh) mount();
    const motionPaused = body.classList.contains('orbis-motion-paused') || ambientButton.getAttribute('aria-pressed') === 'true';
    control.setAttribute('aria-pressed', String(motionPaused));
    control.textContent = motionPaused ? 'Play motion' : 'Pause motion';
    control.disabled = ambientButton.disabled;
    const nextPaused = motionPaused || document.hidden;
    if (!fresh && nextPaused === paused) return;
    paused = nextPaused;
    layer.classList.toggle('is-paused', paused);
    pointerSample = undefined;
    robots.forEach(robot => {
      if (paused) {
        robot.animation?.pause();
        if (robot.timer !== undefined) {
          robot.dwell = Math.max(0, robot.due - performance.now());
          clearTimeout(robot.timer);
          robot.timer = undefined;
        }
      } else if (robot.animation) robot.animation.play();
      else if (robot.dwell !== undefined) schedule(robot, robot.dwell);
      else travel(robot);
    });
  }

  function toggleMotion() {
    ambientButton.click();
    syncState();
  }

  function resize() {
    if (!layer || disposed) return;
    robots.forEach(stop);
    measure();
    robots.forEach(robot => {
      robot.point = constrain(robot.point);
      robot.target = undefined;
      robot.mover.classList.remove('is-walking');
    });
    spreadPositions();
    updatePickerMask();
    pointerSample = undefined;
    if (!paused) robots.forEach(robot => travel(robot));
  }

  function pointerMove(event) {
    if (disposed || paused || !layer || !finePointer.matches || event.pointerType && event.pointerType !== 'mouse') return;
    const now = performance.now();
    const point = { x: event.clientX, y: event.clientY };
    if (!pointerSample) { pointerSample = point; pointerAt = now; return; }
    if (now - pointerAt < 900 || distance(point, pointerSample) < 90) return;
    pointerSample = point;
    pointerAt = now;
    const robot = robots[pointerRobot];
    pointerRobot = (pointerRobot + 1) % robots.length;
    travel(robot, { x: point.x - bounds.size / 2, y: point.y - bounds.size / 2 });
  }

  const classObserver = new MutationObserver(syncState);
  classObserver.observe(body, { attributes: true, attributeFilter: ['class'] });
  classObserver.observe(ambientButton, { attributes: true, attributeFilter: ['aria-pressed', 'disabled'] });
  reduced.addEventListener('change', syncState);
  document.addEventListener('visibilitychange', syncState);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', schedulePickerMask, { passive: true });
  window.visualViewport?.addEventListener('resize', resize, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedulePickerMask, { passive: true });
  document.addEventListener('pointermove', pointerMove, { passive: true });

  function dispose() {
    if (disposed) return;
    disposed = true;
    classObserver.disconnect();
    reduced.removeEventListener('change', syncState);
    document.removeEventListener('visibilitychange', syncState);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', schedulePickerMask);
    window.visualViewport?.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('scroll', schedulePickerMask);
    document.removeEventListener('pointermove', pointerMove);
    unmount();
    if (disposeCurrent === dispose) disposeCurrent = undefined;
  }

  disposeCurrent = dispose;
  syncState();
  return dispose;
}
