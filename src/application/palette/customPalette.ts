/**
 * Paleta personalizada del usuario (Cap. 18).
 *
 * Se guarda en localStorage: es una preferencia local, no parte del proyecto.
 */

const STORAGE_KEY = "dibujeitor-pro:paleta";

export function saveCustomPalette(colors: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Sin espacio o sin permisos: la paleta simplemente no se guarda.
  }
}

export function loadCustomPalette(): string[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((color) => typeof color === "string");
  } catch {
    return null;
  }
}

export function clearCustomPalette(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // sin impacto
  }
}
