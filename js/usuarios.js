/**
 * Usuarios Management Module
 * Admin-only functionality for managing system users.
 * Supports both registered users (in `usuarios` collection)
 * and pre-assigned roles (in `roles_asignados` collection).
 */

let usuariosData = [];
let editingUid = null;

// ── Email key helpers (Firebase keys can't have . # $ [ ]) ─────
function emailToKey(email) {
    return email.toLowerCase().replace(/\./g, ',');
}
function keyToEmail(key) {
    return key.replace(/,/g, '.');
}

// ── Load registered and pending users ────────────────────────────
function cargarUsuarios() {
    // Listen to both collections
    const usersRef = db.ref('usuarios');
    const pendingRef = db.ref('roles_asignados');

    function syncData() {
        Promise.all([
            usersRef.once('value'),
            pendingRef.once('value')
        ]).then(([usersSnap, pendingSnap]) => {
            usuariosData = [];
            const users = usersSnap.val() || {};
            const pending = pendingSnap.val() || {};

            // Add registered users
            Object.keys(users).forEach(uid => {
                usuariosData.push({ uid, ...users[uid], isPending: false });
            });

            // Add pending users (only if not already registered with same email)
            const registeredEmails = new Set(usuariosData.map(u => u.email?.toLowerCase()));
            Object.keys(pending).forEach(key => {
                const item = pending[key];
                if (!registeredEmails.has(item.email?.toLowerCase())) {
                    usuariosData.push({
                        uid: null,
                        emailKey: key,
                        ...item,
                        isPending: true,
                        activo: true // Pending users are implicitly active for management
                    });
                }
            });

            renderUsuarios();
            updateStats();
        });
    }

    // Subscribe to changes on both
    usersRef.on('value', syncData);
    pendingRef.on('value', syncData);
}

// ── Render registered users table ──────────────────────────────
function renderUsuarios() {
    const tbody = document.getElementById('usuarios-tbody');
    const emptyState = document.getElementById('empty-state');

    if (usuariosData.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    const sorted = [...usuariosData].sort((a, b) => {
        if (a.rol === 'admin' && b.rol !== 'admin') return -1;
        if (a.rol !== 'admin' && b.rol === 'admin') return 1;
        return (a.nombre || '').localeCompare(b.nombre || '');
    });

    tbody.innerHTML = sorted.map(u => {
        const rolBadge = u.rol === 'admin'
            ? '<span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-accent/10 text-accent"><span class="material-icons-outlined text-sm">admin_panel_settings</span>Admin</span>'
            : u.rol === 'encargado'
                ? '<span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-success/10 text-success"><span class="material-icons-outlined text-sm">badge</span>Supervisor/a</span>'
                : '<span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-warning/10 text-warning"><span class="material-icons-outlined text-sm">help_outline</span>Sin rol</span>';

        const estadoBadge = u.isPending
            ? '<span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-warning/10 text-warning ring-1 ring-warning/20"><span class="material-icons-outlined text-xs">hourglass_empty</span>Pendiente inicio</span>'
            : u.activo !== false
                ? '<span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Activo</span>'
                : '<span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>Inactivo</span>';

        const fecha = (u.creadoEn || u.asignadoEn) ? new Date(u.creadoEn || u.asignadoEn).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'short', year: 'numeric'
        }) : 'N/A';

        const isCurrentUser = window.__heliosUser && window.__heliosUser.uid === u.uid;

        // Identificador para edición/eliminación
        const id = u.isPending ? `pending:${u.emailKey}` : u.uid;

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl ${u.rol === 'admin' ? 'bg-accent/10' : 'bg-primary/10'} flex items-center justify-center flex-shrink-0">
                            <span class="material-icons-outlined ${u.rol === 'admin' ? 'text-accent' : 'text-primary'} text-lg">${u.isPending ? 'mail' : 'person'}</span>
                        </div>
                        <div class="min-w-0">
                            <p class="text-sm font-semibold text-slate-800 dark:text-white truncate">${u.nombre || 'Sin nombre'}</p>
                            <p class="text-xs text-slate-400 truncate">${u.email || 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">${rolBadge}</td>
                <td class="px-6 py-4 text-center">${estadoBadge}</td>
                <td class="px-6 py-4 text-center text-sm text-slate-500 dark:text-slate-400">${fecha}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="editarUsuario('${id}')" title="Editar"
                            class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <span class="material-icons-outlined text-slate-400 hover:text-primary text-lg">edit</span>
                        </button>
                        ${!isCurrentUser ? `
                            <button onclick="eliminarUsuario('${id}')" title="Eliminar"
                                class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <span class="material-icons-outlined text-slate-400 hover:text-danger text-lg">delete</span>
                            </button>
                            ${!u.isPending ? `
                                <button onclick="toggleActivoUsuario('${u.uid}', ${u.activo !== false})" title="${u.activo !== false ? 'Desactivar' : 'Activar'}"
                                    class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                    <span class="material-icons-outlined ${u.activo !== false ? 'text-slate-400 hover:text-danger' : 'text-green-500'} text-lg">
                                        ${u.activo !== false ? 'person_off' : 'person'}
                                    </span>
                                </button>
                            ` : ''}
                        ` : '<span class="px-2 py-1 text-xs text-slate-400 italic">Tú</span>'}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ── Update Statistics ──────────────────────────────────────────
function updateStats() {
    document.getElementById('stat-total').textContent = usuariosData.length;
    document.getElementById('stat-admins').textContent = usuariosData.filter(u => u.rol === 'admin').length;
    const supervisorCount = usuariosData.filter(u => u.rol === 'encargado').length;
    const statSupervisores = document.getElementById('stat-supervisores') || document.getElementById('stat-encargados');
    if (statSupervisores) statSupervisores.textContent = supervisorCount;
}

// ── Open Modal (Create User with Auth) ─────────────────────────
function openModalUsuario() {
    editingUid = null;
    document.getElementById('form-usuario').reset();
    document.getElementById('usuario-uid').value = '';
    document.getElementById('modal-usuario-title').textContent = 'Nuevo Usuario';
    document.getElementById('btn-usuario-text').textContent = 'Crear Usuario';
    document.getElementById('btn-usuario-icon').textContent = 'person_add';
    document.getElementById('usuario-error').classList.add('hidden');

    document.getElementById('campo-email').style.display = '';
    document.getElementById('campo-password').style.display = '';
    document.getElementById('usuario-email').required = true;
    document.getElementById('usuario-password').required = true;

    document.querySelector('input[name="usuario-rol"][value="encargado"]').checked = true;
    showModal('modal-usuario', 'modal-usuario-content');
}

function closeModalUsuario() {
    hideModal('modal-usuario', 'modal-usuario-content');
}

// ── Edit existing user ─────────────────────────────────────────
function editarUsuario(id) {
    let user;
    if (id.startsWith('pending:')) {
        const key = id.replace('pending:', '');
        user = usuariosData.find(u => u.isPending && u.emailKey === key);
    } else {
        user = usuariosData.find(u => u.uid === id);
    }

    if (!user) return;

    editingUid = id;
    document.getElementById('usuario-uid').value = id;
    document.getElementById('usuario-nombre').value = user.nombre || '';
    document.getElementById('modal-usuario-title').textContent = 'Editar Usuario';
    document.getElementById('btn-usuario-text').textContent = 'Guardar Cambios';
    document.getElementById('btn-usuario-icon').textContent = 'save';
    document.getElementById('usuario-error').classList.add('hidden');

    // Email editing only for pending users
    if (user.isPending) {
        document.getElementById('campo-email').style.display = '';
        document.getElementById('usuario-email').value = user.email || '';
        document.getElementById('usuario-email').disabled = true; // Still disabled but visible
    } else {
        document.getElementById('campo-email').style.display = 'none';
    }

    document.getElementById('campo-password').style.display = 'none';
    document.getElementById('usuario-email').required = false;
    document.getElementById('usuario-password').required = false;

    const rolRadio = document.querySelector(`input[name="usuario-rol"][value="${user.rol || 'encargado'}"]`);
    if (rolRadio) rolRadio.checked = true;

    showModal('modal-usuario', 'modal-usuario-content');
}

// ── Delete user or pending assignment ────────────────────────────
async function eliminarUsuario(id) {
    const isPending = id.startsWith('pending:');
    const msg = isPending
        ? '¿Deseas cancelar esta pre-asignación? El usuario no tendrá rol cuando inicie sesión.'
        : '¿Estás seguro de eliminar este usuario de la base de datos? Sus registros no se borrarán pero no podrá acceder.';

    if (!confirm(msg)) return;

    try {
        if (isPending) {
            const key = id.replace('pending:', '');
            await db.ref(`roles_asignados/${key}`).remove();
        } else {
            await db.ref(`usuarios/${id}`).remove();
        }
        showToast('Usuario eliminado correctamente', 'success');
    } catch (err) {
        showToast('Error al eliminar el usuario', 'error');
        console.error(err);
    }
}

// ── Toggle active status ───────────────────────────────────────
async function toggleActivoUsuario(uid, isCurrentlyActive) {
    const action = isCurrentlyActive ? 'desactivar' : 'activar';
    if (!confirm(`¿Deseas ${action} este usuario?`)) return;

    try {
        await db.ref(`usuarios/${uid}/activo`).set(!isCurrentlyActive);
        showToast(`Usuario ${isCurrentlyActive ? 'desactivado' : 'activado'} correctamente`, 'success');
    } catch (err) {
        showToast('Error al cambiar el estado del usuario', 'error');
        console.error(err);
    }
}

// ── Pending users: Open Modal ──────────────────────────────────
function openModalPendiente() {
    document.getElementById('form-pendiente').reset();
    document.getElementById('pendiente-error').classList.add('hidden');
    document.querySelector('input[name="pendiente-rol"][value="encargado"]').checked = true;
    showModal('modal-pendiente', 'modal-pendiente-content');
}

function closeModalPendiente() {
    hideModal('modal-pendiente', 'modal-pendiente-content');
}

// ── Form Submissions ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Create/Edit user form
    document.getElementById('form-usuario').addEventListener('submit', async (e) => {
        e.preventDefault();

        const errorDiv = document.getElementById('usuario-error');
        const errorText = document.getElementById('usuario-error-text');
        errorDiv.classList.add('hidden');

        const nombre = document.getElementById('usuario-nombre').value.trim();
        const rol = document.querySelector('input[name="usuario-rol"]:checked').value;

        if (editingUid) {
            try {
                if (editingUid.startsWith('pending:')) {
                    const key = editingUid.replace('pending:', '');
                    await db.ref(`roles_asignados/${key}`).update({ nombre, rol });
                } else {
                    await db.ref(`usuarios/${editingUid}`).update({ nombre, rol });
                }

                showToast('Usuario actualizado correctamente', 'success');
                closeModalUsuario();

                if (window.__heliosUser && window.__heliosUser.uid === editingUid) {
                    window.__heliosUser.nombre = nombre;
                    window.__heliosUser.rol = rol;
                    const nameEl = document.getElementById('sidebar-user-name');
                    const roleEl = document.getElementById('sidebar-user-role');
                    if (nameEl) nameEl.textContent = nombre;
                    if (roleEl) roleEl.textContent = rol === 'admin' ? 'Administrador' : 'Supervisor/a';
                }
            } catch (err) {
                errorText.textContent = 'Error al actualizar el usuario';
                errorDiv.classList.remove('hidden');
                console.error(err);
            }
        } else {
            const email = document.getElementById('usuario-email').value.trim();
            const password = document.getElementById('usuario-password').value;

            if (!email || !password) {
                errorText.textContent = 'El correo y la contraseña son obligatorios';
                errorDiv.classList.remove('hidden');
                return;
            }
            if (password.length < 6) {
                errorText.textContent = 'La contraseña debe tener al menos 6 caracteres';
                errorDiv.classList.remove('hidden');
                return;
            }

            const btn = document.querySelector('#form-usuario button[type="submit"]');
            btn.disabled = true;
            document.getElementById('btn-usuario-text').textContent = 'Creando...';

            const result = await crearUsuario(email, password, nombre, rol);

            btn.disabled = false;
            document.getElementById('btn-usuario-text').textContent = 'Crear Usuario';

            if (result.success) {
                // Remove from pending if exists
                const key = emailToKey(email);
                db.ref(`roles_asignados/${key}`).remove();

                showToast('Usuario creado correctamente', 'success');
                closeModalUsuario();
            } else {
                errorText.textContent = result.message;
                errorDiv.classList.remove('hidden');
            }
        }
    });

    // Pre-assign role form
    document.getElementById('form-pendiente').addEventListener('submit', async (e) => {
        e.preventDefault();

        const errorDiv = document.getElementById('pendiente-error');
        const errorText = document.getElementById('pendiente-error-text');
        errorDiv.classList.add('hidden');

        const email = document.getElementById('pendiente-email').value.trim().toLowerCase();
        const nombre = document.getElementById('pendiente-nombre').value.trim();
        const rol = document.querySelector('input[name="pendiente-rol"]:checked').value;

        if (!email) {
            errorText.textContent = 'El correo es obligatorio';
            errorDiv.classList.remove('hidden');
            return;
        }

        // Check if user already exists in usuarios collection
        const alreadyExists = usuariosData.some(u => u.email && u.email.toLowerCase() === email);
        if (alreadyExists) {
            errorText.textContent = 'Este usuario ya está registrado en el sistema. Edita su rol desde la tabla principal.';
            errorDiv.classList.remove('hidden');
            return;
        }

        try {
            const key = emailToKey(email);
            await db.ref(`roles_asignados/${key}`).set({
                email: email,
                nombre: nombre || email.split('@')[0],
                rol: rol,
                asignadoEn: new Date().toISOString()
            });
            showToast(`Rol "${rol}" pre-asignado a ${email}`, 'success');
            closeModalPendiente();
        } catch (err) {
            errorText.textContent = 'Error al asignar el rol';
            errorDiv.classList.remove('hidden');
            console.error(err);
        }
    });
});

// ── Password visibility toggle ────────────────────────────────
function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
    }
}

// ── Modal helpers ──────────────────────────────────────────────
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

function hideModal(modalId, contentId) {
    const content = document.getElementById(contentId);
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        const modal = document.getElementById(modalId);
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 200);
}

// ── Toast helper ───────────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
    const colors = {
        success: 'bg-success text-white',
        error: 'bg-danger text-white',
        info: 'bg-primary text-white',
        warning: 'bg-warning text-white'
    };

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg ${colors[type] || colors.info} transform transition-all duration-300 translate-y-4 opacity-0`;
    toast.innerHTML = `
        <span class="material-icons-outlined">${icons[type] || icons.info}</span>
        <span class="font-medium text-sm">${message}</span>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ── Init on auth ready ─────────────────────────────────────────
function initUsuariosPage() {
    if (!window.__heliosUser || window.__heliosUser.rol !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    cargarUsuarios();
}

window.addEventListener('helios-auth-ready', initUsuariosPage);

if (window.__heliosReady) {
    initUsuariosPage();
}
