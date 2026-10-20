import { describe, expect, it, vi } from "vitest";

import { createCommandStack, type CommandStack } from "./commandStack";

describe("undo/commandStack", () => {
  it("empieza sin historial", () => {
    const stack = createCommandStack<string>();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it("deshace y rehace el último comando", () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const stack = createCommandStack<string>();
    stack.push({ label: "borrar", undo, redo });

    expect(stack.canUndo()).toBe(true);
    expect(stack.undo()).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(stack.canRedo()).toBe(true);
    expect(stack.redo()).toBe(true);
    expect(redo).toHaveBeenCalledTimes(1);
  });

  it("un comando nuevo descarta la pila de rehacer", () => {
    const stack = createCommandStack<string>();
    stack.push({ label: "a", undo: vi.fn(), redo: vi.fn() });
    stack.undo();
    stack.push({ label: "b", undo: vi.fn(), redo: vi.fn() });
    expect(stack.canRedo()).toBe(false);
  });

  it("mantiene como máximo 50 niveles", () => {
    const stack = createCommandStack<string>();
    for (let i = 0; i < 60; i += 1) {
      stack.push({ label: `cmd-${i}`, undo: vi.fn(), redo: vi.fn() });
    }
    expect(stack.undoDepth).toBe(50);
    expect(stack.peekUndo()?.label).toBe("cmd-59");
  });

  it("deshacer en vacío no rompe nada", () => {
    const stack = createCommandStack<string>();
    expect(stack.undo()).toBe(false);
    expect(stack.redo()).toBe(false);
  });

  it("limpiar vacía ambas pilas", () => {
    const stack = createCommandStack<string>();
    stack.push({ label: "a", undo: vi.fn(), redo: vi.fn() });
    stack.undo();
    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it("guarda el historial reciente para mostrarlo en la interfaz", () => {
    const stack: CommandStack<string> = createCommandStack<string>();
    stack.push({ label: "trazo", undo: vi.fn(), redo: vi.fn() });
    expect(stack.history().map((entry) => entry.label)).toEqual(["trazo"]);
  });
});
