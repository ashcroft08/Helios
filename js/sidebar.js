/**
 * Sidebar and Theme Management System
 * Handles injection, collapse, and light/dark mode persistence.
 */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    injectSidebar();
    initCollapse();
});

function initTheme() {
    const savedTheme = localStorage.getItem('helios-theme') || 'light';
    document.documentElement.className = savedTheme;
}

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
                    <!-- Logo for expanded state - Light Mode -->
                    <img src="img/horizontal_helios.svg" alt="Helios" class="h-9 sidebar-logo-expanded sidebar-logo-light">
                    <!-- Logo for expanded state - Dark Mode -->
                    <img src="img/horizontal_helios_oscuro.png" alt="Helios" class="h-9 sidebar-logo-expanded sidebar-logo-dark">
                    <!-- Logo for collapsed state -->
                    <img src="img/favicon_helios.svg" alt="Helios" class="h-9 w-9 sidebar-logo-collapsed">
                </a>
            </div>

            <!-- Divider -->
            <div class="mx-4 border-t border-slate-700/50 mb-4"></div>

            <!-- Navigation -->
            <nav class="flex-1 px-3 space-y-1">
                <a href="index.html" class="nav-link group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${activePage === 'index.html' ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}">
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
            </nav>

            <!-- Footer Section -->
            <div class="mt-auto">
                <!-- Divider -->
                <div class="mx-4 border-t border-slate-700/50 mb-3"></div>
                
                <!-- Theme Switcher -->
                <div class="px-3 pb-4">
                    <button onclick="toggleTheme()" class="nav-link group w-full flex items-center space-x-3 py-3 px-4 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                        <span class="material-icons-outlined text-xl" id="theme-toggle-icon">
                            ${document.documentElement.classList.contains('dark') ? 'light_mode' : 'dark_mode'}
                        </span>
                        <span class="font-medium nav-text" id="theme-toggle-text">
                            ${document.documentElement.classList.contains('dark') ? 'Modo Claro' : 'Modo Oscuro'}
                        </span>
                        <span class="nav-tooltip">${document.documentElement.classList.contains('dark') ? 'Modo Claro' : 'Modo Oscuro'}</span>
                    </button>
                </div>
            </div>
        </aside>
    `;

    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
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
