/**
 * Sistema de Gestión de Actividades
 * Maneja una estructura jerárquica: Categoría -> Subactividades
 */

let allCategorias = {};
let filtroActual = 'todas';

document.addEventListener('DOMContentLoaded', () => {
    cargarCategorias();

    // Envío de formularios
    document.getElementById('form-actividad').addEventListener('submit', guardarCategoria);
    document.getElementById('form-subactividad').addEventListener('submit', guardarSubactividad);

    // Listener global para cerrar dropdowns
    window.addEventListener('click', (e) => {
        const menu = document.getElementById('dropdown-estado-menu');
        const btn = document.getElementById('btn-estado-filtro');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
});

// Función para capitalizar primera letra
function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Alternar dropdown
function toggleDropdown(id) {
    const menu = document.getElementById(id);
    if (menu) menu.classList.toggle('hidden');
}

// Selección de filtro
function seleccionarFiltro(valor) {
    filtroActual = valor;
    document.getElementById('selected-estado-text').textContent = capitalize(valor);
    document.getElementById('dropdown-estado-menu').classList.add('hidden');
    filtrarCategorias();
}

// Cargar todas las categorías
function cargarCategorias() {
    db.ref("actividades").on("value", snapshot => {
        allCategorias = snapshot.val() || {};
        filtrarCategorias();

        // Si el modal de subactividades está abierto, actualizar su lista
        const subCatId = document.getElementById('sub-cat-id').value;
        if (subCatId && !document.getElementById('modal-subactividad').classList.contains('hidden')) {
            renderizarListaSubactividades(subCatId);
        }
    });
}

// Filtrar y mostrar categorías
function filtrarCategorias() {
    const busqueda = document.getElementById('buscar-actividad').value.toLowerCase();
    const container = document.getElementById('actividades-container');
    const emptyState = document.getElementById('empty-state');
    container.innerHTML = '';

    // Convertir objeto a array para fácil manipulación
    const categoriasArray = Object.entries(allCategorias).map(([nombre, data]) => {
        const esObjeto = typeof data === 'object' && data !== null;
        return {
            id: nombre,
            nombre: nombre,
            activo: esObjeto ? (data.activo !== false) : (data === true),
            subactividades: esObjeto ? data : null
        };
    });

    // Ordenar alfabéticamente
    categoriasArray.sort((a, b) => a.nombre.localeCompare(b.nombre));

    let count = 0;
    categoriasArray.forEach(cat => {
        // Aplicar filtros
        if (filtroActual === 'activas' && !cat.activo) return;
        if (filtroActual === 'inactivas' && cat.activo) return;
        if (busqueda && !cat.nombre.toLowerCase().includes(busqueda)) return;

        container.appendChild(crearTarjetaCategoria(cat));
        count++;
    });

    emptyState.classList.toggle('hidden', count > 0);
}

// Crear tarjeta de categoría
function crearTarjetaCategoria(cat) {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow';

    const statusColor = cat.activo
        ? { bg: 'bg-success/10', text: 'text-success', label: 'Activa', icon: 'check_circle' }
        : { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500', label: 'Inactiva', icon: 'cancel' };

    let numSub = 0;
    if (cat.subactividades) {
        numSub = Object.keys(cat.subactividades).filter(k => k !== 'activo').length;
    }

    card.innerHTML = `
        <div class="h-1.5 ${cat.activo ? 'bg-success/30' : 'bg-slate-200 dark:bg-slate-600'}"></div>
        <div class="p-5">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl ${cat.activo ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'} flex items-center justify-center">
                        <span class="material-icons-outlined text-2xl">category</span>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 dark:text-white text-lg">${capitalize(cat.nombre)}</h4>
                        <div class="flex gap-2 items-center">
                            <span class="px-2 py-0.5 rounded-lg text-xs font-bold ${statusColor.bg} ${statusColor.text} inline-flex items-center gap-1">
                                <span class="material-icons-outlined text-xs">${statusColor.icon}</span>
                                ${statusColor.label}
                            </span>
                            <span class="px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                                ${numSub} Subactividades
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button onclick="gestionarSubactividades('${cat.id}')" 
                    class="w-full py-2.5 px-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                    <span class="material-icons-outlined text-base">list_alt</span> Gestionar Subactividades
                </button>
                <div class="flex gap-2">
                    ${cat.activo ? `
                        <button onclick="toggleEstado('${cat.id}', false)" 
                            class="flex-1 py-2 px-3 rounded-lg bg-warning/10 text-warning text-sm font-medium hover:bg-warning/20 transition-colors flex items-center justify-center gap-1">
                            <span class="material-icons-outlined text-sm">visibility_off</span>
                        </button>
                    ` : `
                        <button onclick="toggleEstado('${cat.id}', true)" 
                            class="flex-1 py-2 px-3 rounded-lg bg-success/10 text-success text-sm font-medium hover:bg-success/20 transition-colors flex items-center justify-center gap-1">
                            <span class="material-icons-outlined text-sm">visibility</span>
                        </button>
                    `}
                    <button onclick="editarCategoria('${cat.id}')" 
                        class="py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        <span class="material-icons-outlined text-sm">edit</span>
                    </button>
                     <button onclick="eliminarCategoria('${cat.id}')" 
                        class="py-2 px-3 rounded-lg text-danger hover:bg-danger/10 transition-colors">
                        <span class="material-icons-outlined text-sm">delete</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    return card;
}

function toggleEstado(id, nuevoEstado) {
    const data = allCategorias[id];
    if (typeof data === 'object') {
        db.ref(`actividades/${id}/activo`).set(nuevoEstado);
    } else {
        db.ref(`actividades/${id}`).set(nuevoEstado);
    }
    showToast(nuevoEstado ? 'Categoría activada' : 'Categoría desactivada');
}

function openModalActividad() {
    document.getElementById('actividad-id').value = '';
    document.getElementById('actividad-original-name').value = '';
    document.getElementById('form-actividad').reset();
    document.getElementById('modal-actividad-title').textContent = 'Nueva Categoría';
    document.getElementById('btn-submit-text').textContent = 'Crear Categoría';
    showModal('modal-actividad', 'modal-actividad-content');
}

function editarCategoria(id) {
    document.getElementById('actividad-id').value = id;
    document.getElementById('actividad-original-name').value = id;
    document.getElementById('actividad-nombre').value = capitalize(id);
    document.getElementById('modal-actividad-title').textContent = 'Editar Categoría';
    document.getElementById('btn-submit-text').textContent = 'Guardar Cambios';
    showModal('modal-actividad', 'modal-actividad-content');
}

function guardarCategoria(e) {
    e.preventDefault();
    const originalName = document.getElementById('actividad-original-name').value;
    const nuevoNombre = document.getElementById('actividad-nombre').value.trim().toLowerCase();
    if (!nuevoNombre) return;
    if ((!originalName || originalName !== nuevoNombre) && allCategorias.hasOwnProperty(nuevoNombre)) {
        showToast('Ya existe una categoría con ese nombre', 'error');
        return;
    }
    if (originalName && originalName !== nuevoNombre) {
        const data = allCategorias[originalName];
        db.ref(`actividades/${originalName}`).remove()
            .then(() => db.ref(`actividades/${nuevoNombre}`).set(data))
            .then(() => {
                showToast('Categoría actualizada');
                closeModalActividad();
            });
    } else if (originalName) {
        closeModalActividad();
    } else {
        db.ref(`actividades/${nuevoNombre}`).set({ activo: true })
            .then(() => {
                showToast('Categoría creada');
                closeModalActividad();
            });
    }
}

function gestionarSubactividades(catId) {
    document.getElementById('sub-cat-id').value = catId;
    document.getElementById('sub-cat-name').textContent = capitalize(catId);
    document.getElementById('form-subactividad').reset();
    renderizarListaSubactividades(catId);
    showModal('modal-subactividad', 'modal-subactividad-content');
}

function renderizarListaSubactividades(catId) {
    const lista = document.getElementById('subactividades-lista');
    lista.innerHTML = '';
    const data = allCategorias[catId];
    if (typeof data !== 'object') return;
    Object.entries(data).forEach(([subId, valor]) => {
        if (subId === 'activo') return;
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl';
        div.innerHTML = `
            <span class="text-sm font-medium dark:text-white">${capitalize(subId)}</span>
            <button onclick="eliminarSubactividad('${catId}', '${subId}')" class="text-danger hover:bg-danger/10 p-1.5 rounded-lg transition-colors">
                <span class="material-icons-outlined text-sm">delete</span>
            </button>
        `;
        lista.appendChild(div);
    });
    if (lista.children.length === 0) {
        lista.innerHTML = '<p class="text-center text-slate-400 text-sm py-4">Sin subactividades</p>';
    }
}

function guardarSubactividad(e) {
    e.preventDefault();
    const catId = document.getElementById('sub-cat-id').value;
    const nombre = document.getElementById('sub-nombre').value.trim().toLowerCase();
    if (!nombre) return;
    db.ref(`actividades/${catId}/${nombre}`).set(true)
        .then(() => {
            document.getElementById('sub-nombre').value = '';
            showToast('Subactividad añadida');
        });
}

async function eliminarSubactividad(catId, subId) {
    const confirmacion = await showConfirm(
        'Eliminar Subactividad',
        `¿Estás seguro de eliminar la subactividad "${capitalize(subId)}"?`,
        'danger'
    );
    if (!confirmacion) return;

    db.ref(`actividades/${catId}/${subId}`).remove()
        .then(() => showToast('Subactividad eliminada', 'success'));
}

async function eliminarCategoria(id) {
    const confirmacion = await showConfirm(
        'Eliminar Categoría',
        `¿Estás seguro de eliminar la categoría "${capitalize(id)}"? Se borrarán también todas sus subactividades.`,
        'danger'
    );
    if (!confirmacion) return;

    db.ref(`actividades/${id}`).remove()
        .then(() => {
            showToast('Categoría eliminada', 'success');
        });
}

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
    content.classList.replace('scale-100', 'scale-95');
    content.classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function closeModalSubactividad() {
    const modal = document.getElementById('modal-subactividad');
    const content = document.getElementById('modal-subactividad-content');
    content.classList.replace('scale-100', 'scale-95');
    content.classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function closeModalConfirmar() {
    const modal = document.getElementById('modal-confirmar');
    const content = document.getElementById('modal-confirmar-content');
    content.classList.replace('scale-100', 'scale-95');
    content.classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

