/**
 * Asistencia (Clock In/Out) Reports System
 * Handles display and filtering of attendance records
 */

let allMarcaciones = [];
let dataTable = null;
let filtroTipo = 'todos';
let filtroUsuario = '';

document.addEventListener('DOMContentLoaded', () => {
    // Set default date filters (last 30 days)
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    document.getElementById('filtro-hasta').value = formatDateForInput(hoy);
    document.getElementById('filtro-desde').value = formatDateForInput(hace30Dias);

    cargarMarcaciones();

    // Global click listener to close dropdowns
    window.addEventListener('click', (e) => {
        ['dropdown-tipo-menu', 'dropdown-usuario-menu'].forEach(id => {
            const menu = document.getElementById(id);
            if (menu && !menu.classList.contains('hidden')) {
                const btn = document.getElementById(id.replace('-menu', '-filtro').replace('dropdown-', 'btn-'));
                if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
                    menu.classList.add('hidden');
                }
            }
        });
    });
});

// Format date for input field
function formatDateForInput(date) {
    return date.toISOString().substring(0, 10);
}

// Format date for display
function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Format time for display
function formatTimeDisplay(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Load all attendance records
function cargarMarcaciones() {
    db.ref("marcas").on("value", snapshot => {
        const data = snapshot.val() || {};

        // Convert to array and sort by date descending
        allMarcaciones = Object.entries(data).map(([id, marca]) => ({
            id,
            ...marca
        })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        poblarUsuarios();
        aplicarFiltros();
    });
}

// Populate users dropdown
function poblarUsuarios() {
    const container = document.getElementById('usuario-options');
    const usuariosUnicos = [...new Set(allMarcaciones.map(m => m.usuario))].sort();

    container.innerHTML = `
        <button type="button" onclick="seleccionarUsuario('', 'Todos los usuarios')"
            class="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            Todos los usuarios
        </button>
    `;

    usuariosUnicos.forEach(usuario => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 truncate';
        btn.textContent = usuario;
        btn.onclick = () => seleccionarUsuario(usuario, usuario);
        container.appendChild(btn);
    });
}

// Toggle dropdown
function toggleDropdown(id) {
    // Close other dropdowns first
    ['dropdown-tipo-menu', 'dropdown-usuario-menu'].forEach(menuId => {
        if (menuId !== id) {
            document.getElementById(menuId)?.classList.add('hidden');
        }
    });

    const menu = document.getElementById(id);
    if (menu) menu.classList.toggle('hidden');
}

// Select type filter
function seleccionarTipo(valor, texto) {
    filtroTipo = valor;
    document.getElementById('selected-tipo-text').textContent = texto;
    document.getElementById('filtro-tipo').value = valor;
    document.getElementById('dropdown-tipo-menu').classList.add('hidden');
}

// Select user filter
function seleccionarUsuario(valor, texto) {
    filtroUsuario = valor;
    document.getElementById('selected-usuario-text').textContent = texto;
    document.getElementById('filtro-usuario').value = valor;
    document.getElementById('dropdown-usuario-menu').classList.add('hidden');
}

// Apply filters and update table
function aplicarFiltros() {
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;

    const hoy = formatDateForInput(new Date());
    let entradasHoy = 0;
    let salidasHoy = 0;
    let usuariosUnicos = new Set();

    // Filter data
    const filteredData = allMarcaciones.filter(marca => {
        const fechaMarca = marca.fecha.substring(0, 10);

        // Date range filter
        if (desde && fechaMarca < desde) return false;
        if (hasta && fechaMarca > hasta) return false;

        // Type filter
        if (filtroTipo !== 'todos' && marca.tipo !== filtroTipo) return false;

        // User filter
        if (filtroUsuario && marca.usuario !== filtroUsuario) return false;

        // Count stats for today (within filtered view)
        if (fechaMarca === hoy) {
            if (marca.tipo === 'entrada') entradasHoy++;
            if (marca.tipo === 'salida') salidasHoy++;
        }

        usuariosUnicos.add(marca.usuario);
        return true;
    });

    // Update stats
    document.getElementById('stat-total').textContent = filteredData.length.toLocaleString();
    document.getElementById('stat-entradas-hoy').textContent = entradasHoy;
    document.getElementById('stat-salidas-hoy').textContent = salidasHoy;
    document.getElementById('stat-usuarios').textContent = usuariosUnicos.size;

    // Update table
    mostrarTabla(filteredData);
}

// Display table with DataTables
function mostrarTabla(data) {
    // Destroy existing DataTable if exists
    if (dataTable) {
        dataTable.destroy();
        dataTable = null;
    }

    const tbody = document.querySelector('#tabla-marcaciones tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center text-slate-400">
                    <span class="material-icons-outlined text-4xl mb-2 block">event_busy</span>
                    No hay marcaciones para mostrar
                </td>
            </tr>
        `;
        return;
    }

    data.forEach(marca => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors';

        const tipoStyle = marca.tipo === 'entrada'
            ? { bg: 'bg-success/10', text: 'text-success', icon: 'login', label: 'Entrada' }
            : { bg: 'bg-warning/10', text: 'text-warning', icon: 'logout', label: 'Salida' };

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <span class="material-icons-outlined text-slate-400">person</span>
                    </div>
                    <div>
                        <p class="font-medium text-slate-800 dark:text-white text-sm">${marca.usuario}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-center">
                <span class="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${tipoStyle.bg} ${tipoStyle.text}">
                    <span class="material-icons-outlined text-sm">${tipoStyle.icon}</span>
                    ${tipoStyle.label}
                </span>
            </td>
            <td class="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-300">
                ${formatDateDisplay(marca.fecha)}
            </td>
            <td class="px-6 py-4 text-center">
                <span class="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-200">
                    ${formatTimeDisplay(marca.fecha)}
                </span>
            </td>
            <td class="px-6 py-4 text-center">
                ${marca.lat && marca.lng ? `
                    <button onclick="verMapa(${marca.lat}, ${marca.lng})" 
                        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-info/10 text-info text-sm font-medium hover:bg-info/20 transition-colors">
                        <span class="material-icons-outlined text-sm">location_on</span> Ver
                    </button>
                ` : `
                    <span class="text-slate-400 text-sm">-</span>
                `}
            </td>
            <td class="px-6 py-4 text-right">
                ${marca.foto ? `
                    <button onclick="verFoto('${marca.foto}')" 
                        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
                        <span class="material-icons-outlined text-sm">photo_camera</span> Ver
                    </button>
                ` : `
                    <span class="text-slate-400 text-sm">Sin foto</span>
                `}
            </td>
        `;

        tbody.appendChild(row);
    });

    // Initialize DataTable
    dataTable = $('#tabla-marcaciones').DataTable({
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.11.5/i18n/es-ES.json'
        },
        order: [[2, 'desc'], [3, 'desc']],
        pageLength: 25,
        responsive: true,
        dom: '<"flex flex-wrap items-center justify-between gap-4 mb-4"<"flex-1"f><"flex items-center gap-2"l>>rtip'
    });
}

// View photo modal
function verFoto(url) {
    document.getElementById('foto-ampliada').src = url;
    const modal = document.getElementById('modal-foto');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModalFoto() {
    const modal = document.getElementById('modal-foto');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// View map modal
function verMapa(lat, lng) {
    const iframe = document.getElementById('mapa-iframe');
    iframe.src = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${lat},${lng}&zoom=17`;

    const modal = document.getElementById('modal-mapa');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModalMapa() {
    const modal = document.getElementById('modal-mapa');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('mapa-iframe').src = '';
}

// Toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const colors = type === 'error'
        ? 'bg-danger text-white'
        : 'bg-slate-900 dark:bg-slate-700 text-white';

    const icon = type === 'error' ? 'error' : 'check_circle';

    toast.className = `${colors} px-5 py-3 rounded-xl shadow-lg flex items-center gap-3`;
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
