let allReportes = [];
let userMap = {};

// Configuración inicial
document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Cerrar dropdown de sucursal al hacer clic fuera
    window.addEventListener('click', (e) => {
        const container = document.getElementById('dropdown-sucursal-container');
        const menu = document.getElementById('dropdown-sucursal-menu');
        if (container && menu && !container.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
});

async function initApp() {
    await fetchUserMap();
    fetchReportes();
    fetchSucursales();
}

// Obtener mapeo de usuarios para consistencia (opcional si ya viene el nombre)
async function fetchUserMap() {
    try {
        const snapshot = await db.ref("usuarios").once("value");
        const data = snapshot.val() || {};
        userMap = {};
        Object.values(data).forEach(u => {
            if (u.email && u.nombre) {
                userMap[u.email.toLowerCase()] = u.nombre;
            }
        });
    } catch (error) {
        console.error("Error fetching user map:", error);
    }
}

function fetchSucursales() {
    db.ref("ubicaciones").once("value").then(snapshot => {
        const data = snapshot.val() || {};
        const sucursales = Object.keys(data).sort();
        renderSucursalDropdown(sucursales);
    });
}

function renderSucursalDropdown(sucursales) {
    const container = document.getElementById("sucursal-options");
    if (!container) return;

    container.innerHTML = "";

    // Opción "Todas"
    const btnTodas = document.createElement("button");
    btnTodas.type = "button";
    btnTodas.className = "w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between text-primary font-semibold bg-blue-50/50 dark:bg-blue-900/20";
    btnTodas.innerHTML = `<span>Todas las Sucursales</span><span class="material-icons-outlined text-sm">check</span>`;
    btnTodas.onclick = () => seleccionarSucursalFiltro("");
    container.appendChild(btnTodas);

    sucursales.forEach(loc => {
        const item = document.createElement("button");
        const displayName = loc.charAt(0).toUpperCase() + loc.slice(1).toLowerCase();
        item.type = "button";
        item.className = "w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between text-slate-600 dark:text-slate-300";
        item.innerHTML = `<span>${displayName}</span>`;
        item.onclick = () => seleccionarSucursalFiltro(loc);
        container.appendChild(item);
    });
}

function toggleDropdownSucursal() {
    const menu = document.getElementById('dropdown-sucursal-menu');
    if (menu) menu.classList.toggle('hidden');
}

function seleccionarSucursalFiltro(loc) {
    const hiddenInput = document.getElementById("filtro-sucursal");
    const labelText = document.getElementById("selected-sucursal-text");
    const menu = document.getElementById("dropdown-sucursal-menu");

    if (hiddenInput) hiddenInput.value = loc;
    const displayName = loc ? loc.charAt(0).toUpperCase() + loc.slice(1).toLowerCase() : "Todas las Sucursales";
    if (labelText) labelText.textContent = displayName;
    if (menu) menu.classList.add("hidden");

    // Actualizar checks en el dropdown
    const buttons = document.querySelectorAll("#sucursal-options button");
    buttons.forEach(btn => {
        const spanText = btn.querySelector("span").textContent;
        const isSelected = (loc === "" && spanText === "Todas las Sucursales") || (spanText.toLowerCase() === loc.toLowerCase());

        btn.className = `w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${isSelected ? 'text-primary font-semibold bg-blue-50/50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300'}`;

        const existingCheck = btn.querySelector(".material-icons-outlined");
        if (isSelected && !existingCheck) {
            btn.innerHTML += '<span class="material-icons-outlined text-sm">check</span>';
        } else if (!isSelected && existingCheck) {
            existingCheck.remove();
        }
    });

    applyFilters();
}

function fetchReportes() {
    const reportesRef = db.ref('reportes_actividades');

    reportesRef.on('value', (snapshot) => {
        const data = snapshot.val();
        allReportes = [];

        if (data) {
            Object.keys(data).forEach(key => {
                const r = data[key];
                r.id = key;
                allReportes.push(r);
            });
            // Ordenar por timestamp descendente
            allReportes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }

        document.getElementById('loading-state').classList.add('hidden');
        applyFilters();
    }, (error) => {
        console.error("Error fetching reportes:", error);
        document.getElementById('loading-state').classList.add('hidden');
        if (typeof showToast === 'function') showToast("Error al cargar datos", "error");
    });
}

function applyFilters() {
    const desde = document.getElementById("desde").value;
    const hasta = document.getElementById("hasta").value;
    const sucursalFiltroVal = document.getElementById("filtro-sucursal") ? document.getElementById("filtro-sucursal").value : "";
    const busqueda = document.getElementById("buscar-reporte").value.toLowerCase();

    // Si el usuario empieza a filtrar pero faltan fechas, le damos un aviso visual (opcional)
    // Pero permitimos que vea los reportes si no hay muchos. 
    // Para el exportado sí seremos estrictos.

    const filtered = allReportes.filter(r => {
        const fechaReporte = r.fecha || ""; // YYYY-MM-DD
        const sucursalReporte = (r.sucursal || "").toLowerCase();
        const actividadReporte = (r.actividad || "").toLowerCase();
        const usuarioReporte = (r.usuarioNombre || "").toLowerCase();
        const resumenReporte = (r.resumen || "").toLowerCase();

        const cumpleFecha = !desde || !hasta || (fechaReporte >= desde && fechaReporte <= hasta);
        const cumpleSucursal = !sucursalFiltroVal || sucursalReporte === sucursalFiltroVal.toLowerCase();
        const cumpleBusqueda = !busqueda ||
            actividadReporte.includes(busqueda) ||
            usuarioReporte.includes(busqueda) ||
            sucursalReporte.includes(busqueda) ||
            resumenReporte.includes(busqueda);

        return cumpleFecha && cumpleSucursal && cumpleBusqueda;
    });

    renderTable(filtered);
}

function renderTable(reportes) {
    const tbody = document.getElementById('reportes-tbody');
    const emptyState = document.getElementById('empty-state');
    const countEl = document.getElementById('resultados-count');

    countEl.textContent = reportes.length;
    tbody.innerHTML = '';

    if (reportes.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    reportes.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-100 dark:border-slate-800";

        const usuario = r.usuarioNombre || "Usuario Desconocido";
        const iniciales = usuario.substring(0, 2).toUpperCase();
        const fecha = r.fecha || "---";
        const actividad = r.actividad || "Sin título";
        const sucursal = r.sucursal || "General";
        const fotosCount = r.fotos ? r.fotos.length : 0;

        tr.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                        ${iniciales}
                    </div>
                    <div>
                        <p class="text-sm font-medium dark:text-white">${usuario}</p>
                        <p class="text-[10px] text-slate-400 font-medium">${r.hora || '--:--'}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                <div class="flex items-center space-x-2">
                    <span class="material-icons-outlined text-sm text-slate-400">location_on</span>
                    <span>${sucursal}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-sm text-slate-500">${fecha}</td>
            <td class="px-6 py-4">
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">${actividad}</p>
                <p class="text-xs text-slate-500 truncate max-w-[200px]" title="${r.resumen || ''}">${r.resumen || ''}</p>
            </td>
            <td class="px-6 py-4 text-center">
                ${fotosCount > 0 ? `
                    <button onclick='openImageGallery(${JSON.stringify(r.fotos)})' class="px-2.5 py-1 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-xs font-bold rounded-lg flex items-center gap-1 mx-auto hover:scale-105 transition-transform">
                        <span class="material-icons-outlined text-xs">collections</span>
                        ${fotosCount} foto${fotosCount > 1 ? 's' : ''}
                    </button>
                ` : '<span class="text-xs text-slate-300">Sin fotos</span>'}
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex justify-end gap-1">
                    <button onclick="verResumen('${r.id}')" class="p-2 text-slate-400 hover:text-primary transition-colors" title="Ver Resumen">
                        <span class="material-icons-outlined">visibility</span>
                    </button>
                    <button onclick="exportarReporteIndividual('${r.id}')" class="p-2 text-slate-400 hover:text-red-500 transition-colors" title="PDF">
                        <span class="material-icons-outlined">picture_as_pdf</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Funcionalidades de Galería y Detalles ---

let currentGallery = [];
let currentImgIndex = 0;

function openImageGallery(fotos, startIndex = 0) {
    if (!fotos || fotos.length === 0) return;
    currentGallery = fotos;
    currentImgIndex = startIndex;
    updateImageModal();
    const modal = document.getElementById('image-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function updateImageModal() {
    const imgEl = document.getElementById('modal-img-element');
    const counterEl = document.getElementById('img-counter');
    const btnPrev = document.getElementById('btn-prev-img');
    const btnNext = document.getElementById('btn-next-img');

    imgEl.src = currentGallery[currentImgIndex];
    counterEl.textContent = `${currentImgIndex + 1} / ${currentGallery.length}`;

    if (currentGallery.length > 1) {
        btnPrev.classList.remove('hidden');
        btnNext.classList.remove('hidden');
    } else {
        btnPrev.classList.add('hidden');
        btnNext.classList.add('hidden');
    }
}

function prevImage() {
    currentImgIndex = (currentImgIndex - 1 + currentGallery.length) % currentGallery.length;
    updateImageModal();
}

function nextImage() {
    currentImgIndex = (currentImgIndex + 1) % currentGallery.length;
    updateImageModal();
}

function verResumen(id) {
    const reporte = allReportes.find(r => r.id === id);
    if (!reporte) return;

    const msg = `Actividad: ${reporte.actividad}\nUsuario: ${reporte.usuarioNombre}\nResumen: ${reporte.resumen || 'Sin resumen'}`;
    if (typeof showAlert === 'function') {
        showAlert("Resumen de Actividad", msg, "info");
    } else {
        alert(msg);
    }
}

async function exportarReporteIndividual(id) {
    const reporte = allReportes.find(r => r.id === id);
    if (!reporte) return;

    try {
        if (typeof showToast === 'function') showToast("Generando reporte profesional...");

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height || 297;
        const marginBottom = 30;

        // 1. Encabezado Institucional
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 45, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("HELIOS", 20, 22);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("REPORTE DE ACTIVIDAD REALIZADA", 20, 32);

        doc.setFontSize(9);
        doc.setTextColor(200, 200, 200);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 140, 38);

        // 2. Tarjeta de Información (Estilo Registros)
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 50, 180, 35, 3, 3, 'F');

        doc.setTextColor(110);
        doc.setFontSize(8);
        doc.text("SUPERVISOR", 25, 60);
        doc.text("SUCURSAL", 80, 60);
        doc.text("FECHA / HORA", 135, 60);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(reporte.usuarioNombre || "Desconocido", 25, 68);
        doc.text(reporte.sucursal || "General", 80, 68);
        doc.text(`${reporte.fecha || ""} ${reporte.hora || ""}`, 135, 68);

        doc.setTextColor(100);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("ACTIVIDAD REGISTRADA", 25, 78);

        doc.setTextColor(59, 130, 246);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(reporte.actividad || "Sin título", 25, 83);

        // 3. Cuerpo del reporte
        let currentY = 95;

        // Encabezado de Sección "Detalle"
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(20, currentY, 170, 8, 2, 2, 'F');
        doc.setTextColor(255);
        doc.setFontSize(10);
        doc.text("RESUMEN DE ACTIVIDAD", 25, currentY + 5.5);
        currentY += 12;

        // Texto del resumen
        doc.setTextColor(80);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const resumenLines = doc.splitTextToSize(reporte.resumen || "Sin observaciones adicionales.", 165);
        doc.text(resumenLines, 25, currentY);
        currentY += resumenLines.length * 5 + 10;

        // 4. Evidencia Fotográfica
        if (reporte.fotos && Array.isArray(reporte.fotos) && reporte.fotos.length > 0) {
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("EVIDENCIA FOTOGRÁFICA", 20, currentY);
            currentY += 5;

            let xPos = 25;
            const imgWidth = 80;
            const imgHeight = 60;

            for (const url of reporte.fotos) {
                if (currentY + imgHeight > pageHeight - marginBottom - 40) { // Dejar espacio para firmas
                    doc.addPage();
                    currentY = 25;
                    xPos = 25;
                }

                try {
                    const imgData = await getBase64Image(url);
                    doc.addImage(imgData, 'JPEG', xPos, currentY, imgWidth, imgHeight);

                    xPos += imgWidth + 10;
                    if (xPos + imgWidth > 190) {
                        xPos = 25;
                        currentY += imgHeight + 10;
                    }
                } catch (e) {
                    console.error("Error loading image for PDF:", e);
                }
            }
            if (xPos !== 25) currentY += imgHeight + 15;
            else currentY += 5;
        }

        // 5. Sección de Firmas (Estilo Registros)
        if (currentY + 40 > pageHeight - marginBottom) {
            doc.addPage();
            currentY = 25;
        }

        currentY += 15;
        doc.setDrawColor(200);
        doc.line(20, currentY + 20, 90, currentY + 20);
        doc.line(120, currentY + 20, 190, currentY + 20);

        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text("Firma de Supervisión", 35, currentY + 26);
        doc.text("Sello de Sucursal / Gerencia", 135, currentY + 26);

        // 6. Pie de página
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("HELIOS - Reporte de Actividad Realizada", 20, pageHeight - 10);
            doc.text(`Página ${i} de ${totalPages}`, 170, pageHeight - 10);
        }

        doc.save(`Actividad_${reporte.sucursal || 'Gral'}_${reporte.fecha || 'fecha'}.pdf`);
        if (typeof showToast === 'function') showToast("Reporte generado correctamente");

    } catch (error) {
        console.error("PDF Error:", error);
        if (typeof showToast === 'function') showToast("Error al generar el reporte", "error");
    }
}

async function getBase64Image(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function exportarPDF() {
    const { jsPDF } = window.jspdf;

    const desde = document.getElementById("desde").value;
    const hasta = document.getElementById("hasta").value;

    // Validación estricta para exportación
    if (!desde || !hasta) {
        if (typeof showToast === 'function') {
            showToast("Por favor, seleccione un rango de fechas (Desde y Hasta) para generar el reporte detallado.", "warning");
        } else {
            alert("Por favor, seleccione un rango de fechas para exportar.");
        }

        // Resaltar campos para guiar al usuario
        document.getElementById("desde").classList.add("ring-2", "ring-orange-500");
        document.getElementById("hasta").classList.add("ring-2", "ring-orange-500");
        setTimeout(() => {
            document.getElementById("desde").classList.remove("ring-2", "ring-orange-500");
            document.getElementById("hasta").classList.remove("ring-2", "ring-orange-500");
        }, 3000);

        return;
    }

    const sucursalFiltroText = document.getElementById("selected-sucursal-text") ? document.getElementById("selected-sucursal-text").textContent : "Todas las Sucursales";
    const sucursalFiltroVal = document.getElementById("filtro-sucursal") ? document.getElementById("filtro-sucursal").value : "";
    const busqueda = document.getElementById("buscar-reporte").value.toLowerCase();

    const filtered = allReportes.filter(r => {
        const fechaReporte = r.fecha || "";
        const sucursalReporte = (r.sucursal || "").toLowerCase();
        const actividadReporte = (r.actividad || "").toLowerCase();
        const usuarioReporte = (r.usuarioNombre || "").toLowerCase();
        const resumenReporte = (r.resumen || "").toLowerCase();

        const cumpleFecha = (fechaReporte >= desde && fechaReporte <= hasta);
        const cumpleSucursal = !sucursalFiltroVal || sucursalReporte === sucursalFiltroVal.toLowerCase();
        const cumpleBusqueda = !busqueda ||
            actividadReporte.includes(busqueda) ||
            usuarioReporte.includes(busqueda) ||
            sucursalReporte.includes(busqueda) ||
            resumenReporte.includes(busqueda);

        return cumpleFecha && cumpleSucursal && cumpleBusqueda;
    });

    if (filtered.length === 0) {
        if (typeof showToast === 'function') showToast("No hay actividades registradas en el rango seleccionado.", "warning");
        return;
    }

    if (typeof showToast === 'function') showToast("Generando reporte completo con imágenes...", "info");

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageHeight = doc.internal.pageSize.height || 297;
    const marginBottom = 30;

    // 1. Encabezado Principal
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("HELIOS", 20, 22);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("REPORTE DETALLADO DE ACTIVIDADES REALIZADAS", 20, 32);

    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(`Periodo: ${desde} a ${hasta}`, 20, 38);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 140, 38);

    let currentY = 55;

    // 2. Iterar por cada reporte para hacerlo "corrido"
    for (let i = 0; i < filtered.length; i++) {
        const r = filtered[i];

        // Verificar espacio para el bloque de info (unos 40mm)
        if (currentY + 60 > pageHeight - marginBottom) {
            doc.addPage();
            currentY = 20;
        }

        // Título de Actividad (Header Azul)
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(15, currentY, 180, 8, 2, 2, 'F');
        doc.setTextColor(255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}. ${r.actividad || 'Sin Título'}`, 20, currentY + 5.5);
        currentY += 12;

        // Info rápida
        doc.setTextColor(100);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Supervisor: ${r.usuarioNombre || '---'} | Sucursal: ${r.sucursal || '---'} | Fecha: ${r.fecha || '---'} ${r.hora || ''}`, 20, currentY);
        currentY += 6;

        // Resumen
        doc.setTextColor(60);
        doc.setFontSize(9);
        const resumenLines = doc.splitTextToSize(r.resumen || "Sin descripción.", 175);
        doc.text(resumenLines, 20, currentY);
        currentY += resumenLines.length * 5 + 5;

        // Fotos (Pequeñas en el reporte general corrido)
        if (r.fotos && r.fotos.length > 0) {
            let xPos = 20;
            const imgW = 40;
            const imgH = 30;

            for (const fotoUrl of r.fotos) {
                if (currentY + imgH > pageHeight - marginBottom) {
                    doc.addPage();
                    currentY = 20;
                    xPos = 20;
                }

                try {
                    const imgData = await getBase64Image(fotoUrl);
                    doc.addImage(imgData, 'JPEG', xPos, currentY, imgW, imgH);
                    xPos += imgW + 5;
                    if (xPos + imgW > 190) {
                        xPos = 20;
                        currentY += imgH + 5;
                    }
                } catch (e) {
                    console.error("Error loading img for general PDF:", e);
                }
            }
            if (xPos !== 20) currentY += imgH + 10;
            else currentY += 5;
        } else {
            currentY += 5;
        }

        // Línea divisoria
        doc.setDrawColor(240);
        doc.line(15, currentY, 195, currentY);
        currentY += 10;
    }

    // 3. Sección de Firmas al final
    if (currentY + 40 > pageHeight - marginBottom) {
        doc.addPage();
        currentY = 20;
    }

    currentY += 10;
    doc.setDrawColor(200);
    doc.line(20, currentY + 20, 90, currentY + 20);
    doc.line(120, currentY + 20, 190, currentY + 20);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Firma de Supervisión", 35, currentY + 26);
    doc.text("Sello de Sucursal / Gerencia", 135, currentY + 26);

    // Pie de página
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`HELIOS - Reporte Detallado de Actividades (${desde} a ${hasta})`, 20, pageHeight - 10);
        doc.text(`Página ${i} de ${totalPages}`, 180, pageHeight - 10);
    }

    doc.save(`Helios_Detallado_${new Date().toISOString().substring(0, 10)}.pdf`);
    if (typeof showToast === 'function') showToast("Reporte detallado generado", "success");
}
