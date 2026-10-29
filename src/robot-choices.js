const STORAGE_KEY = 'nytc-robot-choices-v1';
const defaults = {scratch: 'basic', arduino: 'basic', games: 'basic'};
const robots = {
  scratch: {
    course: 'Scratch Coding',
    basic: {name: 'Classic', description: 'original Scratch learning robot'},
    retro: {name: 'Pixel', description: 'pixel-style Scratch learning robot'},
    halo: {name: 'Orbit', description: 'orbital Scratch learning robot'},
    classic: {name: 'Pip', description: 'round puzzle robot'},
    pixel: {name: 'Byte', description: 'box-shaped arcade robot'},
    orbit: {name: 'Comet', description: 'hovering orbital sphere robot'},
  },
  arduino: {
    course: 'Arduino Learning',
    basic: {name: 'Classic', description: 'original Arduino learning robot'},
    retro: {name: 'Pixel', description: 'pixel-style Arduino learning robot'},
    halo: {name: 'Orbit', description: 'orbital Arduino learning robot'},
    classic: {name: 'Volt', description: 'slender crane robot'},
    pixel: {name: 'Gear', description: 'circuit spider robot'},
    orbit: {name: 'Bolt', description: 'tracked tank robot'},
  },
  games: {
    course: 'Scratch Games',
    basic: {name: 'Classic', description: 'original Scratch Games learning robot'},
    retro: {name: 'Pixel', description: 'pixel-style Scratch Games learning robot'},
    halo: {name: 'Orbit', description: 'orbital Scratch Games learning robot'},
    classic: {name: 'Rover', description: 'four-wheel explorer robot'},
    pixel: {name: 'Rocket', description: 'rocket-shaped robot'},
    orbit: {name: 'Rex', description: 'robot dinosaur'},
  },
};
const validStyle = style => ['basic', 'retro', 'halo', 'classic', 'pixel', 'orbit'].includes(style);

export function initRobotChoices() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { /* Choices remain available when storage is blocked or damaged. */ }
  const selected = Object.fromEntries(Object.entries(defaults).map(([role, fallback]) => [
    role, validStyle(saved?.[role]) ? saved[role] : fallback,
  ]));

  function apply(role, style) {
    if (!robots[role] || !validStyle(style)) return;
    selected[role] = style;
    document.body.dataset[`${role}Style`] = style;
    const robot = robots[role][style];
    const course = robots[role].course;
    document.querySelectorAll(`[data-robot-choices="${role}"] input`).forEach(input => {
      input.checked = input.value === style;
    });
    document.querySelector(`.robot-${role} .robot-stage`)?.setAttribute('aria-label', `${robot.name}: ${robot.description} for ${course}`);
    document.querySelector(`.crew-${role}`)?.setAttribute('aria-label', `${course} with ${robot.name} (${robot.description}). Explore ${course}`);
    document.querySelectorAll(`[data-selected-robot-name="${role}"]`).forEach(label => {
      label.textContent = robot.name;
    });
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selected)); }
    catch { /* Selection still works for this visit without storage. */ }
  }

  const listeners = [];
  for (const role of Object.keys(defaults)) {
    apply(role, selected[role]);
    const fieldset = document.querySelector(`[data-robot-choices="${role}"]`);
    if (!fieldset) continue;
    const change = event => {
      if (!(event.target instanceof HTMLInputElement) || !validStyle(event.target.value)) return;
      apply(role, event.target.value);
      persist();
    };
    fieldset.addEventListener('change', change);
    listeners.push(() => fieldset.removeEventListener('change', change));
  }
  const resetButton = document.querySelector('#robot-looks-reset');
  const reset = () => {
    for (const [role, style] of Object.entries(defaults)) apply(role, style);
    persist();
  };
  resetButton?.addEventListener('click', reset);
  listeners.push(() => resetButton?.removeEventListener('click', reset));
  return () => listeners.forEach(remove => remove());
}
