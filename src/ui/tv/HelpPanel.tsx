"use client";

/** Panel de ayuda: atajos de teclado del editor. */
const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Espacio", action: "Reproducir / pausar" },
  { keys: "←  →", action: "Cuadro anterior / siguiente" },
  { keys: "Home / End", action: "Primer / último cuadro" },
  { keys: "N", action: "Intercambiar color A y B" },
  { keys: "P", action: "Mostrar / ocultar el panel de color" },
  { keys: "Shift + A", action: "Mostrar / ocultar el panel de pincel" },
  { keys: "0", action: "Mostrar / ocultar la línea de tiempo" },
  { keys: "1 - 6", action: "Elegir pincel (pluma, lápiz, marcador…)" },
  { keys: "L", action: "Herramienta de línea" },
  { keys: "R", action: "Herramienta de rectángulo" },
  { keys: "O", action: "Herramienta de elipse" },
  { keys: "S", action: "Herramienta de spline" },
  { keys: "G", action: "Cubo de pintura" },
  { keys: "M", action: "Selección rectangular" },
  { keys: "X", action: "Goma temporal" },
  { keys: "H", action: "Mano (desplazar)" },
  { keys: "Z", action: "Zoom" },
  { keys: "Ctrl + Z / Ctrl + Y", action: "Deshacer / rehacer" },
  { keys: "Ctrl + arrastrar", action: "Cambiar el tamaño del pincel" },
  { keys: "F1", action: "Pantalla completa" },
];

export function HelpPanel() {
  return (
    <div className="tv-panel border-0">
      <div className="tv-panel-title">
        <span>Atajos</span>
      </div>
      <table className="w-full border-collapse text-[10px]">
        <tbody>
          {SHORTCUTS.map((item) => (
            <tr key={item.keys} className="border-b border-[#33363d]">
              <td className="w-[110px] px-2 py-1 font-mono text-[#9fc9ee]">{item.keys}</td>
              <td className="px-2 py-1 text-muted-foreground">{item.action}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="p-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Flujo de trabajo
        </p>
        <ol className="list-decimal space-y-1 pl-4 text-[10px] leading-snug text-muted-foreground">
          <li>Posá el dibujo en el cuadro actual y creá una instancia nueva (botón + del panel de instancias).</li>
          <li>Estirá el tirador derecho de la instancia para agregar celdas de exposición.</li>
          <li>Activá la Light Table para ver el cuadro anterior en verde y el siguiente en naranja.</li>
          <li>Usá "Out of pegs" para ver el último pivote cuando hay cuadros vacíos en medio.</li>
          <li>Exportá a MP4, WebM o GIF desde el menú Archivo.</li>
        </ol>
      </div>
    </div>
  );
}
