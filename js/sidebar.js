/**
 * Sidebar and Theme Management System
 * Handles injection, collapse, and light/dark mode persistence.
 */

// Immediate theme application to prevent flash (also called from head script)
function initTheme() {
    const savedTheme = localStorage.getItem('helios-theme') || 'light';
    document.documentElement.className = savedTheme;
}

// Run immediately since this script is loaded with 'defer' or at end of body
initTheme();

document.addEventListener('DOMContentLoaded', () => {
    injectSidebar();
    initCollapse();
});

function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.className = newTheme;
    localStorage.setItem('helios-theme', newTheme);

    // Update icon if exists
    updateThemeUI(newTheme);
}

function updateThemeUI(theme) {
    const icon = document.getElementById('theme-toggle-icon');
    const text = document.getElementById('theme-toggle-text');
    if (icon) icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    if (text) text.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro';
}

function injectSidebar() {
    const activePage = window.location.pathname.split('/').pop() || 'index.html';
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) document.body.classList.add('collapsed');

    const sidebarHTML = `
        <aside id="sidebar" class="bg-sidebar-dark dark:bg-background-dark border-r border-slate-800/50 dark:border-slate-800/30 text-white w-64 flex-shrink-0 flex flex-col h-screen fixed left-0 top-0 z-50 transition-all duration-300">
            
            <!-- Floating Collapse Button -->
            <button onclick="toggleCollapse()" id="collapse-btn" class="collapse-toggle-btn" title="${isCollapsed ? 'Expandir menú' : 'Colapsar menú'}">
                <span class="material-icons-outlined text-sm" id="collapse-icon">${isCollapsed ? 'chevron_right' : 'chevron_left'}</span>
            </button>

            <!-- Header with Logo -->
            <div class="sidebar-header p-5 flex items-center justify-center">
                <a href="index.html" class="flex items-center">
                    <img src="img/horizontal_helios.svg" alt="Helios" class="h-9 sidebar-logo-expanded sidebar-logo-light">
                    <img src="img/horizontal_helios_oscuro.png" alt="Helios" class="h-9 sidebar-logo-expanded sidebar-logo-dark">
                    <img src="img/favicon_helios.svg" alt="Helios" class="h-9 w-9 sidebar-logo-collapsed">
                </a>
            </div>

            <!-- Navigation -->
            <nav class="flex-1 px-3 space-y-1 overflow-y-auto">
                <a href="${window.__heliosUser?.rol === 'encargado' ? 'dashboard-encargado.html' : 'index.html'}" class="nav-link group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${(activePage === 'index.html' || activePage === 'dashboard-encargado.html') ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                    <span class="material-icons-outlined">dashboard</span>
                    <span class="font-medium nav-text">Dashboard</span>
                    <span class="nav-tooltip">Dashboard</span>
                </a>
                <a href="registros.html" class="nav-link group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'registros.html' ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                    <span class="material-icons-outlined">assignment</span>
                    <span class="font-medium nav-text">Registros</span>
                    <span class="nav-tooltip">Registros</span>
                </a>
                <a href="tareas.html" class="nav-link group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'tareas.html' ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                    <span class="material-icons-outlined">add_task</span>
                    <span class="font-medium nav-text">Tareas</span>
                    <span class="nav-tooltip">Tareas</span>
                </a>
                <a href="actividades.html" class="nav-link nav-admin-only group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'actividades.html' ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}" style="display:none">
                    <span class="material-icons-outlined">category</span>
                    <span class="font-medium nav-text">Actividades</span>
                    <span class="nav-tooltip">Actividades</span>
                </a>
                <a href="asistencia.html" class="nav-link group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'asistencia.html' ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
                    <span class="material-icons-outlined">fingerprint</span>
                    <span class="font-medium nav-text">Asistencia</span>
                    <span class="nav-tooltip">Asistencia</span>
                </a>

                <!-- Admin Only: Usuarios -->
                <a href="usuarios.html" class="nav-link nav-admin-only group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'usuarios.html' ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}" style="display:none">
                    <span class="material-icons-outlined">group</span>
                    <span class="font-medium nav-text">Usuarios</span>
                    <span class="nav-tooltip">Usuarios</span>
                </a>
            </nav>

            <!-- Footer: User Profile + Actions -->
            <div class="mt-auto sidebar-footer">
                <div class="mx-3 border-t border-slate-700/50 dark:border-slate-700/30"></div>
                
                <!-- User Profile Card -->
                <div class="mx-3 mt-3 mb-2 p-3 rounded-xl sidebar-user-card sidebar-user-section">
                    <div class="flex items-center space-x-3">
                        <div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
                            <span class="material-icons-outlined text-white text-base">person</span>
                        </div>
                        <div class="min-w-0 nav-text flex-1">
                            <p class="text-sm font-semibold truncate sidebar-user-name-text" id="sidebar-user-name">Cargando...</p>
                            <p class="text-xs truncate sidebar-user-role-text" id="sidebar-user-role">---</p>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions Row -->
                <div class="px-3 pb-4 flex items-center gap-1 sidebar-actions-row">
                    <button onclick="toggleTheme()" class="nav-link group flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all" title="${document.documentElement.classList.contains('dark') ? 'Modo Claro' : 'Modo Oscuro'}">
                        <span class="material-icons-outlined text-lg" id="theme-toggle-icon">
                            ${document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode'}
                        </span>
                        <span class="font-medium text-sm nav-text" id="theme-toggle-text">
                            ${document.documentElement.classList.contains('dark') ? 'Claro' : 'Oscuro'}
                        </span>
                        <span class="nav-tooltip">${document.documentElement.classList.contains('dark') ? 'Modo Claro' : 'Modo Oscuro'}</span>
                    </button>
                    <button onclick="logoutUser()" class="nav-link group flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all" title="Cerrar Sesión">
                        <span class="material-icons-outlined text-lg">logout</span>
                        <span class="font-medium text-sm nav-text">Salir</span>
                        <span class="nav-tooltip">Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </aside>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    // Sync with auth state if already loaded (prevents race condition)
    if (window.__heliosUser && typeof updateSidebarUser === 'function') {
        updateSidebarUser(window.__heliosUser);
        applyRoleRestrictions(window.__heliosUser.rol);
    }
}

function toggleCollapse() {
    const isCollapsed = document.body.classList.toggle('collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed);

    const icon = document.getElementById('collapse-icon');
    const btn = document.getElementById('collapse-btn');

    if (icon) icon.textContent = isCollapsed ? 'chevron_right' : 'chevron_left';
    if (btn) btn.title = isCollapsed ? 'Expandir menú' : 'Colapsar menú';
}

function initCollapse() {
    // Add margin to main content if it exists
    const main = document.querySelector('main');
    if (main) {
        main.id = 'main-content';
        main.className += ' transition-all duration-300';
    }
}
