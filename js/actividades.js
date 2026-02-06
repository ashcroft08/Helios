/**
 * Actividades Management System
 * Handles CRUD operations with soft delete (active/inactive)
 */

let allActividades = {};
let filtroActual = 'todas';

document.addEventListener('DOMContentLoaded', () => {
    cargarActividades();

    // Form submission
    document.getElementById('form-actividad').addEventListener('submit', guardarActividad);

    // Global click listener to close dropdowns
    window.addEventListener('click', (e) => {
        const menu = document.getElementById('dropdown-estado-menu');
        const btn = document.getElementById('btn-estado-filtro');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
});

// Helper function to capitalize first letter
function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Dropdown Toggle
function toggleDropdown(id) {
    const menu = document.getElementById(id);
    if (menu) menu.classList.toggle('hidden');
}

// Filter selection
function seleccionarFiltro(valor) {
    filtroActual = valor;
    document.getElementById('selected-estado-text').textContent = capitalize(valor);
    document.getElementById('dropdown-estado-menu').classList.add('hidden');
    filtrarActividades();
}

// Load all activities
function cargarActividades() {
    db.ref("actividades").on("value", snapshot => {
        allActividades = snapshot.val() || {};
        filtrarActividades();
    });
}

// Filter and display activities
function filtrarActividades() {
    const busqueda = document.getElementById('buscar-actividad').value.toLowerCase();
    const container = document.getElementById('actividades-container');
    const emptyState = document.getElementById('empty-state');
    container.innerHTML = '';

    // Convert object to array for easier manipulation
    const actividadesArray = Object.entries(allActividades).map(([nombre, activo]) => ({
        nombre,
        activo: activo === true
    }));

    // Sort alphabetically
    actividadesArray.sort((a, b) => a.nombre.localeCompare(b.nombre));

    let count = 0;
    actividadesArray.forEach(actividad => {
        // Apply filters
        if (filtroActual === 'activas' && !actividad.activo) return;
        if (filtroActual === 'inactivas' && actividad.activo) return;
        if (busqueda && !actividad.nombre.toLowerCase().includes(busqueda)) return;

        container.appendChild(crearTarjetaActividad(actividad));
        count++;
    });

    emptyState.classList.toggle('hidden', count > 0);
}

// Create activity card
function crearTarjetaActividad(actividad) {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow';

    const statusColor = actividad.activo
        ? { bg: 'bg-success/10', text: 'text-success', label: 'Activa', icon: 'check_circle' }
        : { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500', label: 'Inactiva', icon: 'cancel' };

    card.innerHTML = `
        <!-- Status Bar -->
        <div class="h-1.5 ${actividad.activo ? 'bg-success/30' : 'bg-slate-200 dark:bg-slate-600'}"></div>
        
        <div class="p-5">
            <!-- Header -->
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl ${actividad.activo ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'} flex items-center justify-center">
                        <span class="material-icons-outlined text-2xl">category</span>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 dark:text-white text-lg">${capitalize(actividad.nombre)}</h4>
                        <span class="px-2 py-0.5 rounded-lg text-xs font-bold ${statusColor.bg} ${statusColor.text} inline-flex items-center gap-1">
                            <span class="material-icons-outlined text-xs">${statusColor.icon}</span>
                            ${statusColor.label}
                        </span>
                    </div>
                </div>
            </div>
            
            <!-- Info -->
            <div class="text-sm text-slate-500 dark:text-slate-400 mb-4">
                <div class="flex items-center gap-2">
                    <span class="material-icons-outlined text-base">label</span>
                    <span>ID: <code class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">${actividad.nombre}</code></span>
                </div>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                ${actividad.activo ? `
                    <button onclick="toggleEstado('${actividad.nombre}', false)" 
                        class="flex-1 py-2 px-3 rounded-lg bg-warning/10 text-warning text-sm font-medium hover:bg-warning/20 transition-colors flex items-center justify-center gap-1">
                        <span class="material-icons-outlined text-sm">visibility_off</span> Desactivar
                    </button>
                ` : `
                    <button onclick="toggleEstado('${actividad.nombre}', true)" 
                        class="flex-1 py-2 px-3 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition-colors flex items-center justify-center gap-1">
                        <span class="material-icons-outlined text-sm">visibility</span> Activar
                    </button>
                `}
                <button onclick="editarActividad('${actividad.nombre}')" 
                    class="py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    <span class="material-icons-outlined text-sm">edit</span>
                </button>
                <button onclick="prepararEliminar('${actividad.nombre}')" 
                    class="py-2 px-3 rounded-lg text-danger hover:bg-danger/10 transition-colors">
                    <span class="material-icons-outlined text-sm">delete</span>
                </button>
            </div>
        </div>
    `;

    return card;
}

// Toggle activity status (soft delete)
function toggleEstado(nombre, nuevoEstado) {
    db.ref(`actividades/${nombre}`).set(nuevoEstado)
        .then(() => {
            showToast(nuevoEstado ? 'Actividad activada' : 'Actividad desactivada');
        })
        .catch(err => showToast('Error: ' + err.message, 'error'));
}

// Open modal for new activity
function openModalActividad() {
    document.getElementById('actividad-id').value = '';
    document.getElementById('actividad-original-name').value = '';
    document.getElementById('form-actividad').reset();
    document.getElementById('modal-actividad-title').textContent = 'Nueva Actividad';
    document.getElementById('btn-submit-text').textContent = 'Crear Actividad';

    showModal('modal-actividad', 'modal-actividad-content');
}

// Edit existing activity
function editarActividad(nombre) {
    document.getElementById('actividad-id').value = nombre;
    document.getElementById('actividad-original-name').value = nombre;
    document.getElementById('actividad-nombre').value = capitalize(nombre);
    document.getElementById('modal-actividad-title').textContent = 'Editar Actividad';
    document.getElementById('btn-submit-text').textContent = 'Guardar Cambios';

    showModal('modal-actividad', 'modal-actividad-content');
}

// Save activity (create or update)
function guardarActividad(e) {
    e.preventDefault();

    const originalName = document.getElementById('actividad-original-name').value;
    const nuevoNombre = document.getElementById('actividad-nombre').value.trim().toLowerCase();

    if (!nuevoNombre) {
        showToast('El nombre es requerido', 'error');
        return;
    }

    // Check for duplicates (only if creating new or changing name)
    if ((!originalName || originalName !== nuevoNombre) && allActividades.hasOwnProperty(nuevoNombre)) {
        showToast('Ya existe una actividad con ese nombre', 'error');
        return;
    }

    if (originalName && originalName !== nuevoNombre) {
        // Renaming: delete old and create new with same status
        const estadoAnterior = allActividades[originalName];
        db.ref(`actividades/${originalName}`).remove()
            .then(() => db.ref(`actividades/${nuevoNombre}`).set(estadoAnterior))
            .then(() => {
                showToast('Actividad actualizada correctamente');
                closeModalActividad();
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    } else if (originalName) {
        // Just editing (name didn't change) - nothing to update since only field is name
        showToast('Actividad sin cambios');
        closeModalActividad();
    } else {
        // Creating new
        db.ref(`actividades/${nuevoNombre}`).set(true)
            .then(() => {
                showToast('Actividad creada correctamente');
                closeModalActividad();
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    }
}

// Prepare delete confirmation
function prepararEliminar(nombre) {
    document.getElementById('actividad-a-eliminar').value = nombre;
    document.getElementById('nombre-eliminar').textContent = capitalize(nombre);
    showModal('modal-confirmar', 'modal-confirmar-content');
}

// Confirm permanent delete
function confirmarEliminar() {
    const nombre = document.getElementById('actividad-a-eliminar').value;

    db.ref(`actividades/${nombre}`).remove()
        .then(() => {
            showToast('Actividad eliminada permanentemente');
            closeModalConfirmar();
        })
        .catch(err => showToast('Error: ' + err.message, 'error'));
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

function closeModalActividad() {
    const modal = document.getElementById('modal-actividad');
    const content = document.getElementById('modal-actividad-content');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

function closeModalConfirmar() {
    const modal = document.getElementById('modal-confirmar');
    const content = document.getElementById('modal-confirmar-content');
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
