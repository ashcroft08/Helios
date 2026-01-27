# 🌞 Helios - Sistema de Gestión de Actividades del Personal

<div align="center">

![Helios Logo](img/horizontal_helios.png)

**Dashboard moderno para el seguimiento y evaluación de actividades del personal en múltiples sucursales**

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/es/docs/Web/HTML)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/es/docs/Web/JavaScript)

</div>

---

## 📋 Descripción

**Helios** es una aplicación web moderna diseñada para gestionar y monitorear las actividades del personal en empresas con múltiples sucursales. El sistema permite registrar evaluaciones de actividades como limpieza, mantenimiento, seguridad y supervisión, con puntuaciones del 1 al 10, y visualizar estadísticas en tiempo real.

## ✨ Características Principales

- 📊 **Dashboard Interactivo** - Visualización de KPIs en tiempo real con gráficos dinámicos
- 🏢 **Multi-Sucursal** - Gestión de múltiples ubicaciones con filtrado por sucursal
- 📝 **Sistema de Folios** - Registro de actividades agrupadas por folio con múltiples evaluaciones
- ⭐ **Evaluaciones** - Sistema de puntuación del 1 al 10 para diferentes tipos de actividad
- 📅 **Filtros por Fecha** - Filtrado avanzado por rangos de fechas
- 📄 **Exportación PDF** - Generación de reportes detallados en formato PDF
- 📸 **Evidencia Fotográfica** - Soporte para adjuntar fotos a los registros
- 🌙 **Modo Oscuro** - Interfaz adaptable con soporte para tema claro y oscuro
- 📱 **Responsive** - Diseño adaptativo para dispositivos móviles y escritorio

## 🛠️ Tecnologías Utilizadas

| Tecnología | Uso |
|------------|-----|
| **HTML5** | Estructura de la aplicación |
| **TailwindCSS** | Estilos y diseño responsivo |
| **JavaScript (ES6+)** | Lógica de la aplicación |
| **Firebase Realtime Database** | Base de datos en tiempo real |
| **Firebase Storage** | Almacenamiento de imágenes |
| **Chart.js** | Gráficos y visualizaciones |
| **DataTables** | Tablas interactivas con paginación |
| **jsPDF** | Generación de reportes PDF |
| **Flatpickr** | Selector de fechas avanzado |

## 📂 Estructura del Proyecto

```
Helios/
├── 📄 index.html          # Dashboard principal
├── 📄 registros.html      # Gestión de registros
├── 📄 detalle.html        # Vista detallada de folios
├── 📁 css/
│   ├── ui.css             # Estilos principales de UI
│   ├── main.css           # Estilos generales
│   ├── dashboard.css      # Estilos del dashboard
│   └── registros.css      # Estilos de registros
├── 📁 js/
│   ├── firebase-config.js # Configuración de Firebase
│   ├── sidebar.js         # Navegación lateral
│   ├── dashboard.js       # Lógica del dashboard
│   ├── registros.js       # Gestión de registros
│   └── reportes.js        # Generación de reportes
└── 📁 img/
    ├── favicon_helios.svg # Favicon
    └── horizontal_helios.png # Logo horizontal
```

## 🚀 Instalación

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/helios.git
   cd helios
   ```

2. **Configura Firebase:**
   - Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
   - Copia las credenciales de tu proyecto
   - Actualiza el archivo `js/firebase-config.js` con tus credenciales:
   ```javascript
   const firebaseConfig = {
       apiKey: "TU_API_KEY",
       authDomain: "TU_AUTH_DOMAIN",
       databaseURL: "TU_DATABASE_URL",
       projectId: "TU_PROJECT_ID",
       storageBucket: "TU_STORAGE_BUCKET",
       messagingSenderId: "TU_MESSAGING_SENDER_ID",
       appId: "TU_APP_ID"
   };
   ```

3. **Sirve la aplicación:**
   - Puedes usar cualquier servidor web local, por ejemplo:
   ```bash
   # Usando Python
   python -m http.server 8080
   
   # Usando Node.js con http-server
   npx http-server
   
   # O simplemente abre index.html en tu navegador
   ```

4. **Abre tu navegador** y navega a `http://localhost:8080`

## 📱 Capturas de Pantalla

### Dashboard Principal
El dashboard muestra estadísticas en tiempo real:
- Total de registros
- Puntaje promedio
- Actividad del día
- Gráfico de evolución semanal
- Distribución por tipos de actividad

### Gestión de Registros
Vista completa de todos los registros con:
- Filtros por fecha y sucursal
- Tabla interactiva con búsqueda
- Acciones de ver, editar y eliminar
- Exportación a PDF

## 🔒 Estructura de Datos

Los datos se organizan en Firebase con la siguiente estructura de folios:

```json
{
  "folios": {
    "folio_id": {
      "correo": "usuario@email.com",
      "sucursal": "Sucursal Centro",
      "fecha": "2026-01-27",
      "actividades": {
        "actividad_1": {
          "tipo": "Limpieza",
          "puntuacion": 8,
          "comentario": "Buen trabajo",
          "fotoURL": "https://..."
        }
      }
    }
  }
}
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para cambios importantes:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/NuevaFuncionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/NuevaFuncionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

## 📞 Contacto

Si tienes preguntas o sugerencias, no dudes en abrir un issue en el repositorio.