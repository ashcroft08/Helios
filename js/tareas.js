/**
 * Tareas Management System
 * Handles task assignment, CRUD operations, and filtering
 */

let allTareas = {};
let sucursalesList = [];

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

        // Build sorted list of active users
        const users = [];
        Object.keys(data).forEach(uid => {
            const u = data[uid];
            if (u.activo !== false && u.rol === 'encargado') {
                users.push({ uid, nombre: u.nombre || u.email, rol: u.rol });
            }
        });
        users.sort((a, b) => a.nombre.localeCompare(b.nombre));

        users.forEach(u => {
            const rolLabel = u.rol === 'admin' ? 'Admin' : 'Encargado';
            const option = document.createElement('option');
            option.value = u.nombre;
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
        if (busqueda && !tarea.titulo.toLowerCase().includes(busqueda) &&
            !tarea.asignadoA.toLowerCase().includes(busqueda)) return;

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
                    <span>${tarea.asignadoA}</span>
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
                    <button onclick="verTareaCompletada('${tarea.id}')" class="flex-1 py-2 px-3 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition-colors flex items-center justify-center gap-1">
                        <span class="material-icons-outlined text-sm">visibility</span> Ver evidencia
                    </button>
                ` : `
                    <button onclick="editarTarea('${tarea.id}')" class="flex-1 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-1">
                        <span class="material-icons-outlined text-sm">edit</span> Editar
                    </button>
                `}
                <button onclick="eliminarTarea('${tarea.id}')" class="py-2 px-3 rounded-lg text-danger hover:bg-danger/10 transition-colors">
                    <span class="material-icons-outlined text-sm">delete</span>
                </button>
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
function eliminarTarea(id) {
    if (confirm('¿Estás seguro de eliminar esta tarea?')) {
        db.ref(`tareas/${id}`).remove()
            .then(() => showToast('Tarea eliminada'))
            .catch(err => showToast('Error: ' + err.message, 'error'));
    }
}

// View completed task with evidence
function verTareaCompletada(id) {
    const tarea = allTareas[id];
    if (!tarea) return;

    // Handle both single URL (fotoCumplimiento) and array (fotos) formats
    let fotosHtml = '';
    const fotoUrl = tarea.fotoCumplimiento || (tarea.completada?.fotos?.[0]);
    if (fotoUrl) {
        fotosHtml = `
            <div class="mt-4">
                <p class="text-xs font-bold text-slate-500 uppercase mb-2">Evidencia Fotográfica</p>
                <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <img src="${fotoUrl}" alt="Evidencia" class="w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity" onclick="window.open('${fotoUrl}', '_blank')">
                </div>
            </div>
        `;
    }

    // Handle date: fechaCumplido or completada.fecha
    const fechaCompletado = tarea.fechaCumplido || tarea.completada?.fecha;
    const fechaFormateada = fechaCompletado ? new Date(fechaCompletado).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';

    const content = document.getElementById('modal-ver-content');
    content.innerHTML = `
        <div class="p-6 border-b border-slate-200 dark:border-slate-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
                        <span class="material-icons-outlined">task_alt</span>
                    </div>
                    <h3 class="text-lg font-bold text-slate-800 dark:text-white">Tarea Completada</h3>
                </div>
                <button onclick="closeModalVer()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                    <span class="material-icons-outlined text-slate-400">close</span>
                </button>
            </div>
        </div>
        <div class="p-6 overflow-y-auto max-h-[70vh]">
            <h4 class="font-bold text-slate-800 dark:text-white text-lg mb-2">${tarea.titulo}</h4>
            ${tarea.descripcion ? `<p class="text-sm text-slate-500 dark:text-slate-400 mb-4">${tarea.descripcion}</p>` : ''}
            
            <div class="space-y-3 text-sm">
                <div class="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <span class="material-icons-outlined text-base">person</span>
                    <span>Asignado a: <strong>${tarea.asignadoA}</strong></span>
                </div>
                <div class="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <span class="material-icons-outlined text-base">location_on</span>
                    <span>${tarea.sucursal}</span>
                </div>
                <div class="flex items-center gap-2 text-success">
                    <span class="material-icons-outlined text-base">check_circle</span>
                    <span>Completada: <strong>${fechaFormateada}</strong></span>
                </div>
            </div>
            
            ${fotosHtml}
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

// Toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const colors = type === 'error'
        ? 'bg-danger text-white'
        : 'bg-slate-900 dark:bg-slate-700 text-white';

    const icon = type === 'error' ? 'error' : 'check_circle';

    toast.className = `${colors} px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up`;
    toast.innerHTML = `
        <span class="material-icons-outlined text-lg">${icon}</span>
        <span class="font-medium">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
