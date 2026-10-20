import { describe, expect, it } from "vitest";

import { createPixelBuffer, floodFill, type PixelBuffer } from "./floodFill";

function bufferWithBorder(width = 5, height = 5): PixelBuffer {
  const buffer = createPixelBuffer(width, height, [255, 255, 255, 255]);
  const paintBlack = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    buffer.data[offset] = 0;
    buffer.data[offset + 1] = 0;
    buffer.data[offset + 2] = 0;
  };
  // Borde negro completo que encierra el interior blanco.
  for (let x = 0; x < width; x += 1) {
    paintBlack(x, 0);
    paintBlack(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    paintBlack(0, y);
    paintBlack(width - 1, y);
  }
  return buffer;
}

describe("fill/floodFill", () => {
  it("rellena la región conectada con el color pedido", () => {
    const buffer = bufferWithBorder();
    const result = floodFill(buffer, 2, 2, { r: 255, g: 0, b: 0 }, 10);

    expect(result.changed).toBe(true);
    expect(result.filled).toBe(9); // interior 3x3
    const index = (2 * 5 + 2) * 4;
    expect([result.buffer.data[index], result.buffer.data[index + 1], result.buffer.data[index + 2]]).toEqual([
      255, 0, 0,
    ]);
  });

  it("no se sale de la región delimitada por el borde", () => {
    const buffer = bufferWithBorder();
    const result = floodFill(buffer, 2, 2, { r: 255, g: 0, b: 0 }, 10);
    const cornerIndex = 0;
    expect(result.buffer.data[cornerIndex]).toBe(0);
  });

  it("con tolerancia 0 sólo rellena el color exacto", () => {
    const buffer = createPixelBuffer(2, 1, [100, 100, 100, 255]);
    buffer.data[4] = 101; // casi igual, pero no idéntico
    const result = floodFill(buffer, 0, 0, { r: 0, g: 0, b: 255 }, 0);
    expect(result.filled).toBe(1);
  });

  it("una tolerancia mayor alcanza colores más cercanos", () => {
    const buffer = createPixelBuffer(2, 1, [100, 100, 100, 255]);
    buffer.data[4] = 120;
    const strict = floodFill(buffer, 0, 0, { r: 0, g: 0, b: 255 }, 5);
    const loose = floodFill(buffer, 0, 0, { r: 0, g: 0, b: 255 }, 50);
    expect(strict.filled).toBe(1);
    expect(loose.filled).toBe(2);
  });

  it("la tolerancia se acota a un umbral máximo de 200", () => {
    // Dos colores con distancia 250 en RGB: nunca deben unirse.
    const buffer = createPixelBuffer(2, 1, [0, 0, 0, 255]);
    buffer.data[4] = 250;
    const result = floodFill(buffer, 0, 0, { r: 0, g: 0, b: 255 }, 100);
    expect(result.filled).toBe(1);
  });

  it("no modifica el buffer original", () => {
    const buffer = bufferWithBorder();
    const before = buffer.data.slice();
    floodFill(buffer, 2, 2, { r: 255, g: 0, b: 0 }, 10);
    expect(Array.from(buffer.data)).toEqual(Array.from(before));
  });

  it("fuera de rango no hace nada", () => {
    const buffer = bufferWithBorder();
    const result = floodFill(buffer, 99, 99, { r: 255, g: 0, b: 0 }, 10);
    expect(result.changed).toBe(false);
    expect(result.filled).toBe(0);
  });

  it("no se filtra de una zona pintada a una transparente", () => {
    // Un borde opaco separa dos zonas: el relleno no debe pasar de largo.
    const buffer = createPixelBuffer(3, 1, [0, 0, 0, 0]);
    buffer.data[3] = 255;
    buffer.data[4] = 255;
    buffer.data[5] = 255;
    const result = floodFill(buffer, 0, 0, { r: 200, g: 0, b: 0 }, 10);
    expect(result.filled).toBe(1);
    expect(result.buffer.data[7]).toBe(0); // el otro extremo sigue transparente
  });

  it("rellena la zona transparente sin invadir la zona pintada", () => {
    const buffer = createPixelBuffer(3, 1, [0, 0, 0, 0]);
    buffer.data[11] = 255; // el último píxel está pintado (opaco)
    const result = floodFill(buffer, 0, 0, { r: 200, g: 0, b: 0 }, 10);
    expect(result.filled).toBe(2);
    expect(result.buffer.data[11]).toBe(255); // el pintado no cambió
  });

  it("rellena sobre píxeles opacos del mismo color", () => {
    const buffer = createPixelBuffer(2, 1, [10, 10, 10, 255]);
    buffer.data[4] = 10;
    const result = floodFill(buffer, 0, 0, { r: 200, g: 0, b: 0 }, 10);
    expect(result.filled).toBe(2);
  });
});
