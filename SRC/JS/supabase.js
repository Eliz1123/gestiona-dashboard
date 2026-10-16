/* =========================================================
   CONEXIÓN, SESIÓN Y UTILIDADES COMPARTIDAS - GESTIONA!
   Mejora seminario de proyectos II BR (archivo nuevo)

   Se carga en TODAS las páginas, después de la librería de Supabase.
   - Si la página tiene <body data-publica="true"> (el login), no pide sesión.
   - Las demás páginas esperan:  sesionLista.then(usuario => ...)
========================================================= */

const SUPABASE_URL = 'https://cuykabjeeztscywwqcqh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RuiVxXqBMAIzf4zYhZ7yTg_O7cnmn-7';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


/* =========================================================
   UTILIDADES  (Mejora seminario de proyectos II BR)
========================================================= */

// Evita que un texto con < o & rompa el HTML
function escapar(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Estados de Jira que significan "ya terminó" (Cerrado, Resuelto, Listo, Done...)
const REGEX_CERRADO = /^\s*(listo|hecho|done|finaliz|cerrad|resuelt|complet|cancelad|rechazad|closed|resolved)/i;
function esCerrado(estado) {
  return REGEX_CERRADO.test(String(estado || ""));
}

/* ---------- Fechas (siempre como texto "aaaa-mm-dd") ---------- */

const MESES = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };

function isoValida(a, m, d) {
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Convierte lo que venga del Excel (número de Excel, "13/10/2026", "13/oct/26 3:08 PM",
// "2026-10-13") en "aaaa-mm-dd". Si no entiende la fecha devuelve null.
// Las fechas con barras se leen día/mes/año.
function aISO(valor) {
  if (valor === "" || valor === null || valor === undefined) return null;

  if (valor instanceof Date) {
    return isNaN(valor) ? null : isoValida(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }

  if (typeof valor === "number") {
    if (valor < 20000 || valor > 80000) return null;          // no parece una fecha de Excel
    return new Date(Math.round((Math.floor(valor) - 25569) * 86400000)).toISOString().slice(0, 10);
  }

  const t = String(valor).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoValida(+m[1], +m[2], +m[3]);

  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) { let a = +m[3]; if (a < 100) a += 2000; return isoValida(a, +m[2], +m[1]); }

  m = t.match(/^(\d{1,2})[\/\-\s]([A-Za-zÁÉÍÓÚáéíóú]{3,})\.?[\/\-\s](\d{2,4})/);
  if (m) {
    const mes = MESES[m[2].slice(0, 3).toLowerCase()];
    if (!mes) return null;
    let a = +m[3]; if (a < 100) a += 2000;
    return isoValida(a, mes, +m[1]);
  }
  return null;
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumarDias(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

function diasEntre(desdeISO, hastaISO) {
  const [a1, m1, d1] = desdeISO.split("-").map(Number);
  const [a2, m2, d2] = hastaISO.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

// "2026-10-14" -> "14/10/2026"
function formatoFecha(iso) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";
}

/* ---------- Traer TODAS las filas (Supabase entrega 1000 por vez) ---------- */

// fabricaConsulta debe devolver una consulta NUEVA cada vez, con .order("id")
//   const filas = await traerTodos(() => db.from("tickets").select("...").order("id"));
async function traerTodos(fabricaConsulta, tamano = 1000) {
  const todo = [];
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await fabricaConsulta().range(desde, desde + tamano - 1);
    if (error) throw error;
    todo.push(...data);
    if (data.length < tamano) break;
  }
  return todo;
}


/* =========================================================
   SESIÓN  (Mejora seminario de proyectos II BR)
========================================================= */

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
  location.href = "index.html";
}

// Menú de la barra superior: Inicio · Subir tickets · Dashboard · Agenda · nombre · Salir
function pintarNav(usuario) {
  const nav = document.querySelector(".nav");
  if (!nav || document.getElementById("navDerecha")) return;

  const estilo = document.createElement("style");
  estilo.textContent = `
    #navDerecha a { font-size:13px; font-weight:600; color:#3F2574; padding:4px 2px; border-bottom:2px solid transparent; text-decoration:none; }
    #navDerecha a:hover { color:#D82299; }
    #navDerecha a.activo { color:#D82299; border-bottom-color:#D82299; }
    @media (max-width:760px) {
      .nav { padding:10px 14px !important; flex-wrap:wrap; row-gap:6px; }
      #navDerecha { width:100%; justify-content:space-between; gap:8px !important; }
      #navDerecha a { font-size:12px; }
      #navNombre { display:none; }
    }`;
  document.head.appendChild(estilo);

  const caja = document.createElement("div");
  caja.id = "navDerecha";
  caja.style.cssText = "display:flex; align-items:center; gap:18px; flex-wrap:wrap;";

  const actual = location.pathname.split("/").pop().toLowerCase();
  [["bienvenida.html", "Inicio"], ["archivo.html", "Subir tickets"], ["dashboard.html", "Dashboard"], ["agenda.html", "Agenda"]]
    .forEach(([ruta, texto]) => {
      const a = document.createElement("a");
      a.href = ruta;
      a.textContent = texto;
      if (actual === ruta) a.className = "activo";
      caja.appendChild(a);
    });

  const nombre = document.createElement("span");
  nombre.id = "navNombre";
  nombre.textContent = usuario.nombre;
  nombre.style.cssText = "font-size:13px; font-weight:700; color:#3F2574;";

  const salir = document.createElement("button");
  salir.textContent = "Salir";
  salir.style.cssText = "border:1px solid #D82299; color:#D82299; background:#fff; border-radius:999px; padding:4px 14px; font-size:12px; font-weight:700; cursor:pointer;";
  salir.addEventListener("click", cerrarSesion);

  caja.appendChild(nombre);
  caja.appendChild(salir);
  nav.appendChild(caja);
}

// Candado: sin sesión, manda al login
async function protegerPagina() {
  const usuario = await obtenerUsuario();
  if (!usuario) {
    location.replace("index.html");
    return null;
  }
  pintarNav(usuario);
  return usuario;
}

const ES_PUBLICA = !!(document.body && document.body.dataset.publica === "true");
const sesionLista = ES_PUBLICA ? Promise.resolve(null) : protegerPagina();
