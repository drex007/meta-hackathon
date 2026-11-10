import {
  BoxGeometry,
  BufferAttribute,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from '@iwsdk/core';
import { bevelBox } from './lib/hardsurface.js';

const deckWoods = [
  new MeshStandardMaterial({ color: '#815031', roughness: 0.7 }),
  new MeshStandardMaterial({ color: '#96603a', roughness: 0.66 }),
  new MeshStandardMaterial({ color: '#74462d', roughness: 0.74 }),
];
const darkWood = new MeshStandardMaterial({ color: '#4a2c20', roughness: 0.76 });
const iron = new MeshStandardMaterial({ color: '#34383a', metalness: 0.72, roughness: 0.34 });
const stone = new MeshStandardMaterial({ color: '#575b58', roughness: 0.94 });
const pine = new MeshStandardMaterial({ color: '#244b38', roughness: 0.92 });
const pineDark = new MeshStandardMaterial({ color: '#17382c', roughness: 0.94 });
const trunk = new MeshStandardMaterial({ color: '#4d3325', roughness: 0.94 });
const mountain = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96 });
const water = new MeshPhysicalMaterial({
  color: '#3d8296',
  emissive: '#163c4b',
  emissiveIntensity: 0.14,
  metalness: 0.08,
  roughness: 0.18,
  clearcoat: 0.58,
  clearcoatRoughness: 0.16,
  transparent: true,
  opacity: 0.94,
});

function mesh(name: string, geometry: ConstructorParameters<typeof Mesh>[0], material: MeshStandardMaterial): Mesh {
  const result = new Mesh(geometry, material);
  result.name = name;
  return result;
}

function addRail(root: Group, x: number, z: number, length: number, alongX: boolean): void {
  const postCount = Math.max(2, Math.round(length / 0.9));
  for (let index = 0; index <= postCount; index += 1) {
    const along = index / postCount * length - length * 0.5;
    const post = mesh(`RailingPost-${x}-${z}-${index}`, bevelBox(0.065, 1.06, 0.065, 0.01), darkWood);
    post.position.set(x + (alongX ? along : 0), 0.5, z + (alongX ? 0 : along));
    root.add(post);
  }
  for (const height of [0.55, 1.0]) {
    const rail = mesh(`Railing-${x}-${z}-${height}`, bevelBox(alongX ? length : 0.07, 0.07, alongX ? 0.07 : length, 0.012), darkWood);
    rail.position.set(x, height, z);
    root.add(rail);
  }
}

export function createAlpinePaintingDeck(): Group {
  const root = new Group();
  root.name = 'AlpinePaintingDeck';

  for (let index = 0; index < 16; index += 1) {
    const board = mesh(`DeckPlank-${index + 1}`, bevelBox(0.382, 0.075, 6.4, 0.008), deckWoods[index % deckWoods.length]);
    board.position.set(-2.925 + index * 0.39, -0.04, -1.35);
    root.add(board);
  }
  const frontBeam = mesh('FrontDeckBeam', bevelBox(6.35, 0.22, 0.2, 0.018), darkWood);
  frontBeam.position.set(0, -0.12, -4.5);
  const rearBeam = mesh('RearDeckBeam', bevelBox(6.35, 0.18, 0.18, 0.018), darkWood);
  rearBeam.position.set(0, -0.1, 1.82);
  root.add(frontBeam, rearBeam);

  addRail(root, 0, -4.42, 6.25, true);
  addRail(root, -3.12, -1.35, 6.08, false);
  addRail(root, 3.12, -1.35, 6.08, false);

  for (const x of [-2.82, 2.82]) for (const z of [-3.95, 1.3]) {
    const pillar = mesh(`PergolaPillar-${x}-${z}`, bevelBox(0.15, 3.1, 0.15, 0.018), darkWood);
    pillar.position.set(x, 1.5, z);
    root.add(pillar);
  }
  for (const z of [-3.95, 1.3]) {
    const beam = mesh(`PergolaCrossBeam-${z}`, bevelBox(6.0, 0.16, 0.18, 0.018), darkWood);
    beam.position.set(0, 3.0, z);
    root.add(beam);
  }
  for (let index = 0; index < 7; index += 1) {
    const rafter = mesh(`PergolaRafter-${index + 1}`, bevelBox(0.09, 0.09, 5.4, 0.012), deckWoods[1]);
    rafter.position.set(-2.55 + index * 0.85, 3.12, -1.32);
    root.add(rafter);
  }

  const benchSeat = mesh('PainterBenchSeat', bevelBox(1.2, 0.11, 0.38, 0.025), deckWoods[1]);
  benchSeat.position.set(2.28, 0.47, -2.95);
  root.add(benchSeat);
  for (const x of [1.86, 2.7]) {
    const leg = mesh(`PainterBenchLeg-${x}`, new BoxGeometry(0.1, 0.48, 0.3), iron);
    leg.position.set(x, 0.23, -2.95);
    root.add(leg);
  }
  return root;
}

function createMountainGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(42, 28, 56, 34);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const depth = Math.max(0, Math.min(1, (14 - z) / 28));
    const ridges = Math.abs(Math.sin(x * 0.19 + z * 0.08)) * 2.1
      + Math.abs(Math.sin(x * 0.37 - z * 0.045)) * 1.3;
    const peakA = Math.exp(-Math.pow((x + 9) / 4.5, 2)) * 3.7;
    const peakB = Math.exp(-Math.pow((x - 4) / 5.2, 2)) * 4.5;
    const peakC = Math.exp(-Math.pow((x - 13) / 3.8, 2)) * 2.8;
    const height = -0.35 + depth * (0.8 + ridges + peakA + peakB + peakC);
    positions.setY(index, height);
    const colorOffset = index * 3;
    if (height > 5.3) {
      colors[colorOffset] = 0.82; colors[colorOffset + 1] = 0.86; colors[colorOffset + 2] = 0.88;
    } else if (height > 2.4) {
      const tone = 0.33 + Math.sin(x * 0.8 + z) * 0.035;
      colors[colorOffset] = tone; colors[colorOffset + 1] = tone + 0.025; colors[colorOffset + 2] = tone + 0.02;
    } else {
      colors[colorOffset] = 0.2; colors[colorOffset + 1] = 0.3; colors[colorOffset + 2] = 0.24;
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addPine(root: Group, x: number, z: number, scale: number, index: number): void {
  const tree = new Group();
  tree.name = `ShorePine-${index}`;
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  const stem = mesh('Trunk', new CylinderGeometry(0.07, 0.1, 1.7, 8), trunk);
  stem.position.y = 0.85;
  tree.add(stem);
  for (let layer = 0; layer < 3; layer += 1) {
    const crown = mesh(`Crown-${layer + 1}`, new ConeGeometry(0.62 - layer * 0.1, 1.25, 9), layer % 2 === 0 ? pine : pineDark);
    crown.position.y = 0.9 + layer * 0.48;
    tree.add(crown);
  }
  root.add(tree);
}

export function createAlpineVista(): Group {
  const root = new Group();
  root.name = 'AlpineLakeVista';

  const lake = mesh('LakeSurface', new PlaneGeometry(38, 30, 1, 1), water);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, -0.27, -18.5);
  root.add(lake);

  const terrain = mesh('MountainTerrain', createMountainGeometry(), mountain);
  terrain.position.z = -22.5;
  root.add(terrain);

  const pinePositions: Array<[number, number, number]> = [
    [-6.4, -7.4, 1.2], [-7.8, -9.1, 1.55], [-9.3, -11.2, 1.9],
    [6.1, -7.8, 1.15], [7.5, -9.4, 1.45], [9.1, -11.6, 1.85],
    [-11.3, -14.2, 2.1], [11.8, -14.8, 2.25],
  ];
  for (let index = 0; index < pinePositions.length; index += 1) {
    const [x, z, scale] = pinePositions[index];
    addPine(root, x, z, scale, index + 1);
  }

  for (const [index, x, z, scale] of [[1, -4.9, -8.2, 1.1], [2, 5.1, -9.0, 1.35], [3, -8.2, -13.0, 1.7]] as const) {
    const rock = mesh(`LakeRock-${index}`, new SphereGeometry(0.72, 12, 8), stone);
    rock.scale.set(scale * 1.6, scale * 0.65, scale);
    rock.position.set(x, -0.1, z);
    root.add(rock);
  }
  return root;
}
