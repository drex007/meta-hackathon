import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import { bevelBox, taperPlate } from './lib/hardsurface.js';

const MAT = {
  heart: new MeshStandardMaterial({ color: '#ff5f8a', emissive: '#6b102f', emissiveIntensity: 0.75, roughness: 0.82 }),
  heartLight: new MeshStandardMaterial({ color: '#ffb2c7', emissive: '#ff5f8a', emissiveIntensity: 0.5, roughness: 0.7 }),
  ink: new MeshStandardMaterial({ color: '#241d38', roughness: 0.9 }),
  white: new MeshStandardMaterial({ color: '#fff9ec', roughness: 0.86 }),
  bunny: new MeshStandardMaterial({ color: '#aaa6b4', roughness: 1 }),
  bunnyLight: new MeshStandardMaterial({ color: '#d9d5df', roughness: 1 }),
  brute: new MeshStandardMaterial({ color: '#3c7d4e', roughness: 0.88 }),
  boot: new MeshStandardMaterial({ color: '#7c4d2d', roughness: 0.96 }),
  plane: new MeshStandardMaterial({ color: '#fff8df', emissive: '#3b3150', emissiveIntensity: 0.2, roughness: 0.8, side: DoubleSide }),
  wood: new MeshStandardMaterial({ color: '#c98f5a', roughness: 0.9 }),
  woodDark: new MeshStandardMaterial({ color: '#7b4a38', roughness: 0.96 }),
  dusk: new MeshStandardMaterial({ color: '#2b2142', emissive: '#130e26', emissiveIntensity: 0.65, roughness: 0.92 }),
  lamp: new MeshStandardMaterial({ color: '#ffd58a', emissive: '#ffad43', emissiveIntensity: 3.4, roughness: 0.5 }),
  cyan: new MeshStandardMaterial({ color: '#6fe3ff', emissive: '#1286b8', emissiveIntensity: 2.1, roughness: 0.35 }),
  orange: new MeshStandardMaterial({ color: '#ff6a3d', emissive: '#b52c12', emissiveIntensity: 1.9, roughness: 0.54 }),
  yellow: new MeshStandardMaterial({ color: '#ffd25c', emissive: '#7f4c00', emissiveIntensity: 0.6, roughness: 0.72 }),
  purple: new MeshStandardMaterial({ color: '#805ad5', emissive: '#26105c', emissiveIntensity: 0.55, roughness: 0.76 }),
};

function mesh(name: string, geometry: ConstructorParameters<typeof Mesh>[0], material: MeshStandardMaterial): Mesh {
  const result = new Mesh(geometry, material);
  result.name = name;
  return result;
}

function eye(name: string, x: number, y: number, z: number, scale = 1): Group {
  const root = new Group();
  root.name = name;
  root.position.set(x, y, z);
  const white = mesh('EyeWhite', new SphereGeometry(0.024 * scale, 12, 8), MAT.white);
  white.scale.y = 1.15;
  const pupil = mesh('Pupil', new SphereGeometry(0.011 * scale, 10, 7), MAT.ink);
  pupil.position.z = 0.02 * scale;
  root.add(white, pupil);
  return root;
}

export function createPlushHeart(): Group {
  const root = new Group();
  root.name = 'PlushHeartHero';
  const shape = new Shape();
  shape.moveTo(0, 0.02);
  shape.bezierCurveTo(-0.16, -0.08, -0.18, 0.1, -0.095, 0.14);
  shape.bezierCurveTo(-0.035, 0.17, 0, 0.115, 0, 0.09);
  shape.bezierCurveTo(0, 0.115, 0.035, 0.17, 0.095, 0.14);
  shape.bezierCurveTo(0.18, 0.1, 0.16, -0.08, 0, 0.02);
  const body = mesh('HeartBody', new ExtrudeGeometry(shape, { depth: 0.075, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 0.012, bevelThickness: 0.012 }), MAT.heart);
  body.position.set(0, 0.105, -0.0375);
  root.add(body);

  root.add(eye('EyeLeft', -0.045, 0.205, 0.05, 0.9), eye('EyeRight', 0.045, 0.205, 0.05, 0.9));
  const mouth = mesh('Smile', new TorusGeometry(0.031, 0.005, 7, 18, Math.PI), MAT.ink);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, 0.155, 0.06);
  const cheekLeft = mesh('CheekLeft', new SphereGeometry(0.016, 10, 7), MAT.heartLight);
  cheekLeft.scale.set(1.35, 0.65, 0.35);
  cheekLeft.position.set(-0.08, 0.164, 0.057);
  const cheekRight = cheekLeft.clone();
  cheekRight.name = 'CheekRight';
  cheekRight.position.x = 0.08;
  root.add(mouth, cheekLeft, cheekRight);

  for (let index = 0; index < 11; index += 1) {
    const angle = Math.PI * 0.18 + (index / 10) * Math.PI * 1.64;
    const stitch = mesh(`Stitch-${index + 1}`, new BoxGeometry(0.017, 0.004, 0.006), MAT.heartLight);
    stitch.position.set(Math.cos(angle) * 0.112, 0.12 + Math.sin(angle) * 0.09, 0.06);
    stitch.rotation.z = angle + Math.PI / 2;
    root.add(stitch);
  }
  return root;
}

export function createToyTable(): Group {
  const root = new Group();
  root.name = 'ToyRoomTable';
  const top = mesh('TableTop', new CylinderGeometry(0.4, 0.42, 0.055, 48), MAT.wood);
  top.position.y = -0.028;
  const rim = mesh('TableRim', new TorusGeometry(0.405, 0.012, 8, 64), MAT.woodDark);
  rim.rotation.x = Math.PI / 2;
  root.add(top, rim);
  for (const side of [-1, 1]) {
    const leg = mesh(side < 0 ? 'TableLegLeft' : 'TableLegRight', bevelBox(0.065, 0.62, 0.065, 0.012), MAT.woodDark);
    leg.position.set(side * 0.29, -0.34, 0.08);
    root.add(leg);
  }
  const back = mesh('DuskRoomBackdrop', bevelBox(1.4, 0.86, 0.04, 0.025), MAT.dusk);
  back.position.set(0, 0.32, -0.52);
  root.add(back);
  for (let index = 0; index < 7; index += 1) {
    const star = mesh(`WindowStar-${index + 1}`, new IcosahedronGeometry(0.008 + (index % 2) * 0.003, 0), MAT.lamp);
    star.position.set(-0.48 + index * 0.16, 0.25 + (index % 3) * 0.14, -0.492);
    root.add(star);
  }
  const lampStem = mesh('LampStem', new CylinderGeometry(0.012, 0.015, 0.34, 10), MAT.woodDark);
  lampStem.position.set(0.48, 0.18, -0.33);
  const lampShade = mesh('LampShade', new ConeGeometry(0.11, 0.14, 18, 1, true), MAT.lamp);
  lampShade.position.set(0.48, 0.36, -0.33);
  root.add(lampStem, lampShade);
  const blocks = ['#ff5f8a', '#6fe3ff', '#ffd25c'];
  for (let index = 0; index < 5; index += 1) {
    const blockMat = new MeshStandardMaterial({ color: blocks[index % blocks.length], roughness: 0.82 });
    const block = mesh(`ToyBlock-${index + 1}`, bevelBox(0.055, 0.055, 0.055, 0.009), blockMat);
    block.position.set(-0.31 + index * 0.06, 0.03, -0.25 - (index % 2) * 0.04);
    block.rotation.y = index * 0.37;
    root.add(block);
  }
  return root;
}

export function createDustBunny(): Group {
  const root = new Group();
  root.name = 'DustBunnyRunner';
  const body = mesh('FluffBody', new IcosahedronGeometry(0.052, 2), MAT.bunny);
  body.position.y = 0.052;
  body.scale.set(1.12, 0.96, 1.05);
  root.add(body);
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2;
    const tuft = mesh(`FluffTuft-${index + 1}`, new IcosahedronGeometry(0.021, 1), index % 2 ? MAT.bunny : MAT.bunnyLight);
    tuft.position.set(Math.sin(angle) * 0.047, 0.056 + Math.cos(angle * 2) * 0.014, Math.cos(angle) * 0.042);
    root.add(tuft);
  }
  root.add(eye('EyeLeft', -0.021, 0.072, 0.045, 0.68), eye('EyeRight', 0.021, 0.072, 0.045, 0.68));
  for (const side of [-1, 1]) {
    const foot = mesh(side < 0 ? 'FootLeft' : 'FootRight', new SphereGeometry(0.019, 10, 7), MAT.bunnyLight);
    foot.scale.set(1.35, 0.55, 1.6);
    foot.position.set(side * 0.029, 0.013, 0.025);
    root.add(foot);
  }
  return root;
}

export function createBootBrute(): Group {
  const root = new Group();
  root.name = 'BootBrute';
  const body = mesh('BruteBody', new SphereGeometry(0.061, 16, 11), MAT.brute);
  body.scale.set(1.05, 1.22, 0.92);
  body.position.y = 0.095;
  root.add(body);
  root.add(eye('EyeLeft', -0.025, 0.115, 0.055, 0.75), eye('EyeRight', 0.025, 0.115, 0.055, 0.75));
  for (const side of [-1, 1]) {
    const brow = mesh(side < 0 ? 'BrowLeft' : 'BrowRight', bevelBox(0.035, 0.008, 0.009, 0.002), MAT.ink);
    brow.position.set(side * 0.026, 0.143, 0.063);
    brow.rotation.z = side * 0.28;
    const boot = mesh(side < 0 ? 'BootLeft' : 'BootRight', bevelBox(0.052, 0.035, 0.072, 0.01), MAT.boot);
    boot.position.set(side * 0.038, 0.018, 0.012);
    boot.rotation.y = side * 0.08;
    root.add(brow, boot);
  }
  const mouth = mesh('Grumble', bevelBox(0.046, 0.007, 0.008, 0.002), MAT.ink);
  mouth.position.set(0, 0.077, 0.062);
  root.add(mouth);
  return root;
}

export function createPaperPlane(): Group {
  const root = new Group();
  root.name = 'PaperPlaneFlier';
  const center = mesh('FoldedBody', taperPlate(0.035, 0.025, 0.012, 0.16, 0.004), MAT.plane);
  center.rotation.x = Math.PI / 2;
  center.rotation.z = Math.PI / 2;
  root.add(center);
  for (const side of [-1, 1]) {
    const wing = mesh(side < 0 ? 'WingLeft' : 'WingRight', taperPlate(0.1, 0.065, 0.012, 0.008, 0.003), MAT.plane);
    wing.position.set(side * 0.047, 0, -0.01);
    wing.rotation.y = side * -0.18;
    wing.rotation.z = side * 0.04;
    root.add(wing);
  }
  const nose = mesh('PlaneNose', new ConeGeometry(0.012, 0.045, 6), MAT.yellow);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.085;
  root.add(nose);
  return root;
}

export function createToyBarricade(): Group {
  const root = new Group();
  root.name = 'ToyBlockBarricade';
  const colors = [MAT.cyan, MAT.heart, MAT.yellow, MAT.purple];
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const block = mesh(`ShieldBlock-${index + 1}`, bevelBox(0.045, 0.045 + (index % 2) * 0.018, 0.032, 0.007), colors[index % colors.length]);
    block.position.set(Math.sin(angle) * 0.15, 0.025 + (index % 2) * 0.012, Math.cos(angle) * 0.15);
    block.rotation.y = angle;
    root.add(block);
  }
  const countdown = mesh('CountdownRing', new TorusGeometry(0.18, 0.009, 8, 48), MAT.cyan);
  countdown.rotation.x = Math.PI / 2;
  countdown.position.y = 0.008;
  root.add(countdown);
  return root;
}

export function createToyBomb(): Group {
  const root = new Group();
  root.name = 'ToyBomb';
  const body = mesh('BombBody', new SphereGeometry(0.048, 16, 11), MAT.orange);
  body.position.y = 0.05;
  const cap = mesh('FuseCap', new CylinderGeometry(0.012, 0.016, 0.025, 10), MAT.ink);
  cap.position.y = 0.1;
  const fuse = mesh('FuseGlow', new TorusGeometry(0.027, 0.005, 6, 16, Math.PI * 0.8), MAT.yellow);
  fuse.rotation.z = -0.5;
  fuse.position.set(0.014, 0.128, 0);
  root.add(body, cap, fuse);
  return root;
}

export function createHeartHealthToken(): Group {
  const root = new Group();
  root.name = 'MiniHeartHealthToken';
  const left = mesh('LeftLobe', new SphereGeometry(0.018, 10, 7), MAT.heart);
  left.position.set(-0.012, 0.018, 0);
  const right = left.clone();
  right.name = 'RightLobe';
  right.position.x = 0.012;
  const point = mesh('HeartPoint', new ConeGeometry(0.023, 0.04, 10), MAT.heart);
  point.rotation.z = Math.PI;
  point.position.y = 0.002;
  root.add(left, right, point);
  return root;
}
