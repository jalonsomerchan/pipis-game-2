import '../css/main.css';
import bigHenSheet from '../assets/game-sprites/big-hen/sheet-transparent.png';
import chickSheet from '../assets/game-sprites/chick/sheet-transparent.png';
import eggSheet from '../assets/game-sprites/egg/sheet-transparent.png';
import elderHenSheet from '../assets/game-sprites/elder-hen/sheet-transparent.png';
import foxRunSheet from '../assets/game-sprites/fox-run/sheet-transparent.png';
import henSheet from '../assets/game-sprites/hen/sheet-transparent.png';
import henMascotSprite from '../assets/game-sprites/hen-mascot/clean.png';
import queenHenSheet from '../assets/game-sprites/queen-hen/sheet-transparent.png';

const app = document.querySelector('#app');
const STORAGE_KEY = 'corral-gallinas-records-v1';

const EVOLUTION_CHAIN = [
  { key: 'egg', label: 'Huevo', badge: 'E', score: 5, accent: '#fff3d1', sprite: eggSheet },
  { key: 'chick', label: 'Pollito', badge: 'P', score: 12, accent: '#ffe066', sprite: chickSheet },
  { key: 'hen', label: 'Gallina', badge: 'G', score: 30, accent: '#ffd7a2', sprite: henSheet },
  { key: 'bigHen', label: 'Gallina grande', badge: 'GG', score: 65, accent: '#ffb870', sprite: bigHenSheet },
  { key: 'queen', label: 'Gallina reina', badge: 'R', score: 140, accent: '#ffd36e', sprite: queenHenSheet },
  { key: 'elder', label: 'Gallina anciana', badge: 'A', score: 300, accent: '#d7dbe8', sprite: elderHenSheet },
];

const COLOR_VARIANTS = [
  { key: 'white', label: 'Blanco', shell: '#f7f2df', stroke: '#cfbea0', comb: '#d94b5a', row: 0 },
  { key: 'brown', label: 'Marron', shell: '#a8673f', stroke: '#724326', comb: '#d0414f', row: 1 },
  { key: 'black', label: 'Negro', shell: '#36343f', stroke: '#18161d', comb: '#d14d5a', row: 2 },
  { key: 'gray', label: 'Gris', shell: '#8e98aa', stroke: '#5c6370', comb: '#cb5660', row: 3 },
];

const MODES = {
  endless: {
    key: 'endless',
    label: 'Infinito',
    summary: 'Sin limite de espacio. Juegas para ver hasta donde llega tu corral.',
    cap: Infinity,
    warningSeconds: null,
  },
  fill: {
    key: 'fill',
    label: 'Hasta llenar el corral',
    summary: 'Maximo 24 animales. Si llegas a 24, tendras 10 segundos para fusionar o pierdes.',
    cap: 24,
    warningSeconds: 10,
  },
};

const state = {
  screen: 'menu',
  selectedMode: null,
  items: [],
  selectedId: null,
  score: 0,
  merges: 0,
  bestStage: 0,
  timeLeft: null,
  fox: null,
  foxEscaped: 0,
  running: false,
  nextId: 1,
  spawnHandle: null,
  foxHandle: null,
  tickerHandle: null,
  warningStartedAt: null,
  message: 'Une dos animales del mismo color y la misma etapa.',
  aboutOpen: false,
  gameOver: null,
  rope: null,
  effects: [],
  paused: false,
  pausedAt: null,
  foxPausedLeft: null,
  warningPausedLeft: null,
  combo: 0,
  comboUntil: null,
  records: loadRecords(),
};

function loadRecords() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return {};
    }
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function saveRecords() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  } catch {
    // Storage may be unavailable in private browsing; the run should still work.
  }
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomPosition() {
  return {
    x: 8 + Math.random() * 78,
    y: 18 + Math.random() * 66,
  };
}

function movementFor(level) {
  if (level === 0) {
    return { vx: 0, vy: 0 };
  }

  const speed = 0.22 + Math.min(level, 5) * 0.045;
  const angle = Math.random() * Math.PI * 2;
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

function createAnimal(level = 0, colorKey = randomFrom(COLOR_VARIANTS).key, position = randomPosition()) {
  const velocity = movementFor(level);
  return {
    id: state.nextId++,
    level,
    colorKey,
    x: position.x,
    y: position.y,
    vx: velocity.vx,
    vy: velocity.vy,
    bornAt: performance.now(),
  };
}

function getColor(colorKey) {
  return COLOR_VARIANTS.find((variant) => variant.key === colorKey) ?? COLOR_VARIANTS[0];
}

function getStage(level) {
  return EVOLUTION_CHAIN[Math.min(level, EVOLUTION_CHAIN.length - 1)];
}

function spriteRowPosition(color) {
  return `${color.row * 33.3333}%`;
}

function currentMode() {
  return state.selectedMode ? MODES[state.selectedMode] : null;
}

function currentRecord() {
  if (!state.selectedMode) {
    return 0;
  }
  return state.records[state.selectedMode]?.score ?? 0;
}

function updateRecordIfNeeded() {
  if (!state.selectedMode || state.score <= currentRecord()) {
    return false;
  }

  state.records[state.selectedMode] = {
    score: state.score,
    merges: state.merges,
    bestStage: state.bestStage,
    savedAt: new Date().toISOString(),
  };
  saveRecords();
  return true;
}

function startGame(modeKey) {
  clearLoopHandles();
  state.screen = 'game';
  state.selectedMode = modeKey;
  state.items = [
    createAnimal(0, 'white'),
    createAnimal(0, 'brown'),
    createAnimal(1, 'gray'),
    createAnimal(2, 'white'),
  ];
  state.selectedId = null;
  state.score = 0;
  state.merges = 0;
  state.bestStage = 2;
  state.timeLeft = null;
  state.fox = null;
  state.foxEscaped = 0;
  state.running = true;
  state.warningStartedAt = null;
  state.message = 'Han salido las primeras gallinas. Junta iguales para hacerlas crecer.';
  state.gameOver = null;
  state.rope = null;
  state.effects = [];
  state.paused = false;
  state.pausedAt = null;
  state.foxPausedLeft = null;
  state.warningPausedLeft = null;
  state.combo = 0;
  state.comboUntil = null;
  scheduleSpawn();
  scheduleFox();
  state.tickerHandle = window.setInterval(tick, 80);
  render();
}

function clearLoopHandles() {
  if (state.spawnHandle) {
    window.clearTimeout(state.spawnHandle);
  }
  if (state.foxHandle) {
    window.clearTimeout(state.foxHandle);
  }
  if (state.tickerHandle) {
    window.clearInterval(state.tickerHandle);
  }
  state.spawnHandle = null;
  state.foxHandle = null;
  state.tickerHandle = null;
}

function scheduleSpawn() {
  if (!state.running || state.paused) {
    return;
  }
  const delay = 1500 + Math.random() * 1800;
  state.spawnHandle = window.setTimeout(() => {
    spawnEgg();
    scheduleSpawn();
  }, delay);
}

function scheduleFox() {
  if (!state.running || state.paused) {
    return;
  }
  const delay = 8500 + Math.random() * 6500;
  state.foxHandle = window.setTimeout(() => {
    summonFox();
  }, delay);
}

function spawnEgg() {
  const mode = currentMode();
  if (!mode || !state.running) {
    return;
  }
  if (state.items.length >= mode.cap) {
    if (mode.cap !== Infinity) {
      state.message = 'El corral esta a rebosar. Fusiona rapido para hacer sitio.';
      syncWarningState();
      render();
    }
    return;
  }
  const egg = createAnimal(0);
  state.items.push(egg);
  state.message = `Ha aparecido un huevo ${getColor(egg.colorKey).label.toLowerCase()}.`;
  syncWarningState();
  render();
}

function summonFox() {
  if (!state.running) {
    return;
  }
  if (state.fox) {
    resolveFoxSteal();
    return;
  }
  state.fox = {
    enteredAt: performance.now(),
    leaveAt: performance.now() + 4800,
    top: 18 + Math.random() * 55,
    left: 8 + Math.random() * 72,
  };
  state.message = 'Un zorro ha entrado en el establo. Haz clic sobre el para espantarlo.';
  render();
}

function scareFox() {
  if (!state.fox || !state.running) {
    return;
  }
  state.fox = null;
  state.score += 20;
  updateRecordIfNeeded();
  state.message = 'Has espantado al zorro. El corral respira tranquilo un momento.';
  scheduleFox();
  render();
}

function resolveFoxSteal() {
  const stealable = state.items.filter((item) => item.level >= 2);
  if (stealable.length > 0) {
    const victim = randomFrom(stealable);
    state.items = state.items.filter((item) => item.id !== victim.id);
    state.foxEscaped += 1;
    state.selectedId = state.selectedId === victim.id ? null : state.selectedId;
    state.message = `El zorro se ha llevado una ${getStage(victim.level).label.toLowerCase()} ${getColor(victim.colorKey).label.toLowerCase()}.`;
  } else {
    state.message = 'El zorro no ha encontrado ninguna gallina que robar y se ha marchado.';
  }
  state.fox = null;
  syncWarningState();
  scheduleFox();
  render();
}

function tick() {
  if (!state.running || state.paused) {
    return;
  }

  updateAnimalMovement();
  const effectsChanged = cleanupTemporaryEffects();
  syncComboState();

  if (state.fox && performance.now() >= state.fox.leaveAt) {
    resolveFoxSteal();
    return;
  }

  syncWarningState();
  if (effectsChanged) {
    render();
    return;
  }

  updateSceneActors();
  renderHudOnly();
}

function syncComboState() {
  if (state.comboUntil && performance.now() > state.comboUntil) {
    state.combo = 0;
    state.comboUntil = null;
  }
}

function updateAnimalMovement() {
  state.items = state.items.map((item) => {
    if (item.level === 0) {
      return item;
    }

    let nextX = item.x + item.vx;
    let nextY = item.y + item.vy;
    let nextVx = item.vx;
    let nextVy = item.vy;

    if (nextX < 5 || nextX > 88) {
      nextVx *= -1;
      nextX = Math.max(5, Math.min(88, nextX));
    }

    if (nextY < 17 || nextY > 80) {
      nextVy *= -1;
      nextY = Math.max(17, Math.min(80, nextY));
    }

    if (Math.random() < 0.012) {
      const turn = (Math.random() - 0.5) * 0.22;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const vx = nextVx * cos - nextVy * sin;
      const vy = nextVx * sin + nextVy * cos;
      nextVx = vx;
      nextVy = vy;
    }

    return {
      ...item,
      x: nextX,
      y: nextY,
      vx: nextVx,
      vy: nextVy,
    };
  });
}

function cleanupTemporaryEffects() {
  const now = performance.now();
  let changed = false;
  if (state.rope && state.rope.until <= now) {
    state.rope = null;
    changed = true;
  }
  const nextEffects = state.effects.filter((effect) => effect.until > now);
  if (nextEffects.length !== state.effects.length) {
    state.effects = nextEffects;
    changed = true;
  }
  return changed;
}

function updateSceneActors() {
  state.items.forEach((item) => {
    const node = document.querySelector(`[data-animal-id="${item.id}"]`);
    if (!node) {
      return;
    }
    node.style.left = `${item.x}%`;
    node.style.top = `${item.y}%`;
    node.classList.toggle('coop__animal--left', item.vx < 0);
  });
}

function syncWarningState() {
  const mode = currentMode();
  if (!mode || mode.cap === Infinity || mode.warningSeconds === null) {
    state.warningStartedAt = null;
    state.timeLeft = null;
    return;
  }

  if (state.items.length < mode.cap) {
    state.warningStartedAt = null;
    state.timeLeft = null;
    return;
  }

  if (!state.warningStartedAt) {
    state.warningStartedAt = performance.now();
  }

  const elapsed = (performance.now() - state.warningStartedAt) / 1000;
  const left = Math.max(0, mode.warningSeconds - elapsed);
  state.timeLeft = left;

  if (left <= 0) {
    endGame('El corral se ha llenado y no has conseguido unir gallinas a tiempo.');
  }
}

function endGame(reason) {
  state.running = false;
  updateRecordIfNeeded();
  state.gameOver = reason;
  state.screen = 'gameover';
  state.fox = null;
  state.rope = null;
  state.effects = [];
  state.paused = false;
  clearLoopHandles();
  render();
}

function pauseGame() {
  if (!state.running || state.paused) {
    return;
  }

  state.paused = true;
  state.pausedAt = performance.now();
  state.foxPausedLeft = state.fox ? Math.max(0, state.fox.leaveAt - state.pausedAt) : null;
  state.warningPausedLeft = state.timeLeft;
  clearLoopHandles();
  state.message = 'Partida en pausa.';
  render();
}

function resumeGame() {
  if (!state.running || !state.paused) {
    return;
  }

  const now = performance.now();
  const mode = currentMode();
  if (state.fox && state.foxPausedLeft !== null) {
    state.fox.leaveAt = now + state.foxPausedLeft;
  }
  if (mode?.warningSeconds && state.warningPausedLeft !== null) {
    state.warningStartedAt = now - (mode.warningSeconds - state.warningPausedLeft) * 1000;
  }

  state.paused = false;
  state.pausedAt = null;
  state.foxPausedLeft = null;
  state.warningPausedLeft = null;
  state.message = 'La partida continua.';
  scheduleSpawn();
  scheduleFox();
  state.tickerHandle = window.setInterval(tick, 80);
  render();
}

function togglePause() {
  if (state.paused) {
    resumeGame();
  } else {
    pauseGame();
  }
}

function chooseAnimal(id) {
  if (!state.running) {
    return;
  }
  const item = state.items.find((animal) => animal.id === id);
  if (!item) {
    return;
  }

  if (state.selectedId === id) {
    state.selectedId = null;
    state.rope = null;
    state.message = 'Seleccion cancelada.';
    render();
    return;
  }

  if (state.selectedId === null) {
    state.selectedId = id;
    state.message = `Has elegido ${describeAnimal(item)}. Busca su pareja.`;
    render();
    return;
  }

  const first = state.items.find((animal) => animal.id === state.selectedId);
  if (!first) {
    state.selectedId = id;
    render();
    return;
  }

  showRope(first, item, canMerge(first, item));

  if (canMerge(first, item)) {
    mergeAnimals(first.id, item.id);
    return;
  }

  state.selectedId = id;
  state.message = 'Solo puedes unir animales de la misma etapa y del mismo color.';
  render();
}

function canMerge(a, b) {
  return a.id !== b.id && a.colorKey === b.colorKey && a.level === b.level && a.level < EVOLUTION_CHAIN.length - 1;
}

function showRope(from, to, isValid) {
  state.rope = {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    valid: isValid,
    until: performance.now() + (isValid ? 700 : 420),
  };
}

function mergeAnimals(firstId, secondId) {
  const first = state.items.find((animal) => animal.id === firstId);
  const second = state.items.find((animal) => animal.id === secondId);

  if (!first || !second || !canMerge(first, second)) {
    state.message = 'Esa combinacion no es valida.';
    state.selectedId = null;
    render();
    return;
  }

  const midpoint = {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
  const upgraded = createAnimal(first.level + 1, first.colorKey, midpoint);
  state.items = state.items.filter((animal) => animal.id !== firstId && animal.id !== secondId);
  state.items.unshift(upgraded);
  state.selectedId = null;
  const now = performance.now();
  state.combo = state.comboUntil && now < state.comboUntil ? state.combo + 1 : 1;
  state.comboUntil = now + 3600;
  const comboBonus = Math.max(0, state.combo - 1) * 8;
  state.score += getStage(upgraded.level).score + comboBonus;
  state.merges += 1;
  state.bestStage = Math.max(state.bestStage, upgraded.level);
  updateRecordIfNeeded();
  state.effects.push({
    id: `merge-${upgraded.id}-${Date.now()}`,
    x: midpoint.x,
    y: midpoint.y,
    colorKey: upgraded.colorKey,
    label: getStage(upgraded.level).label,
    until: performance.now() + 820,
  });
  state.message = `${describeAnimal(first)} y ${describeAnimal(second)} se convierten en ${describeAnimal(upgraded)}${comboBonus ? ` con combo +${comboBonus}` : ''}.`;
  syncWarningState();
  render();
}

function describeAnimal(item) {
  return `${getStage(item.level).label.toLowerCase()} ${getColor(item.colorKey).label.toLowerCase()}`;
}

function goToMenu() {
  updateRecordIfNeeded();
  clearLoopHandles();
  state.running = false;
  state.screen = 'menu';
  state.selectedMode = null;
  state.selectedId = null;
  state.fox = null;
  state.warningStartedAt = null;
  state.timeLeft = null;
  state.rope = null;
  state.effects = [];
  state.paused = false;
  render();
}

function openAbout() {
  state.screen = 'about';
  render();
}

function openModeSelect() {
  state.screen = 'mode-select';
  render();
}

function renderHudOnly() {
  const score = document.querySelector('[data-ui="score"]');
  const merges = document.querySelector('[data-ui="merges"]');
  const population = document.querySelector('[data-ui="population"]');
  const best = document.querySelector('[data-ui="best"]');
  const record = document.querySelector('[data-ui="record"]');
  const combo = document.querySelector('[data-ui="combo"]');
  const warning = document.querySelector('[data-ui="warning"]');
  const fox = document.querySelector('[data-ui="fox"]');

  if (!score || !merges || !population || !best || !record || !combo || !warning || !fox) {
    return;
  }

  score.textContent = String(state.score);
  merges.textContent = String(state.merges);
  population.textContent = String(state.items.length);
  best.textContent = getStage(state.bestStage).label;
  record.textContent = String(currentRecord());
  combo.textContent = state.combo > 1 ? `x${state.combo}` : '-';
  fox.textContent = String(state.foxEscaped);

  if (state.timeLeft === null) {
    warning.textContent = 'Corral estable';
    warning.dataset.state = 'safe';
  } else {
    warning.textContent = `${state.timeLeft.toFixed(1)} s para fusionar`;
    warning.dataset.state = state.timeLeft < 3 ? 'danger' : 'warn';
  }
}

function animalActor(item) {
  const stage = getStage(item.level);
  const color = getColor(item.colorKey);
  const selectedClass = state.selectedId === item.id ? ' coop__animal--selected' : '';
  const stillClass = item.level === 0 ? ' coop__animal--egg' : ' coop__animal--walker';
  const size = Math.min(92 + item.level * 8, 132);
  const flipClass = item.vx < 0 ? ' coop__animal--left' : '';
  const age = Math.max(0, performance.now() - item.bornAt);
  const spawnClass = age < 500 ? ' coop__animal--fresh' : '';

  return `
    <button
      class="coop__animal${selectedClass}${stillClass}${flipClass} ${spawnClass}"
      type="button"
      data-animal-id="${item.id}"
      style="left:${item.x}%; top:${item.y}%; --actor-size:${size}px;"
      aria-label="${getStage(item.level).label} ${color.label}"
    >
      <span
        class="coop__token"
        style="--sprite-image:url('${stage.sprite}'); --sprite-row:${spriteRowPosition(color)};"
        aria-hidden="true"
      ></span>
      <span class="coop__meta">${stage.label} · ${color.label}</span>
      <span class="coop__badge">${stage.badge}</span>
    </button>
  `;
}

function ropeMarkup() {
  if (!state.rope) {
    return '';
  }

  const { from, to, valid } = state.rope;
  return `
    <svg class="rope-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line
        class="rope-layer__shadow"
        x1="${from.x}"
        y1="${from.y}"
        x2="${to.x}"
        y2="${to.y}"
      />
      <line
        class="rope-layer__line ${valid ? 'rope-layer__line--valid' : 'rope-layer__line--invalid'}"
        x1="${from.x}"
        y1="${from.y}"
        x2="${to.x}"
        y2="${to.y}"
      />
    </svg>
  `;
}

function mergeEffectsMarkup() {
  return state.effects
    .map((effect) => {
      const color = getColor(effect.colorKey);
      return `
        <div
          class="merge-burst"
          style="left:${effect.x}%; top:${effect.y}%; --burst:${color.shell}; --burst-line:${color.stroke};"
          aria-hidden="true"
        >
          <span>${effect.label}</span>
        </div>
      `;
    })
    .join('');
}

function progressMarkup() {
  return `
    <div class="progress-line">
      ${EVOLUTION_CHAIN.map((stage, index) => {
        const reachedClass = index <= state.bestStage ? ' progress-line__step--reached' : '';
        return `
          <span class="progress-line__step${reachedClass}" title="${stage.label}">
            <span>${stage.badge}</span>
          </span>
        `;
      }).join('')}
    </div>
  `;
}

function menuScreen() {
  return `
    <section class="screen screen--menu">
      <div class="hero-card">
        <div class="hero-copy">
          <p class="eyebrow">Establo · Merge · Defensa</p>
          <h1>Corral de Gallinas</h1>
          <p class="lead">
            Une huevos del mismo color para criar una linea completa de gallinas, desde pollitos
            hasta ancianas, mientras espantas al zorro antes de que robe tu corral.
          </p>
          <div class="hero-actions">
            <button class="primary-button" type="button" data-action="play-menu">Jugar</button>
            <button class="ghost-button" type="button" data-action="about-menu">Acerca de</button>
          </div>
        </div>
        <div class="hero-art">
          <div class="hero-plaque">
            <img src="${henMascotSprite}" alt="Gallina del menu" />
          </div>
        </div>
      </div>
    </section>
  `;
}

function aboutScreen() {
  return `
    <section class="screen screen--about">
      <div class="panel panel--wide">
        <p class="eyebrow">Acerca del juego</p>
        <h2>Como funciona este corral</h2>
        <div class="about-grid">
          <article class="info-card">
            <h3>Cadena de evolucion</h3>
            <p>2 huevos -> 1 pollito -> 1 gallina -> 1 gallina grande -> 1 gallina reina -> 1 gallina anciana.</p>
          </article>
          <article class="info-card">
            <h3>Regla clave</h3>
            <p>Solo puedes unir animales del mismo color y de la misma etapa. Los colores actuales son blanco, marron, negro y gris.</p>
          </article>
          <article class="info-card">
            <h3>El zorro</h3>
            <p>Entra cada cierto tiempo para intentar llevarse una gallina. Si haces clic sobre el antes de que escape, lo espantas y ganas unos puntos.</p>
          </article>
          <article class="info-card">
            <h3>Modos</h3>
            <p>Infinito no tiene tope. Hasta llenar el corral te obliga a sobrevivir con 24 animales y una cuenta atras de 10 segundos si te atascas.</p>
          </article>
        </div>
        <div class="lineup">
          ${EVOLUTION_CHAIN.map((stage) => `<span class="lineup__chip">${stage.label}</span>`).join('')}
        </div>
        <div class="panel-actions">
          <button class="ghost-button" type="button" data-action="back-menu">Volver</button>
          <button class="primary-button" type="button" data-action="play-menu">Jugar</button>
        </div>
      </div>
    </section>
  `;
}

function modeSelectScreen() {
  return `
    <section class="screen screen--modes">
      <div class="panel panel--wide">
        <p class="eyebrow">Elegir modo</p>
        <h2>Selecciona como quieres jugar</h2>
        <div class="mode-grid">
          ${Object.values(MODES)
            .map(
              (mode) => `
                <button class="mode-card" type="button" data-mode="${mode.key}">
                  <strong>${mode.label}</strong>
                  <span>${mode.summary}</span>
                </button>
              `,
            )
            .join('')}
          <article class="mode-card mode-card--future">
            <strong>Mas gallinas</strong>
            <span>El sistema de evoluciones ya esta preparado para futuras variantes y ramas nuevas.</span>
          </article>
        </div>
        <div class="panel-actions">
          <button class="ghost-button" type="button" data-action="back-menu">Volver</button>
        </div>
      </div>
    </section>
  `;
}

function gameScreen() {
  const mode = currentMode();
  const boardClass = mode?.cap === Infinity ? 'coop coop--endless' : 'coop coop--capped';

  return `
    <section class="screen screen--game">
      <div class="hud">
        <div class="hud__cluster">
          <div class="hud__stat"><span>Puntos</span><strong data-ui="score">${state.score}</strong></div>
          <div class="hud__stat"><span>Fusiones</span><strong data-ui="merges">${state.merges}</strong></div>
          <div class="hud__stat"><span>Poblacion</span><strong data-ui="population">${state.items.length}</strong></div>
          <div class="hud__stat"><span>Mejor etapa</span><strong data-ui="best">${getStage(state.bestStage).label}</strong></div>
          <div class="hud__stat"><span>Zorros huidos</span><strong data-ui="fox">${state.foxEscaped}</strong></div>
        </div>
        <div class="hud__cluster hud__cluster--actions">
          <div class="warning-pill" data-ui="warning" data-state="${state.timeLeft === null ? 'safe' : 'warn'}">
            ${state.timeLeft === null ? 'Corral estable' : `${state.timeLeft.toFixed(1)} s para fusionar`}
          </div>
          <button class="ghost-button ghost-button--small" type="button" data-action="restart">Reiniciar</button>
          <button class="ghost-button ghost-button--small" type="button" data-action="back-menu">Menu</button>
        </div>
      </div>

      <div class="playfield">
        <aside class="sidebar">
          <div class="panel">
            <p class="eyebrow">Modo actual</p>
            <h2>${mode?.label ?? ''}</h2>
            <p>${mode?.summary ?? ''}</p>
          </div>
          <div class="panel">
            <p class="eyebrow">Consejo</p>
            <p>${state.message}</p>
          </div>
          <div class="panel panel--sprite">
            <img src="${henMascotSprite}" alt="Gallina decorativa" />
          </div>
        </aside>

        <div class="barn">
          <div class="barn__sky"></div>
          <div class="barn__title">
            <div>
              <p class="eyebrow">Establo vivo</p>
              <h2>Corral principal</h2>
            </div>
            <span class="barn__capacity">${mode?.cap === Infinity ? 'Sin limite' : `${state.items.length}/${mode?.cap}`}</span>
          </div>
          <div class="${boardClass}">
            <div class="coop__ground"></div>
            ${ropeMarkup()}
            ${state.items.map((item) => animalActor(item)).join('')}
            ${mergeEffectsMarkup()}
          </div>
          ${
            state.fox
              ? `
                <button
                  class="fox-alert"
                  type="button"
                  data-action="scare-fox"
                  style="top:${state.fox.top}%;left:${state.fox.left}%"
                >
                  <span class="fox-alert__sprite" style="--fox-image:url('${foxRunSheet}')" aria-hidden="true"></span>
                  <span>Espantar</span>
                </button>
              `
              : ''
          }
        </div>
      </div>
    </section>
  `;
}

function gameOverScreen() {
  return `
    <section class="screen screen--gameover">
      <div class="panel panel--wide panel--gameover">
        <p class="eyebrow">Fin de la partida</p>
        <h2>${state.gameOver ?? 'El corral ha terminado por hoy.'}</h2>
        <div class="results-grid">
          <div class="hud__stat"><span>Puntos</span><strong>${state.score}</strong></div>
          <div class="hud__stat"><span>Fusiones</span><strong>${state.merges}</strong></div>
          <div class="hud__stat"><span>Mejor etapa</span><strong>${getStage(state.bestStage).label}</strong></div>
          <div class="hud__stat"><span>Zorros huidos</span><strong>${state.foxEscaped}</strong></div>
        </div>
        <div class="panel-actions">
          <button class="primary-button" type="button" data-action="restart">Jugar otra vez</button>
          <button class="ghost-button" type="button" data-action="back-menu">Menu principal</button>
        </div>
      </div>
    </section>
  `;
}

function render() {
  if (!app) {
    return;
  }

  if (state.screen === 'menu') {
    app.innerHTML = menuScreen();
  } else if (state.screen === 'about') {
    app.innerHTML = aboutScreen();
  } else if (state.screen === 'mode-select') {
    app.innerHTML = modeSelectScreen();
  } else if (state.screen === 'game') {
    app.innerHTML = gameScreen();
  } else if (state.screen === 'gameover') {
    app.innerHTML = gameOverScreen();
  }

  wireEvents();
}

function wireEvents() {
  document.querySelectorAll('[data-action="play-menu"]').forEach((button) => {
    button.addEventListener('click', openModeSelect);
  });

  document.querySelectorAll('[data-action="about-menu"]').forEach((button) => {
    button.addEventListener('click', openAbout);
  });

  document.querySelectorAll('[data-action="back-menu"]').forEach((button) => {
    button.addEventListener('click', goToMenu);
  });

  document.querySelectorAll('[data-action="restart"]').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.selectedMode) {
        startGame(state.selectedMode);
      } else {
        openModeSelect();
      }
    });
  });

  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const { mode } = button.dataset;
      if (mode && MODES[mode]) {
        startGame(mode);
      }
    });
  });

  document.querySelectorAll('[data-animal-id]').forEach((button) => {
    button.addEventListener('click', () => {
      chooseAnimal(Number(button.dataset.animalId));
    });
  });

  document.querySelectorAll('[data-action="scare-fox"]').forEach((button) => {
    button.addEventListener('click', scareFox);
  });
}

render();
