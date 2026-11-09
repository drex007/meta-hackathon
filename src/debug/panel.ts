import type { TimeScaleParameters } from '../core/time-scale.js';

export interface DebugTelemetry {
  leftWristSpeed: number;
  rightWristSpeed: number;
  headSpeed: number;
  rawSpeed: number;
  smoothedSpeed: number;
  timeScale: number;
  fps: number;
  handsTracked: number;
}

export interface CombatTelemetry {
  score: number;
  kills: number;
  wave: number;
  roundsFired: number;
  activeTargets: number;
}

type ParameterKey = keyof TimeScaleParameters;

const SLIDERS: Array<{
  key: ParameterKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: 'minScale', label: 'Minimum scale', min: 0.01, max: 0.25, step: 0.01 },
  { key: 'deadZone', label: 'Dead zone', min: 0, max: 0.2, step: 0.005 },
  { key: 'fullSpeed', label: 'Full speed', min: 0.2, max: 2, step: 0.05 },
  { key: 'headWeight', label: 'Head weight', min: 0, max: 1.5, step: 0.05 },
  { key: 'attack', label: 'Attack', min: 0.02, max: 0.5, step: 0.01 },
  { key: 'release', label: 'Release', min: 0.05, max: 0.8, step: 0.01 },
];

export class DebugPanel {
  fallbackMoving = false;
  private readonly root: HTMLDivElement;
  private readonly metricElements = new Map<keyof DebugTelemetry, HTMLElement>();
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space' || event.code === 'KeyM') {
      event.preventDefault();
      this.fallbackMoving = true;
    }
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space' || event.code === 'KeyM') {
      this.fallbackMoving = false;
    }
  };

  constructor(
    private readonly parameters: TimeScaleParameters,
    enterXr: () => void,
    xrEnabled: boolean,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'game-overlay';
    this.root.innerHTML = `
      <header class="game-header">
        <div class="wordmark"><i></i><span>SKY//RIOT</span></div>
        <div class="header-status"><i></i><span>BIRDSTORM ACTIVE</span><b>SUNFIRE ONLINE</b></div>
      </header>
      <section class="mission-brief">
        <div class="mission-index"><span>01</span><i></i><b>OPERATION SUNBURST</b></div>
        <p class="eyebrow">AERIAL ARCADE // META QUEST</p>
        <h1>HUNT THE<br><em>NEON FLOCK.</em></h1>
        <p class="mechanic">Aim the right controller and squeeze trigger to blast a bird.<br>Move to unleash time. Hold still to freeze the flock and line up impossible shots.</p>
        <button class="enter-xr" type="button">${xrEnabled ? 'LAUNCH SKY HUNT' : 'WEBXR NOT AVAILABLE'}</button>
        <p class="desktop-hint">Desktop: click birds to fire. Hold <kbd>SPACE</kbd> to make the sky move.</p>
      </section>
      <aside class="combat-hud" role="status" aria-live="polite">
        <div class="combat-heading"><span>FLOCK RADAR</span><b>AIRBORNE</b></div>
        <div class="combat-grid">
          <div><span>SCORE</span><strong data-score>000000</strong></div>
          <div><span>WAVE</span><strong data-wave>01</strong></div>
          <div><span>HITS</span><strong data-kills>00</strong></div>
          <div><span>BIRDS</span><strong data-targets>08</strong></div>
        </div>
      </aside>
      <div class="target-reticle" aria-hidden="true"><i></i><b></b><span>SKYLOCK</span></div>
      <div class="time-readout" role="status" aria-live="polite">
        <div class="time-dial"><strong data-time-scale>6%</strong><small>WORLD<br>SPEED</small></div>
        <div class="time-state"><span data-time-state>TIME FROZEN</span><b>FLIGHT TEMPO</b></div>
        <div class="time-bar"><i data-time-bar></i></div>
      </div>
      <div class="weapon-readout"><span>SUNFIRE CARBINE</span><b>TRIGGER TO BLAST</b><i></i><small data-rounds>000 SHOTS</small></div>
      <footer class="tactical-footer"><span>STOP TIME. STEADY AIM.</span><i></i><b>CLEAR THE SKY</b></footer>
    `;

    const button = this.root.querySelector<HTMLButtonElement>('.enter-xr');
    if (button != null) {
      button.disabled = !xrEnabled;
      button.addEventListener('click', enterXr);
    }

    if (new URLSearchParams(window.location.search).has('debug')) {
      this.root.append(this.createDebugPanel());
    }

    document.body.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  update(telemetry: DebugTelemetry): void {
    const scale = Math.round(telemetry.timeScale * 100);
    const scaleElement = this.root.querySelector<HTMLElement>('[data-time-scale]');
    const bar = this.root.querySelector<HTMLElement>('[data-time-bar]');
    if (scaleElement != null) scaleElement.textContent = `${scale}%`;
    if (bar != null) bar.style.width = `${scale}%`;
    this.root.style.setProperty('--time-progress', `${scale}%`);
    this.root.classList.toggle('time-slow', scale < 22);
    this.root.classList.toggle('time-fast', scale > 72);
    const state = this.root.querySelector<HTMLElement>('[data-time-state]');
    if (state != null) {
      state.textContent = scale < 22 ? 'TIME FROZEN' : scale > 72 ? 'TIMELINE HOT' : 'TIME FLOWING';
    }

    for (const [key, element] of this.metricElements) {
      const value = telemetry[key];
      element.textContent = key === 'handsTracked' ? `${value}` : value.toFixed(3);
    }
  }

  updateCombat(telemetry: CombatTelemetry): void {
    const values: Array<[string, string]> = [
      ['[data-score]', telemetry.score.toString().padStart(6, '0')],
      ['[data-wave]', telemetry.wave.toString().padStart(2, '0')],
      ['[data-kills]', telemetry.kills.toString().padStart(2, '0')],
      ['[data-targets]', telemetry.activeTargets.toString().padStart(2, '0')],
      ['[data-rounds]', `${telemetry.roundsFired.toString().padStart(3, '0')} SHOTS`],
    ];
    for (const [selector, value] of values) {
      const element = this.root.querySelector<HTMLElement>(selector);
      if (element != null) element.textContent = value;
    }
    this.root.classList.toggle('wave-clear', telemetry.activeTargets === 0);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.root.remove();
  }

  private createDebugPanel(): HTMLElement {
    const panel = document.createElement('aside');
    panel.className = 'debug-panel';
    const heading = document.createElement('div');
    heading.className = 'debug-heading';
    heading.innerHTML = '<strong>TIME LAB</strong><span>?debug</span>';
    panel.append(heading);

    const metrics = document.createElement('div');
    metrics.className = 'debug-metrics';
    const metricKeys: Array<keyof DebugTelemetry> = [
      'leftWristSpeed',
      'rightWristSpeed',
      'headSpeed',
      'rawSpeed',
      'smoothedSpeed',
      'timeScale',
      'fps',
      'handsTracked',
    ];
    for (const key of metricKeys) {
      const row = document.createElement('div');
      const label = document.createElement('span');
      const value = document.createElement('code');
      label.textContent = key.replace(/([A-Z])/g, ' $1');
      value.textContent = '0.000';
      row.append(label, value);
      metrics.append(row);
      this.metricElements.set(key, value);
    }
    panel.append(metrics);

    for (const slider of SLIDERS) {
      const label = document.createElement('label');
      const top = document.createElement('span');
      const value = document.createElement('code');
      const input = document.createElement('input');
      top.textContent = slider.label;
      value.textContent = this.parameters[slider.key].toFixed(3);
      input.type = 'range';
      input.min = `${slider.min}`;
      input.max = `${slider.max}`;
      input.step = `${slider.step}`;
      input.value = `${this.parameters[slider.key]}`;
      input.addEventListener('input', () => {
        this.parameters[slider.key] = Number(input.value);
        value.textContent = Number(input.value).toFixed(3);
      });
      label.append(top, value, input);
      panel.append(label);
    }
    return panel;
  }
}
