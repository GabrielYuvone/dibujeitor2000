/**
 * Pila de undo/redo (Cap. 19).
 *
 * Cada comando sabe deshacerse y rehacerse. La pila guarda hasta 50 niveles
 * (los más antiguos se descartan) y expone el historial reciente para poder
 * mostrarlo en la interfaz.
 */

export interface Command<T = unknown> {
  label: string;
  undo: () => void;
  redo: () => void;
  /** Datos opcionales del comando (por ejemplo el trazo afectado). */
  data?: T;
}

export interface CommandStack<T = unknown> {
  push(command: Command<T>): void;
  undo(): boolean;
  redo(): boolean;
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  readonly undoDepth: number;
  readonly redoDepth: number;
  peekUndo(): Command<T> | null;
  peekRedo(): Command<T> | null;
  history(): Command<T>[];
}

export const MAX_UNDO_LEVELS = 50;

export function createCommandStack<T = unknown>(limit = MAX_UNDO_LEVELS): CommandStack<T> {
  const undoStack: Command<T>[] = [];
  const redoStack: Command<T>[] = [];

  return {
    push(command) {
      undoStack.push(command);
      while (undoStack.length > limit) {
        undoStack.shift();
      }
      // Un comando nuevo invalida el futuro: no se puede rehacer lo deshecho.
      redoStack.length = 0;
    },
    undo() {
      const command = undoStack.pop();
      if (!command) return false;
      command.undo();
      redoStack.push(command);
      return true;
    },
    redo() {
      const command = redoStack.pop();
      if (!command) return false;
      command.redo();
      undoStack.push(command);
      return true;
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    canUndo() {
      return undoStack.length > 0;
    },
    canRedo() {
      return redoStack.length > 0;
    },
    get undoDepth() {
      return undoStack.length;
    },
    get redoDepth() {
      return redoStack.length;
    },
    peekUndo() {
      return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
    },
    peekRedo() {
      return redoStack.length > 0 ? redoStack[redoStack.length - 1] : null;
    },
    history() {
      return [...undoStack];
    },
  };
}
