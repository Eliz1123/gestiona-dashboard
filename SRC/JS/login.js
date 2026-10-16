/* =========================================================
   LOGIN Y REGISTRO - GESTIONA!
   Mejora seminario de proyectos II BR (archivo nuevo)
   Usa "db" de JS/supabase.js
========================================================= */

let modo = "entrar"; // "entrar" o "registro"

const el = (id) => document.getElementById(id);
const formulario = el("formAcceso");

// Si ya hay una sesión abierta, pasar directo a la bienvenida
obtenerUsuario().then(u => {
  if (u) location.replace("bienvenida.html");
});

/* ---------- Cambiar entre "entrar" y "crear cuenta" ---------- */

function cambiarModo(nuevo) {
  modo = nuevo;
  const registro = nuevo === "registro";

  el("campoNombre").classList.toggle("hidden", !registro);
  el("campoClave2").classList.toggle("hidden", !registro);

  el("titulo").textContent = registro ? "Crea tu cuenta" : "Ingresa tus credenciales";
  el("subtitulo").textContent = registro
    ? "Regístrate para tener tus propios tickets y tu agenda."
    : "Entra para ver tus tickets y tu agenda del día.";
  el("btnEnviar").textContent = registro ? "Crear cuenta" : "Entrar";
  el("textoAlternar").textContent = registro ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?";
  el("alternar").textContent = registro ? "Inicia sesión" : "Crea una cuenta";
  el("clave").autocomplete = registro ? "new-password" : "current-password";

  mostrarMensaje("");
}

function mostrarMensaje(texto, tipo = "error") {
  const p = el("mensaje");
  p.textContent = texto;
  p.className = "text-sm min-h-[20px] " + (tipo === "ok" ? "text-green-600" : "text-red-500");
}

function traducirError(mensaje) {
  const m = String(mensaje || "");
  if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/already registered|already been registered/i.test(m)) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (/email not confirmed/i.test(m)) return "Tienes que confirmar tu correo antes de entrar. Revisa tu bandeja.";
  if (/password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  if (/invalid.*email|unable to validate email/i.test(m)) return "Ese correo no parece válido.";
  if (/failed to fetch|network/i.test(m)) return "No hay conexión con el servidor. Revisa tu internet.";
  return "No se pudo completar: " + m;
}

/* ---------- Enviar el formulario ---------- */

formulario.addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarMensaje("");

  const correo = el("correo").value.trim();
  const clave = el("clave").value;

  if (!correo || !/^\S+@\S+\.\S+$/.test(correo)) {
    mostrarMensaje("Escribe un correo válido.");
    return;
  }
  if (clave.length < 6) {
    mostrarMensaje("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  const boton = el("btnEnviar");
  boton.disabled = true;

  try {
    if (modo === "entrar") {
      const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });
      if (error) throw error;
      location.href = "bienvenida.html";
      return;
    }

    // ----- Registro -----
    const nombre = el("nombre").value.trim();
    if (!nombre) {
      mostrarMensaje("Escribe tu nombre.");
      return;
    }
    if (clave !== el("clave2").value) {
      mostrarMensaje("Las contraseñas no coinciden.");
      return;
    }

    const { data, error } = await db.auth.signUp({
      email: correo,
      password: clave,
      options: { data: { nombre } }
    });
    if (error) throw error;

    // Si el correo ya existía y Supabase exige confirmación, no avisa con error
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      mostrarMensaje("Ya existe una cuenta con ese correo. Inicia sesión.");
      return;
    }

    if (data.session) {
      location.href = "bienvenida.html";   // entró directo (confirmación de correo apagada)
      return;
    }

    cambiarModo("entrar");
    el("correo").value = correo;
    mostrarMensaje("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.", "ok");

  } catch (err) {
    mostrarMensaje(traducirError(err.message));
  } finally {
    boton.disabled = false;
  }
});

/* ---------- Eventos ---------- */

el("alternar").addEventListener("click", (e) => {
  e.preventDefault();
  cambiarModo(modo === "entrar" ? "registro" : "entrar");
});

el("verClave").addEventListener("change", (e) => {
  const tipo = e.target.checked ? "text" : "password";
  el("clave").type = tipo;
  el("clave2").type = tipo;
});

cambiarModo("entrar");
