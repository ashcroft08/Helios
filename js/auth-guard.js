/**
 * Auth Guard - Protects all pages except login.html
 * Include this script AFTER firebase-config.js and auth.js on every protected page.
 * 
 * Stores current user info in window.__heliosUser for use by other scripts.
 */

// Global user state
window.__heliosUser = null;
window.__heliosReady = false;

// Check for cached session first (enables instant page loads)
const cachedUser = sessionStorage.getItem('helios-user');
if (cachedUser) {
    try {
        const parsed = JSON.parse(cachedUser);
        window.__heliosUser = parsed;
        window.__heliosReady = true;
        // Immediately apply UI without waiting for Firebase
        document.addEventListener('DOMContentLoaded', () => {
            applyRoleRestrictions(parsed.rol);
            updateSidebarUser(parsed);
            window.dispatchEvent(new CustomEvent('helios-auth-ready', { detail: parsed }));
        });
    } catch (e) {
        sessionStorage.removeItem('helios-user');
    }
}

(function () {
    const hasCachedUser = !!window.__heliosUser;

    // Only show loading overlay if we don't have cached data
    let overlay = null;
    if (!hasCachedUser) {
        overlay = document.createElement('div');
        overlay.id = 'auth-loading-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg,#f8fafc);z-index:99999;display:flex;align-items:center;justify-content:center;transition:opacity 0.3s';
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) overlay.style.background = '#0a0f1a';
        overlay.innerHTML = `
            <div style="text-align:center">
                <div style="width:40px;height:40px;border:3px solid ${isDark ? '#334155' : '#e2e8f0'};border-top-color:#3b82f6;border-radius:50%;animation:auth-spin 0.8s linear infinite;margin:0 auto 16px"></div>
                <p style="color:${isDark ? '#94a3b8' : '#64748b'};font-family:Inter,sans-serif;font-size:14px">Verificando sesión...</p>
            </div>
            <style>@keyframes auth-spin{to{transform:rotate(360deg)}}</style>
        `;
        document.body.appendChild(overlay);
    }

    function removeOverlay() {
        if (overlay) {
            const el = overlay;
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
            overlay = null;
        }
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            // Not logged in → clear cache and redirect
            sessionStorage.removeItem('helios-user');
            localStorage.removeItem('helios-last-activity');
            window.location.href = 'login.html';
            return;
        }

        // Check for inactivity timeout (1 hour = 3600000ms)
        const lastActivity = localStorage.getItem('helios-last-activity');
        const now = Date.now();
        const ONE_HOUR = 3600000;

        if (lastActivity && (now - parseInt(lastActivity)) > ONE_HOUR) {
            sessionStorage.removeItem('helios-user');
            localStorage.removeItem('helios-last-activity');
            await firebase.auth().signOut();
            window.location.href = 'login.html';
            return;
        }

        // Update activity timestamp on first load
        localStorage.setItem('helios-last-activity', now.toString());
        initInactivityMonitor();

        try {
            const userData = await getUserData(user.uid);

            if (!userData) {
                // First login — check pre-assigned role
                let autoRole = (typeof EMAIL_ROLES !== 'undefined' && EMAIL_ROLES[user.email.toLowerCase()]) || null;
                let autoNombre = user.email.split('@')[0];

                const emailKey = user.email.toLowerCase().replace(/\./g, ',');
                const pendingSnap = await db.ref(`roles_asignados/${emailKey}`).once('value');
                const pendingData = pendingSnap.val();
                if (pendingData) {
                    autoRole = pendingData.rol || autoRole;
                    autoNombre = pendingData.nombre || autoNombre;
                    await db.ref(`roles_asignados/${emailKey}`).remove();
                }

                const finalRole = autoRole || 'encargado';
                await db.ref(`usuarios/${user.uid}`).set({
                    email: user.email,
                    nombre: autoNombre,
                    rol: finalRole,
                    activo: true,
                    creadoEn: new Date().toISOString()
                });
                window.__heliosUser = {
                    uid: user.uid,
                    email: user.email,
                    nombre: autoNombre,
                    rol: finalRole
                };
            } else if (!userData.activo) {
                sessionStorage.removeItem('helios-user');
                localStorage.removeItem('helios-last-activity');
                await firebase.auth().signOut();
                window.location.href = 'login.html';
                return;
            } else {
                // Check role auto-correction
                if (typeof EMAIL_ROLES !== 'undefined') {
                    const assignedRole = EMAIL_ROLES[user.email.toLowerCase()];
                    if (assignedRole && userData.rol !== assignedRole) {
                        await db.ref(`usuarios/${user.uid}/rol`).set(assignedRole);
                        userData.rol = assignedRole;
                    }
                }

                window.__heliosUser = {
                    uid: user.uid,
                    email: user.email,
                    nombre: userData.nombre,
                    rol: userData.rol
                };
            }

            // Cache for future page loads
            sessionStorage.setItem('helios-user', JSON.stringify(window.__heliosUser));
            window.__heliosReady = true;

            // Apply role-based visibility
            applyRoleRestrictions(window.__heliosUser.rol);
            updateSidebarUser(window.__heliosUser);
            removeOverlay();

            // Handle Dashboard auto-redirection
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            if (currentPage === 'index.html' && window.__heliosUser.rol === 'encargado') {
                window.location.href = 'dashboard-encargado.html';
                return;
            }
            if (currentPage === 'dashboard-encargado.html' && window.__heliosUser.rol === 'admin') {
                window.location.href = 'index.html';
                return;
            }
            if ((currentPage === 'usuarios.html' || currentPage === 'actividades.html') && window.__heliosUser.rol !== 'admin') {
                window.location.href = 'index.html';
                return;
            }

            // Only dispatch if we didn't already dispatch from cache
            if (!hasCachedUser) {
                window.dispatchEvent(new CustomEvent('helios-auth-ready', { detail: window.__heliosUser }));
            }

        } catch (error) {
            console.error('Error in auth guard:', error);
            if (overlay) {
                overlay.innerHTML = `<p style="color:#ef4444;font-family:Inter,sans-serif">Error de autenticación. Recarga la página.</p>`;
            }
        }
    });

    /**
     * Monitor user activity to handle automatic logout
     */
    function initInactivityMonitor() {
        const updateActivity = () => {
            localStorage.setItem('helios-last-activity', Date.now().toString());
        };

        // Events that count as activity
        ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(event => {
            window.addEventListener(event, updateActivity, { passive: true });
        });

        // Periodic check every minute
        setInterval(() => {
            const lastActivity = localStorage.getItem('helios-last-activity');
            const now = Date.now();
            if (lastActivity && (now - parseInt(lastActivity)) > 3600000) {
                firebase.auth().signOut().then(() => {
                    window.location.href = 'login.html';
                });
            }
        }, 60000);
    }
})();

/**
 * Hide/show elements based on user role
 */
function applyRoleRestrictions(role) {
    if (!role) return;

    // Hide admin-only elements for non-admins
    document.querySelectorAll('[data-role="admin"]').forEach(el => {
        if (el) el.style.display = (role === 'admin') ? '' : 'none';
    });

    // Hide encargado-only elements for non-encargados
    document.querySelectorAll('[data-role="encargado"]').forEach(el => {
        if (el) el.style.display = (role === 'encargado') ? '' : 'none';
    });
}

/**
 * Update sidebar to show current user info and role-specific nav items
 */
function updateSidebarUser(userData) {
    if (!userData) return;

    // Update user display in sidebar
    const userNameEl = document.getElementById('sidebar-user-name');
    const userRoleEl = document.getElementById('sidebar-user-role');

    if (userNameEl) {
        userNameEl.textContent = userData.nombre || userData.email.split('@')[0];
    }

    if (userRoleEl) {
        const roleLabels = { admin: 'Administrador', encargado: 'Supervisor/a' };
        userRoleEl.textContent = roleLabels[userData.rol] || userData.rol;
    }

    // Show/hide admin-only nav links
    document.querySelectorAll('.nav-admin-only').forEach(item => {
        if (item) item.style.display = (userData.rol === 'admin') ? '' : 'none';
    });
}
