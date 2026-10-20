import { describe, expect, it } from "vitest";
import {
  addEmptyExposure,
  addExposures,
  deleteInstance,
  duplicateInstance,
  frameOffsetInInstance,
  frameToInstanceIndex,
  imageIdAtFrame,
  insertEmptyInstance,
  instanceDuration,
  instanceStarts,
  layerDuration,
  moveInstance,
  projectDuration,
  repeatExposure,
  repeatHold,
  setExposures,
  splitInstance,
  syncLayerLengths,
} from "@/domain/timeline/instances";
import type { Layer } from "@/domain/project/model";

function layerWith(exposures: number[]): Layer {
  return {
    id: "layer-1",
    name: "Capa 1",
    kind: "animation",
    color: "#4a9eff",
    instances: exposures.map((value, index) => ({
      id: `inst-${index}`,
      headImageId: `img-${index}`,
      exposures: value,
    })),
    visible: true,
    locked: false,
    opacity: 1,
    lightTable: true,
    loop: false,
  };
}

describe("instancias y celdas de exposición", () => {
  it("una instancia dura un cuadro más sus exposiciones", () => {
    expect(instanceDuration({ id: "a", headImageId: "img", exposures: 0 })).toBe(1);
    expect(instanceDuration({ id: "a", headImageId: "img", exposures: 3 })).toBe(4);
  });

  it("calcula la duración total de la capa", () => {
    expect(layerDuration(layerWith([0, 2, 1]))).toBe(6);
  });

  it("la duración del proyecto es la de la capa más larga", () => {
    const a = layerWith([0, 0]);
    const b = layerWith([0, 0, 0, 0]);
    expect(projectDuration([a, b])).toBe(4);
  });

  it("calcula el cuadro inicial de cada instancia", () => {
    expect(instanceStarts(layerWith([0, 2, 1]))).toEqual([0, 1, 4]);
  });

  it("ubica el cuadro dentro de su instancia", () => {
    const layer = layerWith([0, 2, 1]);
    expect(frameToInstanceIndex(layer, 0)).toBe(0);
    expect(frameToInstanceIndex(layer, 1)).toBe(1);
    expect(frameToInstanceIndex(layer, 3)).toBe(1);
    expect(frameToInstanceIndex(layer, 4)).toBe(2);
    expect(frameOffsetInInstance(layer, 0)).toBe(0);
    expect(frameOffsetInInstance(layer, 2)).toBe(1);
    expect(frameOffsetInInstance(layer, 5)).toBe(1);
  });

  it("devuelve la imagen visible en cada cuadro", () => {
    const layer = layerWith([0, 2]);
    expect(imageIdAtFrame(layer, 0)).toBe("img-0");
    expect(imageIdAtFrame(layer, 2)).toBe("img-1");
  });

  it("estira una instancia desde el tirador derecho", () => {
    const layer = setExposures(layerWith([0, 0]), 0, 3);
    expect(layer.instances[0].exposures).toBe(3);
    expect(layerDuration(layer)).toBe(5);
  });

  it("suma celdas de exposición", () => {
    const layer = addExposures(layerWith([1]), 0, 2);
    expect(layer.instances[0].exposures).toBe(3);
  });

  it("inserta una instancia vacía en la posición indicada", () => {
    const layer = insertEmptyInstance(layerWith([0, 0]), 1, "new");
    expect(layer.instances.map((i) => i.id)).toEqual(["inst-0", "new", "inst-1"]);
    expect(layer.instances[1].headImageId).toBeNull();
  });

  it("añade una exposición vacía: la instancia se fusiona con la anterior", () => {
    const layer = addEmptyExposure(layerWith([0, 0, 0]), 1);
    expect(layer.instances).toHaveLength(2);
    expect(layer.instances[0].exposures).toBe(1);
    expect(layer.instances[1].id).toBe("inst-2");
  });

  it("duplica, borra y mueve instancias", () => {
    const duplicated = duplicateInstance(layerWith([0, 0]), 0, "dup");
    expect(duplicated.instances.map((i) => i.id)).toEqual(["inst-0", "dup", "inst-1"]);

    const deleted = deleteInstance(layerWith([0, 0, 0]), 1);
    expect(deleted.instances).toHaveLength(2);

    const moved = moveInstance(layerWith([0, 0, 0]), 0, 2);
    expect(moved.instances.map((i) => i.id)).toEqual(["inst-1", "inst-2", "inst-0"]);
  });

  it("divide una instancia en dos conservando el dibujo", () => {
    const layer = splitInstance(layerWith([3]), 0, 2, "split");
    expect(layer.instances).toHaveLength(2);
    expect(layer.instances[0].exposures).toBe(1);
    expect(layer.instances[1].exposures).toBe(2);
    expect(layer.instances[1].headImageId).toBe("img-0");
  });

  it("repite el último dibujo sin duplicar el contenido", () => {
    const layer = repeatHold(layerWith([0, 0]), 2, () => "new");
    expect(layer.instances).toHaveLength(4);
    expect(layer.instances[3].headImageId).toBe("img-1");
  });

  it("repite exposición sobre la última instancia", () => {
    const layer = repeatExposure(layerWith([0]), 2);
    expect(layer.instances[0].exposures).toBe(2);
  });

  it("sincroniza la longitud de todas las capas", () => {
    const layers = [layerWith([0, 0]), layerWith([0])];
    const synced = syncLayerLengths(layers, 5);
    expect(layerDuration(synced[0])).toBe(5);
    expect(layerDuration(synced[1])).toBe(5);
  });
});
