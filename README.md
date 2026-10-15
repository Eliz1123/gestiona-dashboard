# DASHBOARD EMPRESARIAL PARA GESTION DE TICKETS

## 1. Nombre del Proyecto

**Gestión de Tickets**

---

## 2. Descripción del Sistema

Este sistema es una aplicación web diseñada para facilitar la gestión y análisis de tickets de soporte técnico dentro de una empresa.

Permite al usuario cargar un archivo de Excel con información de tickets (como cliente, prioridad, estado, agente asignado, fechas, entre otros), procesar esos datos, generar un dashboard interactivo con visualizaciones claras y de igual manera te permite general una Agenda Diaria 

Además, el sistema ofrece funcionalidades como:

* Filtrado de información por diferentes criterios.
* Generación de reportes en PDF.
* Almacenamiento temporal de archivos para su procesamiento.

Este proyecto está enfocado en mejorar la toma de decisiones y reducir la acumulación de tickets pendientes.

---

## 3. Objetivo

Desarrollar una herramienta interactiva que permita visualizar, analizar y gestionar tickets de soporte de manera eficiente, facilitando el monitoreo del estado de los casos y apoyando la toma de decisiones dentro de la organización.

---

## 4. Tecnologías Utilizadas

* **HTML5** – Estructura de la aplicación.
* **CSS3** – Diseño y estilos visuales.
* **JavaScript (Vanilla)** – Lógica del sistema.
* **Chart.js** – Visualización de datos en gráficos.
* **SheetJS (XLSX)** – Lectura y procesamiento de archivos Excel.
* **jsPDF / html2canvas** – Generación de reportes en PDF.
* **Supabase** (Auth + PostgreSQL + RLS.

---

## 5. Instalación y Ejecución

### Requisitos:

*Cuenta gratuita en Supabase (supabase.com)
*La carpeta del proyecto ( zip)
*Node.js (para abrir el sistema en tu computadora)
*Navegador (Chrome recomendado)
*Un Excel de tickets


### Pasos:

1. Clonar el repositorio:

```bash
git clone https://github.com/Eliz1123/gestiona-dashboard/
```

2. Crea el proyecto en Supabase.
Entra a supabase.com, inicia sesión y pulsa "New project". Ponle un nombre (por ejemplo, gestiona), una contraseña de base de datos y la región más cercana. Espera a que termine de crearse.

3. Crea las tablas.
En el menú izquierdo abre SQL Editor y pulsa New query. Abre el archivo database copia TODO su contenido, pégalo y pulsa Run. Debe terminar sin errores. Se puede ejecutar más de una vez sin dañar nada.

4. Copia tu URL y tu clave.
En Supabase abre Project Settings > API. Copia la Project URL y la clave publishable (empieza con sb_publishable_).
IMPORTANTE: nunca uses ni copies la clave service_role. Esa es secreta y no va en el sistema.

5. Pégalas en el sistema.
Abre el archivo src/JS/supabase.js y reemplaza los dos valores de las primeras líneas:
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_KEY = 'sb_publishable_...';

6. Abre el sistema.
En una terminal, dentro de la carpeta del proyecto, ejecuta una de estas dos opciones:
npx serve src
python3 -m http.server -d src
Luego abre en el navegador la dirección que te muestre (por ejemplo, http://localhost:3000 o http://localhost:8000).

Paso 7. Confirma el correo (si Supabase lo pide).
Si en Authentication > Providers > Email tienes activada la confirmación, revisa tu bandeja y confirma antes de ingresar. Para probar más rápido puedes desactivarla.


> Nota: No requiere instalación de dependencias ya que es una aplicación web estática.

---

## 6. Capturas de Pantalla del Proyecto
LOGIN
<img width="801" height="815" alt="image" src="https://github.com/user-attachments/assets/4e612c14-613b-416f-9e59-ac0d069af7af" />

Menu principal
<img width="1350" height="619" alt="image" src="https://github.com/user-attachments/assets/7900365b-0df2-4808-8e44-fcb26845ece1" />

Subir archivos 
<img width="1350" height="675" alt="image" src="https://github.com/user-attachments/assets/6cde8007-7f49-48c7-ace8-b2f7016e1a4b" />
<img width="1350" height="794" alt="image" src="https://github.com/user-attachments/assets/05d0ef81-288e-4626-ad63-9f253ed28dd6" />
<img width="1350" height="592" alt="image" src="https://github.com/user-attachments/assets/d925073d-6c8f-4319-acd3-85675f4719a4" />

DASHBOARD
<img width="1350" height="613" alt="image" src="https://github.com/user-attachments/assets/1d464ac1-cd90-42ac-9723-a0da4e3aefb1" />
<img width="1350" height="625" alt="image" src="https://github.com/user-attachments/assets/8eba92cb-5ee9-49d6-aa90-a072a1b248e5" />
<img width="1350" height="695" alt="image" src="https://github.com/user-attachments/assets/c625f3bb-573a-471e-89e3-9f6950661a94" />

AGENDA
<img width="1350" height="679" alt="image" src="https://github.com/user-attachments/assets/d680c422-ef7e-429d-af4d-988f64b810b1" />
<img width="1350" height="542" alt="image" src="https://github.com/user-attachments/assets/b09d585c-9941-4708-b41c-b9662b93e998" />
<img width="1350" height="580" alt="image" src="https://github.com/user-attachments/assets/9cb59776-f0e6-40c4-91e0-d92f369fb630" />
<img width="1350" height="747" alt="image" src="https://github.com/user-attachments/assets/a8cba6a2-8ff1-49e9-a56d-1c5a0a8f5131" />















---


## 7. Evidencia Funcional del Proyecto

Se adjunta evidencia del funcionamiento del sistema mediante: VIDEO
https://youtu.be/4J7qwie7VvY 



---

## Autora

Brenda Elizabeth Robles Concepción
Estudiante de Ingeniería en Software
UAPA

---
