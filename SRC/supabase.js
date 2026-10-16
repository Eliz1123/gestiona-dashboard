/* =========================================================
   CONEXIÓN, SESIÓN Y GUARDADO - GESTIONA!
   Se carga en todas las páginas, después de la librería de Supabase.
========================================================= */

const SUPABASE_URL = 'https://cuykabjeeztscywwqcqh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RuiVxXqBMAIzf4zYhZ7yTg_O7cnmn-7';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------- Sesión ---------- */

async function obtenerUsuario() {
  const { data } = await db.auth.getSession();
  const sesion = data && data.session;
  if (!sesion) return null;

  const u = sesion.user;
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email,
    nombre: meta.nombre || (u.email || "").split("@")[0]
  };
}

async function cerrarSesion() {
  await db.auth.signOut();
  location.href = "login.html";
}

// Muestra "Nombre · Salir" en la barra superior
function pintarUsuarioEnNav(usuario) {
  const nav = document.querySelector(".nav");
  if (!nav || document.getElementById("chipUsuario")) return;

  const chip = document.createElement("div");
  chip.id = "chipUsuario";
  chip.style.cssText = "display:flex; align-items:center; gap:10px; font-size:13px; color:#3F2574; font-weight:600;";

  const nombre = document.createElement("span");
  nombre.textContent = usuario.nombre;

  const salir = document.createElement("button");
  salir.textContent = "Salir";
  salir.style.cssText = "border:1px solid #D82299; color:#D82299; background:#fff; border-radius:999px; padding:4px 14px; font-size:12px; font-weight:700; cursor:pointer;";
  salir.addEventListener("click", cerrarSesion);

  chip.appendChild(nombre);
  chip.appendChild(salir);
  nav.appendChild(chip);
}

// Candado: si no hay sesión, manda al login
async function protegerPagina() {
  const usuario = await obtenerUsuario();
  if (!usuario) {
    location.replace("login.html");
    return null;
  }
  pintarUsuarioEnNav(usuario);
  return usuario;
}

const ES_LOGIN = location.pathname.toLowerCase().endsWith("login.html");

// Las demás páginas pueden esperar esto: sesionLista.then(usuario => ...)
const sesionLista = ES_LOGIN ? Promise.resolve(null) : protegerPagina();

/* ---------- Guardar los tickets del Excel ---------- */

async function guardarTickets(filas, columnas) {
  const colId = columnas.find(c => /clave|key|ticket|identificador|^id$/i.test(c));
  const colEstado = columnas.find(c => /estado|status/i.test(c));
  const colResumen = columnas.find(c => /resumen|summary|t[ií]tulo|asunto|descripci/i.test(c));

  if (!colId) {
    return { error: 'No encontré una columna con el identificador del ticket' };
  }

  // Un Map evita repetidos dentro del mismo Excel
  const unicos = new Map();
  filas.forEach(fila => {
    const id = String(fila[colId] ?? '').trim();
    if (!id) return;
    unicos.set(id, {
      identificador_tk: id,
      estado: colEstado ? String(fila[colEstado] || 'Sin dato') : 'Sin dato',
      resumen: colResumen ? String(fila[colResumen] || '').trim() || null : null,
      datos: fila
    });
  });

  const registros = [...unicos.values()];

  // Se envía en lotes de 500
  for (let i = 0; i < registros.length; i += 500) {
    const lote = registros.slice(i, i + 500);
    const { error } = await db
      .from('tickets')
      .upsert(lote, { onConflict: 'identificador_tk' });
    if (error) return { error: error.message };
  }

  return { guardados: registros.length };
}
