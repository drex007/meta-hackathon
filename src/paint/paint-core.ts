export const PAINT_COLORS = ['#d83b3b', '#edb83d', '#316fca', '#f4efe4', '#18161b', '#4c9a62'] as const;

export function mixHexColors(first: string, second: string): string {
  const channels = [1, 3, 5].map((offset) =>
    Math.round(
      (Number.parseInt(first.slice(offset, offset + 2), 16) +
        Number.parseInt(second.slice(offset, offset + 2), 16)) /
        2,
    ),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function mixPigmentColors(first: string, second: string): string {
  const a = rgbToRyb(hexToUnitRgb(first));
  const b = rgbToRyb(hexToUnitRgb(second));
  const mixed = rybToRgb({ r: (a.r + b.r) / 2, g: (a.g + b.g) / 2, b: (a.b + b.b) / 2 });
  return `#${[mixed.r, mixed.g, mixed.b]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

interface Channels { r: number; g: number; b: number }

function hexToUnitRgb(hex: string): Channels {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16) / 255,
    g: Number.parseInt(hex.slice(3, 5), 16) / 255,
    b: Number.parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function rgbToRyb(input: Channels): Channels {
  let { r, g, b } = input;
  const white = Math.min(r, g, b);
  r -= white; g -= white; b -= white;
  const maximumGreen = Math.max(r, g, b);
  let yellow = Math.min(r, g);
  r -= yellow; g -= yellow;
  if (b > 0 && g > 0) { b /= 2; g /= 2; }
  yellow += g; b += g;
  const maximumYellow = Math.max(r, yellow, b);
  if (maximumYellow > 0) {
    const normal = maximumGreen / maximumYellow;
    r *= normal; yellow *= normal; b *= normal;
  }
  return { r: r + white, g: yellow + white, b: b + white };
}

function rybToRgb(input: Channels): Channels {
  let { r, b } = input;
  let yellow = input.g;
  const white = Math.min(r, yellow, b);
  r -= white; yellow -= white; b -= white;
  const maximumYellow = Math.max(r, yellow, b);
  let g = Math.min(yellow, b);
  yellow -= g; b -= g;
  if (b > 0 && g > 0) { b *= 2; g *= 2; }
  r += yellow; g += yellow;
  const maximumGreen = Math.max(r, g, b);
  if (maximumGreen > 0) {
    const normal = maximumYellow / maximumGreen;
    r *= normal; g *= normal; b *= normal;
  }
  return { r: Math.min(1, r + white), g: Math.min(1, g + white), b: Math.min(1, b + white) };
}
