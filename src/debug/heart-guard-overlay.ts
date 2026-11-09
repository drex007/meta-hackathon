export interface HeartGuardOverlayState {
  phase: string;
  health: number;
  energy: number;
  wave: number;
  score: number;
  timeScale: number;
  enemies: number;
}

export class HeartGuardOverlay {
  fallbackMoving = false;
  private readonly root: HTMLDivElement;
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Space' || event.code === 'KeyM') {
      event.preventDefault();
      this.fallbackMoving = true;
    }
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space' || event.code === 'KeyM') this.fallbackMoving = false;
  };

  constructor(enterXr: () => void, xrEnabled: boolean) {
    this.root = document.createElement('div');
    this.root.className = 'heart-guard-overlay';
    this.root.innerHTML = `
      <header><b>HEART GUARD</b><span>HANDS ONLY // SEATED</span></header>
      <section class="heart-guard-intro">
        <p>THE INVADERS MOVE WHEN YOU MOVE</p>
        <h1>STAY CALM.<br><em>GUARD THE HEART.</em></h1>
        <p class="heart-guard-copy">Poke invaders with either index finger, or point and pinch. Fast hand movement speeds up the swarm.</p>
        <button type="button" data-enter-xr>${xrEnabled ? 'ENTER WITH HANDS' : 'WEBXR NOT AVAILABLE'}</button>
        <small>Desktop test: click invaders. Hold SPACE to simulate fast hands.</small>
      </section>
      <aside class="heart-guard-browser-hud">
        <strong data-phase>CALIBRATING</strong>
        <span>HEART <b data-health>10/10</b></span>
        <span>ENERGY <b data-energy>0/10</b></span>
        <span>WAVE <b data-wave>1/5</b></span>
        <span>SCORE <b data-score>0000</b></span>
        <span>TIME <b data-time>15%</b></span>
        <span>INVADERS <b data-enemies>0</b></span>
      </aside>
    `;
    const button = this.root.querySelector<HTMLButtonElement>('[data-enter-xr]');
    if (button != null) {
      button.disabled = !xrEnabled;
      button.addEventListener('click', enterXr);
    }
    document.body.append(this.root);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  update(state: HeartGuardOverlayState): void {
    const values: Array<[string, string]> = [
      ['[data-phase]', state.phase],
      ['[data-health]', `${state.health}/10`],
      ['[data-energy]', `${state.energy}/10`],
      ['[data-wave]', `${state.wave}/5`],
      ['[data-score]', state.score.toString().padStart(4, '0')],
      ['[data-time]', `${Math.round(state.timeScale * 100)}%`],
      ['[data-enemies]', `${state.enemies}`],
    ];
    for (const [selector, value] of values) {
      const element = this.root.querySelector<HTMLElement>(selector);
      if (element != null) element.textContent = value;
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.root.remove();
  }
}
