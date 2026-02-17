/**
 * Tareas Management System
 * Handles task assignment, CRUD operations, and filtering
 */

let allTareas = {};
let sucursalesList = [];
let usuariosCache = {}; // Global cache for mapping email/uid to name

document.addEventListener('DOMContentLoaded', () => {
    cargarTareas();
    cargarSucursales();
    cargarEncargados();
    initFlatpickr();

    // Form submission
    document.getElementById('form-tarea').addEventListener('submit', guardarTarea);

    // Global click listener to close dropdowns
    window.addEventListener('click', (e) => {
        const dropdownIds = ['dropdown-estado-menu', 'dropdown-prioridad-menu', 'dropdown-sucursal-menu'];
        dropdownIds.forEach(id => {
            const menu = document.getElementById(id);
            const btnId = id.replace('menu', 'filtro');
            const btn = document.getElementById(btnId);
            if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });
    });
});

// Dropdown Toggle
function toggleDropdown(id) {
    const menu = document.getElementById(id);
    if (!menu) return;

    // Close others
    const allMenus = ['dropdown-estado-menu', 'dropdown-prioridad-menu', 'dropdown-sucursal-menu'];
    allMenus.forEach(mId => {
        if (mId !== id) document.getElementById(mId)?.classList.add('hidden');
    });

    menu.classList.toggle('hidden');
}

// Selector de valor de filtro con feedback visual
function seleccionarFiltro(tipo, valor, etiqueta) {
    const hiddenInput = document.getElementById(`filtro-${tipo}`);
    hiddenInput.value = valor;

    // Actualizar texto del botón
    document.getElementById(`selected-${tipo}-text`).textContent = etiqueta;

    // Actualizar estados visuales en el menú
    const menuId = `dropdown-${tipo}-menu`;
    const menu = document.getElementById(menuId);
    if (menu) {
        const buttons = menu.querySelectorAll('button');
        buttons.forEach(btn => {
            const isSelected = btn.getAttribute('onclick').includes(`'${valor}'`);
            btn.className = `w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${isSelected ? 'text-primary font-semibold bg-blue-50/50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300'}`;

            // Eliminar check previo si existe
            const existingCheck = btn.querySelector('.check-icon');
            if (existingCheck) existingCheck.remove();

            // Agregar check si está seleccionado
            if (isSelected) {
                const check = document.createElement('span');
                check.className = 'material-icons-outlined text-sm check-icon';
                check.textContent = 'check';
                btn.appendChild(check);
            }
        });
        menu.classList.add('hidden');
    }

    filtrarTareas();
}

// Initialize date picker
function initFlatpickr() {
    flatpickr("#tarea-fecha", {
        locale: "es",
        dateFormat: "Y-m-d",
        minDate: "today",
        disableMobile: true
    });
}

// Load sucursales from ubicaciones collection
function cargarSucursales() {
    // Helper function to capitalize first letter
    function capitalize(str) {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    db.ref("ubicaciones").once("value").then(snapshot => {
        const data = snapshot.val();
        if (!data) return;

        if (typeof data === 'object' && !Array.isArray(data)) {
            sucursalesList = Object.keys(data).sort();
        } else if (Array.isArray(data)) {
            sucursalesList = data.filter(Boolean).sort();
        }

        const sucursalOptions = document.getElementById('sucursal-options');
        const formSelect = document.getElementById('tarea-sucursal');

        if (sucursalOptions) {
            sucursalOptions.innerHTML = "";

            // Add "Todas" option
            const btnTodas = document.createElement('button');
            btnTodas.type = 'button';
            btnTodas.className = 'w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between text-primary font-semibold bg-blue-50/50 dark:bg-blue-900/20';
            btnTodas.innerHTML = `<span>Todas las sucursales</span><span class="material-icons-outlined text-sm check-icon">check</span>`;
            btnTodas.setAttribute('onclick', "seleccionarFiltro('sucursal', '', 'Todas las sucursales')");
            sucursalOptions.appendChild(btnTodas);

            sucursalesList.forEach(suc => {
                const btn = document.createElement('button');
                const displayName = capitalize(suc);
                btn.type = 'button';
                btn.className = 'w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between text-slate-600 dark:text-slate-300';
                btn.innerHTML = `<span>${displayName}</span>`;
                btn.setAttribute('onclick', `seleccionarFiltro('sucursal', '${suc}', '${displayName}')`);
                sucursalOptions.appendChild(btn);
            });
        }

        if (formSelect) {
            formSelect.innerHTML = '<option value="">Seleccionar</option>';
            formSelect.innerHTML += '<option value="TODAS">Todas las sucursales</option>';
            sucursalesList.forEach(suc => {
                formSelect.innerHTML += `<option value="${suc}">${capitalize(suc)}</option>`;
            });
        }
    });
}

// Load users for assignment dropdown
function cargarEncargados() {
    db.ref('usuarios').on('value', (snapshot) => {
        const data = snapshot.val();
        const select = document.getElementById('tarea-asignado');
        if (!select || !data) return;

        // Preserve current selection
        const currentVal = select.value;

        // Clear options except the placeholder
        select.innerHTML = '<option value="">Seleccionar encargado</option>';

        // Build sorted list of active users and populate cache
        usuariosCache = {};
        const users = [];
        Object.keys(data).forEach(uid => {
            const u = data[uid];
            if (u.activo !== false && u.rol === 'encargado') {
                const name = u.nombre || u.email;
                const email = u.email;
                users.push({ uid, nombre: name, email: email, rol: u.rol });

                // Map both email and uid to name for safety
                if (email) usuariosCache[email.toLowerCase()] = name;
                usuariosCache[uid] = name;
            }
        });
        users.sort((a, b) => a.nombre.localeCompare(b.nombre));

        users.forEach(u => {
            const rolLabel = u.rol === 'admin' ? 'Admin' : 'Supervisor/a';
            const option = document.createElement('option');
            // Use email as the value for unique identification
            option.value = u.email || u.uid;
            option.textContent = `${u.nombre} (${rolLabel})`;
            select.appendChild(option);
        });

        // Restore selection
        if (currentVal) select.value = currentVal;
    });
}

// Load all tasks
function cargarTareas() {
    db.ref("tareas").on("value", snapshot => {
        allTareas = snapshot.val() || {};
        checkVencidas();
        filtrarTareas();
    });
}

// Check and update expired tasks
function checkVencidas() {
    const hoy = new Date().toISOString().substring(0, 10);

    Object.keys(allTareas).forEach(id => {
        const tarea = allTareas[id];
        if (tarea.estado === 'pendiente' && tarea.fechaLimite < hoy) {
            db.ref(`tareas/${id}/estado`).set('vencida');
        }
    });
}

// Filter and display tasks
function filtrarTareas() {
    const estadoFiltro = document.getElementById('filtro-estado').value;
    const prioridadFiltro = document.getElementById('filtro-prioridad').value;
    const sucursalFiltro = document.getElementById('filtro-sucursal').value;
    const busqueda = document.getElementById('buscar-tarea').value.toLowerCase();

    const container = document.getElementById('tareas-container');
    const emptyState = document.getElementById('empty-state');
    container.innerHTML = '';

    const tareasArray = Object.entries(allTareas).map(([id, tarea]) => ({ id, ...tarea }));

    // Sort by priority (alta first) and then by date
    const prioridadOrden = { 'alta': 0, 'media': 1, 'baja': 2 };
    tareasArray.sort((a, b) => {
        if (prioridadOrden[a.prioridad] !== prioridadOrden[b.prioridad]) {
            return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
        }
        return new Date(a.fechaLimite) - new Date(b.fechaLimite);
    });

    let count = 0;
    tareasArray.forEach(tarea => {
        // Apply filters
        if (estadoFiltro && tarea.estado !== estadoFiltro) return;
        if (prioridadFiltro && tarea.prioridad !== prioridadFiltro) return;
        if (sucursalFiltro && tarea.sucursal?.toLowerCase() !== sucursalFiltro.toLowerCase()) return;

        // ROLE FILTER: If not admin, only show assigned tasks
        // Comparison by e-mail (new) or name (legacy)
        const userEmail = window.__heliosUser?.email?.toLowerCase();
        const userName = window.__heliosUser?.nombre?.toLowerCase();
        const assignedTo = tarea.asignadoA?.toLowerCase();

        if (window.__heliosUser?.rol !== 'admin' && assignedTo !== userEmail && assignedTo !== userName) {
            return;
        }

        if (busqueda && !tarea.titulo.toLowerCase().includes(busqueda) &&
            !(usuariosCache[assignedTo] || assignedTo).toLowerCase().includes(busqueda)) return;

        container.appendChild(crearTarjetaTarea(tarea));
        count++;
    });

    emptyState.classList.toggle('hidden', count > 0);
}

// Create task card
function crearTarjetaTarea(tarea) {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow';

    // Priority colors
    const prioridadColores = {
        'alta': { bg: 'bg-danger/10', text: 'text-danger', dot: '🔴' },
        'media': { bg: 'bg-warning/10', text: 'text-warning', dot: '🟡' },
        'baja': { bg: 'bg-success/10', text: 'text-success', dot: '🟢' }
    };

    // Status badges
    const estadoBadges = {
        'pendiente': { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', label: 'Pendiente' },
        'en_progreso': { bg: 'bg-info/10', text: 'text-info', label: 'En Progreso' },
        'completado': { bg: 'bg-success/10', text: 'text-success', label: 'Completado' },
        'vencida': { bg: 'bg-danger/10', text: 'text-danger', label: 'Vencida' }
    };

    const prio = prioridadColores[tarea.prioridad] || prioridadColores.media;
    const estado = estadoBadges[tarea.estado] || estadoBadges.pendiente;

    // Calculate days remaining
    const hoy = new Date();
    const fechaLimite = new Date(tarea.fechaLimite);
    const diffDias = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
    let fechaTexto = '';
    if (diffDias < 0) {
        fechaTexto = `<span class="text-danger font-medium">Venció hace ${Math.abs(diffDias)} día(s)</span>`;
    } else if (diffDias === 0) {
        fechaTexto = `<span class="text-warning font-medium">Vence hoy</span>`;
    } else if (diffDias === 1) {
        fechaTexto = `<span class="text-warning font-medium">Vence mañana</span>`;
    } else {
        fechaTexto = `<span class="text-slate-500">Vence en ${diffDias} días</span>`;
    }

    card.innerHTML = `
        <!-- Priority Bar -->
        <div class="h-1.5 ${prio.bg}"></div>
        
        <div class="p-5">
            <!-- Header -->
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm">${prio.dot}</span>
                        <span class="px-2 py-0.5 rounded-lg text-xs font-bold uppercase ${estado.bg} ${estado.text}">${estado.label}</span>
                    </div>
                    <h4 class="font-bold text-slate-800 dark:text-white line-clamp-2">${tarea.titulo}</h4>
                </div>
            </div>
            
            <!-- Info -->
            <div class="space-y-2 text-sm mb-4">
                <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <span class="material-icons-outlined text-base">person</span>
                    <span>${usuariosCache[tarea.asignadoA?.toLowerCase()] || tarea.asignadoA}</span>
                </div>
                <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <span class="material-icons-outlined text-base">location_on</span>
                    <span>${tarea.sucursal}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="material-icons-outlined text-base text-slate-400">schedule</span>
                    ${fechaTexto}
                </div>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                ${tarea.estado === 'completado' ? `
                    <button onclick="verDetallesTarea('${tarea.id}')" class="flex-1 py-2 px-3 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition-colors flex items-center justify-center gap-1">
                        <span class="material-icons-outlined text-sm">visibility</span> Ver evidencia
                    </button>
                ` : window.__heliosUser?.rol === 'admin' ? `
                     <button onclick="verDetallesTarea('${tarea.id}')" class="flex-1 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-1" title="Ver detalles">
                        <span class="material-icons-outlined text-sm">visibility</span> Ver
                    </button>
                    <button onclick="completarTareaRapido('${tarea.id}')" class="flex-1 py-2 px-3 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition-colors flex items-center justify-center gap-1" title="Completado rápido">
                        <span class="material-icons-outlined text-sm">check_circle</span> Completar
                    </button>
                    <button onclick="editarTarea('${tarea.id}')" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Editar tarea">
                        <span class="material-icons-outlined text-sm">edit</span>
                    </button>
                ` : `
                    <button onclick="abrirModalCompletar('${tarea.id}')" class="flex-1 py-2 px-3 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors flex items-center justify-center gap-1">
                        <span class="material-icons-outlined text-sm">check_circle</span> Completar
                    </button>
                `}
                
                ${window.__heliosUser?.rol === 'admin' ? `
                <button onclick="eliminarTarea('${tarea.id}')" class="p-2 rounded-lg text-danger hover:bg-danger/10 transition-colors" title="Eliminar">
                    <span class="material-icons-outlined text-sm">delete</span>
                </button>
                ` : ''}
            </div>
        </div>
    `;

    return card;
}

// Open modal for new task
function openModalTarea() {
    document.getElementById('tarea-id').value = '';
    document.getElementById('form-tarea').reset();
    document.getElementById('modal-tarea-title').textContent = 'Nueva Tarea';
    document.getElementById('btn-submit-text').textContent = 'Crear Tarea';

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('tarea-fecha').value = tomorrow.toISOString().substring(0, 10);

    // Reset priority to media
    document.querySelector('input[name="prioridad"][value="media"]').checked = true;

    showModal('modal-tarea', 'modal-tarea-content');
}

// Edit existing task
function editarTarea(id) {
    const tarea = allTareas[id];
    if (!tarea) return;

    document.getElementById('tarea-id').value = id;
    document.getElementById('tarea-titulo').value = tarea.titulo;
    document.getElementById('tarea-descripcion').value = tarea.descripcion || '';
    document.getElementById('tarea-asignado').value = tarea.asignadoA;
    document.getElementById('tarea-sucursal').value = tarea.sucursal;
    document.getElementById('tarea-fecha').value = tarea.fechaLimite;

    const prioridadInput = document.querySelector(`input[name="prioridad"][value="${tarea.prioridad}"]`);
    if (prioridadInput) prioridadInput.checked = true;

    document.getElementById('modal-tarea-title').textContent = 'Editar Tarea';
    document.getElementById('btn-submit-text').textContent = 'Guardar Cambios';

    showModal('modal-tarea', 'modal-tarea-content');
}

// Save task (create or update)
function guardarTarea(e) {
    e.preventDefault();

    const id = document.getElementById('tarea-id').value;
    const tareaData = {
        titulo: document.getElementById('tarea-titulo').value.trim(),
        descripcion: document.getElementById('tarea-descripcion').value.trim(),
        asignadoA: document.getElementById('tarea-asignado').value.trim(),
        sucursal: document.getElementById('tarea-sucursal').value,
        fechaLimite: document.getElementById('tarea-fecha').value,
        prioridad: document.querySelector('input[name="prioridad"]:checked').value,
        estado: 'pendiente'
    };

    if (id) {
        // Update - preserve existing estado if not pendiente
        const existingEstado = allTareas[id]?.estado;
        if (existingEstado && existingEstado !== 'pendiente') {
            tareaData.estado = existingEstado;
        }
        // Preserve completion data
        if (allTareas[id]?.completada) {
            tareaData.completada = allTareas[id].completada;
        }

        db.ref(`tareas/${id}`).update(tareaData)
            .then(() => {
                showToast('Tarea actualizada correctamente');
                closeModalTarea();
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    } else {
        // Create new
        if (tareaData.sucursal === 'TODAS') {
            const promises = sucursalesList.map(suc => {
                const multiTareaData = { ...tareaData, sucursal: suc };
                multiTareaData.fechaCreacion = new Date().toISOString();
                multiTareaData.asignadoPor = window.__heliosUser?.nombre || 'Admin';
                return db.ref('tareas').push(multiTareaData);
            });

            Promise.all(promises)
                .then(() => {
                    showToast(`Se han creado ${promises.length} tareas correctamente`);
                    closeModalTarea();
                })
                .catch(err => showToast('Error: ' + err.message, 'error'));
            return;
        }

        tareaData.fechaCreacion = new Date().toISOString();
        tareaData.asignadoPor = window.__heliosUser?.nombre || 'Admin';

        db.ref('tareas').push(tareaData)
            .then(() => {
                showToast('Tarea creada correctamente');
                closeModalTarea();
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    }
}

// Delete task
async function eliminarTarea(id) {
    const confirmacion = await showConfirm(
        'Eliminar Tarea',
        '¿Estás seguro de eliminar esta tarea? Esta acción no se puede deshacer.',
        'danger'
    );
    if (!confirmacion) return;
    db.ref(`tareas/${id}`).remove()
        .then(() => showToast('Tarea eliminada'))
        .catch(err => showToast('Error: ' + err.message, 'error'));
}

// View task details (works for all states)
function verDetallesTarea(id) {
    const tarea = allTareas[id];
    if (!tarea) return;

    const isCompletada = tarea.estado === 'completado';

    // Handle photos
    let fotosHtml = '';
    const fotoUrl = tarea.fotoCumplimiento || (tarea.completada?.fotos?.[0]);
    if (fotoUrl) {
        fotosHtml = `
            <div class="mt-4">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Evidencia Fotográfica</p>
                <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src="${fotoUrl}" alt="Evidencia" class="w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" onclick="window.open('${fotoUrl}', '_blank')">
                </div>
            </div>
        `;
    }

    // Handle completion date
    const fechaCompletado = tarea.fechaCumplido || tarea.completada?.fecha;
    const fechaFormateada = fechaCompletado ? new Date(fechaCompletado).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';

    // Status colors
    const estadoLabels = {
        'pendiente': 'Pendiente',
        'en_progreso': 'En Progreso',
        'completado': 'Completada',
        'vencida': 'Vencida'
    };
    const estadoColors = {
        'pendiente': 'text-slate-500 bg-slate-100 dark:bg-slate-700',
        'en_progreso': 'text-info bg-info/10',
        'completado': 'text-success bg-success/10',
        'vencida': 'text-danger bg-danger/10'
    };

    // Format description to handle dashes as line breaks
    const formatDescription = (text) => {
        if (!text) return "Sin descripción adicional.";
        // Replace " -" or "-" with "<br>-" for better list visibility
        // but avoid breaking words like "anti-gravity" (though less common in this context)
        // A simple approach is replacing " -" with "\n-"
        return text.replace(/(\s-|-)/g, '\n-').trim();
    };

    const content = document.getElementById('modal-ver-content');
    content.innerHTML = `
        <div class="p-6 border-b border-slate-200 dark:border-slate-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl ${isCompletada ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'} flex items-center justify-center">
                        <span class="material-icons-outlined">${isCompletada ? 'task_alt' : 'info'}</span>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-slate-800 dark:text-white">Detalles de la Tarea</h3>
                        <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${estadoColors[tarea.estado]}">${estadoLabels[tarea.estado]}</span>
                    </div>
                </div>
                <button onclick="closeModalVer()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                    <span class="material-icons-outlined text-slate-400">close</span>
                </button>
            </div>
        </div>
        <div class="p-6 overflow-y-auto max-h-[70vh]">
            <h4 class="font-bold text-slate-800 dark:text-white text-lg mb-2">${tarea.titulo}</h4>
            <div class="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 mb-6">
                <p class="text-sm text-slate-600 dark:text-slate-400 italic whitespace-pre-line">${formatDescription(tarea.descripcion)}</p>
            </div>
            
            <div class="space-y-4 text-sm">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Asignado a</p>
                        <div class="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                            <span class="material-icons-outlined text-base">person</span>
                            <span>${tarea.asignadoA}</span>
                        </div>
                    </div>
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sucursal</p>
                        <div class="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                            <span class="material-icons-outlined text-base">location_on</span>
                            <span>${tarea.sucursal}</span>
                        </div>
                    </div>
                </div>

                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha Límite</p>
                    <div class="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                        <span class="material-icons-outlined text-base">calendar_today</span>
                        <span>${new Date(tarea.fechaLimite).toLocaleDateString('es', { dateStyle: 'long' })}</span>
                    </div>
                </div>

                ${isCompletada ? `
                <div class="pt-4 border-t border-slate-100 dark:border-slate-700">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Información de Cumplimiento</p>
                    <div class="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/20">
                        <div class="flex items-center gap-2 text-success font-bold mb-2 text-xs">
                            <span class="material-icons-outlined text-sm">check_circle</span>
                            <span>Completada el ${fechaFormateada}</span>
                        </div>
                        <p class="text-sm text-slate-600 dark:text-slate-300">
                            <strong>Comentario:</strong><br>
                            ${tarea.completada?.comentario || tarea.comentario || "Sin comentario."}
                        </p>
                        ${tarea.completada?.completadoPor ? `<p class="text-[10px] text-slate-500 mt-2">Finalizada por: ${tarea.completada.completadoPor}</p>` : ''}
                        ${fotosHtml}
                    </div>
                </div>
                ` : ''}
                
                <div class="pt-6 flex gap-3">
                    <button onclick="exportarPDFTarea('${id}')" class="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                        <span class="material-icons-outlined">picture_as_pdf</span>
                        Exportar reporte PDF
                    </button>
                </div>
            </div>
        </div>
    `;

    showModal('modal-ver-tarea', 'modal-ver-content');
}

// Modal helpers
function showModal(modalId, contentId) {
    const modal = document.getElementById(modalId);
    const content = document.getElementById(contentId);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeModalTarea() {
    const modal = document.getElementById('modal-tarea');
    const content = document.getElementById('modal-tarea-content');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

function closeModalVer() {
    const modal = document.getElementById('modal-ver-tarea');
    const content = document.getElementById('modal-ver-content');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

// Task Completion for Encargados
function abrirModalCompletar(id) {
    const tarea = allTareas[id];
    if (!tarea) return;

    const modal = document.getElementById('modal-completar-tarea');
    if (!modal) {
        // Create modal if it doesn't exist
        const modalHtml = `
            <div id="modal-completar-tarea" class="fixed inset-0 bg-black/60 backdrop-blur-sm hidden items-center justify-center z-[110] p-4">
                <div id="modal-completar-content" class="bg-white dark:bg-card-dark rounded-3xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 opacity-0">
                    <div class="p-6 border-b border-slate-200 dark:border-slate-700">
                        <h3 class="text-xl font-bold text-slate-800 dark:text-white">Completar Tarea</h3>
                    </div>
                    <form id="form-completar-tarea" class="p-6 space-y-4">
                        <input type="hidden" id="completar-tarea-id">
                        <div>
                            <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Comentario / Evidencia *</label>
                            <textarea id="completar-comentario" required rows="3" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary resize-none" placeholder="Describe brevemente lo realizado..."></textarea>
                        </div>
                        <div>
                            <label class="text-xs font-bold text-slate-500 uppercase mb-2 block">Foto de Evidencia (Opcional)</label>
                            <div class="space-y-3">
                                <input type="file" id="completar-foto" accept="image/*" onchange="handlePreview(this)" class="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20">
                                <div id="foto-preview-container" class="hidden relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-video bg-slate-50 dark:bg-slate-900">
                                    <img id="img-preview" class="w-full h-full object-cover">
                                    <button type="button" onclick="removePhoto()" class="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors">
                                        <span class="material-icons-outlined text-sm">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-3 pt-2">
                            <button type="button" onclick="cerrarModalCompletar()" class="flex-1 py-3 rounded-xl font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 transitioning">Cancelar</button>
                            <button type="submit" id="btn-finalizar-tarea" class="flex-1 py-3 rounded-xl font-semibold bg-success text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transitioning">
                                <span class="material-icons-outlined text-lg">check_circle</span>
                                <span>Finalizar</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('form-completar-tarea').addEventListener('submit', guardarCumplimiento);
    }

    document.getElementById('completar-tarea-id').value = id;
    showModal('modal-completar-tarea', 'modal-completar-content');
}

function cerrarModalCompletar() {
    const modal = document.getElementById('modal-completar-tarea');
    const content = document.getElementById('modal-completar-content');
    if (!modal || !content) return;

    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        // Clear form
        document.getElementById('form-completar-tarea').reset();
        document.getElementById('foto-preview-container').classList.add('hidden');
    }, 200);
}

// Preview handles
function handlePreview(input) {
    const container = document.getElementById('foto-preview-container');
    const img = document.getElementById('img-preview');
    const file = input.files[0];

    if (file) {
        img.src = URL.createObjectURL(file);
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

function removePhoto() {
    const input = document.getElementById('completar-foto');
    const container = document.getElementById('foto-preview-container');
    input.value = '';
    container.classList.add('hidden');
}

/**
 * Image compression utility using Canvas
 */
async function compressImage(file, maxWidth = 1200, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
        };
    });
}

async function guardarCumplimiento(e) {
    e.preventDefault();
    const id = document.getElementById('completar-tarea-id').value;
    const comentario = document.getElementById('completar-comentario').value.trim();
    const file = document.getElementById('completar-foto').files[0];
    const btn = document.getElementById('btn-finalizar-tarea');
    const originalContent = btn.innerHTML;

    if (!id || !comentario) return;

    try {
        btn.disabled = true;
        btn.innerHTML = `<div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> <span>Subiendo evidencia...</span>`;

        let fotoUrl = null;
        if (file) {
            // Compress image to speed up upload
            const compressedBlob = await compressImage(file);
            const ref = storage.ref(`evidencia_tareas/${id}/${Date.now()}.jpg`);
            const snap = await ref.put(compressedBlob, { contentType: 'image/jpeg' });
            fotoUrl = await snap.ref.getDownloadURL();
        }

        const data = {
            estado: 'completado',
            fechaCumplido: new Date().toISOString(),
            completada: {
                comentario: comentario,
                fecha: new Date().toISOString(),
                fotos: fotoUrl ? [fotoUrl] : []
            }
        };

        await db.ref(`tareas/${id}`).update(data);
        showToast('¡Tarea completada con éxito!');
        cerrarModalCompletar();
    } catch (err) {
        console.error("Task completion error:", err);
        showToast('Error al guardar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}


// Utility: Load image and convert to base64 for PDF
function loadImageAsBase64(url) {
    return new Promise((resolve) => {
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
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

// Export individual task to PDF
async function exportarPDFTarea(id) {
    const tarea = allTareas[id];
    if (!tarea) return;

    showToast("Generando reporte PDF...");

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // 1. Header
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("HELIOS", 20, 22);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("REPORTE DE TAREA INDIVIDUAL", 20, 32);

        doc.setFontSize(9);
        doc.setTextColor(200, 200, 200);
        doc.text(`Generado: ${new Date().toLocaleString()}`, 140, 32);

        // 2. Task Basic Info
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(15, 50, 180, 45, 3, 3, 'F');

        doc.setTextColor(110);
        doc.setFontSize(8);
        doc.text("TÍTULO DE LA TAREA", 25, 60);
        doc.text("ASIGNADO A", 25, 80);
        doc.text("SUCURSAL", 100, 80);
        doc.text("ESTADO", 155, 80);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(tarea.titulo.toUpperCase(), 25, 68);

        doc.setFontSize(10);
        doc.text(tarea.asignadoA, 25, 88);
        doc.text(tarea.sucursal, 100, 88);

        const estadoLabels = { 'pendiente': 'PENDIENTE', 'en_progreso': 'EN PROGRESO', 'completado': 'COMPLETADA', 'vencida': 'VENCIDA' };
        doc.text(estadoLabels[tarea.estado] || tarea.estado.toUpperCase(), 155, 88);

        // 3. Detail Sections
        let currentY = 105;

        // Description
        doc.setFillColor(30, 41, 59);
        doc.roundedRect(20, currentY, 170, 8, 2, 2, 'F');
        doc.setTextColor(255);
        doc.setFontSize(9);
        doc.text("DESCRIPCIÓN / REQUERIMIENTOS", 25, currentY + 5.5);
        currentY += 15;

        doc.setTextColor(60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const desc = tarea.descripcion || "Sin descripción adicional.";
        // Format with breaks like in the UI
        const formattedDesc = desc.replace(/(\s-|-)/g, '\n-').trim();
        const descLines = doc.splitTextToSize(formattedDesc, 160);
        doc.text(descLines, 25, currentY);
        currentY += descLines.length * 5 + 10;

        // Completion Info (if done)
        if (tarea.estado === 'completado') {
            doc.setFillColor(16, 185, 129); // Success color
            doc.roundedRect(20, currentY, 170, 8, 2, 2, 'F');
            doc.setTextColor(255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("INFORMACIÓN DE CUMPLIMIENTO", 25, currentY + 5.5);
            currentY += 15;

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            const fechaComp = tarea.fechaCumplido || tarea.completada?.fecha;
            doc.text(`Fecha de finalización: ${new Date(fechaComp).toLocaleString()}`, 25, currentY);
            if (tarea.completada?.completadoPor) {
                doc.text(`Finalizada por: ${tarea.completada.completadoPor}`, 120, currentY);
            }
            currentY += 8;

            doc.setTextColor(80);
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            const comentario = tarea.completada?.comentario || tarea.comentario || "Sin comentarios.";
            const commentLines = doc.splitTextToSize(comentario, 160);
            doc.text(commentLines, 25, currentY);
            currentY += commentLines.length * 5 + 10;

            // Photos
            const fotoUrl = tarea.fotoCumplimiento || (tarea.completada?.fotos?.[0]);
            if (fotoUrl) {
                if (currentY + 80 > 270) {
                    doc.addPage();
                    currentY = 20;
                }
                doc.setTextColor(100);
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.text("Evidencia fotográfica:", 25, currentY);
                currentY += 5;

                const imgData = await loadImageAsBase64(fotoUrl);
                if (imgData) {
                    doc.addImage(imgData, 'JPEG', 25, currentY, 100, 75);
                    currentY += 85;
                }
            }
        }

        // 4. Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`HELIOS - Gestión de Tareas | Página ${i} de ${pageCount}`, 20, 285);
        }

        doc.save(`Tarea_${tarea.sucursal}_${tarea.titulo.substring(0, 15).replace(/\s/g, '_')}.pdf`);
        showToast("PDF generado con éxito");

    } catch (error) {
        console.error("PDF generation error:", error);
        showToast("Error al generar PDF: " + error.message, 'error');
    }
}

async function completarTareaRapido(id) {
    const confirmacion = await showConfirm(
        'Completar Tarea',
        '¿Deseas marcar esta tarea como completada instantáneamente?',
        'success'
    );
    if (!confirmacion) return;

    try {
        const data = {
            estado: 'completado',
            fechaCumplido: new Date().toISOString(),
            completada: {
                comentario: "Completada por el administrador (Rápido)",
                fecha: new Date().toISOString(),
                completadoPor: window.__heliosUser?.nombre || 'Admin',
                fotos: []
            }
        };

        await db.ref(`tareas/${id}`).update(data);
        showToast('Tarea completada con éxito');
    } catch (err) {
        console.error("Quick completion error:", err);
        showToast('Error: ' + err.message, 'error');
    }
}
