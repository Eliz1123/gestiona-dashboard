/* =========================================================
   BIENVENIDA - GESTIONA!
   Mejora seminario de proyectos II BR (archivo nuevo)
========================================================= */

sesionLista.then(async (usuario) => {
  if (!usuario) return;

  document.getElementById("saludo").textContent = `Hola, ${usuario.nombre}`;

  const hoy = hoyISO();

  // Cuántos tickets tiene guardados, cuántos pendientes, última carga y agenda de hoy
  const [total, pendientes, ultima, enAgendaHoy] = await Promise.all([
    db.from("tickets").select("id", { count: "exact", head: true }),
    // pendientes de verdad: sin hacer, sin bloquear y que en Jira no estén cerrados
    db.from("tickets").select("id", { count: "exact", head: true }).eq("situacion", "pendiente").eq("cerrado_jira", false),
    db.from("cargas").select("creado_en, nombre_archivo").order("creado_en", { ascending: false }).limit(1),
    db.from("agenda_dia").select("id", { count: "exact", head: true }).eq("fecha", hoy)
  ]);

  const resumen = document.getElementById("resumen");
  const nTotal = total.count || 0;

  if (total.error) {
    resumen.textContent = "No se pudo leer tu información. Revisa que la base de datos esté creada.";
    return;
  }

  if (nTotal === 0) {
    resumen.textContent = "Todavía no tienes tickets guardados. Empieza subiendo tu Excel de Jira.";
    document.getElementById("opSubir").classList.add("ring-2", "ring-[#D82299]");
    return;
  }

  const partes = [`${nTotal} tickets guardados`, `${pendientes.count || 0} pendientes`];
  const carga = ultima.data && ultima.data[0];
  if (carga) partes.push(`última carga: ${formatoFecha(hoyISO_de(carga.creado_en))}`);
  resumen.textContent = partes.join("  ·  ");

  const nHoy = enAgendaHoy.count || 0;
  document.getElementById("textoAgenda").textContent =
    nHoy > 0 ? `Hoy tienes ${nHoy} en tu agenda` : "Armar la agenda de hoy";
});

// Fecha local (aaaa-mm-dd) de un instante guardado en la base
function hoyISO_de(instante) {
  const d = new Date(instante);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
