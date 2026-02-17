// Variables globales para mapeo y estado
let userMap = {};

document.addEventListener('DOMContentLoaded', () => {
    cargarRegistros();

    // Cerrar dropdown al hacer clic fuera
    window.addEventListener('click', (e) => {
        const container = document.getElementById('dropdown-sucursal-container');
        const menu = document.getElementById('dropdown-sucursal-menu');
        if (container && menu && !container.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
});

function cargarRegistros() {
    const desde = document.getElementById("desde").value;
    const hasta = document.getElementById("hasta").value;
    const sucursal = document.getElementById("filtro-sucursal").value;

    // Obtener mapeo de usuarios para mostrar nombres en lugar de correos
    db.ref("usuarios").once("value").then(userSnapshot => {
        const usersData = userSnapshot.val() || {};
        userMap = {};
        Object.values(usersData).forEach(u => {
            if (u.email && u.nombre) {
                userMap[u.email.toLowerCase()] = u.nombre;
            }
        });

        db.ref("folios").once("value").then(snapshot => {
            const data = snapshot.val();
            cargarSucursales(data);
            mostrarTabla(data, desde, hasta, sucursal);
        });
    });
}

function cargarSucursales(data) {
    // Función para capitalizar primera letra
    function capitalize(str) {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // Cargar ubicaciones desde la colección
    db.ref("ubicaciones").once("value").then(snapshot => {
        const ubicacionesData = snapshot.val();
        let listaSorted = [];

        if (ubicacionesData && typeof ubicacionesData === 'object') {
            // Las llaves son los nombres de ubicación
            listaSorted = Object.keys(ubicacionesData).sort();
        }

        // Actualizar dropdown de filtro
        const sucursalOptions = document.getElementById("sucursal-options");
        const hiddenInput = document.getElementById("filtro-sucursal");
        const currentFiltroVal = hiddenInput ? hiddenInput.value : "";

        if (sucursalOptions) {
            sucursalOptions.innerHTML = "";

            // Agregar opción "Todas"
            const btnTodas = document.createElement("button");
            btnTodas.type = "button";
            btnTodas.className = `w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${!currentFiltroVal ? 'text-primary font-semibold bg-blue-50/50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300'}`;
            btnTodas.innerHTML = `<span>Todas las Sucursales</span>${!currentFiltroVal ? '<span class="material-icons-outlined text-sm">check</span>' : ''}`;
            btnTodas.onclick = () => seleccionarSucursalFiltro("");
            sucursalOptions.appendChild(btnTodas);

            listaSorted.forEach(loc => {
                const item = document.createElement("button");
                const displayName = capitalize(loc);
                item.type = "button";
                item.className = `w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${currentFiltroVal === loc ? 'text-primary font-semibold bg-blue-50/50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300'}`;
                item.innerHTML = `<span>${displayName}</span>${currentFiltroVal === loc ? '<span class="material-icons-outlined text-sm">check</span>' : ''}`;
                item.onclick = () => seleccionarSucursalFiltro(loc);
                sucursalOptions.appendChild(item);
            });
        }

        // Actualizar select del formulario (si existe)
        const formSelect = document.getElementById("form-sucursal");
        if (formSelect) {
            const currentFormValue = formSelect.value;
            formSelect.innerHTML = '<option value="" disabled selected>Seleccione Sucursal</option>';
            listaSorted.forEach(loc => {
                const opt = document.createElement("option");
                opt.value = loc;
                opt.textContent = capitalize(loc);
                formSelect.appendChild(opt);
            });
            if (currentFormValue) formSelect.value = currentFormValue;
        }
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
    // Capitalizar para mostrar
    const displayName = loc ? loc.charAt(0).toUpperCase() + loc.slice(1).toLowerCase() : "Todas las Sucursales";
    if (labelText) labelText.textContent = displayName;
    if (menu) menu.classList.add("hidden");

    cargarRegistros();
}

let dataTable = null;

function mostrarTabla(data, desde, hasta, sucursalFiltro) {
    const tbody = document.querySelector("#tabla-registros tbody");

    // Destroy existing DataTable instance
    if ($.fn.DataTable.isDataTable('#tabla-registros')) {
        $('#tabla-registros').DataTable().destroy();
    }

    tbody.innerHTML = "";

    if (!data) return;

    // FOLIOS: One row per folio (aggregate activities)
    // Sort keys descending to get newest first (insertion order)
    Object.keys(data).sort().reverse().forEach(folioId => {
        const folio = data[folioId];
        const fechaCorta = folio.fecha ? folio.fecha.substring(0, 10) : "";
        const sucursal = folio.sucursal || "General";
        const rawUsuario = folio.usuario || "Usuario Desconocido";

        // Mapear correo a nombre usando el mapa con los datos de Firebase
        const usuario = userMap[rawUsuario.toLowerCase()] || rawUsuario;


        const cumpleFecha = !desde || !hasta || (fechaCorta >= desde && fechaCorta <= hasta);
        // Case-insensitive comparison for sucursal
        const cumpleSucursal = !sucursalFiltro || sucursal.toLowerCase() === sucursalFiltro.toLowerCase();

        if (cumpleFecha && cumpleSucursal && folio.actividades) {
            // Calculate aggregates for nested structure
            let totalSubactividades = 0;
            let sumaPuntaje = 0;

            Object.values(folio.actividades).forEach(catData => {
                if (typeof catData === 'object') {
                    Object.values(catData).forEach(subData => {
                        sumaPuntaje += parseFloat(subData.puntuacion || 0);
                        totalSubactividades++;
                    });
                }
            });

            const promedio = totalSubactividades > 0 ? (sumaPuntaje / totalSubactividades).toFixed(1) : "0";
            const numEvaluadas = totalSubactividades;

            // ROLE FILTER: If not admin, only show own folios
            const isOwner = (rawUsuario.toLowerCase() === window.__heliosUser?.nombre?.toLowerCase()) ||
                (rawUsuario.toLowerCase() === window.__heliosUser?.email?.toLowerCase());

            if (window.__heliosUser?.rol !== 'admin' && !isOwner) {
                return;
            }

            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-100 dark:border-slate-800";
            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                            ${usuario.substring(0, 2)}
                        </div>
                        <span class="text-sm font-medium dark:text-white">${usuario}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <span class="material-icons-outlined text-sm text-slate-400">location_on</span>
                        <span>${sucursal}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-slate-500 text-center">${fechaCorta}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-bold rounded-lg">
                        ${numEvaluadas} evaluadas
                    </span>
                </td>
                <td class="px-6 py-4 text-sm font-bold text-amber-500 text-center">${promedio}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-1">
                        <button onclick="verDetalle('${folioId}')" class="p-2 text-slate-400 hover:text-primary transition-colors" title="Ver Detalles">
                            <span class="material-icons-outlined">visibility</span>
                        </button>
                        <button onclick="exportarPDFFolio('${folioId}')" class="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Generar Reporte PDF">
                            <span class="material-icons-outlined">picture_as_pdf</span>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });

    // Re-initialize DataTable
    $('#tabla-registros').DataTable({
        language: {
            "sProcessing": "Procesando...",
            "sLengthMenu": "Mostrar _MENU_ registros",
            "sZeroRecords": "No se encontraron resultados",
            "sEmptyTable": "Ningún dato disponible en esta tabla",
            "sInfo": "Mostrando del _START_ al _END_ de _TOTAL_ folios",
            "sInfoEmpty": "Mostrando 0 de 0 folios",
            "sInfoFiltered": "(filtrado de _MAX_ folios)",
            "sSearch": "Buscar:",
            "oPaginate": {
                "sFirst": "Primero",
                "sLast": "Último",
                "sNext": "Siguiente",
                "sPrevious": "Anterior"
            }
        },
        pageLength: 10,
        order: [[2, 'desc']],
        responsive: true,
        dom: '<"flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-b border-slate-100 dark:border-slate-800"f>rt<"flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-t border-slate-100 dark:border-slate-800"ip>',
        drawCallback: function () {
            $('.dataTables_filter input')
                .addClass('outline-none transition-all ml-2 shadow-inner')
                .attr('placeholder', 'Escribe para filtrar...');

            $('.dataTables_paginate').addClass('flex items-center gap-1');
            $('.paginate_button').addClass('cursor-pointer');
        }
    });
}

// Control de modales
// Control de modales con Wizard
function openModal(isEdit = false) {
    const modal = document.getElementById("modal-registro");
    const content = document.getElementById("modal-content");

    // Reset wizard
    currentStep = 0;
    Object.keys(pendingPhotos).forEach(key => delete pendingPhotos[key]);
    if (typeof initMultiStepForm === 'function') initMultiStepForm();
    if (typeof updateStepUI === 'function') updateStepUI();

    if (modal) modal.classList.remove("hidden");
    if (content) {
        setTimeout(() => {
            content.classList.remove("scale-95", "opacity-0");
        }, 10);
        content.classList.add("scale-100", "opacity-100");
    }

    if (!isEdit) {
        const form = document.getElementById("form-registro");
        if (form) form.reset();
        document.getElementById("edit-id").value = "";

        // Auto-asignar nombre del supervisor
        const correoInput = document.getElementById('form-correo');
        if (correoInput && window.__heliosUser) {
            correoInput.value = window.__heliosUser.nombre || window.__heliosUser.email;
        }
    }
}

function closeModal() {
    const modal = document.getElementById("modal-registro");
    const content = document.getElementById("modal-content");
    if (content) {
        content.classList.remove("scale-100", "opacity-100");
        content.classList.add("scale-95", "opacity-0");
    }
    setTimeout(() => {
        if (modal) modal.classList.add("hidden");
    }, 200);
}

// Configuración de Actividades del Folio (Dinamizada)
let ACTIVIDADES_DINAMICAS = {}; // Estructura: { catId: { subId1: true, subId2: true } }
let currentStep = 0;
let totalSteps = 1;

// Inicializar UI del formulario multi-pasos
async function initMultiStepForm() {
    const container = document.getElementById('dynamic-steps-container');
    if (!container) return;

    // Cargar actividades desde la base de datos
    const snapshot = await db.ref("actividades").once("value");
    const data = snapshot.val() || {};

    // Filtrar solo las activas
    ACTIVIDADES_DINAMICAS = {};
    Object.entries(data).forEach(([catId, catData]) => {
        const activo = typeof catData === 'object' ? (catData.activo !== false) : (catData === true);
        if (activo) {
            ACTIVIDADES_DINAMICAS[catId] = {};
            if (typeof catData === 'object') {
                Object.entries(catData).forEach(([subId, val]) => {
                    if (subId !== 'activo') ACTIVIDADES_DINAMICAS[catId][subId] = val;
                });
            }
        }
    });

    const categoryIds = Object.keys(ACTIVIDADES_DINAMICAS).sort();
    totalSteps = categoryIds.length + 1;

    container.innerHTML = categoryIds.map((catId, index) => {
        const subactividades = Object.keys(ACTIVIDADES_DINAMICAS[catId]).sort();
        const catLabel = catId.charAt(0).toUpperCase() + catId.slice(1);

        return `
            <div class="form-step hidden" data-step="${index + 1}">
                <div class="space-y-6">
                    <div class="bg-primary/5 p-4 rounded-2xl border border-primary/10 mb-2 text-center">
                        <h4 class="text-sm font-bold text-primary uppercase tracking-widest">${catLabel}</h4>
                    </div>
                    
                    ${subactividades.map(subId => {
            const subLabel = subId.charAt(0).toUpperCase() + subId.slice(1);
            return `
                        <div class="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 mb-4">
                            <label class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">${subLabel}</label>
                            
                            <!-- Puntuación -->
                            <div class="mb-4">
                                <label class="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Puntuación (1-10)</label>
                                <div class="flex flex-wrap gap-1.5 justify-center">
                                    ${Array.from({ length: 10 }, (_, i) => i + 1).map(num => `
                                        <button type="button" onclick="setScore('${catId}', '${subId}', ${num})" 
                                            data-score-btn="${catId}-${subId}-${num}"
                                            class="score-btn w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-primary/10 transition-all dark:text-white">
                                            ${num}
                                        </button>
                                    `).join('')}
                                </div>
                                <input type="hidden" id="score-${catId}-${subId}" name="${catId}-${subId}-puntuacion" value="0">
                            </div>

                            <!-- Comentario -->
                            <div class="mb-4">
                                <textarea id="comment-${catId}-${subId}" rows="2"
                                    class="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:ring-primary focus:border-primary resize-none"
                                    placeholder="Observaciones de ${subLabel}..."></textarea>
                            </div>

                            <!-- Fotos -->
                            <div>
                                <label class="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Fotos de Evidencia</label>
                                <div class="grid grid-cols-4 gap-2" id="preview-grid-${catId}-${subId}">
                                    <div class="relative group aspect-square">
                                        <input type="file" onchange="handleFileSelect(event, '${catId}', '${subId}')" accept="image/*" multiple
                                            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                                        <div class="w-full h-full bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center transition-all group-hover:border-primary">
                                            <span class="material-icons-outlined text-slate-400 group-hover:text-primary text-xl">add_a_photo</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Alternar Botón de Puntuación
function setScore(catId, subId, score) {
    const input = document.getElementById(`score-${catId}-${subId}`);
    if (input) input.value = score;

    document.querySelectorAll(`[data-score-btn^="${catId}-${subId}-"]`).forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white', 'border-primary');
        btn.classList.add('border-slate-200', 'dark:border-slate-700');
    });
    const selected = document.querySelector(`[data-score-btn="${catId}-${subId}-${score}"]`);
    if (selected) {
        selected.classList.add('bg-primary', 'text-white', 'border-primary');
        selected.classList.remove('border-slate-200', 'dark:border-slate-700');
    }
}

// Gestión de Archivos Múltiples
const pendingPhotos = {}; // "catId-subId" -> File[]

function handleFileSelect(event, catId, subId) {
    const files = Array.from(event.target.files);
    const key = `${catId}-${subId}`;
    if (!pendingPhotos[key]) pendingPhotos[key] = [];

    files.forEach(file => {
        pendingPhotos[key].push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const grid = document.getElementById(`preview-grid-${catId}-${subId}`);
            const div = document.createElement('div');
            div.className = 'relative aspect-square rounded-xl overflow-hidden border border-slate-200 group';
            div.innerHTML = `
                <img src="${e.target.result}" class="w-full h-full object-cover">
                <button type="button" onclick="removePendingPhoto('${catId}', '${subId}', ${pendingPhotos[key].length - 1}, this)" 
                    class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-100 transition-opacity">
                    <span class="material-icons-outlined text-[10px]">close</span>
                </button>
            `;
            grid.insertBefore(div, grid.firstChild);
        };
        reader.readAsDataURL(file);
    });
}

function removePendingPhoto(catId, subId, index, btn) {
    const key = `${catId}-${subId}`;
    pendingPhotos[key].splice(index, 1);
    btn.parentElement.remove();
}

// Navegación de Pasos
function changeStep(delta) {
    if (delta === 1 && !validateStep(currentStep)) return;

    const steps = document.querySelectorAll('.form-step');
    steps[currentStep].classList.add('hidden');

    currentStep += delta;

    if (currentStep >= totalSteps) {
        currentStep = totalSteps - 1;
        guardarFolioCompleto();
        return;
    }

    steps[currentStep].classList.remove('hidden');
    updateStepUI();
}

function updateStepUI() {
    const progress = (currentStep / (totalSteps - 1)) * 100;
    const progressBar = document.getElementById('form-progress');
    if (progressBar) progressBar.style.width = `${progress}%`;

    const indicator = document.getElementById('step-indicator');
    if (indicator) {
        const categoryIds = Object.keys(ACTIVIDADES_DINAMICAS).sort();
        const stepLabel = currentStep === 0 ? 'Información General' : categoryIds[currentStep - 1].charAt(0).toUpperCase() + categoryIds[currentStep - 1].slice(1);
        indicator.textContent = `Paso ${currentStep + 1} de ${totalSteps}: ${stepLabel}`;
    }

    const btnPrev = document.getElementById('btn-prev');
    if (btnPrev) btnPrev.classList.toggle('hidden', currentStep === 0);

    const btnNext = document.getElementById('btn-next');
    if (btnNext) btnNext.textContent = currentStep === totalSteps - 1 ? 'Finalizar Folio' : 'Siguiente';
}

function validateStep(step) {
    if (step === 0) {
        const sucursal = document.getElementById('form-sucursal').value;
        const fecha = document.getElementById('form-fecha').value;
        if (!sucursal || !fecha) {
            showToast('Por favor completa los datos generales', 'warning');
            return false;
        }
    } else {
        const catId = Object.keys(ACTIVIDADES_DINAMICAS).sort()[step - 1];
        const subIds = Object.keys(ACTIVIDADES_DINAMICAS[catId]);

        for (const subId of subIds) {
            const score = document.getElementById(`score-${catId}-${subId}`).value;
            if (score === "0") {
                showToast(`Por favor califica la subactividad: ${subId}`, 'warning');
                return false;
            }
        }
    }
    return true;
}

async function guardarFolioCompleto() {
    const btn = document.getElementById('btn-next');
    const originalText = btn.textContent;

    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-icons-outlined animate-spin mr-2">refresh</span> Guardando...`;

        const idEdit = document.getElementById("edit-id").value;
        const folioData = {
            usuario: document.getElementById("form-correo").value,
            sucursal: document.getElementById("form-sucursal").value,
            fecha: document.getElementById("form-fecha").value + "T12:00:00",
            actividades: {}
        };

        const categoryIds = Object.keys(ACTIVIDADES_DINAMICAS).sort();
        for (const catId of categoryIds) {
            folioData.actividades[catId] = {};
            const subIds = Object.keys(ACTIVIDADES_DINAMICAS[catId]);

            for (const subId of subIds) {
                const key = `${catId}-${subId}`;
                let photoUrls = [];
                const files = pendingPhotos[key] || [];

                for (const file of files) {
                    const ref = storage.ref(`fotos_folios/${Date.now()}_${file.name}`);
                    const snap = await ref.put(file);
                    const url = await snap.ref.getDownloadURL();
                    photoUrls.push(url);
                }

                folioData.actividades[catId][subId] = {
                    puntuacion: parseInt(document.getElementById(`score-${catId}-${subId}`).value),
                    comentario: document.getElementById(`comment-${catId}-${subId}`).value,
                    fotos: photoUrls
                };
            }
        }

        const ref = idEdit ? db.ref(`folios/${idEdit}`) : db.ref(`folios`).push();
        await ref.set(folioData);

        showToast(idEdit ? "Folio actualizado" : "Folio creado con éxito");
        closeModal();
        cargarRegistros();
    } catch (err) {
        showToast("Error: " + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Ver detalle del folio
function verDetalle(folioId) {
    db.ref(`folios/${folioId}`).once("value").then(snapshot => {
        const folio = snapshot.val();
        if (!folio || !folio.actividades) return;

        // Calcular promedio total y agrupar por categoría
        let sumaPuntajeTotal = 0;
        let totalSubactividades = 0;
        const gruposCategorias = {};

        Object.entries(folio.actividades).forEach(([catId, catData]) => {
            if (typeof catData === 'object') {
                gruposCategorias[catId] = {
                    subactividades: [],
                    promedioCat: 0,
                    sumaPuntajeCat: 0
                };

                Object.entries(catData).forEach(([subId, subData]) => {
                    if (subId === 'activo') return;
                    const puntuacion = parseFloat(subData.puntuacion || 0);
                    sumaPuntajeTotal += puntuacion;
                    totalSubactividades++;

                    gruposCategorias[catId].sumaPuntajeCat += puntuacion;
                    gruposCategorias[catId].subactividades.push({
                        id: subId,
                        ...subData
                    });
                });

                if (gruposCategorias[catId].subactividades.length > 0) {
                    gruposCategorias[catId].promedioCat = (gruposCategorias[catId].sumaPuntajeCat / gruposCategorias[catId].subactividades.length).toFixed(1);
                }
            }
        });

        const promedioGral = totalSubactividades > 0 ? (sumaPuntajeTotal / totalSubactividades).toFixed(1) : "0";

        // Llenar header
        const elCorreo = document.getElementById("detalle-correo");
        const elSucursal = document.getElementById("detalle-sucursal");
        const elFecha = document.getElementById("detalle-fecha");
        const elPromedio = document.getElementById("detalle-promedio");

        if (elCorreo) elCorreo.textContent = folio.usuario || "Usuario Desconocido";
        if (elSucursal) elSucursal.innerHTML = `<span class="material-icons-outlined text-xs text-primary">location_on</span> ${folio.sucursal || "General"}`;
        if (elFecha) elFecha.innerHTML = `<span class="material-icons-outlined text-xs text-primary">calendar_today</span> ${folio.fecha ? folio.fecha.substring(0, 10) : ""}`;
        if (elPromedio) elPromedio.innerHTML = `<span class="material-icons-outlined text-sm">star</span> ${promedioGral} <span class="text-xs text-slate-400 font-medium">/ 10</span>`;

        // Generar Visualización Agrupada
        const actividadesContainer = document.getElementById("detalle-actividades");
        actividadesContainer.innerHTML = "";

        Object.entries(gruposCategorias).forEach(([catId, data]) => {
            const displayCat = catId.charAt(0).toUpperCase() + catId.slice(1);

            const catSection = document.createElement("div");
            catSection.className = "mb-8 bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm";

            // Category Header
            let headerHtml = `
                <div class="px-5 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <span class="material-icons-outlined text-xl">folder</span>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 dark:text-white">${displayCat}</h4>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${data.subactividades.length} Subactividades</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <span class="material-icons-outlined text-amber-500 text-sm">star</span>
                        <span class="text-sm font-bold text-slate-700 dark:text-white">${data.promedioCat}</span>
                    </div>
                </div>
                <div class="p-5 space-y-6">
            `;

            // Sub-activities
            data.subactividades.forEach(sub => {
                const displaySub = sub.id.charAt(0).toUpperCase() + sub.id.slice(1);

                let fotosHtml = "";
                if (sub.fotos && Array.isArray(sub.fotos) && sub.fotos.length > 0) {
                    fotosHtml = `
                        <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-4">
                            ${sub.fotos.map(url => `
                                <div class="aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 group cursor-pointer" onclick="abrirModalImagen('${url}')">
                                    <img src="${url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                                </div>
                            `).join('')}
                        </div>
                    `;
                }

                const hasScore = sub.puntuacion !== undefined && sub.puntuacion !== null && sub.puntuacion !== 0;
                const scoreDisplay = hasScore ? `${sub.puntuacion} / 10` : "No se calificó";
                const scoreColor = !hasScore ? 'text-slate-500 bg-slate-100 dark:bg-slate-700' : (sub.puntuacion >= 8 ? 'text-success bg-success/10' : (sub.puntuacion >= 5 ? 'text-warning bg-warning/10' : 'text-danger bg-danger/10'));

                headerHtml += `
                    <div class="relative pl-6 border-l-2 border-slate-100 dark:border-slate-700 pb-2 last:pb-0">
                        <!-- Dot indicator -->
                        <div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600"></div>
                        
                        <div class="flex items-start justify-between mb-2">
                            <h5 class="text-sm font-bold text-slate-700 dark:text-slate-200">${displaySub}</h5>
                            <span class="px-2 py-0.5 rounded-lg text-xs font-black ${scoreColor}">
                                ${scoreDisplay}
                            </span>
                        </div>
                        
                        <div class="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-inner">
                            <p class="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
                                ${sub.comentario || "Sin observaciones adicionales."}
                            </p>
                            ${fotosHtml}
                        </div>
                    </div>
                `;
            });

            headerHtml += `</div>`;
            catSection.innerHTML = headerHtml;
            actividadesContainer.appendChild(catSection);
        });

        // Implementación del mapa
        const mapaContainer = document.getElementById("detalle-mapa-container");
        const mapaIframe = document.getElementById("detalle-mapa-iframe");

        // Campos de coordenadas posibles
        let coords = folio.coordenadas || (folio.lat && folio.lng ? `${folio.lat},${folio.lng}` : null);

        if (coords) {
            console.log("Coordenadas encontradas:", coords);
            mapaContainer.classList.remove("hidden");
            // Usamos Google Maps Embed
            // Para mejor experiencia usamos el patrón de URL estándar
            mapaIframe.src = `https://maps.google.com/maps?q=${coords}&z=15&output=embed`;
        } else {
            mapaContainer.classList.add("hidden");
            mapaIframe.src = "";
        }

        // Mostrar modal
        const modal = document.getElementById("modal-detalle");
        const content = document.getElementById("modal-detalle-content");

        if (modal) modal.classList.remove("hidden");
        setTimeout(() => {
            if (content) {
                content.classList.replace("scale-95", "scale-100");
                content.classList.replace("opacity-0", "opacity-100");
            }
        }, 10);
    });
}

function closeModalDetalle() {
    const modal = document.getElementById("modal-detalle");
    const content = document.getElementById("modal-detalle-content");

    if (content) {
        content.classList.replace("scale-100", "scale-95");
        content.classList.replace("opacity-100", "opacity-0");
    }

    setTimeout(() => {
        if (modal) modal.classList.add("hidden");
    }, 300);
}

// Modal para ver imagen ampliada
function abrirModalImagen(url) {
    // Crear el modal si no existe
    let modal = document.getElementById("modal-imagen-ampliada");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modal-imagen-ampliada";
        modal.className = "fixed inset-0 bg-black/90 backdrop-blur-sm hidden items-center justify-center z-[200] p-4 cursor-pointer";
        modal.onclick = function (e) {
            if (e.target === modal) cerrarModalImagen();
        };
        modal.innerHTML = `
            <div class="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
                <button onclick="cerrarModalImagen()" 
                    class="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors z-10">
                    <span class="material-icons-outlined text-3xl">close</span>
                </button>
                <img id="imagen-ampliada-src" src="" alt="Imagen Ampliada" 
                    class="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl">
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Establecer la imagen y mostrar el modal
    document.getElementById("imagen-ampliada-src").src = url;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function cerrarModalImagen() {
    const modal = document.getElementById("modal-imagen-ampliada");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
}

function openFullImage() {
    const url = document.getElementById("detalle-foto").src;
    if (url) abrirModalImagen(url);
}

function closeModal() {
    const modal = document.getElementById("modal-registro");
    const content = document.getElementById("modal-content");
    if (content) content.classList.add("translate-x-full");
    if (modal) {
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 300);
    }
}

// Vista previa de archivos
if (document.getElementById("form-foto-file")) {
    document.getElementById("form-foto-file").addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById("foto-preview");
            if (preview) {
                preview.querySelector("img").src = e.target.result;
                preview.classList.remove("hidden");
            }
            const label = document.getElementById("foto-label");
            if (label) label.textContent = file.name;
        };
        reader.readAsDataURL(file);
    });
}


// Lógica de guardado con almacenamiento
const formRegistro = document.getElementById("form-registro");
if (formRegistro) {
    formRegistro.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.textContent;

        try {
            btn.disabled = true;
            btn.innerHTML = `<span class="material-icons-outlined animate-spin mr-2">refresh</span> Guardando...`;

            const fileInput = document.getElementById("form-foto-file");
            const file = fileInput ? fileInput.files[0] : null;
            let photoUrl = document.getElementById("form-foto-url").value;

            if (file) {
                const fileRef = storage.ref().child(`fotos/${Date.now()}_${file.name}`);
                const snapshot = await fileRef.put(file);
                photoUrl = await snapshot.ref.getDownloadURL();
            }

            const uidEdit = document.getElementById("edit-uid").value;
            const idEdit = document.getElementById("edit-id").value;

            // Prepare activity data
            const actividadNombre = document.getElementById("form-actividad").value;
            const actividadKey = actividadNombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            const commonData = {
                usuario: document.getElementById("form-correo").value,
                sucursal: document.getElementById("form-sucursal").value,
                fecha: document.getElementById("form-fecha").value + " 00:00:00"
            };

            const actividadData = {
                comentario: document.getElementById("form-comentarios").value,
                puntuacion: parseInt(document.getElementById("form-puntuacion").value),
                fotos: photoUrl ? [photoUrl] : []
            };

            if (idEdit) {
                // Update existing folio
                await db.ref(`folios/${idEdit}`).update(commonData);
                await db.ref(`folios/${idEdit}/actividades/${actividadKey}`).set(actividadData);
            } else {
                // Create new folio
                const newFolioRef = db.ref(`folios`).push();
                await newFolioRef.set({
                    ...commonData,
                    actividades: {
                        [actividadKey]: actividadData
                    }
                });
            }

            showToast(idEdit ? "Registro actualizado correctamente" : "Registro creado correctamente");
            closeModal();
            cargarRegistros();
        } catch (err) {
            showToast("Error: " + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

async function eliminarFolio(id) {
    const confirmacion = await showConfirm(
        'Eliminar Folio',
        '¿Estás seguro de eliminar este folio completo? Esta acción no se puede deshacer.',
        'danger'
    );
    if (!confirmacion) return;

    db.ref(`folios/${id}`).remove()
        .then(() => showToast("Folio eliminado correctamente", "success"))
        .catch(err => showToast("Error al eliminar: " + err.message, "error"));
}
// Función auxiliar: Cargar imagen y convertir a base64
function loadImageAsBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            try {
                const dataURL = canvas.toDataURL("image/jpeg", 0.7);
                resolve(dataURL);
            } catch (e) {
                resolve(null); // Error de CORS u otro
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

// Reporte PDF de folio individual con imágenes
async function exportarPDFFolio(folioId) {
    showToast("Generando reporte con imágenes...");

    try {
        const snapshot = await db.ref(`folios/${folioId}`).once("value");
        const folio = snapshot.val();

        if (!folio || !folio.actividades) {
            showToast("No se encontraron datos del folio", 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Calcular totales
        const actividadesKeys = Object.keys(folio.actividades);
        let sumaPuntaje = 0;
        actividadesKeys.forEach(key => {
            sumaPuntaje += parseFloat(folio.actividades[key].puntuacion || 0);
        });
        const promedio = actividadesKeys.length > 0 ? (sumaPuntaje / actividadesKeys.length).toFixed(1) : "0";

        // 1. Encabezado
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 45, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("HELIOS", 20, 22);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("REPORTE DE FOLIO INDIVIDUAL", 20, 32);

        doc.setFontSize(9);
        doc.setTextColor(200, 200, 200);
        const fechaGen = new Date().toLocaleString();
        doc.text(`Generado: ${fechaGen}`, 140, 38);

        // 2. Sección de info del folio
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 50, 180, 35, 3, 3, 'F');

        doc.setTextColor(110);
        doc.setFontSize(8);
        doc.text("USUARIO", 25, 60);
        doc.text("SUCURSAL", 80, 60);
        doc.text("FECHA", 135, 60);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");

        // Usar nombre en lugar de correo si está en el mapa
        const rawUsuario = folio.usuario || "Desconocido";
        const displayNombre = userMap[rawUsuario.toLowerCase()] || rawUsuario;

        doc.text(displayNombre, 25, 68);
        doc.text(folio.sucursal || "General", 80, 68);
        doc.text(folio.fecha ? folio.fecha.substring(0, 10) : "", 135, 68);

        doc.setTextColor(100);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("ACTIVIDADES EVALUADAS", 25, 78);
        doc.text("PROMEDIO GENERAL", 100, 78);

        doc.setTextColor(59, 130, 246);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(actividadesKeys.length.toString(), 25, 83);
        doc.setTextColor(245, 158, 11);
        doc.text(promedio + " / 10", 100, 83);

        // Implementación de coordenadas en PDF
        const coords = folio.coordenadas || (folio.lat && folio.lng ? `${folio.lat},${folio.lng}` : null);
        if (coords) {
            doc.setTextColor(100);
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text("COORDENADAS (VER MAPA)", 145, 78);

            doc.setTextColor(59, 130, 246);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(coords, 145, 83);

            // Agregar enlace clickeable
            doc.link(145, 79, 40, 6, { url: `https://www.google.com/maps/search/?api=1&query=${coords}` });
        }

        // 3. Sección de actividades con imágenes
        let currentY = 95;
        const pageHeight = doc.internal.pageSize.height || 297;
        const marginBottom = 30;

        for (const key of actividadesKeys) {
            const act = folio.actividades[key];
            const nombre = key.charAt(0).toUpperCase() + key.slice(1);

            // Verificar si necesitamos nueva página
            const neededHeight = 100; // Altura estimada para actividad con imágenes grandes
            if (currentY + neededHeight > pageHeight - marginBottom) {
                doc.addPage();
                currentY = 20;
            }

            // Encabezado de actividad
            doc.setFillColor(59, 130, 246);
            doc.roundedRect(20, currentY, 170, 8, 2, 2, 'F');
            doc.setTextColor(255);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(nombre.toUpperCase(), 25, currentY + 5.5);

            doc.setTextColor(255);
            doc.setFontSize(10);
            doc.text(`Puntaje: ${act.puntuacion || 0} / 10`, 150, currentY + 5.5);

            currentY += 12;

            // Comentario
            doc.setTextColor(80);
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            const comentario = act.comentario || "Sin comentarios";
            const comentarioLines = doc.splitTextToSize(comentario, 165);
            doc.text(comentarioLines, 25, currentY);
            currentY += comentarioLines.length * 5 + 5;

            // Fotos
            if (act.fotos && Array.isArray(act.fotos) && act.fotos.length > 0) {
                doc.setTextColor(100);
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.text("Evidencia fotográfica:", 25, currentY);
                currentY += 5;

                let xPos = 25;
                const imgWidth = 100;
                const imgHeight = 80;

                for (const fotoUrl of act.fotos.slice(0, 3)) { // Máximo 3 fotos por actividad
                    if (xPos + imgWidth > 180) {
                        xPos = 25;
                        currentY += imgHeight + 5;
                    }

                    // Verificar salto de página antes de imagen
                    if (currentY + imgHeight > pageHeight - marginBottom) {
                        doc.addPage();
                        currentY = 20;
                        xPos = 25;
                    }

                    try {
                        const imgData = await loadImageAsBase64(fotoUrl);
                        if (imgData) {
                            doc.addImage(imgData, 'JPEG', xPos, currentY, imgWidth, imgHeight);
                            xPos += imgWidth + 5;
                        }
                    } catch (e) {
                        console.log("Error loading image:", e);
                    }
                }
                currentY += imgHeight + 10;
            } else {
                currentY += 5;
            }

            // Línea separadora
            doc.setDrawColor(226, 232, 240);
            doc.line(20, currentY, 190, currentY);
            currentY += 10;
        }

        // 4. Sección de firmas
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
        doc.setFont("helvetica", "normal");
        doc.text("Firma de Supervisión", 35, currentY + 26);
        doc.text("Sello de Sucursal / Gerencia", 135, currentY + 26);

        // 5. Pie de página en todas las hojas
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("HELIOS - Reporte de Folio Individual", 20, pageHeight - 10);
            doc.text(`Página ${i} de ${totalPages}`, 170, pageHeight - 10);
        }

        // Guardar
        const filename = `Folio_${folio.sucursal || 'General'}_${folio.fecha ? folio.fecha.substring(0, 10) : 'sin_fecha'}.pdf`;
        doc.save(filename);
        showToast("Reporte con imágenes generado correctamente");

    } catch (error) {
        console.error("Error generating PDF:", error);
        showToast("Error al generar el reporte: " + error.message, 'error');
    }
}

function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Extracción manual de datos con limpieza
    const table = document.getElementById("tabla-registros");
    const rows = Array.from(table.querySelectorAll("tbody tr"));

    const cleanData = [];
    let totalPuntos = 0;
    let count = 0;

    rows.forEach(tr => {
        if (tr.cells.length >= 5) {
            // Extraer y limpiar cada celda
            let usuario = tr.cells[0].innerText.trim();
            let sucursal = tr.cells[1].innerText.trim();
            let fecha = tr.cells[2].innerText.trim();
            let actividades = tr.cells[3].innerText.trim();
            let promedio = tr.cells[4].innerText.trim();

            // --- LÓGICA DE LIMPIEZA ---
            // Remover iniciales (ej: "FI ", "US ", "DA ")
            usuario = usuario.replace(/^[A-Z]{2,3}\s+/i, '').trim();

            // Remover texto del icono "location_on"
            sucursal = sucursal.replace(/location_on/gi, '').trim();

            // Agregar al array limpio
            cleanData.push([usuario, sucursal, fecha, actividades, promedio]);

            // Calcular métricas
            const val = parseFloat(promedio);
            if (!isNaN(val)) {
                totalPuntos += val;
                count++;
            }
        }
    });

    const promedio = count > 0 ? (totalPuntos / count).toFixed(1) : "0";

    // 2. Decoración del encabezado
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("HELIOS", 20, 22);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("REPORTE DE CONTROL Y SUPERVISIÓN", 20, 32);

    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    const fechaGen = new Date().toLocaleString();
    doc.text(`Generado: ${fechaGen}`, 140, 32);

    // 3. Resumen ejecutivo
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN EJECUTIVO", 20, 55);

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 57, 190, 57);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const desde = document.getElementById("desde").value || "Inicio";
    const hasta = document.getElementById("hasta").value || "Hoy";
    const sucursalFiltro = document.getElementById("selected-sucursal-text").textContent;

    doc.text(`Periodo: ${desde} - ${hasta}`, 20, 65);
    doc.text(`Sucursal: ${sucursalFiltro}`, 20, 71);

    // Tarjetas de métricas
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(145, 50, 45, 25, 3, 3, 'F');
    doc.roundedRect(95, 50, 45, 25, 3, 3, 'F');

    doc.setTextColor(59, 130, 246);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(promedio, 150, 63);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("PUNTUACIÓN", 150, 68);
    doc.text("PROMEDIO", 150, 71);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(count.toString(), 100, 63);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("TOTAL", 100, 68);
    doc.text("FOLIOS", 100, 71);

    // 4. Tabla de datos usando el array limpio
    doc.autoTable({
        startY: 85,
        theme: 'grid',
        head: [['PERSONAL', 'SUCURSAL', 'FECHA', 'ACTIVIDADES', 'PROMEDIO']],
        body: cleanData,
        headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: { fontSize: 8, textColor: 50 },
        alternateRowStyles: { fillColor: [250, 251, 253] },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 35 },
            2: { halign: 'center', cellWidth: 25 },
            3: { halign: 'center', cellWidth: 30 },
            4: { halign: 'center', fontStyle: 'bold', cellWidth: 20 }
        },
        margin: { top: 85, bottom: 40 },
        didDrawPage: function (data) {
            const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("HELIOS - Sistema de Gestión Profesional", 20, pageHeight - 10);
            doc.text("Página " + doc.internal.getNumberOfPages(), 180, pageHeight - 10);
        }
    });

    // 5. Sección de firmas
    const finalY = doc.lastAutoTable.finalY + 35;
    if (finalY < (doc.internal.pageSize.height - 40)) {
        doc.setDrawColor(200);
        doc.line(20, finalY, 80, finalY);
        doc.line(130, finalY, 190, finalY);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("Firma de Supervisión", 35, finalY + 5);
        doc.text("Sello de Sucursal / Gerencia", 145, finalY + 5);
    }

    doc.save(`Helios_Supervision_${new Date().toISOString().substring(0, 10)}.pdf`);
    showToast("Reporte de Supervisión generado con éxito");
}

document.addEventListener('DOMContentLoaded', () => {
    cargarRegistros();

    // Inicialización de Flatpickr
    const flatpickrConfig = {
        locale: "es",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
        disableMobile: "true",
        allowInput: true
    };

    if (document.getElementById("desde")) flatpickr("#desde", flatpickrConfig);
    if (document.getElementById("hasta")) flatpickr("#hasta", flatpickrConfig);
    if (document.getElementById("form-fecha")) flatpickr("#form-fecha", flatpickrConfig);

    // Cerrar dropdown al hacer clic fuera
    window.addEventListener('click', (e) => {
        const container = document.getElementById('dropdown-sucursal-container');
        const menu = document.getElementById('dropdown-sucursal-menu');
        if (container && menu && !container.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
});
