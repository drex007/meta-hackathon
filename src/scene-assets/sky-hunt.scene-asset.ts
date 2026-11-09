import {
  BoxGeometry,
  ConeGeometry,
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

const midnight = new MeshStandardMaterial({
  color: '#15103b', emissive: '#160a48', emissiveIntensity: 0.7, roughness: 0.74, metalness: 0.12,
});
const violet = new MeshStandardMaterial({
  color: '#7127ff', emissive: '#3a0da8', emissiveIntensity: 1.2, roughness: 0.46, metalness: 0.18,
});
const hotPink = new MeshStandardMaterial({
  color: '#ff4fa3', emissive: '#ff087f', emissiveIntensity: 3.5, roughness: 0.26, metalness: 0.1,
});
const sunGold = new MeshStandardMaterial({
  color: '#fff0a6', emissive: '#ff7b00', emissiveIntensity: 5.2, roughness: 0.18, metalness: 0.04,
});
const cyan = new MeshStandardMaterial({
  color: '#77fff4', emissive: '#00d7ff', emissiveIntensity: 3, roughness: 0.25, metalness: 0.15,
});
const featherDark = new MeshStandardMaterial({
  color: '#15152c', emissive: '#190d4a', emissiveIntensity: 0.45, roughness: 0.64, metalness: 0.15,
});
const featherBlue = new MeshStandardMaterial({
  color: '#255ae8', emissive: '#113eff', emissiveIntensity: 1.4, roughness: 0.48, metalness: 0.1,
});
const cloudLight = new MeshStandardMaterial({
  color: '#ffe1ee', emissive: '#b74cff', emissiveIntensity: 0.85, roughness: 0.92, metalness: 0,
});
const grass = new MeshStandardMaterial({
  color: '#182c34', emissive: '#063f47', emissiveIntensity: 0.5, roughness: 0.86, metalness: 0,
});

function part(name: string, geometry: ConstructorParameters<typeof Mesh>[0], material: MeshStandardMaterial): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

export function createSunbird(): Group {
  const bird = new Group();
  bird.name = 'SolarSunbird';

  const bodySurface = LoftSurface.tube([
    { z: -0.5, halfW: 0.06, hUp: 0.055, hDown: 0.05, power: 2 },
    { z: -0.22, halfW: 0.18, hUp: 0.19, hDown: 0.13, power: 1.65 },
    { z: 0.15, halfW: 0.2, hUp: 0.22, hDown: 0.16, power: 1.55 },
    { z: 0.38, halfW: 0.11, hUp: 0.12, hDown: 0.1, power: 1.8 },
  ]);
  const body = part('Body', bodySurface.build([-0.5, -0.22, 0.15, 0.38], 18, true), featherBlue);
  bird.add(body);

  const breast = part('SolarBreast', new SphereGeometry(0.145, 18, 12), hotPink);
  breast.scale.set(0.86, 1.15, 0.62);
  breast.position.set(0, -0.035, 0.24);
  const head = part('Head', new SphereGeometry(0.15, 18, 12), featherDark);
  head.position.set(0, 0.13, 0.42);
  bird.add(breast, head);

  const beak = part('Beak', new ConeGeometry(0.07, 0.28, 10), sunGold);
  alignSpan(beak, new Vector3(0, 0.1, 0.51), new Vector3(0, 0.08, 0.79));
  bird.add(beak);

  for (const side of [-1, 1]) {
    const eye = part(side < 0 ? 'EyeLeft' : 'EyeRight', new SphereGeometry(0.032, 10, 8), cyan);
    eye.position.set(side * 0.105, 0.175, 0.525);
    bird.add(eye);

    const wingPivot = new Group();
    wingPivot.name = side < 0 ? 'WingLeftPivot' : 'WingRightPivot';
    wingPivot.position.set(side * 0.14, 0.08, 0.05);
    const wing = part(
      side < 0 ? 'WingLeft' : 'WingRight',
      taperPlate(0.76, 0.34, 0.11, 0.07, 0.025),
      side < 0 ? hotPink : cyan,
    );
    wing.position.x = side * 0.39;
    wing.rotation.y = side * -0.18;
    wingPivot.add(wing);
    bird.add(wingPivot);
  }

  for (const side of [-1, 0, 1]) {
    const tail = part(`TailFeather-${side + 2}`, taperPlate(0.16, 0.1, 0.18, 0.58, 0.018), featherDark);
    tail.rotation.x = Math.PI / 2;
    tail.rotation.z = Math.PI / 2 + side * 0.22;
    tail.position.set(side * 0.09, 0, -0.62);
    bird.add(tail);
  }

  const crest = part('Crest', taperPlate(0.1, 0.07, 0.02, 0.26, 0.012), sunGold);
  crest.rotation.z = Math.PI / 2;
  crest.position.set(0, 0.31, 0.42);
  bird.add(crest);
  return bird;
}

function createCloud(name: string, position: Vector3, scale: number): Group {
  const cloud = new Group();
  cloud.name = name;
  cloud.position.copy(position);
  const lobes = [
    [-0.7, 0, 0, 0.56], [-0.25, 0.16, 0, 0.76], [0.3, 0.12, 0, 0.68], [0.75, -0.02, 0, 0.47],
  ];
  for (const [index, [x, y, z, size]] of lobes.entries()) {
    const lobe = part(`CloudLobe-${index + 1}`, new SphereGeometry(size, 12, 8), cloudLight);
    lobe.position.set(x, y, z);
    lobe.scale.set(1.35, 0.62, 0.52);
    cloud.add(lobe);
  }
  cloud.scale.setScalar(scale);
  return cloud;
}

export function createSkyWorld(): Group {
  const world = new Group();
  world.name = 'SunburstSkyWorld';

  const stage = part('SkyIslandTop', new CylinderGeometry(4.2, 4.65, 0.18, 48), grass);
  stage.position.y = -0.11;
  const islandRoot = part('SkyIslandRock', new ConeGeometry(4.5, 2.3, 48), midnight);
  islandRoot.position.y = -1.34;
  world.add(stage, islandRoot);

  const horizon = new Group();
  horizon.name = 'HorizonMountains';
  for (let index = 0; index < 15; index += 1) {
    const angle = -1.2 + (index / 14) * 2.4;
    const distance = 14 + (index % 3) * 1.8;
    const height = 3.2 + ((index * 7) % 5) * 0.65;
    const mountain = part(`Mountain-${index + 1}`, new ConeGeometry(2.1 + (index % 2) * 0.5, height, 7), index % 3 === 0 ? violet : midnight);
    mountain.position.set(Math.sin(angle) * distance, height * 0.47 - 0.2, -Math.cos(angle) * distance);
    mountain.rotation.y = index * 0.73;
    horizon.add(mountain);
  }
  world.add(horizon);

  const sun = part('GiantSun', new SphereGeometry(2.7, 32, 20), sunGold);
  sun.position.set(4.8, 6.4, -15.5);
  const halo = part('SunHalo', new TorusGeometry(3.4, 0.08, 10, 72), hotPink);
  halo.position.copy(sun.position);
  const orbit = part('NeonOrbit', new TorusGeometry(5.2, 0.045, 8, 96), cyan);
  orbit.position.set(-1.4, 4.9, -14.3);
  orbit.rotation.z = -0.22;
  world.add(sun, halo, orbit);

  world.add(
    createCloud('CloudBankLeft', new Vector3(-7, 4.1, -11), 1.65),
    createCloud('CloudBankRight', new Vector3(7.4, 3.4, -10.2), 1.35),
    createCloud('CloudCrown', new Vector3(-1.7, 7.3, -14), 1.05),
  );

  for (const [index, side] of [-1, 1].entries()) {
    const island = new Group();
    island.name = `FloatingIsland-${index + 1}`;
    island.position.set(side * 6.2, 1.25 + index * 1.6, -8.8 - index);
    const top = part('FloatingTop', new CylinderGeometry(1.15, 1.35, 0.16, 18), grass);
    const rock = part('FloatingRock', new ConeGeometry(1.3, 2.4, 18), violet);
    rock.position.y = -1.25;
    const beacon = part('SkyBeacon', bevelBox(0.14, 1.1, 0.14, 0.03), index === 0 ? cyan : hotPink);
    beacon.position.y = 0.6;
    island.add(top, rock, beacon);
    world.add(island);
  }

  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const spark = part(`SkySpark-${index + 1}`, new IcosahedronGeometry(0.055 + (index % 3) * 0.018, 0), index % 2 === 0 ? cyan : hotPink);
    spark.position.set(Math.sin(angle) * (4.8 + (index % 4)), 1.2 + (index % 6) * 0.82, -5.8 - (index % 5) * 1.45);
    world.add(spark);
  }

  const startRail = part('LaunchRail', new BoxGeometry(1.4, 0.04, 0.08), sunGold);
  startRail.position.set(0, 0.03, -2.4);
  world.add(startRail);
  return world;
}
