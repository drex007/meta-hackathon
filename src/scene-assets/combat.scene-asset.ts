import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import { alignSpan, bevelBox, LoftSurface, taperPlate } from './lib/hardsurface.js';

const gunMetal = new MeshStandardMaterial({ color: '#10151a', metalness: 0.82, roughness: 0.28 });
const militaryGreen = new MeshStandardMaterial({ color: '#344437', metalness: 0.32, roughness: 0.62 });
const fieldTan = new MeshStandardMaterial({ color: '#88775a', metalness: 0.12, roughness: 0.75 });
const armor = new MeshStandardMaterial({ color: '#26313a', metalness: 0.56, roughness: 0.46 });
const opticRed = new MeshStandardMaterial({
  color: '#ff734c', emissive: '#ff2808', emissiveIntensity: 4, metalness: 0.2, roughness: 0.2,
});
const muzzleGlow = new MeshStandardMaterial({
  color: '#fff1a6', emissive: '#ff6508', emissiveIntensity: 6, roughness: 0.1,
});

function part(name: string, geometry: ConstructorParameters<typeof Mesh>[0], material: MeshStandardMaterial): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

export function createServiceRifle(): Group {
  const rifle = new Group();
  rifle.name = 'VX9ServiceRifle';

  const receiverSurface = LoftSurface.tube([
    { z: -0.48, halfW: 0.075, hUp: 0.09, hDown: 0.07, power: 2 },
    { z: -0.2, halfW: 0.095, hUp: 0.105, hDown: 0.08, power: 1.8 },
    { z: 0.16, halfW: 0.085, hUp: 0.09, hDown: 0.075, power: 2 },
  ]);
  const receiver = part('Receiver', receiverSurface.build([-0.48, -0.2, 0.16], 16, true), militaryGreen);
  receiver.position.y = 0.08;
  rifle.add(receiver);

  const stockSurface = LoftSurface.tube([
    { z: 0.12, halfW: 0.075, hUp: 0.075, hDown: 0.06, power: 2 },
    { z: 0.44, halfW: 0.065, hUp: 0.08, hDown: 0.08, power: 2 },
    { z: 0.67, halfW: 0.095, hUp: 0.13, hDown: 0.12, power: 1.7 },
  ]);
  const stock = part('AdjustableStock', stockSurface.build([0.12, 0.44, 0.67], 14, true), fieldTan);
  stock.position.y = 0.08;
  rifle.add(stock);

  const barrel = part('Barrel', new CylinderGeometry(0.022, 0.028, 0.5, 14), gunMetal);
  alignSpan(barrel, new Vector3(0, 0.1, -0.92), new Vector3(0, 0.1, -0.43));
  const suppressor = part('MuzzleBrake', new CylinderGeometry(0.042, 0.035, 0.16, 12), gunMetal);
  alignSpan(suppressor, new Vector3(0, 0.1, -1.03), new Vector3(0, 0.1, -0.87));
  rifle.add(barrel, suppressor);

  const handguardSurface = LoftSurface.tube([
    { z: -0.76, halfW: 0.055, hUp: 0.06, hDown: 0.055, power: 2 },
    { z: -0.58, halfW: 0.078, hUp: 0.08, hDown: 0.068, power: 1.8 },
    { z: -0.42, halfW: 0.085, hUp: 0.085, hDown: 0.07, power: 2 },
  ]);
  const handguard = part('ArmoredHandguard', handguardSurface.build([-0.76, -0.58, -0.42], 12, true), militaryGreen);
  handguard.position.y = 0.1;
  rifle.add(handguard);

  const grip = part('PistolGrip', bevelBox(0.11, 0.29, 0.1, 0.025, 0.035), fieldTan);
  grip.position.set(0, -0.1, 0.03);
  grip.rotation.x = -0.18;
  const magazine = part('Magazine', taperPlate(0.16, 0.14, 0.11, 0.3, 0.025), gunMetal);
  magazine.rotation.z = Math.PI / 2;
  magazine.position.set(0, -0.12, -0.22);
  rifle.add(grip, magazine);

  const rail = part('TopRail', new BoxGeometry(0.115, 0.025, 0.48), gunMetal);
  rail.position.set(0, 0.205, -0.12);
  const optic = part('CombatOptic', bevelBox(0.1, 0.11, 0.16, 0.02, 0.03), gunMetal);
  optic.position.set(0, 0.27, -0.08);
  const lens = part('OpticLens', new SphereGeometry(0.025, 12, 8), opticRed);
  lens.position.set(0, 0.27, -0.165);
  rifle.add(rail, optic, lens);

  const flash = new Group();
  flash.name = 'MuzzleFlash';
  flash.position.set(0, 0.1, -1.08);
  const flashCore = part('FlashCore', new IcosahedronGeometry(0.085, 0), muzzleGlow);
  const flashRing = part('FlashRing', new TorusGeometry(0.11, 0.015, 6, 18), muzzleGlow);
  flashRing.rotation.x = Math.PI / 2;
  flash.add(flashCore, flashRing);
  flash.visible = false;
  rifle.add(flash);
  return rifle;
}

export function createCombatSentry(): Group {
  const sentry = new Group();
  sentry.name = 'AegisCombatSentry';

  const base = part('ArmoredBase', new CylinderGeometry(0.34, 0.43, 0.18, 8), armor);
  base.position.y = 0.09;
  const swivel = part('TurretSwivel', new CylinderGeometry(0.2, 0.24, 0.22, 12), gunMetal);
  swivel.position.y = 0.29;
  sentry.add(base, swivel);

  const torso = part('ArmoredTorso', taperPlate(0.7, 0.5, 0.32, 0.48, 0.055), militaryGreen);
  torso.rotation.z = Math.PI / 2;
  torso.position.y = 0.66;
  const head = part('SensorHead', bevelBox(0.48, 0.26, 0.3, 0.045, 0.06), armor);
  head.position.y = 1.02;
  sentry.add(torso, head);

  const eye = part('TargetCore', new SphereGeometry(0.085, 16, 10), opticRed);
  eye.position.set(0, 1.04, 0.165);
  sentry.add(eye);

  for (const side of [-1, 1]) {
    const pod = part(
      side < 0 ? 'AmmoPodLeft' : 'AmmoPodRight',
      bevelBox(0.18, 0.38, 0.3, 0.035, 0.045),
      fieldTan,
    );
    pod.position.set(side * 0.34, 0.78, -0.02);
    sentry.add(pod);
  }

  for (const side of [-1, 1]) {
    const cannon = part(
      side < 0 ? 'CannonLeft' : 'CannonRight',
      new CylinderGeometry(0.035, 0.045, 0.54, 10),
      gunMetal,
    );
    alignSpan(cannon, new Vector3(side * 0.23, 0.97, 0.12), new Vector3(side * 0.23, 0.97, 0.66));
    sentry.add(cannon);
  }

  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2;
    const foot = part(`Stabilizer-${index + 1}`, bevelBox(0.16, 0.12, 0.62, 0.025), fieldTan);
    foot.position.set(Math.sin(angle) * 0.3, 0.08, Math.cos(angle) * 0.3);
    foot.rotation.y = angle;
    sentry.add(foot);
  }
  return sentry;
}
