# DIBUJEITOR TV

Editor de animación 2D cuadro a cuadro con la **interfaz y el flujo de trabajo de TVPaint Standard**:
instancias con celdas de exposición, Light Table con los colores de TVPaint (verde el pasado,
naranja el futuro) y una ventana de una sola pantalla con menú, cajones y línea de tiempo.

Desarrollado con TDD y con *The Clean Coder* como referencia de método. Software original: no
incluye código, marcas ni recursos de TVPaint ni de ningún otro producto comercial.

---

## Puesta en marcha

```bash
npm install          # 234 paquetes
npm run ffmpeg:assets # copia el core de ffmpeg.wasm a public/ffmpeg
npm run dev          # http://localhost:3001
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto **3001** |
| `npm run build` | Build de producción (incluye los assets de ffmpeg) |
| `npm test` | Suite completa de tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run ffmpeg:assets` | Copia el core de ffmpeg a `public/ffmpeg` |
| `npm run guardar-github` | Commit + push al repositorio |
| `npm run traer-github` | Fetch + merge desde el repositorio |

> **Ojo:** el snapshot del sandbox no conserva `node_modules` ni `.next`. Después de cada cierre
> de sesión hay que volver a correr `npm install` (y `npm run ffmpeg:assets`) antes de `npm run dev`.

---

## Arquitectura (Clean Coder)

```
src/
├── domain/          ← reglas puras, sin React ni Canvas (100% testeadas)
│   ├── brush/       motor de pinceles (dabs, trazos, suavizado, memoria por herramienta)
│   ├── geometry/    formas del Main Panel (línea, rectángulo, elipse, spline)
│   ├── color/       color, distancia RGB, paleta de 30 colores
│   ├── fill/        relleno por inundación
│   ├── timeline/    INSTANCIAS Y CELDAS DE EXPOSICIÓN ← el núcleo del flujo TVPaint
│   ├── lighttable/  Light Table (onion skin al estilo TVPaint)
│   ├── undo/        historial de instantáneas (50 niveles)
│   └── project/     modelo de proyecto (capas, instancias, imágenes)
├── application/     ← store Zustand, persistencia IndexedDB, paleta
├── infrastructure/  ← Canvas 2D, exportadores (GIF/MP4/WebM), audio
├── ui/tv/           ← interfaz (menú, cajones, línea de tiempo, lienzo)
└── app/             ← Next.js (layout, página, estilos)
```

El dominio no sabe qué es un `<canvas>`: produce *dabs* (gotas de tinta) y polilíneas; la capa de
presentación los traduce a llamadas de Canvas 2D. Esa frontera es la que permite testear el
comportamiento del pincel sin navegador.

**Los trazos se guardan como datos vectoriales** (`Stroke` con `points`, `settings` y `seed`), nunca
como píxeles. Se re-renderizan con un PRNG determinista, así el undo/redo, la Light Table y las
exportaciones son reproducibles.

---

## Lo que se copió de TVPaint (en comportamiento, no en código)

### 1. La ventana de una sola pantalla

```
┌──────────────────────────────────────────────────────────────────────┐
│ Menú: Archivo Edición Proyecto Clip Capa Imagen Vista Ayuda  [iconos]│
├────────────┬────────────────────────────────────────┬────────────────┤
│ Main Panel │                                        │  Right Drawer  │
│ Color      │              Canvas                    │  Light Table   │
│ Tool Panel │                                        │  Paleta        │
│            ├────────────────────────────────────────┤  Capas         │
│            │ Info Bar / Playback Bar                │  Audio         │
│            ├────────────────────────────────────────┤  Ayuda         │
│            │ Layer Stack │ instancias / exposición  │                │
└────────────┴────────────────────────────────────────┴────────────────┘
```

### 2. Instancias y celdas de exposición (el flujo de trabajo)

Es la diferencia central respecto de un editor "cuadro a cuadro" clásico. TVPaint no guarda cuadros:
guarda **instancias**. Cada instancia contiene un dibujo (la *cabeza*) que puede permanecer en
pantalla N cuadros más mediante **celdas de exposición**.

Un plan de 8 cuadros con 4 poses se describe así:

| Instancia | Contenido | Celdas | Cuadros que ocupa |
|---|---|---|---|
| 1 | Pose A | 2 | 1–2 |
| 2 | Pose B | 1 | 3 |
| 3 | Pose C | 1 | 4 |
| 4 | Pose D | 4 | 5–8 |

En la línea de tiempo cada instancia es un bloque cuyo ancho depende de su duración, con el
número de celdas en la esquina superior derecha y un **tirador a la derecha** que estira el bloque
(igual que TVPaint).

Operaciones del menú *Clip*:

- Nueva instancia · Agregar exposición · Instancia vacía · Duplicar · Dividir
- Repetir dibujo (×N) · Agregar N exposiciones

### 3. Light Table (el papel cebolla de TVPaint)

No es un "onion skin" genérico: reproduce el panel de TVPaint.

- El cuadro actual es el **"0"** y se ve siempre a opacidad plena.
- Los cuadros **anteriores se tiñen de verde** y los **posteriores de naranja** (no rojo/azul).
- **Cada cuadro tiene su propia opacidad**: en el panel, cada casilla es un tirador — se arrastra
  hacia arriba o abajo para cambiar la intensidad, un clic lo enciende o apaga.
- La bombilla de la **Light Table es por capa**: cada capa decide si participa.
- **Out of pegs**: si los cuadros vecinos están vacíos, muestra el último pivote anterior (o el
  próximo) aunque esté fuera del rango.
- "Mezclar al frente" dibuja el papel cebolla por encima del dibujo actual.
- Hasta 10 cuadros por lado.

### 4. El Main Panel y el Tool Panel

La división es **una caja para cada cosa**, sin repeticiones:

- **Main Panel → *Herramientas***: elige la **herramienta** (qué hace el clic).
  Trazo, Línea, Rectángulo, Círculo/Elipse, Spline, Cubo de pintura, Corte, Selección,
  Transformación, Recorte, Cámara, Cuentagotas.
- **Main Panel → segunda sección**: acciones, no herramientas: borrar el dibujo del cuadro
  actual, suavizado de línea, papel (textura), plantilla y vaciar el papel cebolla.
- **Tool Panel → *Pincel***: elige el **pincel** y sus ajustes. Es el **único** lugar donde se
  elige un pincel (antes la lista se repetía en el cajón derecho).
- **Color Panel**: colores **A** y **B** (se intercambian con **N**).
- **Cajón derecho → *Paleta***: los 30 colores (clic = A, clic derecho = B). Sin pinceles.

El pincel se aplica al **Trazo**; el Tool Panel avisa cuando la herramienta activa no lo usa.
Si se elige la **Goma** estando en otra herramienta, se pasa al Trazo; y si se elige una forma
con la goma activa, se vuelve a la Pluma y se avisa. Así nunca ocurre que un rectángulo
"borre" el dibujo por herencia del pincel.

| Pincel | Controles |
|---|---|
| Pluma | Tamaño, color, opacidad (extremos afinados, como el cel shading) |
| Lápiz | Tamaño, color, opacidad, grano |
| Marcador | Tamaño, color, opacidad (trazo plano) |
| Aerógrafo | Tamaño, color, opacidad, flujo |
| Acuarela | Tamaño, color, opacidad, grano (cerdas perpendiculares, centro más oscuro) |
| Goma | Tamaño, opacidad, dureza, modo suave |

Cada pincel **recuerda sus propios ajustes**: al volver a él se recuperan los valores con los
que se usó (tamaño, opacidad, dureza, grano), en vez de heredar los del pincel anterior.

### 5. El Layer Stack

Columna izquierda de la línea de tiempo: color de la capa, visibilidad, candado, bombilla de la
Light Table, nombre editable (se renombra al salir del campo) y opacidad.

### 6. Lienzo de cualquier tamaño, en píxeles

El tamaño **no está limitado a un catálogo de resoluciones**:

- En la **pantalla de inicio** hay atajos frecuentes (HD, Full HD, 2K, 4K, Cuadrado, Papel A4,
  Vertical) **y dos campos libres** donde se escribe el ancho y el alto exactos en píxeles.
  El botón muestra el resultado: *"Nuevo proyecto · 2400×1350 px"*.
- En **Proyecto → Tamaño del lienzo…** se cambia la resolución en cualquier momento, con dos
  opciones que TVPaint también ofrece:
  - **Escalar el dibujo al nuevo tamaño**: los trazos se escalan (y con ellos el grosor de las
    líneas) para acompañar al nuevo formato. Como los trazos son vectoriales, el escalado es
    exacto y no se pierde calidad.
  - **Mantener la proporción**: el factor menor manda, para no deformar.
- Rango permitido: de **16 a 16384 px por lado**.
- La exportación respeta el tamaño del proyecto: un lienzo de 8000×4500 se exporta a
  8000×4500.

**Rendimiento con lienzos enormes.** Un lienzo de 16000×16000 son 256 megapíxeles: pedir ese
búfer de píxeles mataría el navegador. Por eso:

- El lienzo visible limita su búfer interno a 16 megapíxeles (4096×4096); la medida en pantalla
  no cambia, sólo la resolución interna del dibujo.
- Cada capa rasterizada se cachea con un tope de 8 megapíxeles y se estira al componer.
- El relleno por inundación (que trabaja sobre píxeles) avisa en lugar de colgarse cuando el
  lienzo supera los 40 megapíxeles.

### 7. Correcciones de las herramientas (ronda de revisión)

Cuatro fallos reales que se reprodujeron y corrigieron, con tests en el dominio:

| Síntoma | Causa | Corrección |
|---|---|---|
| El cubo de pintura borraba casi todo el lienzo | El relleno comparaba **sólo RGB**: en una capa transparente el fondo (0,0,0,0) era indistinguible de la tinta negra (0,0,0) y la inundación se filtraba por todo el dibujo | La comparación respeta el **alfa**: la relleno no puede pasar de una zona transparente a una pintada |
| Al volver al lápiz redibujaba el dibujo "por pasos" | El relleno **reemplazaba** los trazos vectoriales por un bitmap, y la caché de capas se indexaba por `imagen#cantidad de trazos` (colisión: N trazos nuevos con la misma N) | El relleno se **añade** encima como bitmap de la región rellenada y la caché se indexa por la **identidad de los trazos** |
| La goma no borraba | La goma es un pincel: al elegirla se quedaba la herramienta anterior, y las formas heredaban su motor de borrado | Elegir la **Goma** pasa al **Trazo**; las formas usan siempre su propio motor (`brush`) y la goma se limita al trazo libre |
| El corte no cortaba los trazos que cruzaban la región | Sólo se descartaban los trazos **enteros** contenidos en la región | El corte es **geométrico** (Liang–Barsky): parte los trazos en el punto exacto donde cruzan la región y borra los píxeles de los rellenos |

Además: el **cuentagotas** leía el píxel con el DPR en lugar del factor de escala real del
lienzo (por eso siempre devolvía blanco), y el **Tool Panel** ya no duplica la lista de
pinceles del cajón derecho.

### 8. Otras cosas de TVPaint

- Capas como **acetatos** apilados: la de abajo descansa sobre el fondo.
- Menú *Clip* con el vocabulario de TVPaint (instancias, exposiciones, repetir).
- Reproducción con barra de reproducción y FPS configurable.
- Atajos: `N` colores, `P` panel de color, `Shift+A` panel de pincel, `0` línea de tiempo,
  `1`–`6` pinceles, `L/R/O/S/G/M` herramientas, `Ctrl+arrastrar` tamaño del pincel, `F1` pantalla
  completa.

---

## Lo que esta edición todavía no tiene

Comparado con TVPaint Standard, quedan fuera (a propósito, para que la interfaz sea utilizable):

- Escaneo y limpieza de dibujos escaneados (*Scan Cleaner*).
- Estabilizador de pivotes aplicado a escaneos (la base del suavizado está, el flujo de escaneo no).
- Capas de cámara con keyframes y 2D Camera.
- Sistema de *rooms* (escritorios de panel) y paneles flotantes fuera de la ventana.
- Exportación a After Effects / TVPaint y formatos de línea de tiempo.
- Plastic deformation, warp, colorización inteligente (CTG).
- Storyboard.

---

## Tests

```
Test Files  10 passed
     Tests  102 passed
```

Cubren el motor de pinceles, el relleno por inundación, la paleta, las **instancias y celdas de
exposición**, la **Light Table**, las formas geométricas, el suavizado de línea, el historial de
undo/redo, el plan de exportación, el color, la paleta y el **redimensionado del lienzo**
(escalado del dibujo, límites de tamaño y proporciones).

```bash
npm test
npm run typecheck   # 0 errores
```

---

## Exportación

| Formato | Motor | Estado |
|---|---|---|
| GIF animado | `gifenc` | ✅ verificado (1280×720, paleta de 256) |
| MP4 (H.264) | `@ffmpeg/ffmpeg` (WASM, worker propio) | ✅ verificado |
| WebM (VP9) | `MediaRecorder` nativo | ✅ verificado |
| PNG / JPEG | Canvas 2D | ✅ verificado |

El core de ffmpeg se copia a `public/ffmpeg` con `npm run ffmpeg:assets`. Se usa siempre la
variante **simple** (`/ffmpeg/core`): la multi-hilo falla con `function signature mismatch` en
este entorno. `next.config.ts` define los headers `COOP`/`COEP` que exige `SharedArrayBuffer`.

---

## Atajos

| Tecla | Acción |
|---|---|
| `Espacio` | Reproducir / pausar |
| `←` `→` | Cuadro anterior / siguiente |
| `Home` `End` | Primer / último cuadro |
| `N` | Intercambiar color A y B |
| `P` | Mostrar / ocultar el Color Panel |
| `Shift+A` | Mostrar / ocultar el Tool Panel |
| `0` | Mostrar / ocultar la línea de tiempo |
| `1` – `6` | Pluma, lápiz, marcador, aerógrafo, acuarela, goma |
| `L` `R` `O` `S` | Línea, rectángulo, elipse, spline |
| `G` `M` | Cubo de pintura, selección |
| `X` `H` `Z` | Goma, mano, zoom |
| `Ctrl+Z` / `Ctrl+Y` | Deshacer / rehacer |
| `Ctrl+arrastrar` | Cambiar el tamaño del pincel (10 px = 1 unidad) |
| `F1` | Pantalla completa |

---

## GitHub

```bash
npm run guardar-github   # commit + push
npm run traer-github     # fetch + merge
```

---

## Licencia y créditos

Software original. TVPaint es una marca de TVPaint Software; este proyecto **no** incluye su
código, sus recursos gráficos ni sus marcas. Se replican únicamente las *ideas* del flujo de
trabajo de animación tradicional (instancias, celdas de exposición, Light Table), que son
prácticas generales del oficio.
