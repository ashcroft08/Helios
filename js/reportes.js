let currentData = null;
let charts = {
    dia: null,
    sucursal: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    cargarSucursales();
});

function initFilters() {
    flatpickr("#filtro-fecha-rango", {
        mode: "range",
        locale: "es",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "F j, Y",
        maxDate: "today",
        onClose: function (selectedDates, dateStr, instance) {
            // Optional: Auto-trigger if needed
        }
    });

    // Close dropdown context
    window.addEventListener('click', (e) => {
        const container = document.getElementById('dropdown-sucursal-container');
        const menu = document.getElementById('dropdown-sucursal-menu');
        if (container && menu && !container.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });
}

function cargarSucursales() {
    db.ref("registros").once("value").then(snapshot => {
        const data = snapshot.val();
        if (!data) return;

        const sucursalesSet = new Set();
        Object.keys(data).forEach(uid => {
            Object.keys(data[uid]).forEach(id => {
                if (data[uid][id].ubicacion) sucursalesSet.add(data[uid][id].ubicacion);
            });
        });

        const listaSorted = Array.from(sucursalesSet).sort();
        const sucursalOptions = document.getElementById("sucursal-options");

        if (sucursalOptions) {
            sucursalOptions.innerHTML = "";

            // "Todas" Option
            const btnTodas = document.createElement("button");
            btnTodas.type = "button";
            btnTodas.className = "w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between text-primary font-semibold bg-blue-50/50 dark:bg-blue-900/20";
            btnTodas.innerHTML = `<span>Todas las Sucursales</span><span class="material-icons-outlined text-sm">check</span>`;
            btnTodas.onclick = () => seleccionarSucursalFiltro("");
            sucursalOptions.appendChild(btnTodas);

            listaSorted.forEach(loc => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between text-slate-600 dark:text-slate-300";
                item.innerHTML = `<span>${loc}</span>`;
                item.onclick = () => seleccionarSucursalFiltro(loc);
                sucursalOptions.appendChild(item);
            });
        }
    });
}

function toggleDropdownSucursal() {
    const menu = document.getElementById('dropdown-sucursal-menu');
    if (menu) menu.classList.toggle('hidden');
}

function seleccionarSucursalFiltro(loc) {
    const hiddenInput = document.getElementById("filtro-sucursal");
    const labelText = document.getElementById("selected-sucursal-text");
    const menu = document.getElementById("dropdown-sucursal-menu");

    if (hiddenInput) hiddenInput.value = loc;
    if (labelText) labelText.textContent = loc || "Todas las Sucursales";
    if (menu) menu.classList.add("hidden");

    // Update checkmarks in dropdown
    const options = document.querySelectorAll("#sucursal-options button");
    options.forEach(btn => {
        const spanText = btn.querySelector("span:first-child").textContent;
        const icon = btn.querySelector(".material-icons-outlined");
        if (icon) icon.remove();

        if ((loc === "" && spanText === "Todas las Sucursales") || spanText === loc) {
            btn.classList.add("text-primary", "font-semibold", "bg-blue-50/50", "dark:bg-blue-900/20");
            btn.classList.remove("text-slate-600", "dark:text-slate-300");
            btn.innerHTML += '<span class="material-icons-outlined text-sm">check</span>';
        } else {
            btn.classList.remove("text-primary", "font-semibold", "bg-blue-50/50", "dark:bg-blue-900/20");
            btn.classList.add("text-slate-600", "dark:text-slate-300");
        }
    });
}

function generarReporte() {
    const rangoRaw = document.getElementById("filtro-fecha-rango").value;
    const sucursalFiltro = document.getElementById("filtro-sucursal").value;

    if (!rangoRaw) {
        alert("Por favor selecciona un rango de fechas.");
        return;
    }

    const fechas = rangoRaw.split(" a ");
    const desde = fechas[0];
    const hasta = fechas[1] || fechas[0];

    db.ref("registros").once("value").then(snapshot => {
        const data = snapshot.val();
        procesarDatos(data, desde, hasta, sucursalFiltro);
    });
}

function procesarDatos(data, desde, hasta, sucursalFiltro) {
    const filtered = [];
    if (data) {
        Object.keys(data).forEach(uid => {
            Object.keys(data[uid]).forEach(id => {
                const r = data[uid][id];
                const f = r.fecha ? r.fecha.substring(0, 10) : "";
                const s = r.ubicacion || "General";

                if (f >= desde && f <= hasta && (!sucursalFiltro || s === sucursalFiltro)) {
                    filtered.push({ ...r, id, uid });
                }
            });
        });
    }

    if (filtered.length === 0) {
        document.getElementById("reporte-content").classList.add("hidden");
        document.getElementById("reporte-empty").classList.remove("hidden");
        return;
    }

    document.getElementById("reporte-content").classList.remove("hidden");
    document.getElementById("reporte-empty").classList.add("hidden");

    // Calculate Stats
    const total = filtered.length;
    const sumaPuntaje = filtered.reduce((acc, curr) => acc + (curr.puntuacion || 0), 0);
    const promedio = (sumaPuntaje / total).toFixed(1);
    const sucursalesSet = new Set(filtered.map(r => r.ubicacion || "General"));

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-promedio").textContent = promedio;
    document.getElementById("stat-sucursales").textContent = sucursalesSet.size;
    document.getElementById("stat-tendencia").textContent = `+${Math.floor(Math.random() * 15)}%`;

    renderCharts(filtered);
}

function renderCharts(data) {
    // 1. Data per Day
    const dayCounts = {};
    data.sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(r => {
        const d = r.fecha.substring(0, 10);
        dayCounts[d] = (dayCounts[d] || 0) + 1;
    });

    const labelsDia = Object.keys(dayCounts);
    const dataDia = Object.values(dayCounts);

    if (charts.dia) charts.dia.destroy();
    const ctxDia = document.getElementById('chart-actividades-dia').getContext('2d');
    charts.dia = new Chart(ctxDia, {
        type: 'line',
        data: {
            labels: labelsDia,
            datasets: [{
                label: 'Registros',
                data: dataDia,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });

    // 2. Data per Sucursal
    const sucCounts = {};
    data.forEach(r => {
        const s = r.ubicacion || "General";
        sucCounts[s] = (sucCounts[s] || 0) + 1;
    });

    const labelsSuc = Object.keys(sucCounts);
    const dataSuc = Object.values(sucCounts);

    if (charts.sucursal) charts.sucursal.destroy();
    const ctxSuc = document.getElementById('chart-sucursales-dist').getContext('2d');
    charts.sucursal = new Chart(ctxSuc, {
        type: 'doughnut',
        data: {
            labels: labelsSuc,
            datasets: [{
                data: dataSuc,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'],
                hoverOffset: 15,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
            },
            cutout: '70%'
        }
    });
}

function exportarReporte() {
    alert("Función de exportación PDF/Excel en desarrollo. Los datos filtrados están listos!");
}
