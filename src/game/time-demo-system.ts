import { createSystem, type Entity, type Object3D, Pressed, Vector3 } from '@iwsdk/core';
import { PositionSpeedTracker, ScalarEmaFilter } from '../core/filters.js';
import {
  advanceTimeScale,
  DEFAULT_TIME_SCALE_PARAMETERS,
  type TimeScaleParameters,
} from '../core/time-scale.js';
import { DebugPanel } from '../debug/panel.js';
import { BirdFlight, CombatSession, CombatTarget } from './combat-components.js';

export class TimeDemoSystem extends createSystem({
  targets: { required: [CombatTarget] },
  birds: { required: [CombatTarget, BirdFlight] },
  hitTargets: { required: [CombatTarget, Pressed] },
  sessions: { required: [CombatSession] },
}) {
  private readonly parameters: TimeScaleParameters = {
    ...DEFAULT_TIME_SCALE_PARAMETERS,
  };
  private readonly leftTracker = new PositionSpeedTracker();
  private readonly rightTracker = new PositionSpeedTracker();
  private readonly headTracker = new PositionSpeedTracker();
  private readonly speedFilter = new ScalarEmaFilter(0.3);
  private readonly leftPosition = new Vector3();
  private readonly rightPosition = new Vector3();
  private readonly headPosition = new Vector3();
  private readonly targetHomes = new Map<Object3D, Vector3>();
  private readonly targetHomeScales = new Map<Object3D, Vector3>();
  private readonly birdWings = new Map<Object3D, { left: Object3D; right: Object3D }>();
  private readonly hitPulses = new Map<Object3D, number>();
  private weapon?: Object3D;
  private muzzleFlash?: Object3D;
  private panel?: DebugPanel;
  private phase = 0;
  private timeScale = DEFAULT_TIME_SCALE_PARAMETERS.minScale;
  private telemetryElapsed = 0;
  private muzzleFlashTimer = 0;
  private respawnTimer = -1;

  init(): void {
    for (const entity of this.queries.targets.entities) {
      if (entity.object3D != null) {
        this.targetHomes.set(entity.object3D, entity.object3D.position.clone());
        this.targetHomeScales.set(entity.object3D, entity.object3D.scale.clone());
      }
    }
    for (const entity of this.queries.birds.entities) {
      if (entity.object3D == null) continue;
      const left = entity.object3D.getObjectByName('WingLeftPivot');
      const right = entity.object3D.getObjectByName('WingRightPivot');
      if (left != null && right != null) this.birdWings.set(entity.object3D, { left, right });
    }

    this.weapon = this.world.getSceneObject<Object3D>('service-rifle') ?? undefined;
    if (this.weapon != null) {
      this.player.gripSpaces.right.add(this.weapon);
      this.weapon.position.set(0.035, -0.08, -0.08);
      this.weapon.rotation.set(-0.08, 0, 0);
      this.muzzleFlash = this.weapon.getObjectByName('MuzzleFlash') ?? undefined;
    }
    this.queries.hitTargets.subscribe('qualify', (entity) => this.hitTarget(entity));

    const enterXr = (): void => {
      void this.world.launchXR();
    };
    this.panel = new DebugPanel(this.parameters, enterXr, this.world.xrEnabled);
    this.pushCombatHud();
    this.cleanupFuncs.push(() => this.panel?.dispose());
  }

  update(deltaReal: number): void {
    const dtReal = Math.min(Math.max(deltaReal, 0), 0.05);
    const leftTracked = this.world.input.isPrimary('hand', 'left');
    const rightTracked = this.world.input.isPrimary('hand', 'right');

    let leftSpeed = this.leftTracker.hold(dtReal);
    let rightSpeed = this.rightTracker.hold(dtReal);

    if (leftTracked) {
      this.player.gripSpaces.left.getWorldPosition(this.leftPosition);
      leftSpeed = this.leftTracker.update(
        this.leftPosition.x,
        this.leftPosition.y,
        this.leftPosition.z,
        dtReal,
      );
    }
    if (rightTracked) {
      this.player.gripSpaces.right.getWorldPosition(this.rightPosition);
      rightSpeed = this.rightTracker.update(
        this.rightPosition.x,
        this.rightPosition.y,
        this.rightPosition.z,
        dtReal,
      );
    }

    this.player.head.getWorldPosition(this.headPosition);
    const headSpeed = this.headTracker.update(
      this.headPosition.x,
      this.headPosition.y,
      this.headPosition.z,
      dtReal,
    );
    const desktopSpeed = this.panel?.fallbackMoving ? this.parameters.fullSpeed : 0;
    const rawSpeed = Math.max(
      leftSpeed,
      rightSpeed,
      headSpeed * this.parameters.headWeight,
      desktopSpeed,
    );
    const smoothedSpeed = this.speedFilter.update(rawSpeed);
    this.timeScale = advanceTimeScale(
      this.timeScale,
      smoothedSpeed,
      dtReal,
      this.parameters,
    );

    const dtGame = dtReal * this.timeScale;
    this.phase += dtGame;
    this.updateCombat(dtReal);

    this.telemetryElapsed += dtReal;
    if (this.telemetryElapsed >= 0.05) {
      this.panel?.update({
        leftWristSpeed: leftSpeed,
        rightWristSpeed: rightSpeed,
        headSpeed,
        rawSpeed,
        smoothedSpeed,
        timeScale: this.timeScale,
        fps: dtReal > 0 ? 1 / dtReal : 0,
        handsTracked: Number(leftTracked) + Number(rightTracked),
      });
      this.telemetryElapsed = 0;
    }
  }

  private hitTarget(entity: Entity): void {
    if (!entity.getValue(CombatTarget, 'active') || entity.object3D == null) return;
    const session = this.queries.sessions.entities.values().next().value;
    if (session == null) return;

    session.setValue(
      CombatSession,
      'roundsFired',
      (session.getValue(CombatSession, 'roundsFired') ?? 0) + 1,
    );
    const health = Math.max(0, (entity.getValue(CombatTarget, 'health') ?? 1) - 1);
    entity.setValue(CombatTarget, 'health', health);
    this.hitPulses.set(entity.object3D, 0.16);
    this.muzzleFlashTimer = 0.07;
    if (this.muzzleFlash != null) this.muzzleFlash.visible = true;

    if (health === 0) {
      entity.setValue(CombatTarget, 'active', false);
      entity.object3D.visible = false;
      session.setValue(
        CombatSession,
        'kills',
        (session.getValue(CombatSession, 'kills') ?? 0) + 1,
      );
      session.setValue(
        CombatSession,
        'score',
        (session.getValue(CombatSession, 'score') ?? 0) +
          (entity.getValue(CombatTarget, 'scoreValue') ?? 100),
      );
      let anyActive = false;
      for (const target of this.queries.targets.entities) {
        if (target.getValue(CombatTarget, 'active')) anyActive = true;
      }
      if (!anyActive) this.respawnTimer = 1.4;
    }
    this.pushCombatHud();
  }

  private updateCombat(dtReal: number): void {
    this.muzzleFlashTimer -= dtReal;
    if (this.muzzleFlashTimer <= 0 && this.muzzleFlash != null) this.muzzleFlash.visible = false;

    for (const [object, remaining] of this.hitPulses) {
      const next = remaining - dtReal;
      const pulse = 1 + Math.max(0, next) * 0.8;
      const homeScale = this.targetHomeScales.get(object);
      if (homeScale != null) object.scale.copy(homeScale).multiplyScalar(pulse);
      if (next <= 0) {
        if (homeScale != null) object.scale.copy(homeScale);
        this.hitPulses.delete(object);
      } else {
        this.hitPulses.set(object, next);
      }
    }

    for (const entity of this.queries.birds.entities) {
      if (!entity.getValue(CombatTarget, 'active') || entity.object3D == null) continue;
      const home = this.targetHomes.get(entity.object3D);
      const speed = entity.getValue(BirdFlight, 'speed') ?? 1;
      const phaseOffset = entity.getValue(BirdFlight, 'phase') ?? 0;
      const wingRate = entity.getValue(BirdFlight, 'wingRate') ?? 7;
      const lane = entity.getValue(BirdFlight, 'lane') ?? 0;
      const flight = this.phase * speed + phaseOffset;
      if (home != null) {
        entity.object3D.position.x = home.x + Math.sin(flight) * (0.42 + lane * 0.08);
        entity.object3D.position.y = home.y + Math.sin(flight * 1.7) * (0.16 + lane * 0.025);
        entity.object3D.position.z = home.z + Math.cos(flight * 0.72) * 0.24;
      }
      entity.object3D.rotation.y = Math.sin(flight * 0.48) * 0.2;
      entity.object3D.rotation.z = -Math.cos(flight) * 0.18;
      const wings = this.birdWings.get(entity.object3D);
      if (wings != null) {
        const flap = Math.sin(this.phase * wingRate + phaseOffset) * 0.62;
        wings.left.rotation.z = flap;
        wings.right.rotation.z = -flap;
      }
    }

    if (this.respawnTimer >= 0) {
      this.respawnTimer -= dtReal;
      if (this.respawnTimer <= 0) this.beginNextWave();
    }
  }

  private beginNextWave(): void {
    const session = this.queries.sessions.entities.values().next().value;
    if (session == null) return;
    const wave = (session.getValue(CombatSession, 'wave') ?? 1) + 1;
    session.setValue(CombatSession, 'wave', wave);
    for (const target of this.queries.targets.entities) {
      target.setValue(
        CombatTarget,
        'health',
        target.getValue(CombatTarget, 'maxHealth') ?? 1,
      );
      target.setValue(CombatTarget, 'active', true);
      if (target.object3D != null) {
        target.object3D.visible = true;
        const homeScale = this.targetHomeScales.get(target.object3D);
        if (homeScale != null) target.object3D.scale.copy(homeScale);
      }
    }
    this.respawnTimer = -1;
    this.pushCombatHud();
  }

  private pushCombatHud(): void {
    const session = this.queries.sessions.entities.values().next().value;
    if (session == null) return;
    let activeTargets = 0;
    for (const target of this.queries.targets.entities) {
      if (target.getValue(CombatTarget, 'active')) activeTargets += 1;
    }
    this.panel?.updateCombat({
      score: session.getValue(CombatSession, 'score') ?? 0,
      kills: session.getValue(CombatSession, 'kills') ?? 0,
      wave: session.getValue(CombatSession, 'wave') ?? 1,
      roundsFired: session.getValue(CombatSession, 'roundsFired') ?? 0,
      activeTargets,
    });
  }
}
