/**
 * Dashboard Encargado - specialized logic for the Supervisor role
 */

document.addEventListener('helios-auth-ready', (e) => {
    const user = e.detail;
    if (user.rol !== 'encargado') {
        window.location.href = 'index.html';
        return;
    }
    initEncargadoDashboard(user);
});

// Fallback if event already fired or using cached user
if (window.__heliosReady && window.__heliosUser) {
    if (window.__heliosUser.rol === 'encargado') {
        initEncargadoDashboard(window.__heliosUser);
    }
}

function initEncargadoDashboard(user) {
    document.getElementById('welcome-message').textContent = `¡Hola, ${user.nombre.split(' ')[0]}!`;

    cargarEstadisticasPropas(user);
    cargarTareasProximas(user);
    cargarUltimosFolios(user);
    verificarEstadoHoy(user);
}

function cargarEstadisticasPropas(user) {
    // 1. Tareas pendientes
    db.ref('tareas').on('value', snapshot => {
        const tareas = snapshot.val() || {};
        let pendientes = 0;
        Object.values(tareas).forEach(t => {
            if (t.asignadoA === user.nombre && (t.estado === 'pendiente' || t.estado === 'en_progreso')) {
                pendientes++;
            }
        });
        document.getElementById('kpi-tareas-pendientes').textContent = pendientes;
        document.getElementById('kpi-tareas-info').textContent = pendientes > 0 ? 'Tienes trabajo pendiente' : '¡Todo al día!';
    });

    // 2. Mis registros (folios)
    db.ref('folios').on('value', snapshot => {
        const folios = snapshot.val() || {};
        let mios = 0;
        Object.values(folios).forEach(f => {
            if (f.usuario === user.nombre) {
                mios++;
            }
        });
        document.getElementById('kpi-mis-registros').textContent = mios;
    });
}

function verificarEstadoHoy(user) {
    const hoy = new Date().toISOString().substring(0, 10);

    // Verificar si ya marcó asistencia hoy
    db.ref(`asistencia/${user.uid}/${hoy}`).on('value', snapshot => {
        const asistencia = snapshot.val();
        const kpiEstado = document.getElementById('kpi-estado-hoy');
        const kpiInfo = document.getElementById('kpi-estado-info');

        if (asistencia) {
            kpiEstado.textContent = 'Activo';
            kpiEstado.className = 'text-xl font-bold mt-1 text-emerald-500';
            kpiInfo.textContent = `Entrada: ${asistencia.horaEntrada || '--:--'}`;
        } else {
            kpiEstado.textContent = 'Pendiente';
            kpiEstado.className = 'text-xl font-bold mt-1 text-amber-500';
            kpiInfo.textContent = 'Aún no has marcado asistencia';
        }
    });
}

function cargarTareasProximas(user) {
    const container = document.getElementById('lista-tareas-encargado');

    db.ref('tareas').on('value', snapshot => {
        const allTareas = snapshot.val() || {};
        const misTareas = Object.entries(allTareas)
            .map(([id, t]) => ({ id, ...t }))
            .filter(t => t.asignadoA === user.nombre && t.estado !== 'completado')
            .sort((a, b) => new Date(a.fechaLimite) - new Date(b.fechaLimite))
            .slice(0, 5);

        if (misTareas.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-slate-400">
                    <span class="material-icons-outlined text-4xl block mb-2">done_all</span>
                    <p class="text-sm">No tienes tareas pendientes</p>
                </div>`;
            return;
        }

        container.innerHTML = misTareas.map(t => {
            const date = new Date(t.fechaLimite);
            const isToday = date.toISOString().substring(0, 10) === new Date().toISOString().substring(0, 10);
            const prioDot = t.prioridad === 'alta' ? '🔴' : t.prioridad === 'media' ? '🟡' : '🟢';

            return `
                <div class="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 hover:border-primary/30 transition-all">
                    <div class="flex items-center gap-3">
                        <span class="text-xs">${prioDot}</span>
                        <div>
                            <p class="text-sm font-bold dark:text-white line-clamp-1">${t.titulo}</p>
                            <p class="text-xs text-slate-500">${isToday ? 'Vence hoy' : 'Vence el ' + t.fechaLimite}</p>
                        </div>
                    </div>
                    <a href="tareas.html" class="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        <span class="material-icons-outlined text-sm">chevron_right</span>
                    </a>
                </div>
            `;
        }).join('');
    });
}

function cargarUltimosFolios(user) {
    const container = document.getElementById('lista-folios-encargado');

    db.ref('folios').on('value', snapshot => {
        const allFolios = snapshot.val() || {};
        const misFolios = Object.entries(allFolios)
            .map(([id, f]) => ({ id, ...f }))
            .filter(f => f.usuario === user.nombre)
            .sort((a, b) => b.id.localeCompare(a.id)) // Realtime DB push keys sort alphabetically by time
            .slice(0, 5);

        if (misFolios.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-slate-400">
                    <span class="material-icons-outlined text-4xl block mb-2">history</span>
                    <p class="text-sm">Aún no has creado folios</p>
                </div>`;
            return;
        }

        container.innerHTML = misFolios.map(f => {
            const numAct = f.actividades ? Object.keys(f.actividades).length : 0;
            return `
                <div class="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-primary">
                            <span class="material-icons-outlined text-lg">description</span>
                        </div>
                        <div>
                            <p class="text-sm font-bold dark:text-white">${f.sucursal || 'General'}</p>
                            <p class="text-xs text-slate-500">${f.fecha ? f.fecha.substring(0, 10) : 'Sin fecha'} • ${numAct} actividades</p>
                        </div>
                    </div>
                    <a href="registros.html" class="p-2 text-slate-400 hover:text-primary transition-colors">
                        <span class="material-icons-outlined text-sm">visibility</span>
                    </a>
                </div>
            `;
        }).join('');
    });
}
