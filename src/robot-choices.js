const STORAGE_KEY = 'nytc-robot-styles-v1';
const STYLES = ['classic', 'pixel', 'orbit'];
const ROLES = [
  { key: 'scratch', label: 'Scratch Coding' },
  { key: 'arduino', label: 'Arduino Learning' },
  { key: 'games', label: 'Scratch Games' },
];
const DEFAULTS = { scratch: 'pixel', arduino: 'classic', games: 'classic' };
let activeCleanup;

function readChoices() {
  const choices = { ...DEFAULTS };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const { key } of ROLES) {
        if (Object.hasOwn(saved, key) && STYLES.includes(saved[key])) choices[key] = saved[key];
      }
    }
  } catch { /* A private or restricted browser can still use the chooser. */ }
  return choices;
}

function saveChoices(choices) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
    return true;
  } catch {
    return false;
  }
}

export function initRobotChoices() {
  activeCleanup?.();
  const host = document.querySelector('#robot-chooser-host');
  if (!host) return () => {};

  const body = document.body;
  const previous = ROLES.map(({ key }) => [key, body.getAttribute(`data-${key}-style`)]);
  let choices = readChoices();
  const panel = document.createElement('details');
  panel.className = 'robot-chooser';
  panel.innerHTML = `
    <summary>Choose your robots</summary>
    <div class="robot-chooser-content">
      <p class="robot-chooser-copy">Choose a look for each course. All nine robots explore the page. Choices are saved on this device when possible.</p>
      <div class="robot-chooser-groups">
        ${ROLES.map(({ key, label }) => `
          <fieldset class="robot-choice-group">
            <legend>${label}</legend>
            <div class="robot-choice-options">
              ${STYLES.map(style => `
                <label class="robot-choice-option">
                  <span class="robot-choice-preview" data-role="${key}" data-style="${style}" aria-hidden="true"></span>
                  <span class="robot-choice-label">
                    <input type="radio" name="nytc-robot-style-${key}" value="${style}" data-robot-role="${key}">
                    <span>${style[0].toUpperCase() + style.slice(1)}</span>
                  </span>
                </label>
              `).join('')}
            </div>
          </fieldset>
        `).join('')}
      </div>
      <div class="robot-chooser-footer">
        <button class="robot-choice-reset" type="button">Reset looks</button>
        <p class="robot-choice-status" role="status" aria-live="polite" aria-atomic="true"></p>
      </div>
    </div>`;
  host.append(panel);

  const inputs = [...panel.querySelectorAll('input[data-robot-role]')];
  const status = panel.querySelector('.robot-choice-status');
  const reset = panel.querySelector('.robot-choice-reset');
  const summary = panel.querySelector('summary');
  const openers = [...document.querySelectorAll('[data-open-robot-chooser]')];

  function openChooser() {
    panel.open = true;
    summary.focus({ preventScroll: true });
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    summary.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }

  function applyChoices() {
    for (const { key } of ROLES) body.setAttribute(`data-${key}-style`, choices[key]);
    for (const input of inputs) input.checked = choices[input.dataset.robotRole] === input.value;
  }

  function onChange(event) {
    const input = event.target;
    if (!inputs.includes(input) || !input.checked) return;
    const role = ROLES.find(({ key }) => key === input.dataset.robotRole);
    if (!role || !STYLES.includes(input.value)) return;
    choices[role.key] = input.value;
    applyChoices();
    const saved = saveChoices(choices);
    const style = input.value[0].toUpperCase() + input.value.slice(1);
    status.textContent = `${role.label} now uses ${style}.${saved ? ' Saved on this device.' : ' Set for this visit.'}`;
  }

  function onReset() {
    choices = { ...DEFAULTS };
    applyChoices();
    const saved = saveChoices(choices);
    status.textContent = `Robot looks reset.${saved ? ' Saved on this device.' : ' Set for this visit.'}`;
  }

  applyChoices();
  panel.addEventListener('change', onChange);
  reset.addEventListener('click', onReset);
  for (const opener of openers) opener.addEventListener('click', openChooser);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    panel.removeEventListener('change', onChange);
    reset.removeEventListener('click', onReset);
    for (const opener of openers) opener.removeEventListener('click', openChooser);
    panel.remove();
    for (const [key, value] of previous) {
      if (value === null) body.removeAttribute(`data-${key}-style`);
      else body.setAttribute(`data-${key}-style`, value);
    }
    if (activeCleanup === cleanup) activeCleanup = undefined;
  };
  activeCleanup = cleanup;
  return cleanup;
}
