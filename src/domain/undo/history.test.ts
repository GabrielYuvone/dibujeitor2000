import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY,
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "@/domain/undo/history";

describe("historial de instantáneas", () => {
  it("empieza vacío", () => {
    const history = createHistory<string>();
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("guarda instantáneas y permite deshacer", () => {
    let history = createHistory<string>();
    history = pushHistory(history, "a");
    expect(canUndo(history)).toBe(true);

    const result = undoHistory(history, "b");
    expect(result?.snapshot).toBe("a");
    expect(canRedo(result!.history)).toBe(true);
  });

  it("permite rehacer", () => {
    let history = createHistory<string>();
    history = pushHistory(history, "a");
    const undone = undoHistory(history, "b")!;
    const redone = redoHistory(undone.history, "a")!;
    expect(redone.snapshot).toBe("b");
  });

  it("una instantánea nueva descarta el futuro", () => {
    let history = createHistory<string>();
    history = pushHistory(history, "a");
    const undone = undoHistory(history, "b")!;
    history = pushHistory(undone.history, "c");
    expect(canRedo(history)).toBe(false);
  });

  it("descarta las instantáneas más antiguas al superar el máximo", () => {
    let history = createHistory<number>();
    for (let i = 0; i < MAX_HISTORY + 10; i += 1) {
      history = pushHistory(history, i);
    }
    expect(history.past).toHaveLength(MAX_HISTORY);
    expect(history.past[0]).toBe(10);
  });

  it("deshacer sin historial devuelve null", () => {
    expect(undoHistory(createHistory<string>(), "x")).toBeNull();
    expect(redoHistory(createHistory<string>(), "x")).toBeNull();
  });
});
