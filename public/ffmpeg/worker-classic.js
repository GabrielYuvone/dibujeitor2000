/**
 * Worker (módulo) para ffmpeg.wasm.
 *
 * El core se importa dinámicamente como módulo ES: es lo que espera el worker
 * de hilos (pthread) del build multi-hilo, que hace `import(urlOrBlob)` del
 * script principal.
 *
 * Se deja el hilo principal libre durante la codificación.
 */

let core = null;

self.onmessage = async (event) => {
  const { type, payload, id } = event.data || {};

  // Cada respuesta lleva el id de la petición para resolver la promesa correcta.
  const post = (responseType, responsePayload) =>
    self.postMessage({ type: responseType, payload: responsePayload, id });

  try {
    switch (type) {
      case "load": {
        const module = await import(payload.coreUrl);
        const factory = module.default;
        if (!factory) throw new Error("El core de ffmpeg no quedó disponible");

        core = await factory({
          mainScriptUrlOrBlob: payload.mainScriptUrlOrBlob,
        });

        core.setLogger((data) => post("log", data));
        core.setProgress((data) => post("progress", data));

        post("loaded", true);
        break;
      }

      case "writeFile": {
        core.FS.writeFile(payload.path, new Uint8Array(payload.data));
        post("written", true);
        break;
      }

      case "readFile": {
        const data = core.FS.readFile(payload.path);
        post("read", data);
        break;
      }

      case "deleteFile": {
        core.FS.unlink(payload.path);
        post("deleted", true);
        break;
      }

      case "exec": {
        core.setTimeout(-1);
        core.exec(...payload.args);
        const code = core.ret;
        core.reset();
        post("executed", code);
        break;
      }

      default:
        post("error", `Mensaje desconocido: ${type}`);
    }
  } catch (error) {
    post("error", error instanceof Error ? error.message : String(error));
  }
};
