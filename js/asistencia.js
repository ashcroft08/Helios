/**
 * Sistema de Control de Asistencia (Entradas/Salidas)
 * Maneja la visualización para Admin y el marcado con cámara/GPS para Supervisores
 */

let allMarcaciones = [];
let dataTable = null;
let filtroTipo = 'todos';
let filtroUsuario = '';

// Variables para el marcado (Supervisor)
let stream = null;
let currentType = 'entrada';
let capturedBlob = null;
let userLocation = null;

document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que Helios esté listo (auth-guard)
    window.addEventListener('helios-auth-ready', (e) => {
        const user = e.detail;
        initPageByRole(user.rol);
    });

    // Si ya está listo (cache)
    if (window.__heliosReady && window.__heliosUser) {
        initPageByRole(window.__heliosUser.rol);
    }
});

function initPageByRole(rol) {
    if (rol === 'admin') {
        document.getElementById('admin-view').classList.remove('hidden');
        initAdminView();
    } else {
        document.getElementById('supervisor-view').classList.remove('hidden');
        initSupervisorView();
    }
}

// ── Lógica de Administrador ──────────────────────────────────────

function initAdminView() {
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    document.getElementById('filtro-hasta').value = formatDateForInput(hoy);
    document.getElementById('filtro-desde').value = formatDateForInput(hace30Dias);

    cargarMarcaciones();

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
}

function cargarMarcaciones() {
    db.ref("marcas").on("value", snapshot => {
        const data = snapshot.val() || {};
        allMarcaciones = Object.entries(data).map(([id, marca]) => ({
            id,
            ...marca
        })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        poblarUsuarios();
        aplicarFiltros();
    });
}

function poblarUsuarios() {
    const container = document.getElementById('usuario-options');
    if (!container) return;
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

function toggleDropdown(id) {
    ['dropdown-tipo-menu', 'dropdown-usuario-menu'].forEach(menuId => {
        if (menuId !== id) {
            document.getElementById(menuId)?.classList.add('hidden');
        }
    });
    const menu = document.getElementById(id);
    if (menu) menu.classList.toggle('hidden');
}

function seleccionarTipo(valor, texto) {
    filtroTipo = valor;
    document.getElementById('selected-tipo-text').textContent = texto;
    document.getElementById('filtro-tipo').value = valor;
    document.getElementById('dropdown-tipo-menu').classList.add('hidden');
}

function seleccionarUsuario(valor, texto) {
    filtroUsuario = valor;
    document.getElementById('selected-usuario-text').textContent = texto;
    document.getElementById('filtro-usuario').value = valor;
    document.getElementById('dropdown-usuario-menu').classList.add('hidden');
}

function aplicarFiltros() {
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;
    const hoy = formatDateForInput(new Date());
    let entradasHoy = 0;
    let salidasHoy = 0;
    let usuariosUnicos = new Set();

    const filteredData = allMarcaciones.filter(marca => {
        const fechaMarca = marca.fecha.substring(0, 10);
        if (desde && fechaMarca < desde) return false;
        if (hasta && fechaMarca > hasta) return false;
        if (filtroTipo !== 'todos' && marca.tipo !== filtroTipo) return false;
        if (filtroUsuario && marca.usuario !== filtroUsuario) return false;

        if (fechaMarca === hoy) {
            if (marca.tipo === 'entrada') entradasHoy++;
            if (marca.tipo === 'salida') salidasHoy++;
        }
        usuariosUnicos.add(marca.usuario);
        return true;
    });

    document.getElementById('stat-total').textContent = filteredData.length.toLocaleString();
    document.getElementById('stat-entradas-hoy').textContent = entradasHoy;
    document.getElementById('stat-salidas-hoy').textContent = salidasHoy;
    document.getElementById('stat-usuarios').textContent = usuariosUnicos.size;

    mostrarTabla(filteredData);
}

function mostrarTabla(data) {
    if (dataTable) {
        dataTable.destroy();
        dataTable = null;
    }

    const tbody = document.querySelector('#tabla-marcaciones tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400"><span class="material-icons-outlined text-4xl mb-2 block">event_busy</span>No hay marcaciones</td></tr>`;
        return;
    }

    data.forEach(marca => {
        const tipoStyle = marca.tipo === 'entrada'
            ? { bg: 'bg-success/10', text: 'text-success', icon: 'login', label: 'Entrada' }
            : { bg: 'bg-warning/10', text: 'text-warning', icon: 'logout', label: 'Salida' };

        const row = `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <span class="material-icons-outlined text-slate-400">person</span>
                        </div>
                        <p class="font-medium text-slate-800 dark:text-white text-sm">${marca.usuario}</p>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${tipoStyle.bg} ${tipoStyle.text}">
                        <span class="material-icons-outlined text-sm">${tipoStyle.icon}</span>${tipoStyle.label}
                    </span>
                </td>
                <td class="px-6 py-4 text-center text-sm text-slate-600 dark:text-slate-300">${formatDateDisplay(marca.fecha)}</td>
                <td class="px-6 py-4 text-center"><span class="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-200">${formatTimeDisplay(marca.fecha)}</span></td>
                <td class="px-6 py-4 text-center">
                    ${marca.lat && marca.lng ? `<button onclick="verMapa(${marca.lat}, ${marca.lng})" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-info/10 text-info text-sm font-medium hover:bg-info/20 transition-colors"><span class="material-icons-outlined text-sm">location_on</span> Ver</button>` : '-'}
                </td>
                <td class="px-6 py-4 text-right">
                    ${marca.foto ? `<button onclick="verFoto('${marca.foto}')" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"><span class="material-icons-outlined text-sm">photo_camera</span> Ver</button>` : 'Sin foto'}
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    dataTable = $('#tabla-marcaciones').DataTable({
        language: { url: 'https://cdn.datatables.net/plug-ins/1.11.5/i18n/es-ES.json' },
        order: [[2, 'desc'], [3, 'desc']],
        pageLength: 25,
        dom: '<"flex flex-wrap items-center justify-between gap-4 mb-4"<"flex-1"f><"flex items-center gap-2"l>>rtip'
    });
}

// ── Lógica de Supervisor (Marcado) ────────────────────────────────

async function initSupervisorView() {
    await initCamera();
    obtenerUbicacion();
}

async function initCamera() {
    const video = document.getElementById('video');
    const loading = document.getElementById('camera-loading');

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = stream;
        loading.classList.add('hidden');
    } catch (err) {
        console.error("Camera error:", err);
        loading.innerHTML = `<p class="text-danger p-4">Error al acceder a la cámara. Verifica los permisos.</p>`;
    }
}

function changeAttendanceType(type) {
    currentType = type;
    const btnEntrada = document.getElementById('type-entrada');
    const btnSalida = document.getElementById('type-salida');

    if (type === 'entrada') {
        btnEntrada.className = "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 bg-white dark:bg-slate-800 shadow-sm text-success";
        btnSalida.className = "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 text-slate-400";
    } else {
        btnSalida.className = "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 bg-white dark:bg-slate-800 shadow-sm text-warning";
        btnEntrada.className = "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 text-slate-400";
    }
}

function takePhoto() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    const preview = document.getElementById('photo-preview');
    const capturedImg = document.getElementById('captured-img');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
        capturedBlob = blob;
        capturedImg.src = URL.createObjectURL(blob);
        preview.classList.remove('hidden');
        document.getElementById('btn-capture').classList.add('hidden');
        document.getElementById('btn-save').classList.remove('hidden');
        document.getElementById('btn-save').disabled = !userLocation;
    }, 'image/jpeg', 0.8);
}

function retakePhoto() {
    capturedBlob = null;
    document.getElementById('photo-preview').classList.add('hidden');
    document.getElementById('btn-capture').classList.remove('hidden');
    document.getElementById('btn-save').classList.add('hidden');
}

function obtenerUbicacion() {
    const statusText = document.getElementById('location-text');
    if (!navigator.geolocation) {
        statusText.textContent = "Geolocalización no soportada";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            statusText.textContent = "Ubicación lista";
            if (capturedBlob) document.getElementById('btn-save').disabled = false;
        },
        (err) => {
            console.error("Location error:", err);
            statusText.textContent = "Error al obtener ubicación";
        }
    );
}

async function guardarMarcacion() {
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> Guardando...`;

    try {
        const user = window.__heliosUser;
        const timestamp = Date.now();
        const fileName = `asistencia/${user.uid}/${timestamp}.jpg`;
        const storageRef = storage.ref(fileName);

        const snapshot = await storageRef.put(capturedBlob);
        const fotoUrl = await snapshot.ref.getDownloadURL();

        const data = {
            usuario: user.nombre || user.email,
            email: user.email,
            tipo: currentType,
            fecha: new Date().toISOString(),
            foto: fotoUrl,
            lat: userLocation ? userLocation.lat : null,
            lng: userLocation ? userLocation.lng : null
        };

        await db.ref('marcas').push(data);
        showToast(`¡${currentType === 'entrada' ? 'Entrada' : 'Salida'} registrada con éxito!`);

        // Reset view
        retakePhoto();

    } catch (err) {
        console.error("Save error:", err);
        showToast("Error al guardar la marcación", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ── Helpers & Modals ──────────────────────────────────────────

function formatDateForInput(date) { return date.toISOString().substring(0, 10); }
function formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTimeDisplay(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}

function verFoto(url) {
    document.getElementById('foto-ampliada').src = url;
    const modal = document.getElementById('modal-foto');
    modal.classList.replace('hidden', 'flex');
}
function closeModalFoto() { document.getElementById('modal-foto').classList.replace('flex', 'hidden'); }

function verMapa(lat, lng) {
    const iframe = document.getElementById('mapa-iframe');
    iframe.src = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${lat},${lng}&zoom=17`;
    document.getElementById('modal-mapa').classList.replace('hidden', 'flex');
}
function closeModalMapa() {
    document.getElementById('modal-mapa').classList.replace('flex', 'hidden');
    document.getElementById('mapa-iframe').src = '';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = type === 'error' ? 'bg-danger' : 'bg-slate-900 dark:bg-slate-700';
    const icon = type === 'error' ? 'error' : 'check_circle';

    toast.className = `${colors} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 transform transition-all duration-300 translate-y-4 opacity-0`;
    toast.innerHTML = `<span class="material-icons-outlined text-2xl">${icon}</span><span class="font-bold text-sm">${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}
