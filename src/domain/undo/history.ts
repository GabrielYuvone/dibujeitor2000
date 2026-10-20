/**
 * Historial de instantáneas para undo/redo.
 *
 * En la edición TV una acción puede tocar muchas cosas a la vez (una capa,
 * su lista de instancias, el pool de dibujos). En vez de implementar un
 * comando por cada caso, el historial guarda *instantáneas* del proyecto: es
 * simple, imposible de desincronizar y con 50 niveles el costo es
 * insignificante porque el proyecto son datos vectoriales, no píxeles.
 */

export interface History<T> {
  past: T[];
  future: T[];
}

export const MAX_HISTORY = 50;

export function createHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/** Guarda una instantánea y descarta el futuro. */
export function pushHistory<T>(history: History<T>, snapshot: T): History<T> {
  const past = [...history.past, snapshot];
  while (past.length > MAX_HISTORY) past.shift();
  return { past, future: [] };
}

/** Deshace: devuelve la instantánea anterior y apila la actual en el futuro. */
export function undoHistory<T>(
  history: History<T>,
  current: T,
): { history: History<T>; snapshot: T } | null {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return null;
  const past = history.past.slice(0, -1);
  return {
    history: { past, future: [current, ...history.future] },
    snapshot: previous,
  };
}

/** Rehace: devuelve la instantánea siguiente. */
export function redoHistory<T>(
  history: History<T>,
  current: T,
): { history: History<T>; snapshot: T } | null {
  const next = history.future[0];
  if (next === undefined) return null;
  return {
    history: { past: [...history.past, current], future: history.future.slice(1) },
    snapshot: next,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}
