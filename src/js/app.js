import '../css/main.css';
import foxSprite from '../assets/game-sprites/fox/clean.png';
import henMascotSprite from '../assets/game-sprites/hen-mascot/clean.png';

const app = document.querySelector('#app');

const EVOLUTION_CHAIN = [
  { key: 'egg', label: 'Huevo', badge: 'E', score: 5, accent: '#fff3d1' },
  { key: 'chick', label: 'Pollito', badge: 'P', score: 12, accent: '#ffe066' },
  { key: 'hen', label: 'Gallina', badge: 'G', score: 30, accent: '#ffd7a2' },
  { key: 'bigHen', label: 'Gallina grande', badge: 'GG', score: 65, accent: '#ffb870' },
  { key: 'queen', label: 'Gallina reina', badge: 'R', score: 140, accent: '#ffd36e' },
  { key: 'elder', label: 'Gallina anciana', badge: 'A', score: 300, accent: '#d7dbe8' },
];

const COLOR_VARIANTS = [
  { key: 'white', label: 'Blanco', shell: '#f7f2df', stroke: '#cfbea0', comb: '#d94b5a' },
  { key: 'brown', label: 'Marron', shell: '#a8673f', stroke: '#724326', comb: '#d0414f' },
  { key: 'black', label: 'Negro', shell: '#36343f', stroke: '#18161d', comb: '#d14d5a' },
  { key: 'gray', label: 'Gris', shell: '#8e98aa', stroke: '#5c6370', comb: '#cb5660' },
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
};

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createAnimal(level = 0, colorKey = randomFrom(COLOR_VARIANTS).key) {
  return {
    id: state.nextId++,
    level,
    colorKey,
  };
}

function getColor(colorKey) {
  return COLOR_VARIANTS.find((variant) => variant.key === colorKey) ?? COLOR_VARIANTS[0];
}

function getStage(level) {
  return EVOLUTION_CHAIN[Math.min(level, EVOLUTION_CHAIN.length - 1)];
}

function currentMode() {
  return state.selectedMode ? MODES[state.selectedMode] : null;
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
  scheduleSpawn();
  scheduleFox();
  state.tickerHandle = window.setInterval(tick, 100);
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
  if (!state.running) {
    return;
  }
  const delay = 1500 + Math.random() * 1800;
  state.spawnHandle = window.setTimeout(() => {
    spawnEgg();
    scheduleSpawn();
  }, delay);
}

function scheduleFox() {
  if (!state.running) {
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
  if (!state.running) {
    return;
  }

  if (state.fox && performance.now() >= state.fox.leaveAt) {
    resolveFoxSteal();
    return;
  }

  syncWarningState();
  renderHudOnly();
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
  state.gameOver = reason;
  state.screen = 'gameover';
  state.fox = null;
  clearLoopHandles();
  render();
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

function mergeAnimals(firstId, secondId) {
  const first = state.items.find((animal) => animal.id === firstId);
  const second = state.items.find((animal) => animal.id === secondId);

  if (!first || !second || !canMerge(first, second)) {
    state.message = 'Esa combinacion no es valida.';
    state.selectedId = null;
    render();
    return;
  }

  const upgraded = createAnimal(first.level + 1, first.colorKey);
  state.items = state.items.filter((animal) => animal.id !== firstId && animal.id !== secondId);
  state.items.unshift(upgraded);
  state.selectedId = null;
  state.score += getStage(upgraded.level).score;
  state.merges += 1;
  state.bestStage = Math.max(state.bestStage, upgraded.level);
  state.message = `${describeAnimal(first)} y ${describeAnimal(second)} se convierten en ${describeAnimal(upgraded)}.`;
  syncWarningState();
  render();
}

function describeAnimal(item) {
  return `${getStage(item.level).label.toLowerCase()} ${getColor(item.colorKey).label.toLowerCase()}`;
}

function goToMenu() {
  clearLoopHandles();
  state.running = false;
  state.screen = 'menu';
  state.selectedMode = null;
  state.selectedId = null;
  state.fox = null;
  state.warningStartedAt = null;
  state.timeLeft = null;
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
  const warning = document.querySelector('[data-ui="warning"]');
  const fox = document.querySelector('[data-ui="fox"]');

  if (!score || !merges || !population || !best || !warning || !fox) {
    return;
  }

  score.textContent = String(state.score);
  merges.textContent = String(state.merges);
  population.textContent = String(state.items.length);
  best.textContent = getStage(state.bestStage).label;
  fox.textContent = String(state.foxEscaped);

  if (state.timeLeft === null) {
    warning.textContent = 'Corral estable';
    warning.dataset.state = 'safe';
  } else {
    warning.textContent = `${state.timeLeft.toFixed(1)} s para fusionar`;
    warning.dataset.state = state.timeLeft < 3 ? 'danger' : 'warn';
  }
}

function stageMarkup(level, color) {
  const fill = color.shell;
  const stroke = color.stroke;
  const comb = color.comb;

  if (level === 0) {
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="50" cy="56" rx="26" ry="34" fill="${fill}" stroke="${stroke}" stroke-width="6" />
        <ellipse cx="41" cy="42" rx="5" ry="7" fill="#fff8ef" opacity="0.8" />
      </svg>
    `;
  }

  if (level === 1) {
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="47" cy="56" r="21" fill="${fill}" stroke="${stroke}" stroke-width="5" />
        <circle cx="66" cy="42" r="12" fill="${fill}" stroke="${stroke}" stroke-width="5" />
        <polygon points="76,42 88,46 76,50" fill="#f3ab36" />
        <circle cx="67" cy="40" r="2.7" fill="#24150f" />
        <path d="M41 76 L38 91 M57 76 L54 91" stroke="#d08a30" stroke-width="5" stroke-linecap="round" />
      </svg>
    `;
  }

  if (level === 2) {
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="45" cy="59" rx="24" ry="21" fill="${fill}" stroke="${stroke}" stroke-width="5" />
        <circle cx="69" cy="44" r="13" fill="${fill}" stroke="${stroke}" stroke-width="5" />
        <path d="M67 28 C70 20 76 22 75 30 C79 21 85 27 81 35 C86 33 88 41 82 43" fill="${comb}" />
        <polygon points="79,45 91,49 79,53" fill="#eead38" />
        <circle cx="69" cy="42" r="2.6" fill="#251914" />
        <path d="M31 55 C22 47 22 38 33 38" fill="${fill}" stroke="${stroke}" stroke-width="5" stroke-linecap="round" />
        <path d="M42 77 L40 92 M56 77 L54 92" stroke="#cf8a30" stroke-width="5" stroke-linecap="round" />
      </svg>
    `;
  }

  if (level === 3) {
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="45" cy="58" rx="28" ry="24" fill="${fill}" stroke="${stroke}" stroke-width="6" />
        <circle cx="72" cy="41" r="14" fill="${fill}" stroke="${stroke}" stroke-width="6" />
        <path d="M69 24 C73 14 81 18 79 29 C84 16 92 24 88 34 C95 31 97 42 89 45" fill="${comb}" />
        <polygon points="82,42 95,47 82,52" fill="#efb245" />
        <circle cx="72" cy="39" r="2.8" fill="#221612" />
        <path d="M25 56 C14 48 14 35 29 34" fill="${fill}" stroke="${stroke}" stroke-width="6" stroke-linecap="round" />
        <path d="M42 80 L40 95 M58 80 L56 95" stroke="#d58f33" stroke-width="5" stroke-linecap="round" />
      </svg>
    `;
  }

  if (level === 4) {
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx="45" cy="59" rx="28" ry="24" fill="${fill}" stroke="${stroke}" stroke-width="6" />
        <circle cx="72" cy="41" r="14" fill="${fill}" stroke="${stroke}" stroke-width="6" />
        <path d="M71 20 L78 13 L85 20 L91 13 L95 25 L83 28 Z" fill="#f7d159" stroke="#d4a537" stroke-width="3" />
        <path d="M67 27 C70 18 77 19 78 28 C82 20 88 24 86 34 C92 31 94 40 88 43" fill="${comb}" />
        <polygon points="82,42 95,47 82,52" fill="#f0b84a" />
        <circle cx="72" cy="39" r="2.8" fill="#221612" />
        <path d="M23 59 C13 52 13 38 29 36" fill="${fill}" stroke="${stroke}" stroke-width="6" stroke-linecap="round" />
        <path d="M42 80 L40 95 M58 80 L56 95" stroke="#d58f33" stroke-width="5" stroke-linecap="round" />
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="45" cy="59" rx="28" ry="24" fill="${fill}" stroke="${stroke}" stroke-width="6" />
      <circle cx="72" cy="41" r="14" fill="${fill}" stroke="${stroke}" stroke-width="6" />
      <path d="M70 23 C73 12 81 15 81 27 C86 18 93 24 91 34 C96 31 97 39 90 43" fill="${comb}" />
      <polygon points="82,42 95,47 82,52" fill="#f0b84a" />
      <circle cx="72" cy="39" r="2.8" fill="#221612" />
      <path d="M21 61 C12 52 13 38 29 36" fill="${fill}" stroke="${stroke}" stroke-width="6" stroke-linecap="round" />
      <path d="M39 20 C48 8 63 8 72 20" fill="none" stroke="#a7b4c7" stroke-width="6" stroke-linecap="round" />
      <path d="M42 80 L40 95 M58 80 L56 95" stroke="#d58f33" stroke-width="5" stroke-linecap="round" />
    </svg>
  `;
}

function animalCard(item) {
  const stage = getStage(item.level);
  const color = getColor(item.colorKey);
  const selectedClass = state.selectedId === item.id ? ' coop__animal--selected' : '';

  return `
    <button class="coop__animal${selectedClass}" type="button" data-animal-id="${item.id}">
      <span class="coop__token" style="--token-accent:${stage.accent}; --shell:${color.shell}; --stroke:${color.stroke}; --comb:${color.comb};">
        ${stageMarkup(item.level, color)}
      </span>
      <span class="coop__meta">
        <strong>${stage.label}</strong>
        <span>${color.label}</span>
      </span>
      <span class="coop__badge">${stage.badge}</span>
    </button>
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
            ${state.items.map((item) => animalCard(item)).join('')}
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
                  <img src="${foxSprite}" alt="Zorro en el establo" />
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
