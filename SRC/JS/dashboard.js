// CONFIGURACIÓN DE CREDENCIALES (Reemplaza con tus datos reales de EmailJS)
const EMAILJS_PUBLIC_KEY = "PWKDfyvJz2ErUAnoT"; 
const EMAILJS_SERVICE_ID = "gestionatickets@gmail.co"; 
const EMAILJS_TEMPLATE_ID = "template_13hv75e"; 

if (window.emailjs) {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

/* =========================================================
   ESTADO GLOBAL DE LA APLICACIÓN
========================================================= */
let datosOriginales = [];
let datosFiltrados = [];
let columnas = [];
let graficasActivas = [];

const ICONOS_KPI = ["", "", "", "", ""];

// Paleta de estado: asigna un color de marca consistente según palabras clave
const PALETA_ESTADO = [
  { patron: /abiert|pendiente|nuevo/i,  color: "#D82299" }, // rosa
  { patron: /proceso|progreso|curso/i,  color: "#F2A93B" }, // ámbar
  { patron: /espera|revisi[oó]n/i,      color: "#4C7CFF" }, // azul
  { patron: /cerrad|resuelt|complet/i,  color: "#22B573" }, // verde
  { patron: /cancelad|rechazad/i,       color: "#6B6E85" }, // gris
];
const PALETA_RESPALDO = ["#D82299", "#3F2574", "#0EA5A6", "#F2A93B", "#4C7CFF", "#22B573"];

function colorParaEtiqueta(etiqueta, indiceRespaldo) {
  const encontrado = PALETA_ESTADO.find(p => p.patron.test(etiqueta));
  return encontrado ? encontrado.color : PALETA_RESPALDO[indiceRespaldo % PALETA_RESPALDO.length];
}

/* =========================================================
   CARGA INICIAL DE DATOS (window.onload)
========================================================= */
window.onload = function () {
  const archivoGuardado = sessionStorage.getItem("archivoExcel");

  if (!archivoGuardado) {
    mostrarVacio();
    return;
  }

  try {
    const bytes = new Uint8Array(JSON.parse(archivoGuardado));
    const workbook = XLSX.read(bytes, { type: "array" });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datos = XLSX.utils.sheet_to_json(hoja, { defval: "" });

    if (!datos.length) {
      mostrarVacio();
      return;
    }

    datosOriginales = datos;
    datosFiltrados = datos;
    columnas = Object.keys(datos[0]);

    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;

    crearFiltros();
    actualizarTodo();

  } catch (error) {
    console.error("Error al leer sesión del buffer Excel:", error);
    mostrarVacio();
  }
};

function mostrarVacio() {
  document.getElementById("vacio").style.display = "block";
  document.getElementById("dashboardExportable").style.display = "none";
}

/* =========================================================
   MÉTODOS DE PROCESAMIENTO Y AGREGACIÓN
========================================================= */
function contarValores(col) {
  const conteo = {};
  datosFiltrados.forEach(d => {
    const val = d[col] === "" || d[col] === null || d[col] === undefined ? "Sin dato" : String(d[col]);
    conteo[val] = (conteo[val] || 0) + 1;
  });
  return conteo;
}

function esColumnaCategorica(col) {
  const valores = datosFiltrados.map(d => d[col]).filter(v => v !== "" && v !== null && v !== undefined);
  const unicos = new Set(valores.map(String));
  return unicos.size > 1 && unicos.size <= 12 && unicos.size < datosFiltrados.length;
}

function obtenerColumnasCategoricas() {
  const prioritarias = columnas.filter(c => /estado|status|prioridad|priority|tipo|categoria|categoría|área|area|departamento|empresa|cliente/i.test(c));
  const otras = columnas.filter(c => !prioritarias.includes(c));

  return [...prioritarias, ...otras].filter(esColumnaCategorica).slice(0, 4);
}

/* =========================================================
   LÓGICA DE INTERFAZ Y RENDERIZADO
========================================================= */
function actualizarTodo() {
  renderContador();
  renderKPIs();
  renderGraficas();
  renderTabla();
}

function renderContador() {
  document.getElementById("contadorResultados").textContent =
    `${datosFiltrados.length} de ${datosOriginales.length} tickets`;
}

function renderKPIs() {
  const contenedor = document.getElementById("kpis");
  contenedor.innerHTML = "";

  const total = datosFiltrados.length;

  contenedor.appendChild(
    crearTarjeta("Total de tickets", total, total ? 100 : 0, "#3F2574", ICONOS_KPI[0], `${datosOriginales.length} en la base`)
  );

  const colEstado = columnas.find(c => /estado|status/i.test(c));

  if (colEstado) {
    const conteo = contarValores(colEstado);
    const topValores = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 3);
    topValores.forEach(([valor, cantidad], i) => {
      const pct = total ? Math.round((cantidad / total) * 100) : 0;
      const color = colorParaEtiqueta(valor, i);
      contenedor.appendChild(
        crearTarjeta(valor, cantidad, pct, color, ICONOS_KPI[i + 1], `${pct}% del total`)
      );
    });
  }
}

function crearTarjeta(titulo, numero, porcentaje, color, icono, subtexto) {
  const div = document.createElement("div");
  div.className = "tarjeta";
  div.innerHTML = `
    <div class="tarjeta-stub" style="--color:${color}"></div>
    <div class="anillo" style="--pct:${porcentaje}; --color:${color}">
      <span>${icono}</span>
    </div>
    <div class="tarjeta-info">
      <h3>${titulo}</h3>
      <div class="numero">${numero.toLocaleString("es-DO")}</div>
      <div class="sub">${subtexto}</div>
    </div>
    <div class="talon-linea"></div>
  `;
  return div;
}

function renderGraficas() {
  const contenedor = document.getElementById("graficas");
  contenedor.innerHTML = "";

  graficasActivas.forEach(g => g.destroy());
  graficasActivas = [];

  const columnasGrafica = obtenerColumnasCategoricas();

  if (!columnasGrafica.length) {
    contenedor.innerHTML = `<p class="vacio">No se encontraron columnas con categorías suficientes para graficar.</p>`;
    return;
  }

  columnasGrafica.forEach((col, i) => {
    const box = document.createElement("div");
    box.className = "grafica-box";

    const canvasId = "grafica_" + i;
    box.innerHTML = `<h4>${col}</h4><div class="lienzo-wrap"><canvas id="${canvasId}"></canvas></div>`;
    contenedor.appendChild(box);

    const conteo = contarValores(col);
    const tipo = i === 0 ? "bar" : (i === 1 ? "doughnut" : "pie");
    const etiquetas = Object.keys(conteo);
    const colores = etiquetas.map((etiqueta, idx) => colorParaEtiqueta(etiqueta, idx));

    const chart = new Chart(document.getElementById(canvasId), {
      type: tipo,
      data: {
        labels: etiquetas,
        datasets: [{
          label: col,
          data: Object.values(conteo),
          backgroundColor: colores,
          borderRadius: tipo === "bar" ? 8 : 0,
          borderWidth: tipo === "bar" ? 0 : 3,
          borderColor: "#fff",
          hoverOffset: tipo === "bar" ? 0 : 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: tipo !== "bar",
            position: "bottom",
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "circle", font: { size: 11, family: "Inter" }, padding: 14 }
          },
          tooltip: {
            backgroundColor: "#14112B",
            padding: 10,
            titleFont: { family: "Manrope", weight: "700" },
            bodyFont: { family: "Inter" },
            cornerRadius: 8
          }
        },
        scales: tipo === "bar" ? {
          y: { beginAtZero: true, ticks: { precision: 0, font: { family: "Inter" } }, grid: { color: "#EEEDF7" } },
          x: { grid: { display: false }, ticks: { font: { family: "Inter", size: 11 } } }
        } : {},
        cutout: tipo === "doughnut" ? "62%" : undefined
      }
    });

    graficasActivas.push(chart);
  });
}

function renderTabla() {
  const thead = document.querySelector("#tabla thead");
  const tbody = document.querySelector("#tabla tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!datosFiltrados.length) {
    tbody.innerHTML = `<tr><td class="p-4 text-center text-gray-400" colspan="100%">Sin resultados para este filtro</td></tr>`;
    return;
  }

  let headerRow = "<tr>";
  columnas.forEach(col => headerRow += `<th>${col}</th>`);
  headerRow += "</tr>";
  thead.innerHTML = headerRow;

  let bodyContent = "";
  datosFiltrados.forEach(fila => {
    bodyContent += "<tr>";
    columnas.forEach(col => {
      bodyContent += `<td>${fila[col]}</td>`;
    });
    bodyContent += "</tr>";
  });
  tbody.innerHTML = bodyContent;
}

/* =========================================================
   LOGÍSTICA DE FILTROS
========================================================= */
function crearFiltros() {
  const contenedor = document.getElementById("filtros");
  contenedor.innerHTML = "";

  columnas.forEach(col => {
    const select = document.createElement("select");
    select.dataset.columna = col;
    select.innerHTML = `<option value="">${col}</option>`;

    const valoresUnicos = [...new Set(datosOriginales.map(d => String(d[col])))].sort();

    valoresUnicos.forEach(val => {
      if (val === "") return;
      select.innerHTML += `<option value="${val}">${val}</option>`;
    });

    select.addEventListener("change", aplicarFiltros);
    contenedor.appendChild(select);
  });
}

function aplicarFiltros() {
  const selects = document.querySelectorAll("#filtros select");

  datosFiltrados = datosOriginales.filter(fila => {
    return Array.from(selects).every(select => {
      if (!select.value) return true;
      return String(fila[select.dataset.columna]) === select.value;
    });
  });

  actualizarTodo();
}

function limpiarFiltros() {
  document.querySelectorAll("#filtros select").forEach(s => s.value = "");
  datosFiltrados = datosOriginales;
  actualizarTodo();
}

/* =========================================================
   ACCIONES ACCESIBLES GLOBALMENTE (onclick)
========================================================= */
function descargarPDF() {
  const elemento = document.getElementById("dashboardExportable");
  if (!elemento) return;

  const opciones = {
    margin:       [8, 8, 8, 8],
    filename:     `Dashboard_GESTIONA_Completo_${new Date().toISOString().slice(0,10)}.pdf`,
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 1.5, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
  };

  html2pdf().set(opciones).from(elemento).save();
}

function abrirModal() {
  document.getElementById("modalCorreo").style.display = "flex";
}

function cerrarModal() {
  document.getElementById("modalCorreo").style.display = "none";
}

function generarOtro() {
  sessionStorage.removeItem("archivoExcel");
  window.location.href = "archivo.html";
}

function confirmarEnvio() {
  const input = document.getElementById("inputGmail");
  const destinatario = input.value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) {
    alert("Por favor ingresa un correo válido (ejemplo@dominio.com)");
    return;
  }

  const boton = document.getElementById("btnConfirmarEnvio");
  boton.textContent = "Procesando métricas...";
  boton.style.opacity = "0.6";
  boton.style.pointerEvents = "none";

  const total = datosFiltrados.length;
  const fechaHoy = new Date().toLocaleDateString("es-DO");

  // A. DESGLOSE DE ESTADOS DINÁMICOS
  const colEstado = columnas.find(c => /estado|status/i.test(c)) || columnas[0];
  const conteoEstados = contarValores(colEstado);
  let textoEstados = "";
  Object.entries(conteoEstados).forEach(([estado, cant]) => {
    textoEstados += `${cant} están ${estado.toLowerCase()}, `;
  });
  if (textoEstados) textoEstados = textoEstados.slice(0, -2); 

  // B. DESGLOSE PORCENTUAL DE EMPRESAS
  const colEmpresa = columnas.find(c => /empresa|cliente|área|area|institución/i.test(c)) || columnas[1] || colEstado;
  const conteoEmpresas = contarValores(colEmpresa);
  let textoEmpresas = "";
  Object.entries(conteoEmpresas).forEach(([empresa, cant]) => {
    let porcentaje = ((cant / total) * 100).toFixed(1);
    textoEmpresas += `el ${porcentaje}% son de "${empresa}", `;
  });
  if (textoEmpresas) textoEmpresas = textoEmpresas.slice(0, -2);

  // C. RANGO DE FECHAS DINÁMICO
  const colFecha = columnas.find(c => /fecha|date|creación/i.test(c));
  let rangoFecha = "un rango general histórico";
  if (colFecha && total > 0) {
    const fechasOrdenadas = datosFiltrados.map(d => String(d[colFecha])).filter(f => f !== "").sort();
    if (fechasOrdenadas.length > 0) {
      rangoFecha = `un rango de fecha desde ${fechasOrdenadas[0]} hasta ${fechasOrdenadas[fechasOrdenadas.length - 1]}`;
    }
  }

  // Estructuración exacta del mensaje solicitado para la conclusión
  const textoConclusionSintetizado = `Hay ${total} tk en total, donde ${textoEstados}; donde ${textoEmpresas}, en ${rangoFecha}.`;

  // Matriz de distribución en formato Tabla HTML para el correo
  let tablaHtml = `
    <table style="width:100%; border-collapse:collapse; font-family:sans-serif; margin-top:10px; font-size:13px;">
      <thead>
        <tr style="background-color:#3F2574; color:#ffffff; text-align:left;">
          <th style="padding:8px; border:1px solid #ddd;">Métrica / Variable (${colEstado})</th>
          <th style="padding:8px; border:1px solid #ddd; text-align:center; width:90px;">Cantidad</th>
        </tr>
      </thead>
      <tbody>
  `;
  Object.entries(conteoEstados).forEach(([key, value]) => {
    tablaHtml += `
      <tr>
        <td style="padding:7px; border:1px solid #ddd; color:#333;">${key}</td>
        <td style="padding:7px; border:1px solid #ddd; text-align:center; font-weight:bold; color:#D82299;">${value}</td>
      </tr>
    `;
  });
  tablaHtml += `</tbody></table>`;

  // D. CONSTRUCCIÓN COMPLETA DEL DISEÑO VISUAL INSTITUCIONAL SOLICITADO
  const htmlCompletoCorreo = `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
      <div style="background: linear-gradient(135deg, #3F2574 0%, #25134a 100%); padding: 20px 25px; color: white;">
        <span style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #f472b6; font-weight: bold; display: block; margin-bottom: 4px;">Reporte</span>
        <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Estatus Ejecutivo!</h2>
      </div>
      <div style="padding: 25px; background-color: #ffffff; line-height: 1.6; color: #334155;">
        <p style="margin-top: 0; font-size: 15px; font-weight: 600; color: #1e293b;">Estimado(a)</p>
        <p style="font-size: 14px; color: #64748b;">
          Por este medio se formaliza la entrega del reporte de rendimiento del sistema correspondiente al corte del <strong>${fechaHoy}</strong>. Este desglose métrico refleja fielmente el estado actual del backlog analizado desde los repositorios de datos del lado del cliente:
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #D82299; padding: 12px 16px; margin: 20px 0; border-radius: 0 6px 6px 0;">
          <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; display: block;">Volumen de Casos en Control Activo</span>
          <span style="font-size: 24px; font-weight: bold; color: #3F2574;">${total} Elementos</span>
        </div>
        <h4 style="color: #3F2574; font-size: 14px; margin: 20px 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;"> Matriz de Distribución Operativa</h4>
        <div style="margin-bottom: 25px;">
          ${tablaHtml}
        </div>
        <h4 style="color: #3F2574; font-size: 14px; margin: 20px 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;"> Diagnóstico y Conclusión Técnica</h4>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 15px; border-radius: 6px; font-size: 13.5px; color: #b45309; font-style: italic; font-weight: 500; line-height: 1.5;">
          "${textoConclusionSintetizado}"
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 35px; border-top: 1px solid #f1f5f9; padding-top: 15px; line-height: 1.4;">
          <strong>Alineación Metodológica:</strong> Este sistema implementa criterios de monitoreo de riesgos y control de calidad basados en estándares internacionales de Ingeniería de Software (PMBOK/Scrum).
        </p>
      </div>
      <div style="background-color: #f8fafc; padding: 15px 25px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        Plataforma de Monitoreo Automatizado GESTIONA! <br>
        Santiago de los Caballeros, República Dominicana.
      </div>
    </div>
  `;

  // ENVIAMOS EL BLOQUE HTML COMPLETO EN UN SOLO PARÁMETRO
  const templateParams = {
    to_email: destinatario,
    html_body: htmlCompletoCorreo
  };

  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams)
    .then(() => {
      alert(`¡Informe gerencial enviado exitosamente al Project Manager (${destinatario})! `);
      cerrarModal();
      input.value = "";
    })
    .catch((err) => {
      console.error("Error detectado en EmailJS:", err);
      alert("Error en el despacho del servicio. Revisa las llaves de configuración de EmailJS.");
    })
    .finally(() => {
      boton.textContent = "Enviar reporte gerencial";
      boton.style.opacity = "1";
      boton.style.pointerEvents = "auto";
    });
}