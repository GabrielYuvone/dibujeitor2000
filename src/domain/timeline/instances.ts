/**
 * Instancias y celdas de exposición: el flujo de trabajo de cuadros de TVPaint.
 *
 * En TVPaint el animador no agrega "cuadros", sino que trabaja con
 * *instancias*. Cada instancia contiene un dibujo (cabeza) y puede mantenerlo
 * en pantalla N cuadros adicionales (celdas de exposición). Así, un plan de
 * 8 cuadros con 3 poses se describe como: pose 1 (2 expos), pose 2 (1 expo),
 * pose 3 (1 expo), pose 4 (4 expos).
 *
 * Todas las funciones son puras: devuelven una capa nueva.
 */

import type { Instance, Layer } from "@/domain/project/model";

/** Duración de una instancia en cuadros: la cabeza + sus exposiciones. */
export function instanceDuration(instance: Instance): number {
  return 1 + Math.max(0, instance.exposures);
}

/** Duración total de una capa. */
export function layerDuration(layer: Layer): number {
  return layer.instances.reduce((total, instance) => total + instanceDuration(instance), 0);
}

/** Duración total del proyecto: la capa más larga. */
export function projectDuration(layers: Layer[]): number {
  return layers.reduce((max, layer) => Math.max(max, layerDuration(layer)), 0);
}

/** Cuadro en el que arranca cada instancia de la capa. */
export function instanceStarts(layer: Layer): number[] {
  const starts: number[] = [];
  let cursor = 0;
  for (const instance of layer.instances) {
    starts.push(cursor);
    cursor += instanceDuration(instance);
  }
  return starts;
}

/** Índice de la instancia que contiene el cuadro dado. */
export function frameToInstanceIndex(layer: Layer, frame: number): number {
  const starts = instanceStarts(layer);
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    if (frame >= starts[index]) return index;
  }
  return 0;
}

/** Posición del cuadro dentro de su instancia (0 = cabeza, 1+ = exposición). */
export function frameOffsetInInstance(layer: Layer, frame: number): number {
  const index = frameToInstanceIndex(layer, frame);
  return frame - instanceStarts(layer)[index];
}

/** Id de la imagen visible en un cuadro de la capa (null si está vacía). */
export function imageIdAtFrame(layer: Layer, frame: number): string | null {
  if (layer.instances.length === 0) return null;
  const index = frameToInstanceIndex(layer, frame);
  return layer.instances[index]?.headImageId ?? null;
}

/** Id de la instancia visible en un cuadro. */
export function instanceIdAtFrame(layer: Layer, frame: number): string | null {
  if (layer.instances.length === 0) return null;
  const index = frameToInstanceIndex(layer, frame);
  return layer.instances[index]?.id ?? null;
}

function replaceLayer(layer: Layer, instances: Instance[]): Layer {
  return { ...layer, instances };
}

/**
 * Cambia el número de celdas de exposición de una instancia.
 *
 * TVPaint llama a esto "estirar" la instancia desde su tirador derecho.
 */
export function setExposures(layer: Layer, instanceIndex: number, exposures: number): Layer {
  const instances = layer.instances.map((instance, index) =>
    index === instanceIndex ? { ...instance, exposures: Math.max(0, Math.round(exposures)) } : instance,
  );
  return replaceLayer(layer, instances);
}

/** Suma celdas de exposición a una instancia. */
export function addExposures(layer: Layer, instanceIndex: number, count: number): Layer {
  const current = layer.instances[instanceIndex];
  if (!current) return layer;
  return setExposures(layer, instanceIndex, current.exposures + count);
}

/**
 * Inserta una instancia vacía en la posición indicada.
 *
 * Es el "Add Empty Instance" del panel Animator.
 */
export function insertEmptyInstance(layer: Layer, atIndex: number, id: string): Layer {
  const instances = [...layer.instances];
  const position = Math.max(0, Math.min(instances.length, atIndex));
  instances.splice(position, 0, { id, headImageId: null, exposures: 0 });
  return replaceLayer(layer, instances);
}

/**
 * Convierte la instancia actual en una celda de exposición de la anterior.
 *
 * Es el "Add Empty Exposure": la instancia `atIndex` se borra y se la
 * convierte en una exposición más de la instancia anterior.
 */
export function addEmptyExposure(layer: Layer, atIndex: number): Layer {
  if (atIndex <= 0) return layer;
  const instances = [...layer.instances];
  const removed = instances.splice(atIndex, 1)[0];
  if (!removed) return layer;
  const previous = instances[atIndex - 1];
  instances[atIndex - 1] = { ...previous, exposures: previous.exposures + 1 + removed.exposures };
  return replaceLayer(layer, instances);
}

/** Duplica una instancia (misma imagen, nueva celda de exposición). */
export function duplicateInstance(layer: Layer, atIndex: number, id: string): Layer {
  const source = layer.instances[atIndex];
  if (!source) return layer;
  const instances = [...layer.instances];
  instances.splice(atIndex + 1, 0, { ...source, id });
  return replaceLayer(layer, instances);
}

/** Elimina una instancia. */
export function deleteInstance(layer: Layer, atIndex: number): Layer {
  if (atIndex < 0 || atIndex >= layer.instances.length) return layer;
  const instances = layer.instances.filter((_, index) => index !== atIndex);
  return replaceLayer(layer, instances);
}

/** Mueve una instancia dentro de la capa. */
export function moveInstance(layer: Layer, from: number, to: number): Layer {
  if (from === to) return layer;
  const instances = [...layer.instances];
  const [moved] = instances.splice(from, 1);
  if (!moved) return layer;
  const target = Math.max(0, Math.min(instances.length, to));
  instances.splice(target, 0, moved);
  return replaceLayer(layer, instances);
}

/**
 * Divide una instancia en dos a partir de una celda de exposición.
 *
 * Es el "Break Instance" del panel Animator: la cabeza y las exposiciones
 * quedan en una instancia y el resto pasa a una nueva.
 */
export function splitInstance(
  layer: Layer,
  instanceIndex: number,
  atOffset: number,
  id: string,
): Layer {
  const source = layer.instances[instanceIndex];
  if (!source || atOffset <= 0) return layer;

  const head: Instance = { id: source.id, headImageId: source.headImageId, exposures: atOffset - 1 };
  const tail: Instance = { id, headImageId: source.headImageId, exposures: source.exposures - atOffset + 1 };
  const instances = [...layer.instances];
  instances.splice(instanceIndex, 1, head, tail);
  return replaceLayer(layer, instances);
}

/**
 * Repite el último dibujo N veces ("Repeat Hold").
 *
 * El contenido no se duplica: todas las instancias apuntan a la misma
 * imagen, así el dibujo se puede corregir en un solo lugar.
 */
export function repeatHold(layer: Layer, count: number, idFactory: () => string): Layer {
  const last = layer.instances[layer.instances.length - 1];
  if (!last) return layer;
  const instances = [...layer.instances];
  for (let i = 0; i < Math.max(1, count); i += 1) {
    instances.push({ id: idFactory(), headImageId: last.headImageId, exposures: 0 });
  }
  return replaceLayer(layer, instances);
}

/**
 * Agrega N celdas de exposición a la última instancia ("Repeat Exposure").
 */
export function repeatExposure(layer: Layer, count: number): Layer {
  if (layer.instances.length === 0) return layer;
  return addExposures(layer, layer.instances.length - 1, Math.max(1, count));
}

/**
 * Corta la capa en el cuadro indicado: todo lo que sigue pasa a una capa
 * nueva. Equivale al "split a layer in two after the current frame".
 */
export function splitLayerAtFrame(
  layer: Layer,
  frame: number,
  newLayer: Layer,
): { first: Layer; second: Layer } {
  const index = frameToInstanceIndex(layer, frame);
  const offset = frameOffsetInInstance(layer, frame);
  const instances = layer.instances;

  const firstInstances = instances.slice(0, index + 1).map((instance, i) =>
    i === index ? { ...instance, exposures: Math.max(0, offset - 1) } : instance,
  );
  const secondInstances = instances.slice(index + 1).map((instance) => ({ ...instance }));
  if (offset === 0 && index < instances.length - 1) {
    // El corte cae justo en el inicio de la instancia: pasa entera a la 2ª capa.
    firstInstances[firstInstances.length - 1] = { ...instances[index], exposures: -1 };
    secondInstances.unshift({ ...instances[index] });
  }

  return {
    first: { ...layer, instances: firstInstances },
    second: { ...newLayer, instances: secondInstances },
  };
}

/**
 * Iguala la duración de todas las capas a la del proyecto.
 *
 * TVPaint mantiene las capas sincronizadas: agregar un cuadro al final de una
 * capa la alarga en todas.
 */
export function syncLayerLengths(layers: Layer[], target: number): Layer[] {
  return layers.map((layer) => {
    if (layerDuration(layer) >= target) return layer;
    const last = layer.instances[layer.instances.length - 1];
    if (!last) return layer;
    const extra = target - layerDuration(layer);
    const instances = [...layer.instances];
    instances[instances.length - 1] = { ...last, exposures: last.exposures + extra };
    return { ...layer, instances };
  });
}
