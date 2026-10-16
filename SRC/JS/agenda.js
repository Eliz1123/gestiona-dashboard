/* =========================================================
   AGENDA DEL DÍA - GESTIONA!
   Mejora seminario de proyectos II BR (archivo nuevo)

   Reglas de la agenda:
   - Se arma SOLO con tus tickets guardados (no hace falta subir un Excel nuevo).
   - No entran los tickets cerrados en Jira ni los que ya marcaste como hechos.
   - Un ticket bloqueado vuelve a aparecer el día que elegiste.
   - Lo que no se hizo hoy pasa a la agenda del día siguiente (con más prioridad).
   Usa "db" y las utilidades de JS/supabase.js
========================================================= */

const LIMITE_POR_DEFECTO = 10;     // tickets por día si no se cambia en pantalla
const CAMPOS_TICKET = "identificador_tk, estado, resumen, prioridad, fecha_creacion, situacion, depende_de, reaparece_el, nota, solucion, completado_en";

let miUsuario = null;
let fechaActual = hoyISO();
let agendaActual = [];             // filas de la agenda con su ticket, como se ven en pantalla
let arrastrePorTicket = {};        // ticket_id -> en cuántas agendas de días anteriores estuvo

const $ = (id) => document.getElementById(id);

function setEstado(mensaje, esError = false) {
  const p = $("estadoAgenda");
  p.textContent = mensaje;
  p.className = "text-sm mb-4 min-h-[20px] " + (esError ? "text-red-500" : "text-slate-500");
}

function leerLimite() {
  const n = parseInt($("limiteDia").value, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : LIMITE_POR_DEFECTO;
}

function nombreDia(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const texto = new Date(a, m - 1, d).toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* =========================================================
   MOTOR DE PRIORIDAD
   Suma puntos: prioridad de Jira + antigüedad + días que lleva pasando de agenda en agenda
   + estado + si vuelve de un bloqueo. Más puntos = más arriba en la agenda.
========================================================= */

function calcularScore(t, veces) {
  let score = 0;

  const prioridad = String(t.prioridad || "");
  if (/highest|critic|cr[ií]tic|urgent|blocker|bloqueante|m[aá]s alta|muy alta/i.test(prioridad)) score += 50;
  else if (/high|alta|major/i.test(prioridad)) score += 35;
  else if (/medium|media|normal/i.test(prioridad)) score += 20;
  else if (/low|baja|minor|trivial/i.test(prioridad)) score += 5;

  if (t.fecha_creacion) score += Math.min(Math.max(0, diasEntre(t.fecha_creacion, hoyISO())), 60);

  score += Math.min((veces || 0) * 5, 25);

  if (/abiert|open|nuev|pendiente|por hacer|to do/i.test(t.estado)) score += 10;
  else if (/proceso|progreso|curso|progress/i.test(t.estado)) score += 5;

  if (t.situacion === "bloqueado") score += 15;   // ya venció su bloqueo: toca revisarlo

  return score;
}

/* =========================================================
   GENERAR LA AGENDA DEL DÍA
========================================================= */

async function generarAgenda() {
  if (fechaActual < hoyISO()) {
    setEstado("Solo puedes generar la agenda de hoy o de días que vienen. Los días pasados se ven como historial.", true);
    return;
  }

  const boton = $("btnGenerar");
  boton.disabled = true;
  setEstado("Generando agenda...");

  try {
    const limite = leerLimite();

    // 1. Mis tickets que no están hechos
    const tickets = await traerTodos(() =>
      db.from("tickets")
        .select("id, identificador_tk, estado, resumen, prioridad, fecha_creacion, situacion, reaparece_el")
        .eq("subido_por", miUsuario.id)
        .neq("situacion", "hecho")
        .order("id"));

    // 2. Cuáles pueden entrar hoy: pendientes, o bloqueados cuyo plazo ya llegó. Los cerrados en Jira no.
    const elegibles = tickets.filter(t =>
      !esCerrado(t.estado) &&
      (t.situacion === "pendiente" || (t.situacion === "bloqueado" && t.reaparece_el && t.reaparece_el <= fechaActual)));
    const idsElegibles = new Set(elegibles.map(t => t.id));

    // 3. Lo que ya hay en la agenda de ese día
    const existentes = await traerTodos(() =>
      db.from("agenda_dia")
        .select("id, ticket_id, orden, tickets(situacion)")
        .eq("usuario_id", miUsuario.id)
        .eq("fecha", fechaActual)
        .order("id"));

    // 4. Cuántos días anteriores estuvo cada ticket en mi agenda sin resolverse
    const previas = await traerTodos(() =>
      db.from("agenda_dia")
        .select("ticket_id")
        .eq("usuario_id", miUsuario.id)
        .lt("fecha", fechaActual)
        .order("id"));
    const veces = {};
    previas.forEach(r => { veces[r.ticket_id] = (veces[r.ticket_id] || 0) + 1; });

    const puntaje = new Map(elegibles.map(t => [t.id, calcularScore(t, veces[t.id])]));

    // 5. Se queda lo que ya estaba y sigue vigente, más lo que ya gestioné hoy (hecho o bloqueado)
    const mantener = existentes.filter(r => idsElegibles.has(r.ticket_id) || (r.tickets && r.tickets.situacion !== "pendiente"));
    const idsMantener = new Set(mantener.map(r => r.ticket_id));
    const vigentes = mantener.filter(r => idsElegibles.has(r.ticket_id)).map(r => r.ticket_id);
    const gestionados = mantener.filter(r => !idsElegibles.has(r.ticket_id)).map(r => r.ticket_id);

    // 6. Se completa con los de mayor puntaje hasta llegar al límite
    const cupo = Math.max(0, limite - vigentes.length);
    const nuevos = elegibles
      .filter(t => !idsMantener.has(t.id))
      .sort((a, b) => puntaje.get(b.id) - puntaje.get(a.id))
      .slice(0, cupo)
      .map(t => t.id);

    const porHacer = [...vigentes, ...nuevos].sort((a, b) => puntaje.get(b) - puntaje.get(a));
    const final = [...porHacer, ...gestionados];

    if (!final.length) {
      setEstado("No tienes tickets pendientes para ese día. Sube un Excel nuevo o revisa los bloqueados que vuelven más adelante.", true);
      boton.disabled = false;
      return;
    }

    // 7. Se guarda (sin tocar el tiempo estimado que ya hubiera) y se quita lo que ya no corresponde
    const filas = final.map((id, i) => ({ usuario_id: miUsuario.id, fecha: fechaActual, ticket_id: id, orden: i + 1 }));
    const guardado = await db.from("agenda_dia").upsert(filas, { onConflict: "usuario_id,fecha,ticket_id" });
    if (guardado.error) throw guardado.error;

    const idsFinal = new Set(final);
    const borrar = existentes.filter(r => !idsFinal.has(r.ticket_id)).map(r => r.id);
    if (borrar.length) {
      const borrado = await db.from("agenda_dia").delete().in("id", borrar);
      if (borrado.error) throw borrado.error;
    }

    const quedan = elegibles.length - porHacer.length;
    setEstado(
      `Agenda lista: ${porHacer.length} por hacer de ${elegibles.length} pendientes.` +
      (quedan > 0 ? ` Los otros ${quedan} pasan a los próximos días.` : "")
    );
    await cargarAgenda();

  } catch (error) {
    console.error("Error al generar la agenda:", error);
    setEstado("No se pudo generar la agenda: " + (error.message || error), true);
  } finally {
    boton.disabled = fechaActual < hoyISO();
  }
}

/* =========================================================
   LEER Y MOSTRAR LA AGENDA
========================================================= */

async function cargarAgenda() {
  $("textoFecha").textContent = nombreDia(fechaActual);
  $("btnGenerar").disabled = fechaActual < hoyISO();
  $("btnGenerar").title = fechaActual < hoyISO() ? "Solo se puede generar la agenda de hoy o de días que vienen" : "";

  try {
    const { data, error } = await db
      .from("agenda_dia")
      .select(`id, ticket_id, orden, tiempo_estimado, tickets(${CAMPOS_TICKET})`)
      .eq("usuario_id", miUsuario.id)
      .eq("fecha", fechaActual)
      .order("orden");
    if (error) throw error;

    agendaActual = data;

    arrastrePorTicket = {};
    const ids = data.map(f => f.ticket_id);
    if (ids.length) {
      const { data: previas } = await db
        .from("agenda_dia")
        .select("ticket_id")
        .eq("usuario_id", miUsuario.id)
        .lt("fecha", fechaActual)
        .in("ticket_id", ids);
      (previas || []).forEach(r => { arrastrePorTicket[r.ticket_id] = (arrastrePorTicket[r.ticket_id] || 0) + 1; });
    }

    renderResumen(data);
    renderLista(data);
    cargarParecidos(data);
    cargarBloqueadosFuturos();

  } catch (error) {
    console.error("Error al cargar la agenda:", error);
    setEstado("No se pudo cargar la agenda: " + (error.message || error) + ". Revisa que la base de datos esté creada.", true);
  }
}

function renderResumen(filas) {
  const situacion = (f) => (f.tickets || {}).situacion;
  const minutos = filas
    .filter(f => situacion(f) === "pendiente")
    .reduce((suma, f) => suma + (f.tiempo_estimado || 0), 0);

  $("kpiTotal").textContent = filas.length;
  $("kpiHechos").textContent = filas.filter(f => situacion(f) === "hecho").length;
  $("kpiBloqueados").textContent = filas.filter(f => situacion(f) === "bloqueado").length;
  $("kpiTiempo").textContent =
    minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`;
}

function insignia(texto, clases) {
  return `<span class="text-xs px-2 py-0.5 rounded-full ${clases}">${texto}</span>`;
}

function htmlTarjeta(f) {
  const t = f.tickets || {};
  const hecho = t.situacion === "hecho";
  const bloqueado = t.situacion === "bloqueado";
  // "Venció" se mide contra el día que se está viendo (no contra hoy): en la agenda del día
  // en que el bloqueo termina, el ticket tiene que avisar que ya toca revisarlo
  const plazoVencido = bloqueado && t.reaparece_el && t.reaparece_el <= fechaActual;
  const veces = arrastrePorTicket[f.ticket_id] || 0;
  const diasAbierto = t.fecha_creacion ? Math.max(0, diasEntre(t.fecha_creacion, hoyISO())) : null;

  const borde = hecho ? "border-green-500" : bloqueado ? "border-[#F2A93B]" : "border-[#D82299]";
  const tachado = hecho ? "line-through text-slate-400" : "";

  const marcas = [insignia(escapar(t.estado), "bg-slate-100 text-slate-600")];
  if (t.prioridad) marcas.push(insignia("Prioridad " + escapar(t.prioridad), "bg-purple-50 text-[#3F2574]"));
  if (hecho) marcas.push(insignia("Hecho", "bg-green-100 text-green-700 font-semibold"));
  if (bloqueado && !plazoVencido) marcas.push(insignia("Bloqueado hasta el " + formatoFecha(t.reaparece_el), "bg-amber-100 text-amber-700 font-semibold"));
  if (plazoVencido) marcas.push(insignia("Venció el bloqueo: revísalo", "bg-red-100 text-red-700 font-semibold"));
  if (veces && !hecho) marcas.push(insignia(`Viene de ${veces} día${veces > 1 ? "s" : ""} anterior${veces > 1 ? "es" : ""}`, "bg-sky-100 text-sky-700"));

  const meta = t.fecha_creacion
    ? `Creado el ${formatoFecha(t.fecha_creacion)}${diasAbierto !== null ? ` · lleva ${diasAbierto} día${diasAbierto === 1 ? "" : "s"} abierto` : ""}`
    : "Sin fecha de creación";

  const opcion = (valor, texto) => `<option value="${valor}" ${t.situacion === valor ? "selected" : ""}>${texto}</option>`;
  const campo = "mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-800";

  return `
    <article class="bg-white rounded-2xl shadow-sm border-l-4 ${borde} p-5" data-id="${f.id}" data-ticket="${f.ticket_id}">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 shrink-0 rounded-full ${hecho ? "bg-green-500" : "bg-[#3F2574]"} text-white font-black flex items-center justify-center">
          ${f.orden}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-black text-[#3F2574] ${tachado}">${escapar(t.identificador_tk)}</span>
            ${marcas.join("")}
          </div>
          <p class="text-sm text-slate-700 mt-1 ${tachado}">${escapar(t.resumen || "Sin descripción")}</p>
          <p class="text-xs text-slate-400 mt-1">${meta}</p>

          <div class="parecidos mt-3" data-ticket="${f.ticket_id}"></div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 items-end">
            <label class="text-xs text-slate-500">Situación
              <select class="f-situacion ${campo}">
                ${opcion("pendiente", "Pendiente")}
                ${opcion("bloqueado", "Bloqueado: depende de otra persona")}
                ${opcion("hecho", "Hecho")}
              </select>
            </label>

            <label class="text-xs text-slate-500">Tiempo estimado (min)
              <input type="number" min="0" class="f-tiempo ${campo}" value="${f.tiempo_estimado ?? ""}">
            </label>

            <button class="btn-guardar btn-primary text-sm">Guardar</button>
          </div>

          <div class="bloque-bloqueo ${bloqueado ? "" : "hidden"} mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="text-xs text-slate-600">¿De quién depende?
                <input type="text" class="f-depende ${campo}" placeholder="Ej: Juan, equipo de Infraestructura" value="${escapar(t.depende_de || "")}">
              </label>
              <label class="text-xs text-slate-600">Volver a mostrarlo el
                <input type="date" class="f-vuelve ${campo}" value="${t.reaparece_el || ""}">
              </label>
            </div>
            <div class="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
              Atajos:
              <button type="button" class="chip-dias px-3 py-1 rounded-full bg-white border border-amber-300 text-amber-800" data-dias="1">mañana</button>
              <button type="button" class="chip-dias px-3 py-1 rounded-full bg-white border border-amber-300 text-amber-800" data-dias="3">en 3 días</button>
              <button type="button" class="chip-dias px-3 py-1 rounded-full bg-white border border-amber-300 text-amber-800" data-dias="7">en 1 semana</button>
            </div>
          </div>

          <label class="bloque-solucion ${hecho ? "" : "hidden"} text-xs text-slate-500 block mt-3">Solución aplicada
            <textarea rows="2" class="f-solucion ${campo}"
              placeholder="Qué hiciste para resolverlo. Le servirá a cualquier compañero que reciba un ticket parecido.">${escapar(t.solucion || "")}</textarea>
          </label>

          <label class="text-xs text-slate-500 block mt-3">Notas
            <textarea rows="2" class="f-nota ${campo}" placeholder="Apuntes de este ticket">${escapar(t.nota || "")}</textarea>
          </label>
        </div>
      </div>
    </article>`;
}

function renderLista(filas) {
  const contenedor = $("listaAgenda");

  if (!filas.length) {
    const pasado = fechaActual < hoyISO();
    contenedor.innerHTML = `
      <div class="bg-white rounded-2xl p-10 text-center text-slate-500">
        ${pasado
          ? "No hay agenda guardada de ese día."
          : "Todavía no hay agenda para este día.<br>Pulsa <b>Generar agenda</b> para armarla con tus tickets pendientes."}
      </div>`;
    return;
  }

  contenedor.innerHTML = filas.map(htmlTarjeta).join("");
}

/* =========================================================
   AVISO: "ya se resolvió algo parecido"
   (busca en toda la base, también tickets de otros compañeros)
========================================================= */

async function cargarParecidos(filas) {
  await Promise.all(filas.filter(f => f.tickets && f.tickets.situacion !== "hecho").map(async (f) => {
    const { data, error } = await db.rpc("tickets_parecidos", { p_ticket_id: f.ticket_id });
    if (error) {
      console.warn("tickets_parecidos:", error.message);
      return;
    }
    if (!data || !data.length) return;

    const zona = document.querySelector(`.parecidos[data-ticket="${f.ticket_id}"]`);
    if (!zona) return;

    zona.innerHTML = `
      <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
        <b>Ya se resolvió algo parecido</b>
        ${data.map(p => {
          // Dos casos: lo marcó como hecho alguien en GESTIONA (hay fecha y quizá solución),
          // o solo está cerrado en Jira (se sabe quién lo registró, pero no cómo se resolvió)
          const nombre = escapar(p.trabajado_por || "otro compañero");
          const cuando = p.completado_en ? " el " + formatoFecha(hoyISO_de(p.completado_en)) : "";
          const intro = `En el ticket <b>${escapar(p.identificador_tk)}</b> (${Math.round(p.similitud * 100)}% parecido): `;
          const quien = p.completado_en
            ? (p.es_mio ? "lo trabajaste tú" : `lo trabajó <b>${nombre}</b>`) + escapar(cuando) + "."
            : (p.es_mio ? "es tuyo y" : `lo tiene registrado <b>${nombre}</b> y`) + " está cerrado en Jira.";
          return `
            <div class="mt-2">
              ${intro}${quien}
              ${p.solucion
                ? `<div class="italic mt-0.5">Solución: ${escapar(p.solucion)}</div>`
                : `<div class="mt-0.5">No hay una solución escrita.</div>`}
            </div>`;
        }).join("")}
        <div class="mt-2">Te conviene revisarlo antes de empezar.</div>
      </div>`;
  }));
}

function hoyISO_de(instante) {
  const d = new Date(instante);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* =========================================================
   BLOQUEADOS QUE VUELVEN MÁS ADELANTE
========================================================= */

async function cargarBloqueadosFuturos() {
  const caja = $("bloqueFuturo");
  const { data, error } = await db
    .from("tickets")
    .select("id, identificador_tk, resumen, depende_de, reaparece_el")
    .eq("subido_por", miUsuario.id)
    .eq("situacion", "bloqueado")
    .gt("reaparece_el", fechaActual)
    .order("reaparece_el");

  if (error || !data || !data.length) {
    caja.classList.add("hidden");
    return;
  }

  caja.classList.remove("hidden");
  $("nBloqueFuturo").textContent = data.length;
  $("listaBloqueFuturo").innerHTML = data.map(t => `
    <li class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div class="min-w-0">
        <span class="font-black text-[#3F2574]">${escapar(t.identificador_tk)}</span>
        <span class="text-sm text-slate-600"> ${escapar(t.resumen || "")}</span>
        <div class="text-xs text-slate-500">Depende de ${escapar(t.depende_de || "—")} · vuelve el ${formatoFecha(t.reaparece_el)}</div>
      </div>
      <button class="btn-desbloquear text-xs px-3 py-1.5 rounded-full border border-[#D82299] text-[#D82299]" data-id="${t.id}">Desbloquear ahora</button>
    </li>`).join("");
}

$("listaBloqueFuturo").addEventListener("click", async (e) => {
  const boton = e.target.closest(".btn-desbloquear");
  if (!boton) return;

  boton.disabled = true;
  const { error } = await db.from("tickets")
    .update({ situacion: "pendiente", depende_de: null, reaparece_el: null })
    .eq("id", boton.dataset.id);

  if (error) {
    setEstado("No se pudo desbloquear: " + error.message, true);
    boton.disabled = false;
    return;
  }
  setEstado("Ticket desbloqueado. Vuelve a entrar en tu agenda cuando la generes.");
  cargarAgenda();
});

/* =========================================================
   TARJETAS: cambiar situación, atajos de fecha y guardar
========================================================= */

$("listaAgenda").addEventListener("change", (e) => {
  if (!e.target.classList.contains("f-situacion")) return;
  const tarjeta = e.target.closest("[data-id]");
  tarjeta.querySelector(".bloque-bloqueo").classList.toggle("hidden", e.target.value !== "bloqueado");
  tarjeta.querySelector(".bloque-solucion").classList.toggle("hidden", e.target.value !== "hecho");
});

$("listaAgenda").addEventListener("click", async (e) => {
  const tarjeta = e.target.closest("[data-id]");
  if (!tarjeta) return;

  // Atajos "mañana / en 3 días / en 1 semana"
  const chip = e.target.closest(".chip-dias");
  if (chip) {
    const base = fechaActual > hoyISO() ? fechaActual : hoyISO();
    tarjeta.querySelector(".f-vuelve").value = sumarDias(base, parseInt(chip.dataset.dias, 10));
    return;
  }

  const boton = e.target.closest(".btn-guardar");
  if (!boton) return;

  const situacion = tarjeta.querySelector(".f-situacion").value;
  const nota = tarjeta.querySelector(".f-nota").value.trim();
  const tiempo = tarjeta.querySelector(".f-tiempo").value;
  const previo = (agendaActual.find(x => String(x.id) === tarjeta.dataset.id) || {}).tickets || {};

  const cambios = { situacion, nota: nota || null };

  if (situacion === "bloqueado") {
    const depende = tarjeta.querySelector(".f-depende").value.trim();
    const vuelve = tarjeta.querySelector(".f-vuelve").value;
    if (!depende) { setEstado("Escribe de quién depende este ticket.", true); return; }
    if (!vuelve) { setEstado("Elige la fecha en que quieres volver a verlo.", true); return; }
    if (vuelve < hoyISO()) { setEstado("La fecha para volver a mostrarlo no puede ser anterior a hoy.", true); return; }
    cambios.depende_de = depende;
    cambios.reaparece_el = vuelve;
    cambios.completado_en = null;
  } else {
    cambios.depende_de = null;
    cambios.reaparece_el = null;
  }

  let avisoSolucion = false;
  if (situacion === "hecho") {
    const solucion = tarjeta.querySelector(".f-solucion").value.trim();
    cambios.solucion = solucion || null;
    cambios.completado_en = previo.situacion === "hecho" && previo.completado_en ? previo.completado_en : new Date().toISOString();
    avisoSolucion = !solucion;
  } else if (situacion === "pendiente") {
    cambios.completado_en = null;
  }

  boton.disabled = true;
  try {
    const t1 = await db.from("tickets").update(cambios).eq("id", tarjeta.dataset.ticket);
    if (t1.error) throw t1.error;

    const t2 = await db.from("agenda_dia")
      .update({ tiempo_estimado: tiempo === "" ? null : parseInt(tiempo, 10) })
      .eq("id", tarjeta.dataset.id);
    if (t2.error) throw t2.error;
  } catch (error) {
    setEstado("No se pudo guardar: " + (error.message || error), true);
    boton.disabled = false;
    return;
  }

  setEstado(avisoSolucion
    ? "Guardado. Tip: sin la solución, tus compañeros no sabrán cómo lo resolviste."
    : "Cambios guardados.");
  cargarAgenda();
});

/* =========================================================
   DESCARGAR LA AGENDA COMO LISTADO (PDF vertical con timbrado)
   Seminario de proyectos I BR: la idea de exportar a PDF con html2pdf.
   Mejora seminario de proyectos II BR: listado con timbrado, columnas de la agenda y pie con página.
========================================================= */

function descargarLista() {
  if (!agendaActual.length) {
    setEstado("No hay agenda para descargar en este día.", true);
    return;
  }

  const fechaTexto = nombreDia(fechaActual);
  const situacion = (f) => (f.tickets || {}).situacion;
  const hechos = agendaActual.filter(f => situacion(f) === "hecho").length;
  const bloqueados = agendaActual.filter(f => situacion(f) === "bloqueado").length;
  const minutos = agendaActual.filter(f => situacion(f) === "pendiente").reduce((s, f) => s + (f.tiempo_estimado || 0), 0);
  const tiempoTexto = minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`;

  const celda = "padding:6px 6px; border-bottom:1px solid #e5e7eb; font-size:10px; vertical-align:top;";
  const cabecera = "padding:7px 6px; background:#3F2574; color:#ffffff; font-size:9.5px; text-align:left;";

  const filasHtml = agendaActual.map(f => {
    const t = f.tickets || {};

    let estadoTrabajo = `<span style="color:#555;">Pendiente</span>`;
    if (t.situacion === "hecho") estadoTrabajo = `<b style="color:#15803d;">Hecho</b>`;
    if (t.situacion === "bloqueado") {
      estadoTrabajo = `<b style="color:#b45309;">Bloqueado</b>
        <div style="color:#555;">Depende de: ${escapar(t.depende_de || "—")}</div>
        <div style="color:#555;">Vuelve: ${formatoFecha(t.reaparece_el)}</div>`;
    }

    const extra = [];
    if (t.solucion && t.situacion === "hecho") extra.push(`<div style="margin-top:3px; color:#15803d;">Solución: ${escapar(t.solucion)}</div>`);
    if (t.nota) extra.push(`<div style="margin-top:3px; color:#777; font-style:italic;">Nota: ${escapar(t.nota)}</div>`);

    return `
      <tr style="page-break-inside:avoid;">
        <td style="${celda} text-align:center; font-weight:bold; color:#D82299;">${f.orden}</td>
        <td style="${celda} font-weight:bold; color:#3F2574;">${escapar(t.identificador_tk)}</td>
        <td style="${celda}">${escapar(t.resumen || "Sin descripción")}${extra.join("")}</td>
        <td style="${celda}">${escapar(t.estado)}</td>
        <td style="${celda}">${formatoFecha(t.fecha_creacion)}</td>
        <td style="${celda}">${escapar(t.prioridad || "—")}</td>
        <td style="${celda}">${estadoTrabajo}</td>
        <td style="${celda} text-align:center;">${f.tiempo_estimado ? f.tiempo_estimado + " min" : "—"}</td>
      </tr>`;
  }).join("");

  const html = `
    <div style="font-family:'Segoe UI', Arial, sans-serif; color:#333; padding:4px;">

      <!-- TIMBRADO -->
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="width:62px; vertical-align:middle;">
            <div style="position:relative; width:50px; height:46px;">
              <span style="position:absolute; left:0; top:-4px; font-family:Georgia, serif; font-weight:900; font-size:42px; color:#D82299; z-index:2;">G</span>
              <span style="position:absolute; left:17px; top:6px; font-family:Georgia, serif; font-weight:900; font-size:42px; color:#3F2574; z-index:1;">T</span>
            </div>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:24px; font-weight:900; letter-spacing:3px; color:#14112B;">GESTIONA!</div>
            <div style="font-size:9px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px;">Gestión de tickets</div>
          </td>
          <td style="vertical-align:middle; text-align:right;">
            <div style="font-size:20px; font-weight:800; color:#3F2574;">Agenda del día</div>
            <div style="font-size:12px; color:#666; margin-top:2px;">${escapar(fechaTexto)}</div>
            <div style="font-size:10px; color:#999; margin-top:2px;">${escapar(miUsuario.nombre)}</div>
          </td>
        </tr>
      </table>
      <div style="height:4px; background:linear-gradient(90deg, #D82299, #3F2574); margin:10px 0 16px;"></div>

      <!-- RESUMEN -->
      <table style="width:100%; border-collapse:separate; border-spacing:0; margin-bottom:14px;">
        <tr>
          <td style="width:25%; padding:8px 12px; background:#f8fafc; border-left:4px solid #3F2574; border-right:6px solid #ffffff;">
            <div style="font-size:17px; font-weight:800; color:#3F2574;">${agendaActual.length}</div>
            <div style="font-size:9.5px; color:#666;">En la agenda</div>
          </td>
          <td style="width:25%; padding:8px 12px; background:#f8fafc; border-left:4px solid #22c55e; border-right:6px solid #ffffff;">
            <div style="font-size:17px; font-weight:800; color:#3F2574;">${hechos}</div>
            <div style="font-size:9.5px; color:#666;">Hechos</div>
          </td>
          <td style="width:25%; padding:8px 12px; background:#f8fafc; border-left:4px solid #F2A93B; border-right:6px solid #ffffff;">
            <div style="font-size:17px; font-weight:800; color:#3F2574;">${bloqueados}</div>
            <div style="font-size:9.5px; color:#666;">Bloqueados</div>
          </td>
          <td style="width:25%; padding:8px 12px; background:#f8fafc; border-left:4px solid #D82299;">
            <div style="font-size:17px; font-weight:800; color:#3F2574;">${tiempoTexto}</div>
            <div style="font-size:9.5px; color:#666;">Tiempo por hacer</div>
          </td>
        </tr>
      </table>

      <!-- LISTADO -->
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${cabecera} width:22px; text-align:center;">#</th>
            <th style="${cabecera} width:58px;">Ticket</th>
            <th style="${cabecera}">Descripción</th>
            <th style="${cabecera} width:54px;">Estado</th>
            <th style="${cabecera} width:56px;">Creado</th>
            <th style="${cabecera} width:44px;">Prior.</th>
            <th style="${cabecera} width:92px;">Situación</th>
            <th style="${cabecera} width:42px; text-align:center;">Tiempo</th>
          </tr>
        </thead>
        <tbody>${filasHtml}</tbody>
      </table>
    </div>`;

  html2pdf().set({
    margin: [10, 10, 18, 10],
    filename: `Agenda_GESTIONA_${fechaActual}.pdf`,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"], avoid: "tr" }
  })
    .from(html, "string")
    .toPdf()
    .get("pdf")
    .then(pdf => {
      // Pie en todas las hojas: nombre, fecha y número de página
      const total = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`GESTIONA! - Agenda del dia - ${formatoFecha(fechaActual)}`, 10, 290);
        pdf.text(`Pagina ${i} de ${total}`, 200, 290, { align: "right" });
      }
    })
    .save();
}

/* =========================================================
   ARRANQUE
========================================================= */

$("btnGenerar").addEventListener("click", generarAgenda);
$("btnDescargar").addEventListener("click", descargarLista);

$("inputFecha").addEventListener("change", (e) => {
  if (!e.target.value) return;
  fechaActual = e.target.value;
  setEstado("");
  cargarAgenda();
});

$("limiteDia").addEventListener("change", () => {
  try { localStorage.setItem("gestiona_limite", String(leerLimite())); } catch (e) { /* sin almacenamiento: no pasa nada */ }
});

$("inputFecha").value = fechaActual;

// Esperar a saber quién es el usuario (si no hay sesión, supabase.js lo manda al login)
sesionLista.then(usuario => {
  if (!usuario) return;
  miUsuario = usuario;
  try {
    const guardado = localStorage.getItem("gestiona_limite");
    if (guardado) $("limiteDia").value = guardado;
  } catch (e) { /* sin almacenamiento: se usa el valor por defecto */ }
  cargarAgenda();
});
