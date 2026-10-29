let disposeCurrent;

const MASTER_LIMIT = .06;
const STEP_SECONDS = 60 / 90 / 2;
// Original space-adventure theme in D major. Each note carries its eighth-note
// length, letting the warm bell melody breathe over eight sustained chord bars.
const MELODY = [
  [[66, 2], null, [69, 2], null, [71, 2], null, [69, 2], null],
  [[66, 3], null, null, [64, 1], [62, 4], null, null, null],
  [[62, 2], null, [64, 2], null, [66, 4], null, null, null],
  [[64, 4], null, null, null, [69, 4], null, null, null],
  [[69, 2], null, [71, 2], null, [74, 2], null, [69, 2], null],
  [[66, 2], null, [64, 2], null, [62, 4], null, null, null],
  [[64, 2], null, [66, 2], null, [69, 4], null, null, null],
  [[66, 3], null, null, [64, 1], [62, 4], null, null, null],
];
const BASS = [38, 35, 43, 45, 38, 43, 45, 38];
const HARMONY = [[62, 66], [62, 66], [59, 62], [61, 64], [62, 66], [59, 62], [61, 64], [62, 66]];

/** Quiet synth music; native browser autoplay policy always has the final say. */
export function initRoboticMusic() {
  disposeCurrent?.();
  if (!document.body) return () => {};

  const control = document.createElement('div');
  control.className = 'robot-music-control';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Background music');
  control.innerHTML = `
    <button class="robot-music-toggle" type="button" aria-pressed="false">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>
      <span>Play music</span>
    </button>
    <label class="robot-music-volume" hidden><span>Volume</span><input type="range" min="0" max="100" step="1" value="33" aria-label="Music volume"></label>
    <span class="robot-music-status" role="status" aria-live="polite"></span>`;
  document.body.append(control);

  const button = control.querySelector('button');
  const buttonText = button.querySelector('span');
  const volumeRow = control.querySelector('label');
  const volumeInput = control.querySelector('input');
  const status = control.querySelector('[role="status"]');
  let context;
  let master;
  let desired = true;
  let playing = false;
  let gesturesArmed = false;
  let disposed = false;
  let revision = 0;
  let timer;
  let nextAt = 0;
  let step = 0;
  let volume = .02;
  const voices = new Set();

  function render(message = '') {
    button.setAttribute('aria-pressed', String(playing));
    buttonText.textContent = playing ? 'Mute music' : 'Play music';
    volumeRow.hidden = !playing;
    status.textContent = message;
  }

  function setMaster(value) {
    if (!master || context.state === 'closed') return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(value, context.currentTime, .025);
  }

  function stopNotes() {
    window.clearTimeout(timer);
    timer = undefined;
    setMaster(0);
    for (const voice of voices) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch { /* Already ended. */ }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    voices.clear();
  }

  function note(midi, at, kind = 'melody', length = 2) {
    // The short scheduling horizon normally uses at most five voices.
    if (voices.size >= 12) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const sustained = kind !== 'melody';
    const duration = STEP_SECONDS * length * .94;
    const peak = kind === 'bass' ? .16 : kind === 'harmony' ? .055 : .32;
    const voice = { oscillator, gain };
    oscillator.type = kind === 'harmony' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + (sustained ? .12 : .025));
    if (sustained) gain.gain.linearRampToValueAtTime(peak * .65, at + duration - .18);
    else gain.gain.exponentialRampToValueAtTime(peak * .45, at + .18);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    gain.gain.linearRampToValueAtTime(0, at + duration + .025);
    oscillator.connect(gain);
    gain.connect(master);
    voices.add(voice);
    oscillator.onended = () => {
      voices.delete(voice);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(at);
    oscillator.stop(at + duration + .04);
  }

  function schedule() {
    timer = undefined;
    if (disposed || !playing || !desired || document.hidden || context.state !== 'running') return;
    const now = context.currentTime;
    // A delayed tab must never catch up by emitting a burst of overdue notes.
    if (nextAt < now) nextAt = now + .04;
    let scheduled = 0;
    while (nextAt < now + .3 && scheduled < 4) {
      const bar = Math.floor(step / 8);
      const beat = step % 8;
      const melody = MELODY[bar][beat];
      if (melody !== null) note(melody[0], nextAt, 'melody', melody[1]);
      if (beat === 0) {
        note(BASS[bar], nextAt, 'bass', 8);
        for (const pitch of HARMONY[bar]) note(pitch, nextAt, 'harmony', 8);
      }
      step = (step + 1) % 64;
      nextAt += STEP_SECONDS;
      scheduled += 1;
    }
    timer = window.setTimeout(schedule, 120);
  }

  function armGestures() {
    if (gesturesArmed || disposed || !desired) return;
    gesturesArmed = true;
    window.addEventListener('pointerdown', onFirstGesture, true);
    window.addEventListener('touchend', onFirstGesture, true);
    window.addEventListener('keydown', onFirstGesture, true);
  }

  function disarmGestures() {
    gesturesArmed = false;
    window.removeEventListener('pointerdown', onFirstGesture, true);
    window.removeEventListener('touchend', onFirstGesture, true);
    window.removeEventListener('keydown', onFirstGesture, true);
  }

  function startPlaying() {
    if (disposed || playing || !desired || document.hidden || context.state !== 'running') return;
    playing = true;
    disarmGestures();
    setMaster(volume);
    nextAt = context.currentTime + .04;
    schedule();
    render('Music is playing.');
  }

  function blocked(ticket) {
    if (disposed || ticket !== revision || !desired) return;
    if (context?.state === 'running' && !document.hidden) { startPlaying(); return; }
    playing = false;
    stopNotes();
    render('Select Play music to start background music.');
    armGestures();
  }

  async function resume(ticket) {
    const current = context;
    try {
      await current.resume();
      if (disposed) {
        if (current.state !== 'closed') void current.close().catch(() => {});
        return;
      }
      if (!desired || document.hidden) {
        if (current.state !== 'closed') void current.suspend().catch(() => {});
        return;
      }
      if (ticket !== revision || current !== context) return;
      if (current.state === 'running') startPlaying();
      else blocked(ticket);
    } catch {
      blocked(ticket);
    }
  }

  function suspend() {
    playing = false;
    stopNotes();
    if (context && context.state !== 'closed') void context.suspend().catch(() => {});
  }

  function onStateChange() {
    if (disposed) return;
    if (context.state === 'running') {
      if (!desired || document.hidden) suspend();
      else startPlaying();
    } else {
      playing = false;
      stopNotes();
      render();
      if (desired && !document.hidden) armGestures();
    }
  }

  function attemptPlayback() {
    const ticket = ++revision;
    armGestures();
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { blocked(ticket); return; }
        context?.removeEventListener('statechange', onStateChange);
        context = new AudioContext();
        master = context.createGain();
        master.gain.setValueAtTime(0, context.currentTime);
        master.connect(context.destination);
        context.addEventListener('statechange', onStateChange);
      }
      if (document.hidden) { suspend(); return; }
      void resume(ticket);
    } catch {
      blocked(ticket);
    }
  }

  function onToggle() {
    if (playing) {
      desired = false;
      revision += 1;
      disarmGestures();
      suspend();
      render('Music is muted.');
    } else {
      desired = true;
      attemptPlayback();
    }
  }

  function onFirstGesture(event) {
    if (!event.isTrusted || event.repeat || disposed || !desired || playing || document.hidden) return;
    // This control has its own click action; avoid a pointerdown/click double toggle.
    if (event.target?.closest?.('.robot-music-control')) return;
    attemptPlayback();
  }

  function onVolume() {
    const percent = Math.max(0, Math.min(100, Number(volumeInput.value) || 0));
    volume = percent / 100 * MASTER_LIMIT;
    if (playing && !document.hidden) setMaster(volume);
  }

  function onVisibility() {
    revision += 1;
    if (!desired) return;
    if (document.hidden) {
      suspend();
      render('Music is paused while this page is in the background.');
    } else if (context) {
      attemptPlayback();
    }
  }

  button.addEventListener('click', onToggle);
  volumeInput.addEventListener('input', onVolume);
  document.addEventListener('visibilitychange', onVisibility);

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    desired = false;
    revision += 1;
    stopNotes();
    disarmGestures();
    button.removeEventListener('click', onToggle);
    volumeInput.removeEventListener('input', onVolume);
    document.removeEventListener('visibilitychange', onVisibility);
    if (context) {
      context.removeEventListener('statechange', onStateChange);
      master?.disconnect();
      if (context.state !== 'closed') void context.close().catch(() => {});
    }
    control.remove();
    if (disposeCurrent === cleanup) disposeCurrent = undefined;
  };
  disposeCurrent = cleanup;
  // The user requested autoplay. A pending/rejected resume stays silent and
  // listens for a real visitor gesture, without trying to bypass browser policy.
  attemptPlayback();
  return cleanup;
}
