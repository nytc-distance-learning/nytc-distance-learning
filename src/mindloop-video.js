let disposeCurrent;

/** Native decorative video follows the same motion preference as the robots. */
export function initMindloopVideo() {
  disposeCurrent?.();
  const scene = document.querySelector('.mindloop-scene');
  const video = scene?.querySelector('.mindloop-video');
  const body = document.body;
  if (!scene || !video || !body) return () => {};

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let inView = false;
  let failed = false;
  let sourceLoaded = Boolean(video.getAttribute('src'));
  let pendingPlay = false;
  let playGeneration = 0;
  let motionPaused = body.classList.contains('orbis-motion-paused');

  // Both properties and attributes are needed for inline muted autoplay in Safari.
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.loop = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  const canPlay = () => !disposed && !failed && inView && !document.hidden
    && !reduced.matches && !body.classList.contains('orbis-motion-paused');
  const hideVideo = () => scene.classList.remove('is-playing');
  const pauseVideo = () => {
    playGeneration += 1;
    pendingPlay = false;
    video.pause();
    hideVideo();
  };
  const updateState = () => {
    if (!canPlay()) return pauseVideo();
    if (pendingPlay || !video.paused) return;

    if (!sourceLoaded) {
      const source = video.dataset.src;
      if (!source) return;
      sourceLoaded = true;
      video.src = source;
      video.load();
    }

    const generation = ++playGeneration;
    pendingPlay = true;
    const rejected = () => {
      // Pausing can reject an older play request; it must not disable a later one.
      if (generation !== playGeneration) {
        if (!canPlay()) pauseVideo();
        return;
      }
      pendingPlay = false;
      if (canPlay()) {
        failed = true;
        scene.classList.remove('has-video-frame');
      }
      pauseVideo();
    };
    try {
      Promise.resolve(video.play()).then(() => {
        if (generation === playGeneration) pendingPlay = false;
        // A pending native play request may finish after pause, hide, or cleanup.
        if (!canPlay()) pauseVideo();
      }, rejected);
    } catch {
      rejected();
    }
  };
  const playing = () => {
    if (canPlay()) scene.classList.add('is-playing', 'has-video-frame');
    else pauseVideo();
  };
  const mediaError = () => {
    failed = true;
    scene.classList.remove('has-video-frame');
    pauseVideo();
  };
  video.addEventListener('playing', playing);
  video.addEventListener('pause', hideVideo);
  video.addEventListener('waiting', hideVideo);
  video.addEventListener('ended', hideVideo);
  video.addEventListener('emptied', hideVideo);
  video.addEventListener('error', mediaError);
  document.addEventListener('visibilitychange', updateState);
  if (reduced.addEventListener) reduced.addEventListener('change', updateState);
  else reduced.addListener(updateState);

  // Observe only this body's class attribute, and react only to pause changes.
  const motionObserver = new MutationObserver(() => {
    const paused = body.classList.contains('orbis-motion-paused');
    if (paused === motionPaused) return;
    motionPaused = paused;
    updateState();
  });
  motionObserver.observe(body, { attributes: true, attributeFilter: ['class'] });

  const intersectionObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target !== scene) continue;
        inView = entry.isIntersecting && entry.intersectionRatio >= .01;
        updateState();
      }
    }, { threshold: .01 }) : null;
  const measureVisibility = () => {
    const rect = scene.getBoundingClientRect();
    inView = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
      && rect.top < window.innerHeight && rect.left < window.innerWidth;
    updateState();
  };
  if (intersectionObserver) intersectionObserver.observe(scene);
  else {
    window.addEventListener('scroll', measureVisibility, { passive: true });
    window.addEventListener('resize', measureVisibility, { passive: true });
    measureVisibility();
  }
  updateState();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    intersectionObserver?.disconnect();
    motionObserver.disconnect();
    document.removeEventListener('visibilitychange', updateState);
    if (reduced.removeEventListener) reduced.removeEventListener('change', updateState);
    else reduced.removeListener(updateState);
    window.removeEventListener('scroll', measureVisibility);
    window.removeEventListener('resize', measureVisibility);
    video.removeEventListener('playing', playing);
    video.removeEventListener('pause', hideVideo);
    video.removeEventListener('waiting', hideVideo);
    video.removeEventListener('ended', hideVideo);
    video.removeEventListener('emptied', hideVideo);
    video.removeEventListener('error', mediaError);
    pauseVideo();
    scene.classList.remove('has-video-frame');
    if (disposeCurrent === dispose) disposeCurrent = undefined;
  };
  disposeCurrent = dispose;
  return dispose;
}
