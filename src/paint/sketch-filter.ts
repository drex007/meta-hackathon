export interface PencilSketchOptions {
  edgeThreshold?: number;
  edgeGain?: number;
  shadingStrength?: number;
}

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

/** Converts RGBA pixels into light paper with charcoal-like contour lines. */
export function createPencilSketchPixels(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  options: PencilSketchOptions = {},
): Uint8ClampedArray {
  if (width < 1 || height < 1 || source.length !== width * height * 4) {
    throw new Error('Sketch source dimensions do not match its pixel data');
  }

  const edgeThreshold = options.edgeThreshold ?? 26;
  const edgeGain = options.edgeGain ?? 0.52;
  const shadingStrength = options.shadingStrength ?? 0.08;
  const luminance = new Float32Array(width * height);
  const blurred = new Float32Array(width * height);
  const output = new Uint8ClampedArray(source.length);

  for (let pixel = 0; pixel < luminance.length; pixel += 1) {
    const offset = pixel * 4;
    luminance[pixel] = source[offset] * 0.2126 + source[offset + 1] * 0.7152 + source[offset + 2] * 0.0722;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      let weightTotal = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const sampleY = Math.max(0, Math.min(height - 1, y + offsetY));
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = Math.max(0, Math.min(width - 1, x + offsetX));
          const weight = (offsetX === 0 ? 2 : 1) * (offsetY === 0 ? 2 : 1);
          total += luminance[sampleY * width + sampleX] * weight;
          weightTotal += weight;
        }
      }
      blurred[y * width + x] = total / weightTotal;
    }
  }

  const sample = (x: number, y: number): number =>
    blurred[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const topLeft = sample(x - 1, y - 1);
      const top = sample(x, y - 1);
      const topRight = sample(x + 1, y - 1);
      const left = sample(x - 1, y);
      const right = sample(x + 1, y);
      const bottomLeft = sample(x - 1, y + 1);
      const bottom = sample(x, y + 1);
      const bottomRight = sample(x + 1, y + 1);
      const gradientX = -topLeft - left * 2 - bottomLeft + topRight + right * 2 + bottomRight;
      const gradientY = -topLeft - top * 2 - topRight + bottomLeft + bottom * 2 + bottomRight;
      const edge = Math.min(218, Math.max(0, Math.hypot(gradientX, gradientY) - edgeThreshold) * edgeGain);
      const shade = Math.min(28, (255 - blurred[y * width + x]) * shadingStrength);
      const paperValue = clampByte(247 - edge - shade);
      const outputOffset = (y * width + x) * 4;
      output[outputOffset] = paperValue;
      output[outputOffset + 1] = paperValue;
      output[outputOffset + 2] = paperValue;
      output[outputOffset + 3] = 255;
    }
  }

  return output;
}
