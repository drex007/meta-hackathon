import {
  createSystem,
  type Entity,
  type Object3D,
  Pressed,
  UIKit,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { PositionSpeedTracker, ScalarEmaFilter } from '../core/filters.js';
import { advanceTimeScale, type TimeScaleParameters } from '../core/time-scale.js';
import { HeartGuardOverlay } from '../debug/heart-guard-overlay.js';
import { HeartGuardSession, Invader } from './heart-guard-components.js';

const PHASE = { CALIBRATING: 0, READY: 1, PLAYING: 2, PAUSED: 3, WON: 4, LOST: 5 } as const;
const ABILITY = { NONE: 0, BARRICADE: 1, BOMB: 2 } as const;
const WAVE_KINDS: readonly (readonly number[])[] = [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 1, 1, 1],
];

export function calibratedDeadZone(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0.06;
  const values = Array.from(samples).sort((a, b) => a - b);
  const index = Math.min(values.length - 1, Math.floor(values.length * 0.95));
  return Math.min(0.12, Math.max(0.04, values[index] * 1.5));
}

export class HeartGuardSystem extends createSystem({
  invaders: { required: [Invader] },
  hitInvaders: { required: [Invader, Pressed] },
  sessions: { required: [HeartGuardSession] },
}) {
  private readonly parameters: TimeScaleParameters = {
    minScale: 0.15,
    deadZone: 0.06,
    fullSpeed: 1.2,
    headWeight: 0.5,
    attack: 0.1,
    release: 0.3,
  };
  private readonly leftTracker = new PositionSpeedTracker();
  private readonly rightTracker = new PositionSpeedTracker();
  private readonly headTracker = new PositionSpeedTracker();
  private readonly speedFilter = new ScalarEmaFilter(0.25);
  private readonly leftPosition = new Vector3();
  private readonly rightPosition = new Vector3();
  private readonly headPosition = new Vector3();
  private readonly invaderHomes = new Map<Object3D, Vector3>();
  private readonly invaderScales = new Map<Object3D, Vector3>();
  private readonly calibrationSamples = new Float32Array(360);
  private calibrationSampleCount = 0;
  private heart?: Object3D;
  private barricade?: Object3D;
  private bomb?: Object3D;
  private panel?: UIKitMLAsset;
  private statusText?: UIKit.Text;
  private healthText?: UIKit.Text;
  private energyText?: UIKit.Text;
  private waveText?: UIKit.Text;
  private scoreText?: UIKit.Text;
  private timeText?: UIKit.Text;
  private enemiesText?: UIKit.Text;
  private hintText?: UIKit.Text;
  private overlay?: HeartGuardOverlay;
  private timeScale = 0.15;
  private phaseClock = 0;
  private spawnTimer = 0;
  private spawnQueueIndex = 0;
  private resolvedThisWave = 0;
  private combo = 0;
  private heartHitTimer = 0;
  private bombTimer = 0;
  private hudTimer = 0;

  init(): void {
    this.heart = this.world.getSceneObject<Object3D>('plush-heart') ?? undefined;
    this.barricade = this.world.getSceneObject<Object3D>('toy-barricade') ?? undefined;
    this.bomb = this.world.getSceneObject<Object3D>('toy-bomb') ?? undefined;
    if (this.barricade != null) this.barricade.visible = false;
    if (this.bomb != null) this.bomb.visible = false;

    for (const entity of this.queries.invaders.entities) {
      if (entity.object3D == null) continue;
      this.invaderHomes.set(entity.object3D, entity.object3D.position.clone());
      this.invaderScales.set(entity.object3D, entity.object3D.scale.clone());
      entity.setValue(Invader, 'active', false);
      entity.object3D.visible = false;
    }
    const offHit = this.queries.hitInvaders.subscribe('qualify', (entity) => this.hitInvader(entity));
    this.cleanupFuncs.push(offHit);

    this.connectPanel();
    this.overlay = new HeartGuardOverlay(() => void this.world.launchXR(), this.world.xrEnabled);
    this.cleanupFuncs.push(() => this.overlay?.dispose());
    this.resetGame(true);
  }

  update(delta: number): void {
    const dtReal = Math.min(Math.max(delta, 0), 0.05);
    const session = this.session();
    if (session == null) return;
    const leftTracked = this.world.input.isPrimary('hand', 'left');
    const rightTracked = this.world.input.isPrimary('hand', 'right');
    let leftSpeed = this.leftTracker.hold(dtReal);
    let rightSpeed = this.rightTracker.hold(dtReal);
    if (leftTracked) {
      this.player.gripSpaces.left.getWorldPosition(this.leftPosition);
      leftSpeed = this.leftTracker.update(this.leftPosition.x, this.leftPosition.y, this.leftPosition.z, dtReal);
    }
    if (rightTracked) {
      this.player.gripSpaces.right.getWorldPosition(this.rightPosition);
      rightSpeed = this.rightTracker.update(this.rightPosition.x, this.rightPosition.y, this.rightPosition.z, dtReal);
    }
    this.player.head.getWorldPosition(this.headPosition);
    const headSpeed = this.headTracker.update(this.headPosition.x, this.headPosition.y, this.headPosition.z, dtReal);
    const desktopSpeed = this.overlay?.fallbackMoving ? this.parameters.fullSpeed : 0;
    const rawSpeed = Math.max(leftSpeed, rightSpeed, headSpeed * this.parameters.headWeight, desktopSpeed);
    const speed = this.speedFilter.update(rawSpeed);

    const phase = session.getValue(HeartGuardSession, 'phase') ?? PHASE.CALIBRATING;
    if (phase === PHASE.CALIBRATING) {
      if (leftTracked || rightTracked || desktopSpeed > 0) this.updateCalibration(session, speed, dtReal);
      this.animateHeart(dtReal, session);
      this.updateHud(dtReal, leftTracked, rightTracked);
      return;
    }

    this.timeScale = advanceTimeScale(this.timeScale, speed, dtReal, this.parameters);
    session.setValue(HeartGuardSession, 'timeScale', this.timeScale);
    this.animateHeart(dtReal, session);
    this.updateEffects(session, dtReal);
    if (phase === PHASE.PLAYING) this.updateGame(session, dtReal, dtReal * this.timeScale);
    this.updateHud(dtReal, leftTracked, rightTracked);
  }

  private connectPanel(): void {
    this.panel = this.world.requireSceneObject<UIKitMLAsset>('heart-guard-panel');
    this.statusText = this.panel.requireElementById<UIKit.Text>('StatusText');
    this.healthText = this.panel.requireElementById<UIKit.Text>('HealthText');
    this.energyText = this.panel.requireElementById<UIKit.Text>('EnergyText');
    this.waveText = this.panel.requireElementById<UIKit.Text>('WaveText');
    this.scoreText = this.panel.requireElementById<UIKit.Text>('ScoreText');
    this.timeText = this.panel.requireElementById<UIKit.Text>('TimeText');
    this.enemiesText = this.panel.requireElementById<UIKit.Text>('EnemiesText');
    this.hintText = this.panel.requireElementById<UIKit.Text>('HintText');
    const start = this.panel.requireElementById('Btn_Start');
    const pause = this.panel.requireElementById('Btn_Pause');
    const restart = this.panel.requireElementById('Btn_Restart');
    const barricade = this.panel.requireElementById('Btn_Barricade');
    const bomb = this.panel.requireElementById('Btn_Bomb');
    start.name = 'Btn_Start';
    pause.name = 'Btn_Pause';
    restart.name = 'Btn_Restart';
    barricade.name = 'Btn_Barricade';
    bomb.name = 'Btn_Bomb';
    const onStart = (): void => this.startGame();
    const onPause = (): void => this.togglePause();
    const onRestart = (): void => this.resetGame(false);
    const onBarricade = (): void => this.activateBarricade();
    const onBomb = (): void => this.armBomb();
    start.addEventListener('click', onStart);
    pause.addEventListener('click', onPause);
    restart.addEventListener('click', onRestart);
    barricade.addEventListener('click', onBarricade);
    bomb.addEventListener('click', onBomb);
    this.cleanupFuncs.push(
      () => start.removeEventListener('click', onStart),
      () => pause.removeEventListener('click', onPause),
      () => restart.removeEventListener('click', onRestart),
      () => barricade.removeEventListener('click', onBarricade),
      () => bomb.removeEventListener('click', onBomb),
    );
  }

  private updateCalibration(session: Entity, speed: number, dtReal: number): void {
    if (this.calibrationSampleCount < this.calibrationSamples.length) {
      this.calibrationSamples[this.calibrationSampleCount] = speed;
      this.calibrationSampleCount += 1;
    }
    const remaining = Math.max(0, (session.getValue(HeartGuardSession, 'calibrationTime') ?? 3) - dtReal);
    session.setValue(HeartGuardSession, 'calibrationTime', remaining);
    if (remaining > 0) return;
    const deadZone = calibratedDeadZone(this.calibrationSamples.subarray(0, this.calibrationSampleCount));
    this.parameters.deadZone = deadZone;
    session.setValue(HeartGuardSession, 'calibratedDeadZone', deadZone);
    session.setValue(HeartGuardSession, 'phase', PHASE.READY);
    this.setHint('Calibration complete. Poke START WITH HANDS.');
    this.pushHud();
  }

  private startGame(): void {
    const session = this.session();
    if (session == null) return;
    const phase = session.getValue(HeartGuardSession, 'phase') ?? PHASE.CALIBRATING;
    if (phase === PHASE.PAUSED) {
      session.setValue(HeartGuardSession, 'phase', PHASE.PLAYING);
      this.setHint('Back in the fight. Calm hands slow the swarm.');
      return;
    }
    if (phase !== PHASE.READY) return;
    session.setValue(HeartGuardSession, 'phase', PHASE.PLAYING);
    this.spawnTimer = 0;
    this.setHint('Poke a dust bunny before it reaches the heart.');
    this.pushHud();
  }

  private togglePause(): void {
    const session = this.session();
    if (session == null) return;
    const phase = session.getValue(HeartGuardSession, 'phase') ?? PHASE.READY;
    if (phase === PHASE.PLAYING) {
      session.setValue(HeartGuardSession, 'phase', PHASE.PAUSED);
      this.setHint('Paused. Poke PAUSE again or START to resume.');
    } else if (phase === PHASE.PAUSED) {
      session.setValue(HeartGuardSession, 'phase', PHASE.PLAYING);
      this.setHint('Resumed. Protect the heart.');
    }
    this.pushHud();
  }

  private resetGame(keepCalibration: boolean): void {
    const session = this.session();
    if (session == null) return;
    const calibrated = session.getValue(HeartGuardSession, 'calibratedDeadZone') ?? 0.06;
    const nextPhase = keepCalibration ? PHASE.CALIBRATING : calibrated > 0 ? PHASE.READY : PHASE.CALIBRATING;
    session.setValue(HeartGuardSession, 'phase', nextPhase);
    session.setValue(HeartGuardSession, 'heartHealth', 10);
    session.setValue(HeartGuardSession, 'energy', 0);
    session.setValue(HeartGuardSession, 'score', 0);
    session.setValue(HeartGuardSession, 'kills', 0);
    session.setValue(HeartGuardSession, 'wave', 1);
    session.setValue(HeartGuardSession, 'waveTime', 40);
    session.setValue(HeartGuardSession, 'timeScale', 0.15);
    session.setValue(HeartGuardSession, 'calibrationTime', keepCalibration ? 3 : 0);
    session.setValue(HeartGuardSession, 'selectedAbility', ABILITY.NONE);
    session.setValue(HeartGuardSession, 'barricadeRemaining', 0);
    session.setValue(HeartGuardSession, 'barricadeCooldown', 0);
    this.timeScale = 0.15;
    this.spawnTimer = 0;
    this.spawnQueueIndex = 0;
    this.resolvedThisWave = 0;
    this.combo = 0;
    this.phaseClock = 0;
    this.calibrationSampleCount = 0;
    if (this.barricade != null) this.barricade.visible = false;
    if (this.bomb != null) this.bomb.visible = false;
    for (const entity of this.queries.invaders.entities) this.deactivateInvader(entity);
    this.setHint(keepCalibration ? 'Show your hands and hold still for 3 seconds.' : 'Poke START WITH HANDS when ready.');
    this.pushHud();
  }

  private updateGame(session: Entity, dtReal: number, dtGame: number): void {
    const wave = session.getValue(HeartGuardSession, 'wave') ?? 1;
    const schedule = WAVE_KINDS[Math.min(WAVE_KINDS.length - 1, wave - 1)];
    const waveTime = Math.max(0, (session.getValue(HeartGuardSession, 'waveTime') ?? 40) - dtReal);
    session.setValue(HeartGuardSession, 'waveTime', waveTime);
    this.spawnTimer -= dtReal;
    if (this.spawnQueueIndex < schedule.length && this.spawnTimer <= 0) {
      if (this.spawnInvader(schedule[this.spawnQueueIndex])) {
        this.spawnQueueIndex += 1;
        this.spawnTimer = Math.max(1.2, 32 / schedule.length);
      }
    }

    for (const entity of this.queries.invaders.entities) {
      if (!entity.getValue(Invader, 'active') || entity.object3D == null) continue;
      const cooldown = Math.max(0, (entity.getValue(Invader, 'hitCooldown') ?? 0) - dtReal);
      entity.setValue(Invader, 'hitCooldown', cooldown);
      this.moveInvader(entity, dtGame, session);
    }

    if (this.spawnQueueIndex >= schedule.length && this.resolvedThisWave >= schedule.length && waveTime <= 0) {
      if (wave >= 5) {
        session.setValue(HeartGuardSession, 'phase', PHASE.WON);
        session.setValue(HeartGuardSession, 'score', (session.getValue(HeartGuardSession, 'score') ?? 0) + (session.getValue(HeartGuardSession, 'heartHealth') ?? 0) * 250);
        this.setHint('The heart is safe! Poke RESTART for another run.');
      } else {
        session.setValue(HeartGuardSession, 'wave', wave + 1);
        session.setValue(HeartGuardSession, 'waveTime', 40);
        this.spawnQueueIndex = 0;
        this.resolvedThisWave = 0;
        this.spawnTimer = 1.8;
        this.setHint(wave === 1 ? 'Paper planes incoming. Watch the air.' : wave === 2 ? 'Boot Brutes need 3 pokes. Save for a barricade.' : 'The next wave is faster. Stay calm.');
      }
      this.pushHud();
    }
  }

  private spawnInvader(kind: number): boolean {
    for (const entity of this.queries.invaders.entities) {
      if (entity.getValue(Invader, 'kind') !== kind || entity.getValue(Invader, 'active') || entity.object3D == null) continue;
      const home = this.invaderHomes.get(entity.object3D);
      const scale = this.invaderScales.get(entity.object3D);
      if (home != null) entity.object3D.position.copy(home);
      if (scale != null) entity.object3D.scale.copy(scale);
      entity.setValue(Invader, 'health', entity.getValue(Invader, 'maxHealth') ?? 1);
      entity.setValue(Invader, 'progress', 0);
      entity.setValue(Invader, 'hitCooldown', 0);
      entity.setValue(Invader, 'active', true);
      entity.object3D.visible = true;
      return true;
    }
    return false;
  }

  private moveInvader(entity: Entity, dtGame: number, session: Entity): void {
    const object = entity.object3D;
    if (object == null || this.heart == null) return;
    const home = this.invaderHomes.get(object);
    if (home == null) return;
    let progress = (entity.getValue(Invader, 'progress') ?? 0) + (entity.getValue(Invader, 'speed') ?? 0.05) * dtGame;
    const barricadeActive = (session.getValue(HeartGuardSession, 'barricadeRemaining') ?? 0) > 0;
    if (barricadeActive && progress > 0.78) {
      progress = 0.78;
      object.rotation.z = Math.sin(this.phaseClock * 11 + (entity.getValue(Invader, 'spawnIndex') ?? 0)) * 0.22;
    }
    entity.setValue(Invader, 'progress', progress);
    const kind = entity.getValue(Invader, 'kind') ?? 0;
    const index = entity.getValue(Invader, 'spawnIndex') ?? 0;
    const curve = Math.sin(progress * Math.PI) * Math.sin(index * 1.7) * 0.055;
    object.position.x = home.x + (this.heart.position.x - home.x) * progress + curve;
    object.position.z = home.z + (this.heart.position.z - home.z) * progress;
    if (kind === 2) {
      object.position.y = home.y + Math.sin(progress * Math.PI * 2 + index) * 0.035 - progress * 0.08;
      object.rotation.z = Math.sin(this.phaseClock * 3 + index) * 0.28;
    } else {
      const hop = Math.abs(Math.sin(this.phaseClock * (kind === 1 ? 4 : 8) + index));
      object.position.y = home.y + hop * (kind === 1 ? 0.018 : 0.032);
      object.rotation.z = Math.sin(this.phaseClock * (kind === 1 ? 3 : 7) + index) * (kind === 1 ? 0.08 : 0.14);
    }
    object.rotation.y = Math.atan2(this.heart.position.x - object.position.x, this.heart.position.z - object.position.z);
    if (progress >= 1) this.invaderReachedHeart(entity, session);
  }

  private invaderReachedHeart(entity: Entity, session: Entity): void {
    this.deactivateInvader(entity);
    this.resolvedThisWave += 1;
    this.combo = 0;
    const wave = session.getValue(HeartGuardSession, 'wave') ?? 1;
    const health = session.getValue(HeartGuardSession, 'heartHealth') ?? 10;
    const nextHealth = wave === 1 ? Math.max(1, health - 1) : Math.max(0, health - 1);
    session.setValue(HeartGuardSession, 'heartHealth', nextHealth);
    this.heartHitTimer = 0.32;
    if (nextHealth === 0) {
      session.setValue(HeartGuardSession, 'phase', PHASE.LOST);
      for (const invader of this.queries.invaders.entities) this.deactivateInvader(invader);
      this.setHint('The heart needs you. Poke RESTART and try again.');
    } else {
      this.setHint('Ouch! Slow down and protect the heart.');
    }
    this.pushHud();
  }

  private hitInvader(entity: Entity): void {
    const session = this.session();
    if (session == null || (session.getValue(HeartGuardSession, 'phase') ?? 0) !== PHASE.PLAYING) return;
    if (!entity.getValue(Invader, 'active') || entity.object3D == null) return;
    if ((entity.getValue(Invader, 'hitCooldown') ?? 0) > 0) return;
    const selected = session.getValue(HeartGuardSession, 'selectedAbility') ?? ABILITY.NONE;
    if (selected === ABILITY.BOMB) {
      this.explodeBomb(entity.object3D.position, session);
      session.setValue(HeartGuardSession, 'selectedAbility', ABILITY.NONE);
      return;
    }
    entity.setValue(Invader, 'hitCooldown', 0.15);
    this.damageInvader(entity, 1, session);
  }

  private damageInvader(entity: Entity, damage: number, session: Entity): void {
    if (!entity.getValue(Invader, 'active') || entity.object3D == null) return;
    const health = Math.max(0, (entity.getValue(Invader, 'health') ?? 1) - damage);
    entity.setValue(Invader, 'health', health);
    const homeScale = this.invaderScales.get(entity.object3D);
    if (homeScale != null) entity.object3D.scale.copy(homeScale).multiplyScalar(1.18);
    if (health > 0) {
      this.setHint(`Brute armor: ${health} more poke${health === 1 ? '' : 's'}.`);
      return;
    }
    this.deactivateInvader(entity);
    this.resolvedThisWave += 1;
    this.combo = Math.min(8, this.combo + 1);
    session.setValue(HeartGuardSession, 'kills', (session.getValue(HeartGuardSession, 'kills') ?? 0) + 1);
    session.setValue(HeartGuardSession, 'energy', Math.min(10, (session.getValue(HeartGuardSession, 'energy') ?? 0) + 1));
    session.setValue(HeartGuardSession, 'score', (session.getValue(HeartGuardSession, 'score') ?? 0) + 100 * this.combo);
    this.setHint(this.combo >= 3 ? `Calm combo x${this.combo}!` : 'Pop! Energy earned.');
    this.pushHud();
  }

  private deactivateInvader(entity: Entity): void {
    entity.setValue(Invader, 'active', false);
    entity.setValue(Invader, 'progress', 0);
    if (entity.object3D != null) {
      entity.object3D.visible = false;
      const scale = this.invaderScales.get(entity.object3D);
      if (scale != null) entity.object3D.scale.copy(scale);
    }
  }

  private activateBarricade(): void {
    const session = this.session();
    if (session == null || (session.getValue(HeartGuardSession, 'phase') ?? 0) !== PHASE.PLAYING) return;
    const energy = session.getValue(HeartGuardSession, 'energy') ?? 0;
    const cooldown = session.getValue(HeartGuardSession, 'barricadeCooldown') ?? 0;
    if (energy < 6 || cooldown > 0 || (session.getValue(HeartGuardSession, 'barricadeRemaining') ?? 0) > 0) {
      this.setHint(energy < 6 ? 'Barricade needs 6 energy.' : 'Barricade is recharging.');
      return;
    }
    session.setValue(HeartGuardSession, 'energy', energy - 6);
    session.setValue(HeartGuardSession, 'selectedAbility', ABILITY.BARRICADE);
    session.setValue(HeartGuardSession, 'barricadeRemaining', 10);
    if (this.barricade != null) this.barricade.visible = true;
    this.setHint('Barricade up for 10 seconds!');
    this.pushHud();
  }

  private armBomb(): void {
    const session = this.session();
    if (session == null || (session.getValue(HeartGuardSession, 'phase') ?? 0) !== PHASE.PLAYING) return;
    const energy = session.getValue(HeartGuardSession, 'energy') ?? 0;
    if (energy < 4) {
      this.setHint('Bomb needs 4 energy.');
      return;
    }
    session.setValue(HeartGuardSession, 'energy', energy - 4);
    session.setValue(HeartGuardSession, 'selectedAbility', ABILITY.BOMB);
    if (this.bomb != null) this.bomb.visible = true;
    this.setHint('Bomb armed. Poke or pinch an invader to choose the blast point.');
    this.pushHud();
  }

  private explodeBomb(position: Vector3, session: Entity): void {
    if (this.bomb != null) {
      this.bomb.position.copy(position);
      this.bomb.visible = true;
      this.bomb.scale.setScalar(1.7);
    }
    this.bombTimer = 0.6;
    for (const entity of this.queries.invaders.entities) {
      if (!entity.getValue(Invader, 'active') || entity.object3D == null) continue;
      if (entity.object3D.position.distanceToSquared(position) <= 0.0289) this.damageInvader(entity, 2, session);
    }
    this.setHint('BOOM! The toy box shakes.');
  }

  private updateEffects(session: Entity, dtReal: number): void {
    this.phaseClock += dtReal * this.timeScale;
    const barricadeRemaining = Math.max(0, (session.getValue(HeartGuardSession, 'barricadeRemaining') ?? 0) - dtReal);
    if (barricadeRemaining > 0) {
      session.setValue(HeartGuardSession, 'barricadeRemaining', barricadeRemaining);
      if (this.barricade != null) {
        this.barricade.visible = true;
        this.barricade.rotation.y += dtReal * 0.35;
        const pulse = 1 + Math.sin(this.phaseClock * 7) * 0.025;
        this.barricade.scale.setScalar(pulse);
      }
    } else if ((session.getValue(HeartGuardSession, 'selectedAbility') ?? 0) === ABILITY.BARRICADE) {
      session.setValue(HeartGuardSession, 'selectedAbility', ABILITY.NONE);
      session.setValue(HeartGuardSession, 'barricadeCooldown', 8);
      if (this.barricade != null) {
        this.barricade.visible = false;
        this.barricade.scale.setScalar(1);
      }
      this.setHint('Barricade crumbled. Recharge: 8 seconds.');
    }
    const cooldown = Math.max(0, (session.getValue(HeartGuardSession, 'barricadeCooldown') ?? 0) - dtReal);
    session.setValue(HeartGuardSession, 'barricadeCooldown', cooldown);
    if (this.bombTimer > 0) {
      this.bombTimer -= dtReal;
      if (this.bomb != null) this.bomb.rotation.y += dtReal * 8;
      if (this.bombTimer <= 0 && this.bomb != null) {
        this.bomb.visible = false;
        this.bomb.scale.setScalar(1);
      }
    } else if ((session.getValue(HeartGuardSession, 'selectedAbility') ?? 0) !== ABILITY.BOMB && this.bomb != null) {
      this.bomb.visible = false;
    }
  }

  private animateHeart(dtReal: number, session: Entity): void {
    this.phaseClock += dtReal * 0.35;
    if (this.heart == null) return;
    const health = session.getValue(HeartGuardSession, 'heartHealth') ?? 10;
    const breathingRate = health <= 3 ? 5.5 : 2.2;
    const breathe = 1 + (Math.sin(this.phaseClock * breathingRate) * 0.5 + 0.5) * 0.035;
    if (this.heartHitTimer > 0) {
      this.heartHitTimer -= dtReal;
      const squash = Math.sin((this.heartHitTimer / 0.32) * Math.PI) * 0.14;
      this.heart.scale.set(1 + squash, 1 - squash, 1 + squash * 0.5);
    } else {
      this.heart.scale.set(breathe, breathe, breathe);
    }
  }

  private updateHud(dtReal: number, leftTracked: boolean, rightTracked: boolean): void {
    this.hudTimer -= dtReal;
    if (this.hudTimer > 0) return;
    this.hudTimer = 0.1;
    const session = this.session();
    if (session == null) return;
    if (!leftTracked && !rightTracked && (session.getValue(HeartGuardSession, 'phase') ?? 0) === PHASE.CALIBRATING) {
      this.setHint('Show either hand to begin calibration.');
    }
    this.pushHud();
  }

  private pushHud(): void {
    const session = this.session();
    if (session == null) return;
    const health = session.getValue(HeartGuardSession, 'heartHealth') ?? 10;
    const energy = session.getValue(HeartGuardSession, 'energy') ?? 0;
    const wave = session.getValue(HeartGuardSession, 'wave') ?? 1;
    const score = session.getValue(HeartGuardSession, 'score') ?? 0;
    const phase = session.getValue(HeartGuardSession, 'phase') ?? PHASE.CALIBRATING;
    let active = 0;
    for (const entity of this.queries.invaders.entities) if (entity.getValue(Invader, 'active')) active += 1;
    const phaseLabel = phase === PHASE.CALIBRATING
      ? `CALIBRATING ${Math.ceil(session.getValue(HeartGuardSession, 'calibrationTime') ?? 3)}s`
      : phase === PHASE.READY ? 'READY - POKE START'
      : phase === PHASE.PLAYING ? `WAVE ${wave} IN PROGRESS`
      : phase === PHASE.PAUSED ? 'PAUSED'
      : phase === PHASE.WON ? 'HEART SAVED!'
      : 'HEART NEEDS HELP';
    this.statusText?.setProperties({ text: phaseLabel });
    this.healthText?.setProperties({ text: `${health}/10` });
    this.energyText?.setProperties({ text: `${energy}/10` });
    this.waveText?.setProperties({ text: `${wave}/5` });
    this.scoreText?.setProperties({ text: score.toString().padStart(4, '0') });
    this.timeText?.setProperties({ text: `${Math.round(this.timeScale * 100)}%` });
    this.enemiesText?.setProperties({ text: `${active}` });
    this.overlay?.update({ phase: phaseLabel, health, energy, wave, score, timeScale: this.timeScale, enemies: active });
  }

  private setHint(text: string): void {
    this.hintText?.setProperties({ text });
  }

  private session(): Entity | undefined {
    return this.queries.sessions.entities.values().next().value;
  }
}
