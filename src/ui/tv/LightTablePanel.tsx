"use client";

import { useRef } from "react";

import { useEditorStore } from "@/application/store/editorStore";
import type { LightTableSide } from "@/domain/lighttable/lightTable";

/**
 * Panel de la Light Table (el "papel cebolla" de TVPaint).
 *
 * La fila central muestra el cuadro actual ("0") y, a los lados, los cuadros
 * vecinos. El número de cada celda se puede arrastrar hacia arriba o abajo
 * para cambiar su opacidad, y un clic lo enciende o apaga.
 */
export function LightTablePanel() {
  const lightTable = useEditorStore((state) => state.lightTable);
  const updateLightTable = useEditorStore((state) => state.updateLightTable);
  const toggleLightTableFrame = useEditorStore((state) => state.toggleLightTableFrame);

  const max = lightTable.maxFrames;
  const distances = Array.from({ length: max }, (_, index) => max - index);

  return (
    <div className="tv-panel">
      <div className="tv-panel-title">
        <span>Light Table</span>
        <label className="flex items-center gap-1 text-[9px] font-normal normal-case text-muted-foreground">
          <input
            type="checkbox"
            checked={lightTable.enabled}
            onChange={(event) => updateLightTable({ enabled: event.target.checked })}
            className="accent-[#4a9ee0]"
          />
          activa
        </label>
      </div>

      <div className="p-2">
        {/* Fila de cuadros */}
        <div className="flex items-stretch justify-center gap-1">
          {distances.map((distance) => (
            <LightTableCell
              key={`prev-${distance}`}
              side="previous"
              distance={distance}
              opacity={lightTable.previousOpacity[distance - 1] ?? 0}
              color={lightTable.previousColor}
              onToggle={() => toggleLightTableFrame("previous", distance)}
              onOpacity={(value) =>
                updateLightTable({
                  previousOpacity: replaceAt(lightTable.previousOpacity, distance, value),
                })
              }
            />
          ))}

          <div
            className="grid h-[46px] w-[34px] place-items-center rounded-[3px] border border-[#4a9ee0] bg-[#2f4f6d] text-[11px] font-semibold"
            title="Cuadro actual"
          >
            0
          </div>

          {distances.map((distance) => (
            <LightTableCell
              key={`next-${distance}`}
              side="next"
              distance={distance}
              opacity={lightTable.nextOpacity[distance - 1] ?? 0}
              color={lightTable.nextColor}
              onToggle={() => toggleLightTableFrame("next", distance)}
              onOpacity={(value) =>
                updateLightTable({
                  nextOpacity: replaceAt(lightTable.nextOpacity, distance, value),
                })
              }
            />
          ))}
        </div>

        {/* Colores */}
        <div className="mt-2 space-y-1">
          <label className="flex items-center justify-between text-[10px] text-muted-foreground">
            Anterior
            <input
              type="color"
              value={lightTable.previousColor}
              onChange={(event) => updateLightTable({ previousColor: event.target.value })}
              className="h-4 w-7 cursor-pointer rounded-[2px] border border-border bg-transparent"
            />
          </label>
          <label className="flex items-center justify-between text-[10px] text-muted-foreground">
            Posterior
            <input
              type="color"
              value={lightTable.nextColor}
              onChange={(event) => updateLightTable({ nextColor: event.target.value })}
              className="h-4 w-7 cursor-pointer rounded-[2px] border border-border bg-transparent"
            />
          </label>
        </div>

        {/* Opciones */}
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          <label className="flex items-center justify-between text-[10px] text-muted-foreground">
            Cuadros a cada lado
            <select
              value={lightTable.maxFrames}
              onChange={(event) => updateLightTable({ maxFrames: Number(event.target.value) })}
              className="rounded-[2px] border border-border bg-[#26282e] px-1 py-[1px] text-[10px]"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between text-[10px] text-muted-foreground">
            Mezclar al frente
            <input
              type="checkbox"
              checked={lightTable.blendToFront}
              onChange={(event) => updateLightTable({ blendToFront: event.target.checked })}
              className="accent-[#4a9ee0]"
            />
          </label>
          <label className="flex items-center justify-between text-[10px] text-muted-foreground">
            Out of pegs
            <input
              type="checkbox"
              checked={lightTable.outOfPegs}
              onChange={(event) => updateLightTable({ outOfPegs: event.target.checked })}
              className="accent-[#4a9ee0]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function replaceAt(values: number[], distance: number, value: number): number[] {
  const next = [...values];
  while (next.length < distance) next.push(0.1);
  next[distance - 1] = value;
  return next;
}

interface LightTableCellProps {
  side: LightTableSide;
  distance: number;
  opacity: number;
  color: string;
  onToggle: () => void;
  onOpacity: (value: number) => void;
}

function LightTableCell({ side, distance, opacity, color, onToggle, onOpacity }: LightTableCellProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const active = opacity > 0.001;

  return (
    <div
      className="relative h-[46px] w-[26px] select-none overflow-hidden rounded-[3px] border"
      style={{
        borderColor: active ? color : "#3f434c",
        background: active ? `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}` : "#23252b",
      }}
      title={`Cuadro ${side === "previous" ? "-" : "+"}${distance} — arrastrá para cambiar la opacidad`}
      onPointerDown={(event) => {
        event.preventDefault();
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        dragRef.current = { startY: event.clientY, startValue: opacity };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const delta = (drag.startY - event.clientY) / 60;
        onOpacity(Math.max(0, Math.min(1, drag.startValue + delta)));
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
        if (!drag || Math.abs(drag.startY - event.clientY) < 3) onToggle();
      }}
    >
      <span className="absolute inset-x-0 bottom-0 text-center text-[10px] font-semibold text-white/90">
        {distance}
      </span>
      {/* Barra de nivel */}
      <span
        className="absolute inset-x-1 bottom-[14px] rounded-[1px] bg-white/25"
        style={{ height: `${Math.round(opacity * 26)}px` }}
      />
    </div>
  );
}
