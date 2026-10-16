/* =========================================================
   SUBIDA DE ARCHIVO - GESTIONA!

   Seminario de proyectos I BR: zona de arrastrar y soltar, validación del archivo
   y mensajes de la pantalla.
   Mejora seminario de proyectos II BR: lectura del Excel, detección de columnas,
   guardado en Supabase sin repetir tickets, resultado de la carga e historial.
========================================================= */

/* ---------- Elementos de la pantalla (Seminario de proyectos I BR) ---------- */
const inputArchivo = document.getElementById("inputArchivo");
const nombreArchivo = document.getElementById("nombreArchivo");

const zonaDrop = document.getElementById("zonaDrop");
const iconoExcel = document.getElementById("iconoExcel");
const textoPrincipal = document.getElementById("textoPrincipal");
const textoSecundario = document.getElementById("textoSecundario");

// Mejora seminario de proyectos II BR: elementos nuevos
const boton = document.getElementById("btnGuardar");
const panelMapa = document.getElementById("panelMapa");
const infoMapa = document.getElementById("infoMapa");
const panelResultado = document.getElementById("panelResultado");

const CAMPOS = ["Ticket", "Estado", "Resumen", "Prioridad", "Fecha"];   // ids: map + campo
const LOTE = 250;                                                       // tickets por envío

let archivoTemporal = null;
let filasExcel = [];      // Mejora seminario de proyectos II BR: filas leídas del Excel
let columnasExcel = [];   // Mejora seminario de proyectos II BR: nombres de las columnas

// PREVENIR comportamiento por defecto (Seminario de proyectos I BR)
["dragenter", "dragover", "dragleave", "drop"].forEach(evento => {
  zonaDrop.addEventListener(evento, e => e.preventDefault());
});

// CUANDO ARRASTRA ENCIMA (Seminario de proyectos I BR)
zonaDrop.addEventListener("dragover", () => {
  zonaDrop.style.borderColor = "#22c55e";
});

// CUANDO SALE (Seminario de proyectos I BR)
zonaDrop.addEventListener("dragleave", () => {
  zonaDrop.style.borderColor = "#D82299";
});

// CUANDO SUELTA EL ARCHIVO (Seminario de proyectos I BR)
zonaDrop.addEventListener("drop", (e) => {
  const archivo = e.dataTransfer.files[0];
  procesarArchivo(archivo);
});

// CUANDO SELECCIONA CON CLICK (Seminario de proyectos I BR)
inputArchivo.addEventListener("change", (e) => {
  const archivo = e.target.files[0];
  procesarArchivo(archivo);
  // Mejora seminario de proyectos II BR: se vacía el campo para que elegir el MISMO archivo otra vez
  // (por ejemplo, el Excel de Jira que se descarga siempre con el mismo nombre pero con datos nuevos)
  // vuelva a leerse. El archivo ya quedó guardado en archivoTemporal.
  inputArchivo.value = "";
});

/* =========================================================
   FUNCIÓN PRINCIPAL (Seminario de proyectos I BR)
========================================================= */
function procesarArchivo(archivo) {

  if (!archivo) return;

  const tiposPermitidos = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel"
  ];

  // Mejora seminario de proyectos II BR: también se acepta por la extensión del nombre
  // (algunos navegadores en Windows no informan el tipo del archivo)
  const esExcel = tiposPermitidos.includes(archivo.type) || /\.xlsx?$/i.test(archivo.name);

  if (!esExcel) {
    alert("Solo se permiten archivos Excel (.xlsx o .xls)");
    inputArchivo.value = "";
    return;
  }

  archivoTemporal = archivo;

  // MOSTRAR ICONO
  iconoExcel.classList.remove("hidden");

  // CAMBIAR TEXTOS
  textoPrincipal.textContent = "Archivo listo";
  textoSecundario.textContent = archivo.name;

  // NOMBRE ABAJO
  nombreArchivo.textContent = "Archivo cargado: " + archivo.name;
  nombreArchivo.classList.remove("text-gray-400");
  nombreArchivo.classList.add("text-green-500");

  // ESTILO
  zonaDrop.style.borderColor = "#22c55e";

  // Mejora seminario de proyectos II BR: leer el contenido para detectar las columnas
  panelResultado.classList.add("hidden");
  leerExcel(archivo);
}

/* =========================================================
   LEER EL EXCEL Y DETECTAR COLUMNAS  (Mejora seminario de proyectos II BR)
========================================================= */

function leerExcel(archivo) {
  const lector = new FileReader();

  lector.onload = function (e) {
    try {
      const libro = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      filasExcel = XLSX.utils.sheet_to_json(hoja, { defval: "" });
    } catch (error) {
      console.error("Error al leer el Excel:", error);
      filasExcel = [];
    }

    if (!filasExcel.length) {
      panelMapa.classList.add("hidden");
      bloquearGuardar();
      mostrarResultado("error", "No pude leer filas en ese archivo. Revisa que sea un Excel con encabezados en la primera fila.");
      return;
    }

    // Todas las columnas que aparezcan (no solo las de la primera fila); se ignoran las sin nombre
    const nombres = new Set();
    filasExcel.forEach(f => Object.keys(f).forEach(k => nombres.add(k)));
    columnasExcel = [...nombres].filter(c => !/^__EMPTY/.test(c));

    llenarSelects();
    panelMapa.classList.remove("hidden");
    actualizarVista();
  };

  lector.readAsArrayBuffer(archivo);
}

// Busca la primera columna que cumpla alguno de los patrones, en orden de preferencia
function detectar(patrones) {
  for (const patron of patrones) {
    const col = columnasExcel.find(c => patron.test(String(c).trim()));
    if (col) return col;
  }
  return "";
}

const DETECCION = {
  Ticket:    [/^clave( de (incidencia|problema))?$/i, /^issue key$/i, /^key$/i, /^(n[uú]mero|n[oº°]\.?|id)( del?)?( ticket| tk| caso)?$/i, /ticket|identificador/i, /clave|key/i],
  Estado:    [/^(estado|status)$/i, /estado|status/i],
  Resumen:   [/^(resumen|summary)$/i, /^(t[ií]tulo|asunto)$/i, /^(descripci[oó]n|description)$/i, /resumen|summary|asunto|t[ií]tulo|descripci/i],
  Prioridad: [/^(prioridad|priority)$/i, /prioridad|priority/i],
  Fecha:     [/^(creada?|creado|created|fecha( de)? creaci[oó]n|fecha)$/i, /creada|created|fecha|date/i]
};

function llenarSelects() {
  CAMPOS.forEach(campo => {
    const select = document.getElementById("map" + campo);
    select.innerHTML = campo === "Ticket" ? "" : `<option value="">(no usar)</option>`;
    columnasExcel.forEach(col => {
      const op = document.createElement("option");
      op.value = col;
      op.textContent = col;
      select.appendChild(op);
    });
    select.value = detectar(DETECCION[campo]);
    select.onchange = actualizarVista;
  });
}

function leerMapa() {
  const mapa = {};
  CAMPOS.forEach(c => { mapa[c.toLowerCase()] = document.getElementById("map" + c).value; });
  return mapa;
}

/* =========================================================
   ARMAR LOS REGISTROS A GUARDAR  (Mejora seminario de proyectos II BR)
========================================================= */

const COLUMNA_FECHA = /fecha|creada|created|actualizad|updated|resuelt|resolved|vencim|due/i;

// Copia la fila del Excel sin celdas vacías y con las fechas legibles (no como números de Excel)
function limpiarFila(fila) {
  const limpia = {};
  Object.keys(fila).forEach(col => {
    if (/^__EMPTY/.test(col)) return;
    let valor = fila[col];
    if (valor === "" || valor === null || valor === undefined) return;
    if (typeof valor === "number" && COLUMNA_FECHA.test(col)) valor = aISO(valor) || valor;
    limpia[col] = valor;
  });
  return limpia;
}

function textoDe(fila, col) {
  return col ? String(fila[col] ?? "").trim() : "";
}

function construirRegistros() {
  const mapa = leerMapa();
  const unicos = new Map();
  let sinNumero = 0;
  let repetidosEnArchivo = 0;

  filasExcel.forEach(fila => {
    const id = textoDe(fila, mapa.ticket);
    if (!id) { sinNumero++; return; }
    if (unicos.has(id)) repetidosEnArchivo++;

    unicos.set(id, {
      identificador_tk: id,
      estado: textoDe(fila, mapa.estado),
      resumen: textoDe(fila, mapa.resumen),
      prioridad: textoDe(fila, mapa.prioridad),
      fecha_creacion: mapa.fecha ? aISO(fila[mapa.fecha]) : null,
      datos: limpiarFila(fila)
    });
  });

  return { registros: [...unicos.values()], sinNumero, repetidosEnArchivo };
}

function bloquearGuardar() {
  boton.disabled = true;
  boton.style.opacity = ".5";
}

function habilitarGuardar() {
  boton.disabled = false;
  boton.style.opacity = "1";
}

function actualizarVista() {
  if (!document.getElementById("mapTicket").value) {
    infoMapa.textContent = "Elige la columna que trae el número de ticket.";
    bloquearGuardar();
    return;
  }

  const { registros, sinNumero, repetidosEnArchivo } = construirRegistros();
  let texto = `${registros.length} tickets listos para guardar`;
  if (repetidosEnArchivo) texto += ` · ${repetidosEnArchivo} repetidos dentro del archivo (se toma el último)`;
  if (sinNumero) texto += ` · ${sinNumero} filas sin número de ticket (se ignoran)`;
  infoMapa.textContent = texto;

  if (registros.length) habilitarGuardar(); else bloquearGuardar();
}

/* =========================================================
   GUARDAR EN SUPABASE  (Mejora seminario de proyectos II BR)
   La base de datos decide qué es nuevo, qué se actualiza y qué se omite
   (función subir_tickets del archivo SQL).
========================================================= */

boton.addEventListener("click", async function () {

  if (!archivoTemporal) {
    alert("Primero debes subir un archivo");   // Seminario de proyectos I BR
    return;
  }

  const { registros, sinNumero, repetidosEnArchivo } = construirRegistros();
  if (!registros.length) return;

  bloquearGuardar();
  panelResultado.classList.add("hidden");

  let cargaId = null;
  const total = { nuevos: 0, actualizados: 0, ajenos: 0, lista: [] };

  try {
    for (let i = 0; i < registros.length; i += LOTE) {
      boton.textContent = `Guardando ${Math.min(i + LOTE, registros.length)} de ${registros.length}...`;

      const { data, error } = await db.rpc("subir_tickets", {
        p_tickets: registros.slice(i, i + LOTE),
        p_nombre_archivo: archivoTemporal.name,
        p_carga_id: cargaId
      });
      if (error) throw error;

      cargaId = data.carga_id;
      total.nuevos += data.nuevos;
      total.actualizados += data.actualizados;
      total.ajenos += data.ajenos;
      total.lista.push(...(data.ajenos_lista || []));
    }
  } catch (error) {
    console.error("Error al guardar:", error);
    const msg = String(error.message || error);
    if (/could not find the function|schema cache/i.test(msg)) {
      mostrarResultado("error", "Falta crear la base de datos. Corre el archivo SQL de GESTIONA en Supabase y vuelve a intentar.");
    } else {
      mostrarResultado("error", "No se pudo guardar: " + msg);
    }
    boton.textContent = "Guardar tickets";
    habilitarGuardar();
    return;
  }

  boton.textContent = "Guardar tickets";
  habilitarGuardar();
  mostrarResultado("ok", null, { ...total, sinNumero, repetidosEnArchivo, archivo: archivoTemporal.name });
  cargarHistorial();
});

function mostrarResultado(tipo, mensaje, r) {
  panelResultado.classList.remove("hidden");

  if (tipo === "error") {
    panelResultado.innerHTML = `<div style="background:#fef2f2; color:#991b1b; border-radius:12px; padding:14px; font-size:14px;">${escapar(mensaje)}</div>`;
    return;
  }

  const lineas = [];
  lineas.push(`<b>${r.nuevos}</b> tickets nuevos guardados`);
  if (r.actualizados) lineas.push(`<b>${r.actualizados}</b> ya eran tuyos y se actualizaron (estado, descripción y demás)`);
  if (r.ajenos) {
    const lista = r.lista.slice(0, 10).map(escapar).join(", ") + (r.ajenos > 10 ? "…" : "");
    lineas.push(`<b>${r.ajenos}</b> no se guardaron porque ya estaban registrados por otro compañero (${lista})`);
  }
  if (r.repetidosEnArchivo) lineas.push(`${r.repetidosEnArchivo} estaban repetidos dentro del archivo`);
  if (r.sinNumero) lineas.push(`${r.sinNumero} filas no tenían número de ticket`);

  panelResultado.innerHTML = `
    <div style="background:#f0fdf4; color:#14532d; border-radius:12px; padding:16px; font-size:14px;">
      <p style="font-weight:800; font-size:15px; color:#14532d;">Carga terminada</p>
      <ul style="margin-top:8px; line-height:1.7; list-style:disc; padding-left:18px;">
        ${lineas.map(l => `<li>${l}</li>`).join("")}
      </ul>
      <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:14px;">
        <a href="agenda.html" class="btn-main" style="display:inline-block; text-decoration:none;">Ir a mi agenda</a>
        <a href="dashboard.html" class="btn-volver" style="display:inline-block; text-decoration:none; color:#333;">Ver dashboard</a>
      </div>
    </div>`;
}

/* =========================================================
   HISTORIAL DE CARGAS  (Mejora seminario de proyectos II BR)
========================================================= */

async function cargarHistorial() {
  const { data, error } = await db
    .from("cargas")
    .select("nombre_archivo, creado_en, nuevos, actualizados, omitidos")
    .order("creado_en", { ascending: false })
    .limit(5);

  if (error || !data || !data.length) return;

  document.getElementById("panelHistorial").classList.remove("hidden");
  document.getElementById("listaCargas").innerHTML = data.map(c => {
    const f = new Date(c.creado_en);
    const fecha = `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}`;
    return `<li style="padding:4px 0;">${fecha} · ${escapar(c.nombre_archivo || "archivo")} — ${c.nuevos} nuevos, ${c.actualizados} actualizados, ${c.omitidos} omitidos</li>`;
  }).join("");
}

sesionLista.then(usuario => { if (usuario) cargarHistorial(); });
