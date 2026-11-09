import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';
import { alignSpan, bevelBox, LoftSurface, taperPlate } from './lib/hardsurface.js';

const obsidian = new MeshStandardMaterial({
  color: '#070a13',
  roughness: 0.55,
  metalness: 0.52,
});
const graphite = new MeshStandardMaterial({
  color: '#17202d',
  emissive: '#07111e',
  emissiveIntensity: 0.55,
  roughness: 0.38,
  metalness: 0.64,
});
const chronoCyan = new MeshStandardMaterial({
  color: '#82fff0',
  emissive: '#12d8e8',
  emissiveIntensity: 3.2,
  roughness: 0.24,
  metalness: 0.2,
});
const threatOrange = new MeshStandardMaterial({
  color: '#ffb068',
  emissive: '#ff3b13',
  emissiveIntensity: 4.1,
  roughness: 0.18,
  metalness: 0.16,
});

function namedMesh(name: string, geometry: ConstructorParameters<typeof Mesh>[0], material: MeshStandardMaterial): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

export function createArena(): Group {
  const arena = new Group();
  arena.name = 'ChronoArena';

  const floor = namedMesh('ClockworkFloor', new CylinderGeometry(6, 6.2, 0.16, 64), obsidian);
  floor.position.y = -0.08;
  arena.add(floor);

  for (const [index, radius] of [1.45, 2.8, 4.25, 5.75].entries()) {
    const ring = namedMesh(
      `ChronoCircuit-${index + 1}`,
      new RingGeometry(radius - 0.025, radius + 0.025, 96),
      index % 2 === 0 ? chronoCyan : graphite,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012 + index * 0.002;
    arena.add(ring);
  }

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const spoke = namedMesh(`TimeSpoke-${index + 1}`, bevelBox(0.045, 0.018, 4.9, 0.006), graphite);
    spoke.position.set(Math.sin(angle) * 2.45, 0.02, Math.cos(angle) * 2.45);
    spoke.rotation.y = angle;
    arena.add(spoke);
  }

  const pylonAngles = [-64, -34, 34, 64];
  for (const [index, angleDegrees] of pylonAngles.entries()) {
    const angle = (angleDegrees * Math.PI) / 180;
    const pylon = new Group();
    pylon.name = `ChronoPylon-${index + 1}`;
    pylon.position.set(Math.sin(angle) * 4.25, 0, -Math.cos(angle) * 4.25);
    pylon.rotation.y = -angle * 0.35;

    const body = namedMesh('PylonBody', taperPlate(0.72, 0.48, 0.25, 1.9, 0.04), graphite);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.96;
    const crown = namedMesh('PylonCrown', new IcosahedronGeometry(0.18, 0), chronoCyan);
    crown.position.y = 1.92;
    const slit = namedMesh('EnergySlit', bevelBox(0.08, 0.72, 0.035, 0.01), chronoCyan);
    slit.position.set(0, 1.1, 0.27);
    pylon.add(body, crown, slit);
    arena.add(pylon);
  }

  for (const [index, z] of [-5.1, -5.55].entries()) {
    const gate = new Group();
    gate.name = `FractureGate-${index + 1}`;
    gate.position.set(0, 2.15 + index * 0.42, z);
    const arc = namedMesh('EnergyArc', new TorusGeometry(2.15 + index * 0.42, 0.035, 8, 72), chronoCyan);
    arc.rotation.x = Math.PI / 2;
    gate.add(arc);
    arena.add(gate);
  }

  return arena;
}

export function createDemoDrone(): Group {
  const drone = new Group();
  drone.name = 'RiftStalkerDrone';

  const hullSurface = LoftSurface.tube([
    { z: -0.58, halfW: 0.13, hUp: 0.08, hDown: 0.08, power: 1.8 },
    { z: -0.18, halfW: 0.48, hUp: 0.2, hDown: 0.14, power: 1.6 },
    { z: 0.22, halfW: 0.42, hUp: 0.17, hDown: 0.13, power: 1.7 },
    { z: 0.52, halfW: 0.12, hUp: 0.08, hDown: 0.07, power: 2 },
  ]);
  const hull = namedMesh('Hull', hullSurface.build([-0.58, -0.18, 0.22, 0.52], 20, true), graphite);
  drone.add(hull);

  for (const side of [-1, 1]) {
    const wing = namedMesh(
      side < 0 ? 'Wing-Left' : 'Wing-Right',
      taperPlate(0.72, 0.34, 0.11, 0.065, 0.025),
      obsidian,
    );
    wing.position.set(side * 0.62, 0.01, -0.03);
    wing.rotation.y = side * -0.24;
    drone.add(wing);

    const nacelle = namedMesh(
      side < 0 ? 'Nacelle-Left' : 'Nacelle-Right',
      bevelBox(0.22, 0.22, 0.52, 0.04, 0.06),
      graphite,
    );
    nacelle.position.set(side * 0.73, -0.02, -0.08);
    drone.add(nacelle);

    const thruster = namedMesh(
      side < 0 ? 'Thruster-Left' : 'Thruster-Right',
      new CylinderGeometry(0.08, 0.11, 0.16, 16),
      chronoCyan,
    );
    thruster.rotation.x = Math.PI / 2;
    thruster.position.set(side * 0.73, -0.02, -0.39);
    drone.add(thruster);
  }

  const aperture = namedMesh('ThreatAperture', new TorusGeometry(0.17, 0.035, 8, 28), threatOrange);
  aperture.position.z = 0.48;
  const eye = namedMesh('ThreatCore', new SphereGeometry(0.1, 18, 12), threatOrange);
  eye.position.z = 0.5;
  const crown = namedMesh('ChronoCrown', new TorusGeometry(0.61, 0.018, 5, 48), chronoCyan);
  crown.rotation.x = Math.PI / 2;
  drone.add(aperture, eye, crown);
  return drone;
}

export function createBulletPattern(): Group {
  const field = new Group();
  field.name = 'FrozenBulletPattern';
  const tracks = [
    [-1.55, 1.15, -2.35], [-1.05, 1.78, -3.05], [-0.62, 1.32, -4.3],
    [-0.18, 1.92, -2.75], [0.22, 1.12, -3.7], [0.7, 1.62, -2.15],
    [1.08, 1.26, -4.55], [1.5, 1.86, -3.35], [-1.82, 1.55, -4.85],
  ];

  for (const [index, [x, y, z]] of tracks.entries()) {
    const bolt = new Group();
    bolt.name = `ChronoBolt-${index + 1}`;
    bolt.position.set(x, y, z);
    bolt.userData.baseX = x;
    bolt.userData.baseY = y;
    bolt.userData.speed = 0.72 + (index % 3) * 0.18;

    const core = namedMesh('BoltCore', new SphereGeometry(0.07, 12, 8), threatOrange);
    const tail = namedMesh('TimeTrail', new CylinderGeometry(0.018, 0.045, 0.62, 8), threatOrange);
    alignSpan(tail, new Vector3(0, 0, -0.58), new Vector3(0, 0, -0.02));
    bolt.add(core, tail);
    field.add(bolt);
  }
  return field;
}
