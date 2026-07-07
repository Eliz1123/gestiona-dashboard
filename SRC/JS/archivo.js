const inputArchivo = document.getElementById("inputArchivo");
const boton = document.getElementById("btnAnalizar");
const nombreArchivo = document.getElementById("nombreArchivo");

const zonaDrop = document.getElementById("zonaDrop");
const iconoExcel = document.getElementById("iconoExcel");
const textoPrincipal = document.getElementById("textoPrincipal");
const textoSecundario = document.getElementById("textoSecundario");

let archivoTemporal = null;

// PREVENIR comportamiento por defecto
["dragenter", "dragover", "dragleave", "drop"].forEach(evento => {
  zonaDrop.addEventListener(evento, e => e.preventDefault());
});

// CUANDO ARRASTRA ENCIMA
zonaDrop.addEventListener("dragover", () => {
  zonaDrop.style.borderColor = "#22c55e";
});

// CUANDO SALE
zonaDrop.addEventListener("dragleave", () => {
  zonaDrop.style.borderColor = "#D82299";
});

// CUANDO SUELTA EL ARCHIVO
zonaDrop.addEventListener("drop", (e) => {
  const archivo = e.dataTransfer.files[0];
  procesarArchivo(archivo);
});

// CUANDO SELECCIONA CON CLICK
inputArchivo.addEventListener("change", (e) => {
  const archivo = e.target.files[0];
  procesarArchivo(archivo);
});

// FUNCIÓN PRINCIPAL
function procesarArchivo(archivo) {

  if (!archivo) return;

  const tiposPermitidos = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel"
  ];

  if (!tiposPermitidos.includes(archivo.type)) {
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
}

// BOTÓN ANALIZAR
boton.addEventListener("click", function () {

  if (!archivoTemporal) {
    alert("Primero debes subir un archivo");
    return;
  }

  const lector = new FileReader();

  lector.onload = function (e) {
    const contenido = e.target.result;

    sessionStorage.setItem(
      "archivoExcel",
      JSON.stringify(Array.from(new Uint8Array(contenido)))
    );

    // REDIRECCIÓN
    window.location.href = "dashboard.html";
  };

  lector.readAsArrayBuffer(archivoTemporal);
});