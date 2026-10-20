"use client";

import { useState } from "react";

import { useEditorStore } from "@/application/store/editorStore";
import { SizeFields } from "@/ui/tv/CanvasSizeDialog";

/**
 * Pantalla de inicio.
 *
 * El tamaño del lienzo se define en píxeles y puede ser cualquiera: hay
 * atajos frecuentes y dos campos libres para escribir el ancho y el alto
 * exactos.
 */
export function StartScreen({ onStart }: { onStart?: () => void }) {
  const newProject = useEditorStore((state) => state.newProject);
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [fps, setFps] = useState(12);
  const [name, setName] = useState("Proyecto sin título");

  return (
    <div className="flex h-full items-center justify-center bg-[#1e2025]">
      <div className="w-[560px] rounded-md border border-border bg-[#2b2e35] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logointro.png"
          alt="DIBUJEITOR TV"
          className="mx-auto mb-4 max-h-[130px] w-auto object-contain"
        />

        <h1 className="mb-1 text-center text-[15px] font-semibold tracking-wide text-foreground">
          DIBUJEITOR TV
        </h1>
        <p className="mb-5 text-center text-[11px] text-muted-foreground">
          Animación 2D cuadro a cuadro · instancias, celdas de exposición y Light Table
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Nombre del proyecto
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-[3px] border border-border bg-[#23252b] px-2 py-1.5 text-[12px] outline-none focus:border-[#4a9ee0]"
          />
        </label>

        <div className="mb-3">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Tamaño del lienzo (cualquier medida en píxeles)
          </span>
          <SizeFields
            width={width}
            height={height}
            onChange={(w, h) => {
              setWidth(w);
              setHeight(h);
            }}
          />
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Cuadros por segundo
          </span>
          <select
            value={fps}
            onChange={(event) => setFps(Number(event.target.value))}
            className="w-full rounded-[3px] border border-border bg-[#23252b] px-2 py-1.5 text-[12px]"
          >
            {[6, 8, 10, 12, 15, 18, 24, 25, 30, 60].map((value) => (
              <option key={value} value={value}>
                {value} fps
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="w-full rounded-[3px] border border-[#4a9ee0] bg-[#2f4f6d] py-2 text-[13px] font-medium text-[#eaf4ff] hover:bg-[#3a6183]"
          onClick={() => {
            newProject({ name, width, height, fps });
            onStart?.();
          }}
        >
          Nuevo proyecto · {width}×{height} px
        </button>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          F1 pantalla completa · N intercambia los colores A y B · 0 oculta la línea de tiempo
        </p>
      </div>
    </div>
  );
}
