/**
 * Conversiones de color puras. Sin dependencias de DOM: son contratos
 * compartidos por el dominio, la persistencia y la UI.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampChannel(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

/** Parsea "#abc", "#aabbcc" o "aabbcc". Devuelve null si no es hex válido. */
export function parseHex(hex: string): RGB | null {
  if (typeof hex !== "string") return null;
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;
  let body = match[1];
  if (body.length === 3) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(body, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

/** Parsea hex admitiendo 8 dígitos (#rrggbbaa) → RGBA. */
export function parseHexToRgba(hex: string): RGBA | null {
  const trimmed = typeof hex === "string" ? hex.trim() : "";
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(trimmed);
  if (!match) return null;

  let body = match[1];
  let alphaHex: string | null = null;

  if (body.length === 3 || body.length === 4) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
    alphaHex = body.length === 8 ? body.slice(6, 8) : null;
    body = body.slice(0, 6);
  } else if (body.length === 8) {
    alphaHex = body.slice(6, 8);
    body = body.slice(0, 6);
  }

  const int = parseInt(body, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
    a: alphaHex ? parseInt(alphaHex, 16) : 255,
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const hex = (v: number) => clampChannel(v).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function rgbToCss({ r, g, b }: RGB, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${clampChannel(r)}, ${clampChannel(g)}, ${clampChannel(b)})`
    : `rgba(${clampChannel(r)}, ${clampChannel(g)}, ${clampChannel(b)}, ${clamp(alpha, 0, 1)})`;
}

export function rgbaToHex({ r, g, b, a }: RGBA): string {
  const alpha = clampChannel(a);
  return alpha === 255 ? rgbToHex({ r, g, b }) : `${rgbToHex({ r, g, b })}${alpha.toString(16).padStart(2, "0")}`;
}

/** Normaliza cualquier entrada de color a hex de 6 dígitos. */
export function toHex(color: string): string {
  const parsed = parseHexToRgba(color);
  if (!parsed) return "#000000";
  return rgbToHex(parsed);
}
