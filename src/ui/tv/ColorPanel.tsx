"use client";

import { useEditorStore } from "@/application/store/editorStore";
import { DEFAULT_PALETTE } from "@/domain/color/palette";

/**
 * Color Panel de TVPaint: dos muestras (A y B) y la paleta.
 * Con la tecla N se intercambian A y B.
 */
export function ColorPanel() {
  const colorA = useEditorStore((state) => state.colorA);
  const colorB = useEditorStore((state) => state.colorB);
  const setColorA = useEditorStore((state) => state.setColorA);
  const setColorB = useEditorStore((state) => state.setColorB);
  const swapColors = useEditorStore((state) => state.swapColors);

  return (
    <div className="tv-panel">
      <div className="tv-panel-title">
        <span>Color</span>
        <span className="text-[9px] font-normal normal-case">N intercambia</span>
      </div>

      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          className="relative h-9 w-9 rounded-[3px] border border-border"
          style={{ background: colorA }}
          title="Color A (el que usa la herramienta)"
          aria-label="Color A"
          onClick={() => setColorA(colorA)}
        />
        <button
          type="button"
          className="relative h-9 w-9 rounded-[3px] border border-border"
          style={{ background: colorB }}
          title="Color B"
          aria-label="Color B"
          onClick={() => setColorB(colorB)}
        />
        <button
          type="button"
          className="tv-icon-btn"
          title="Intercambiar A y B"
          aria-label="Intercambiar A y B"
          onClick={swapColors}
        >
          ⇄
        </button>
        <div className="ml-auto text-[10px] text-muted-foreground">
          A <span className="font-mono text-foreground">{colorA}</span>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-[2px] px-2 pb-2">
        {DEFAULT_PALETTE.map((color) => (
          <button
            key={color.hex}
            type="button"
            className="h-[14px] w-[14px] rounded-[2px] border border-black/30"
            style={{ background: color.hex }}
            title={`${color.name} ${color.hex}`}
            aria-label={color.name}
            onClick={() => setColorA(color.hex)}
            onContextMenu={(event) => {
              event.preventDefault();
              setColorB(color.hex);
            }}
          />
        ))}
      </div>
    </div>
  );
}
