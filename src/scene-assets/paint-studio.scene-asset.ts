import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from '@iwsdk/core';
import { bevelBox } from './lib/hardsurface.js';

function woodTexture(base: readonly [number, number, number], repeatX: number, repeatY: number): DataTexture {
  const width = 128;
  const height = 128;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const grain = Math.sin(x * 0.34 + Math.sin(y * 0.075) * 3.2) * 0.5
      + Math.sin(x * 0.09 + y * 0.028) * 0.34
      + Math.sin(x * 0.018 - y * 0.11) * 0.16;
    const knotDistance = Math.hypot((x - 91) * 0.65, y - 43);
    const knot = Math.max(0, 1 - knotDistance / 23) * Math.sin(knotDistance * 0.72) * 0.42;
    const variation = grain * 15 + knot * 22;
    const offset = (y * width + x) * 4;
    pixels[offset] = Math.max(0, Math.min(255, base[0] + variation));
    pixels[offset + 1] = Math.max(0, Math.min(255, base[1] + variation * 0.7));
    pixels[offset + 2] = Math.max(0, Math.min(255, base[2] + variation * 0.45));
    pixels[offset + 3] = 255;
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function linenTexture(): DataTexture {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const warp = x % 4 === 0 ? 16 : x % 4 === 1 ? -5 : 3;
    const weft = y % 4 === 0 ? 14 : y % 4 === 1 ? -4 : 2;
    const value = 224 + warp + weft;
    const offset = (y * size + x) * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value - 5;
    pixels[offset + 2] = value - 12;
    pixels[offset + 3] = 255;
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(24, 18);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const walnutGrain = woodTexture([91, 52, 34], 2, 7);
const oakGrain = woodTexture([174, 116, 68], 3, 6);
const floorGrain = woodTexture([86, 55, 39], 3, 9);
const linenWeave = linenTexture();

const materials = {
  walnut: new MeshStandardMaterial({ color: '#8a5a3e', map: walnutGrain, roughness: 0.62 }),
  oak: new MeshStandardMaterial({ color: '#c6925b', map: oakGrain, roughness: 0.68 }),
  brass: new MeshStandardMaterial({ color: '#b88a3c', metalness: 0.76, roughness: 0.24 }),
  steel: new MeshStandardMaterial({ color: '#b9bec1', metalness: 0.88, roughness: 0.18 }),
  lacquer: new MeshPhysicalMaterial({ color: '#74301f', metalness: 0.03, roughness: 0.25, clearcoat: 0.72, clearcoatRoughness: 0.2 }),
  bristle: new MeshStandardMaterial({ color: '#cdb184', roughness: 0.94 }),
  canvas: new MeshStandardMaterial({ color: '#fff8e9', map: linenWeave, bumpMap: linenWeave, bumpScale: 0.012, roughness: 0.95 }),
  canvasEdge: new MeshStandardMaterial({ color: '#d8c8ae', map: linenWeave, bumpMap: linenWeave, bumpScale: 0.01, roughness: 0.94 }),
  dark: new MeshStandardMaterial({ color: '#242321', roughness: 0.76 }),
  wall: new MeshStandardMaterial({ color: '#80766d', roughness: 0.96 }),
  floor: new MeshStandardMaterial({ color: '#7c5239', map: floorGrain, bumpMap: floorGrain, bumpScale: 0.018, roughness: 0.72 }),
  floorSeam: new MeshStandardMaterial({ color: '#241813', roughness: 0.9 }),
  cream: new MeshStandardMaterial({ color: '#ded0b9', roughness: 0.86 }),
  plaster: new MeshStandardMaterial({ color: '#b8aea3', roughness: 0.98 }),
  rug: new MeshStandardMaterial({ color: '#4e5b5a', roughness: 1 }),
  cloth: new MeshStandardMaterial({ color: '#b7a58d', roughness: 1 }),
  leaf: new MeshStandardMaterial({ color: '#35523c', roughness: 0.88 }),
  terracotta: new MeshStandardMaterial({ color: '#98583f', roughness: 0.92 }),
  glass: new MeshPhysicalMaterial({ color: '#8aa5b3', emissive: '#728c99', emissiveIntensity: 0.16, transmission: 0.12, transparent: true, opacity: 0.86, roughness: 0.18 }),
  paletteSurface: new MeshStandardMaterial({ color: '#c69a68', roughness: 0.7 }),
};

function namedMesh(name: string, geometry: ConstructorParameters<typeof Mesh>[0], material: MeshStandardMaterial): Mesh {
  const result = new Mesh(geometry, material);
  result.name = name;
  return result;
}

export function createStudioEasel(): Group {
  const root = new Group();
  root.name = 'StudioEasel';

  const rearLeg = namedMesh('RearLeg', bevelBox(0.065, 1.45, 0.065, 0.012), materials.walnut);
  rearLeg.position.set(0, 0.72, -0.18);
  rearLeg.rotation.x = -0.18;
  root.add(rearLeg);
  for (const side of [-1, 1]) {
    const leg = namedMesh(side < 0 ? 'LeftLeg' : 'RightLeg', bevelBox(0.07, 1.45, 0.07, 0.012), materials.walnut);
    leg.position.set(side * 0.31, 0.72, 0.02);
    leg.rotation.z = side * -0.08;
    root.add(leg);
  }
  const shelf = namedMesh('CanvasShelf', bevelBox(0.9, 0.07, 0.14, 0.014), materials.oak);
  shelf.position.set(0, 0.63, 0.08);
  const mast = namedMesh('CentreMast', bevelBox(0.075, 1.62, 0.065, 0.01), materials.walnut);
  mast.position.set(0, 0.91, -0.055);
  const footBrace = namedMesh('FootBrace', bevelBox(0.64, 0.055, 0.06, 0.01), materials.walnut);
  footBrace.position.set(0, 0.32, 0.025);
  const topClamp = namedMesh('TopClamp', bevelBox(0.28, 0.075, 0.1, 0.012), materials.oak);
  topClamp.position.set(0, 1.65, 0.055);
  const canvasBack = namedMesh('CanvasBack', bevelBox(0.83, 0.64, 0.045, 0.014), materials.walnut);
  canvasBack.position.set(0, 1.19, 0.035);
  const canvas = namedMesh('PaintingSurfaceMesh', new PlaneGeometry(0.76, 0.56, 1, 1), materials.canvas);
  canvas.position.set(0, 1.19, 0.061);
  const canvasTop = namedMesh('CanvasTopEdge', bevelBox(0.79, 0.026, 0.052, 0.006), materials.canvasEdge);
  canvasTop.position.set(0, 1.483, 0.04);
  const canvasBottom = namedMesh('CanvasBottomEdge', bevelBox(0.79, 0.026, 0.052, 0.006), materials.canvasEdge);
  canvasBottom.position.set(0, 0.897, 0.04);
  const canvasLeft = namedMesh('CanvasLeftEdge', bevelBox(0.026, 0.56, 0.052, 0.006), materials.canvasEdge);
  canvasLeft.position.set(-0.393, 1.19, 0.04);
  const canvasRight = namedMesh('CanvasRightEdge', bevelBox(0.026, 0.56, 0.052, 0.006), materials.canvasEdge);
  canvasRight.position.set(0.393, 1.19, 0.04);
  const brassPin = namedMesh('BrassClampPin', new CylinderGeometry(0.018, 0.018, 0.1, 12), materials.brass);
  brassPin.rotation.z = Math.PI / 2;
  brassPin.position.set(0, 1.65, 0.11);
  const adjustmentKnob = namedMesh('AdjustmentKnob', new CylinderGeometry(0.032, 0.032, 0.034, 20), materials.brass);
  adjustmentKnob.rotation.x = Math.PI / 2;
  adjustmentKnob.position.set(0, 0.63, 0.17);
  root.add(mast, footBrace, shelf, canvasBack, canvas, canvasTop, canvasBottom, canvasLeft, canvasRight, topClamp, brassPin, adjustmentKnob);
  return root;
}

export function createArtistBrush(): Group {
  const root = new Group();
  root.name = 'ArtistBrush';

  const handle = namedMesh('GripHandle', new CylinderGeometry(0.009, 0.014, 0.25, 18), materials.lacquer);
  handle.position.y = 0.045;
  const collar = namedMesh('FerruleCollar', new CylinderGeometry(0.017, 0.014, 0.025, 16), materials.steel);
  collar.position.y = -0.089;
  const ferrule = namedMesh('Ferrule', bevelBox(0.05, 0.065, 0.016, 0.004), materials.steel);
  ferrule.position.y = -0.132;
  root.add(handle, collar, ferrule);

  const bristleGroup = new Group();
  bristleGroup.name = 'BristleBundle';
  for (let index = 0; index < 11; index += 1) {
    const across = index / 10 - 0.5;
    const length = 0.078 - Math.abs(across) * 0.012;
    const bristle = namedMesh(`Bristle-${index + 1}`, new BoxGeometry(0.004, length, 0.011), materials.bristle);
    bristle.position.set(across * 0.043, -0.165 - length * 0.5, 0);
    bristle.rotation.z = -across * 0.045;
    bristleGroup.add(bristle);
  }
  root.add(bristleGroup);

  const tipMarker = namedMesh('BrushTip', new SphereGeometry(0.004, 8, 5), materials.bristle);
  tipMarker.position.y = -0.244;
  tipMarker.visible = false;
  root.add(tipMarker);
  return root;
}

export function createPainterCart(): Group {
  const root = new Group();
  root.name = 'PainterCart';
  const top = namedMesh('CartTop', bevelBox(0.68, 0.07, 0.42, 0.025), materials.oak);
  top.position.y = 0.75;
  const shelf = namedMesh('LowerShelf', bevelBox(0.58, 0.045, 0.34, 0.018), materials.walnut);
  shelf.position.y = 0.28;
  root.add(top, shelf);
  for (const x of [-0.26, 0.26]) for (const z of [-0.14, 0.14]) {
    const leg = namedMesh(`CartLeg-${x}-${z}`, new CylinderGeometry(0.025, 0.03, 0.72, 10), materials.walnut);
    leg.position.set(x, 0.38, z);
    root.add(leg);
  }

  const palette = namedMesh('WoodPalette', new CircleGeometry(0.24, 32), materials.oak);
  palette.scale.y = 0.58;
  palette.rotation.x = -Math.PI / 2;
  palette.position.set(-0.06, 0.795, 0.01);
  root.add(palette);
  const mixSurface = namedMesh('PaletteMixSurface', new CircleGeometry(0.228, 48), materials.paletteSurface);
  mixSurface.scale.y = 0.58;
  mixSurface.rotation.x = -Math.PI / 2;
  mixSurface.position.set(-0.06, 0.807, 0.01);
  const paletteRim = namedMesh('PaletteRim', new TorusGeometry(0.232, 0.006, 8, 48), materials.oak);
  paletteRim.scale.y = 0.58;
  paletteRim.rotation.x = -Math.PI / 2;
  paletteRim.position.set(-0.06, 0.813, 0.01);
  root.add(mixSurface, paletteRim);

  const cup = namedMesh('BrushCup', new CylinderGeometry(0.07, 0.055, 0.18, 14, 1, true), materials.terracotta);
  cup.position.set(0.25, 0.87, -0.08);
  root.add(cup);
  for (let index = 0; index < 5; index += 1) {
    const brush = namedMesh(`Brush-${index + 1}`, new CylinderGeometry(0.007, 0.009, 0.34 + index * 0.02, 8), index % 2 ? materials.brass : materials.walnut);
    brush.position.set(0.22 + index * 0.014, 1.02 + index * 0.01, -0.08);
    brush.rotation.z = -0.1 + index * 0.05;
    root.add(brush);
  }
  const rag = namedMesh('LinenRag', new PlaneGeometry(0.25, 0.18, 4, 3), materials.cloth);
  rag.rotation.set(-Math.PI / 2, 0, -0.18);
  rag.position.set(-0.18, 0.806, -0.11);
  root.add(rag);
  for (let index = 0; index < 3; index += 1) {
    const tube = namedMesh(`PaintTube-${index + 1}`, new CylinderGeometry(0.018, 0.024, 0.18, 10), materials.steel);
    tube.rotation.z = Math.PI / 2 + index * 0.08;
    tube.position.set(-0.12 + index * 0.13, 0.325, -0.02 + index * 0.04);
    root.add(tube);
  }
  return root;
}

export function createStudioRoom(): Group {
  const root = new Group();
  root.name = 'PaintStudioRoom';
  const floor = namedMesh('StudioFloor', bevelBox(4.8, 0.08, 3.8, 0.03), materials.floor);
  floor.position.set(0, -0.05, -1.1);
  const backWall = namedMesh('BackWall', bevelBox(4.8, 2.8, 0.08, 0.03), materials.wall);
  backWall.position.set(0, 1.35, -2.95);
  const sideWall = namedMesh('SideWall', bevelBox(0.08, 2.8, 3.8, 0.03), materials.wall);
  sideWall.position.set(-2.35, 1.35, -1.1);
  root.add(floor, backWall, sideWall);

  for (let index = 0; index < 11; index += 1) {
    const seam = namedMesh(`FloorboardSeam-${index + 1}`, new BoxGeometry(4.68, 0.006, 0.009), materials.floorSeam);
    seam.position.set(0, -0.006, -2.76 + index * 0.34);
    root.add(seam);
  }
  for (let index = 0; index < 9; index += 1) {
    const joint = namedMesh(`FloorboardJoint-${index + 1}`, new BoxGeometry(0.009, 0.006, 0.34), materials.floorSeam);
    joint.position.set(-1.8 + (index % 5) * 0.9, -0.005, -2.59 + Math.floor(index / 5) * 1.36);
    root.add(joint);
  }

  const backBaseboard = namedMesh('BackBaseboard', bevelBox(4.7, 0.11, 0.055, 0.012), materials.plaster);
  backBaseboard.position.set(0, 0.055, -2.87);
  const sideBaseboard = namedMesh('SideBaseboard', bevelBox(0.055, 0.11, 3.7, 0.012), materials.plaster);
  sideBaseboard.position.set(-2.27, 0.055, -1.1);
  const rug = namedMesh('EaselRug', new PlaneGeometry(1.65, 1.25), materials.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.02, 0.006, -1.47);
  root.add(backBaseboard, sideBaseboard, rug);

  const window = namedMesh('NorthLightWindow', new PlaneGeometry(1.25, 1.35), materials.glass);
  window.position.set(-1.25, 1.65, -2.9);
  const frameH = namedMesh('WindowFrameH', new BoxGeometry(1.36, 0.06, 0.05), materials.cream);
  frameH.position.set(-1.25, 1.65, -2.84);
  const frameV = namedMesh('WindowFrameV', new BoxGeometry(0.06, 1.45, 0.05), materials.cream);
  frameV.position.set(-1.25, 1.65, -2.84);
  const windowTop = namedMesh('WindowTop', bevelBox(1.42, 0.07, 0.07, 0.012), materials.cream);
  windowTop.position.set(-1.25, 2.37, -2.83);
  const windowBottom = namedMesh('WindowSill', bevelBox(1.5, 0.09, 0.17, 0.014), materials.cream);
  windowBottom.position.set(-1.25, 0.93, -2.78);
  const windowLeft = namedMesh('WindowLeft', bevelBox(0.07, 1.52, 0.07, 0.012), materials.cream);
  windowLeft.position.set(-1.92, 1.65, -2.83);
  const windowRight = namedMesh('WindowRight', bevelBox(0.07, 1.52, 0.07, 0.012), materials.cream);
  windowRight.position.set(-0.58, 1.65, -2.83);
  root.add(window, frameH, frameV, windowTop, windowBottom, windowLeft, windowRight);

  const frameColors = ['#715e52', '#6c7880', '#8c6d58'];
  const frameWidths = [0.46, 0.6, 0.42];
  const frameHeights = [0.58, 0.46, 0.54];
  for (let index = 0; index < 3; index += 1) {
    const pictureMat = new MeshStandardMaterial({ color: frameColors[index], roughness: 0.84 });
    const width = frameWidths[index];
    const height = frameHeights[index];
    const centerX = 0.4 + index * 0.62;
    const centerY = 1.58 + (index % 2) * 0.16;
    const picture = namedMesh(`GalleryPicture-${index + 1}`, new PlaneGeometry(width - 0.08, height - 0.08), pictureMat);
    picture.position.set(centerX, centerY, -2.885);
    const top = namedMesh(`GalleryFrameTop-${index + 1}`, bevelBox(width, 0.035, 0.045, 0.006), materials.walnut);
    top.position.set(centerX, centerY + height * 0.5, -2.84);
    const bottom = namedMesh(`GalleryFrameBottom-${index + 1}`, bevelBox(width, 0.035, 0.045, 0.006), materials.walnut);
    bottom.position.set(centerX, centerY - height * 0.5, -2.84);
    const left = namedMesh(`GalleryFrameLeft-${index + 1}`, bevelBox(0.035, height, 0.045, 0.006), materials.walnut);
    left.position.set(centerX - width * 0.5, centerY, -2.84);
    const right = namedMesh(`GalleryFrameRight-${index + 1}`, bevelBox(0.035, height, 0.045, 0.006), materials.walnut);
    right.position.set(centerX + width * 0.5, centerY, -2.84);
    root.add(picture, top, bottom, left, right);
  }

  const stoolSeat = namedMesh('PainterStoolSeat', new CylinderGeometry(0.25, 0.27, 0.09, 24), materials.walnut);
  stoolSeat.position.set(-1.35, 0.48, -1.32);
  root.add(stoolSeat);
  for (let index = 0; index < 3; index += 1) {
    const angle = index / 3 * Math.PI * 2;
    const stoolLeg = namedMesh(`PainterStoolLeg-${index + 1}`, new CylinderGeometry(0.025, 0.032, 0.48, 10), materials.dark);
    stoolLeg.position.set(-1.35 + Math.cos(angle) * 0.16, 0.24, -1.32 + Math.sin(angle) * 0.16);
    stoolLeg.rotation.z = Math.cos(angle) * 0.11;
    stoolLeg.rotation.x = Math.sin(angle) * 0.11;
    root.add(stoolLeg);
  }

  const pot = namedMesh('PlantPot', new CylinderGeometry(0.18, 0.14, 0.32, 14), materials.terracotta);
  pot.position.set(1.85, 0.16, -2.35);
  root.add(pot);
  for (let index = 0; index < 5; index += 1) {
    const leaf = namedMesh(`PlantLeaf-${index + 1}`, new SphereGeometry(0.16, 10, 7), materials.leaf);
    leaf.scale.set(0.38, 1.35, 0.25);
    leaf.position.set(1.85 + (index - 2) * 0.07, 0.48 + (index % 2) * 0.12, -2.35);
    leaf.rotation.z = (index - 2) * 0.23;
    root.add(leaf);
  }
  return root;
}
