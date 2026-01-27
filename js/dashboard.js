// Dashboard Logic - Adapted for FOLIOS structure
let allData = null;
let chartEvolucion, chartActividades;

let selectedUbicacion = "todos";

function initDashboard() {
    // Changed from "registros" to "folios"
    db.ref("folios").on("value", snapshot => {
        allData = snapshot.val();
        if (!allData) return;

        poblarFiltroUbicacion(allData);
        filtrarPorUbicacion();
    });

    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
        const dropdown = document.getElementById('dropdown-ubicacion');
        if (!dropdown.contains(e.target)) {
            document.getElementById('dropdown-menu').classList.add('hidden');
        }
    });
}

function toggleDropdown() {
    const menu = document.getElementById('dropdown-menu');
    menu.classList.toggle('hidden');
}

function poblarFiltroUbicacion(data) {
    const container = document.getElementById("dropdown-options");
    const ubicaciones = new Set();

    // FOLIOS structure: data[folioId].sucursal
    Object.keys(data).forEach(folioId => {
        const folio = data[folioId];
        if (folio.sucursal) ubicaciones.add(folio.sucursal);
    });

    const options = ["todos", ...Array.from(ubicaciones).sort()];
    container.innerHTML = "";

    options.forEach(loc => {
        const item = document.createElement("button");
        item.className = `w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between ${selectedUbicacion === loc ? 'text-primary font-semibold bg-blue-50/50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300'}`;
        item.innerHTML = `
            <span>${loc === "todos" ? "Todas las sucursales" : loc}</span>
            ${selectedUbicacion === loc ? '<span class="material-icons-outlined text-sm">check</span>' : ''}
        `;
        item.onclick = () => seleccionarUbicacion(loc);
        container.appendChild(item);
    });
}

function seleccionarUbicacion(loc) {
    selectedUbicacion = loc;
    document.getElementById("selected-location").textContent = loc === "todos" ? "Todas las sucursales" : loc;
    document.getElementById("dropdown-menu").classList.add("hidden");

    // Refresh options to show checkmark
    poblarFiltroUbicacion(allData);
    filtrarPorUbicacion();
}

function filtrarPorUbicacion() {
    if (!allData) return;
    const ubicacion = selectedUbicacion;

    let filteredData = allData;
    if (ubicacion !== "todos") {
        filteredData = {};
        Object.keys(allData).forEach(folioId => {
            const folio = allData[folioId];
            if (folio.sucursal === ubicacion) {
                filteredData[folioId] = folio;
            }
        });
    }
    processStats(filteredData);
}

function processStats(data) {
    let totalActividades = 0;
    let sumaPuntaje = 0;
    let hoy = new Date().toISOString().substring(0, 10);
    let actividadesHoy = 0;

    const actividadesContador = {};
    const evolucionDatos = {};

    // FOLIOS structure: data[folioId].actividades[actividadName]
    Object.keys(data).forEach(folioId => {
        const folio = data[folioId];
        const fecha = folio.fecha ? folio.fecha.substring(0, 10) : "";

        // Iterate over each activity within the folio
        if (folio.actividades) {
            Object.keys(folio.actividades).forEach(actividadNombre => {
                const act = folio.actividades[actividadNombre];
                totalActividades++;
                sumaPuntaje += parseFloat(act.puntuacion || 0);

                if (fecha === hoy) actividadesHoy++;

                // Capitalize activity name for display
                const displayName = actividadNombre.charAt(0).toUpperCase() + actividadNombre.slice(1);
                actividadesContador[displayName] = (actividadesContador[displayName] || 0) + 1;
                evolucionDatos[fecha] = (evolucionDatos[fecha] || 0) + 1;
            });
        }
    });

    // Update KPIs
    document.getElementById("kpi-total").textContent = totalActividades.toLocaleString();
    document.getElementById("kpi-puntuacion").textContent = totalActividades > 0 ? (sumaPuntaje / totalActividades).toFixed(1) : "0.0";
    document.getElementById("kpi-hoy").textContent = actividadesHoy;

    updateCharts(actividadesContador, evolucionDatos);
}

function updateCharts(actividades, evolucion) {
    // Chart Evolución (Line)
    const ctxEvolucion = document.getElementById('chart-evolucion').getContext('2d');
    const sortedDates = Object.keys(evolucion).sort().slice(-7);

    if (chartEvolucion) chartEvolucion.destroy();
    chartEvolucion = new Chart(ctxEvolucion, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Actividades',
                data: sortedDates.map(d => evolucion[d]),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { borderDash: [5, 5], color: '#e2e8f0' } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            }
        }
    });

    // Chart Actividades (Doughnut)
    const ctxActividades = document.getElementById('chart-actividades').getContext('2d');
    const colors = ['#3b82f6', '#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6'];

    const labels = Object.keys(actividades);
    const chartData = Object.values(actividades);

    if (chartActividades) chartActividades.destroy();
    chartActividades = new Chart(ctxActividades, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: chartData,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { display: false } }
        }
    });

    // Custom Legend
    const legendDiv = document.getElementById("actividades-legend");
    legendDiv.innerHTML = "";
    labels.forEach((label, i) => {
        const percent = ((chartData[i] / chartData.reduce((a, b) => a + b, 0)) * 100).toFixed(0);
        legendDiv.innerHTML += `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <div class="w-3 h-3 rounded-full" style="background-color: ${colors[i]}"></div>
                    <span class="text-sm text-slate-600 dark:text-slate-300">${label}</span>
                </div>
                <span class="text-sm font-semibold dark:text-white">${percent}%</span>
            </div>
        `;
    });
}


document.addEventListener('DOMContentLoaded', initDashboard);
