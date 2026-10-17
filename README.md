# Control de Ventas

Aplicación móvil para el registro y control de ventas de servicios (fotocopias, impresiones, recargas y otros), desarrollada con **React Native**, **Expo SDK 57**, **Firebase JS SDK** y **NativeWind**.

## Índice

- [1. Presentación del proyecto](#1-presentación-del-proyecto)
- [2. Funcionalidades](#2-funcionalidades)
- [3. Stack tecnológico](#3-stack-tecnológico)
- [4. Requisitos previos](#4-requisitos-previos)
- [5. Instalación y ejecución](#5-instalación-y-ejecución)
- [6. Configuración de Firebase](#6-configuración-de-firebase)
- [7. Estructura del proyecto](#7-estructura-del-proyecto)
- [8. Arquitectura de la aplicación](#8-arquitectura-de-la-aplicación)
- [9. Convenciones y buenas prácticas](#9-convenciones-y-buenas-prácticas)
- [10. Navegación y gestión del estado](#10-navegación-y-gestión-del-estado)
- [11. Modelo de datos e integración con Firebase](#11-modelo-de-datos-e-integración-con-firebase)
- [12. Flujo de trabajo de desarrollo](#12-flujo-de-trabajo-de-desarrollo)
- [13. Pruebas y calidad](#13-pruebas-y-calidad)
- [14. Git y contribuciones](#14-git-y-contribuciones)
- [15. Solución de problemas](#15-solución-de-problemas)
- [16. Hoja de ruta](#16-hoja-de-ruta)
- [17. Licencia y estado del proyecto](#17-licencia-y-estado-del-proyecto)

## 1. Presentación del proyecto

| Campo | Detalle |
| --- | --- |
| **Nombre** | `control-ventas` |
| **Tipo** | Aplicación móvil multiplataforma (Android, iOS, web) |
| **Estado actual** | 🚧 Fase de fundación técnica. Base configurada (Expo, Firebase, NativeWind, navegación). Los módulos funcionales de ventas aún no están implementados. |

### Descripción

El proyecto busca resolver la falta de un registro ordenado de las ventas diarias en pequeños negocios de servicios (papelerías, centros de copiado, cibercafés), donde el control suele hacerse en papel y es propenso a errores, pérdidas y falta de trazabilidad.

### Objetivo principal

Permitir registrar ventas por tipo de servicio, cantidad y precio unitario, asociadas a un negocio y a un usuario, de forma que se pueda consultar el historial y los totales de forma confiable.

### Público objetivo

Inferido de los tipos de datos definidos en `src/types/`: dueños y empleados (`owner` / `member`) de negocios que ofrecen servicios de copiado, impresión y recargas. El modelo contempla negocios compartidos mediante código de invitación (`joinCode`).

> **Nota:** los módulos funcionales que materializan este objetivo todavía no existen en el código; solo está definida la base técnica y los tipos de dominio.

---

## 2. Funcionalidades

### ✅ Implementadas

- **Base del proyecto Expo SDK 57** con Expo Router y navegación por pestañas (2 pestañas: *Home* y *Explore*).
- **Inicialización de Firebase JS SDK**: Firebase App, **Authentication** y **Firestore** exportados desde `src/services/firebase.ts`.
- **Autenticación anónima** mediante `authenticateUser()` en `src/services/authService.ts` (reutiliza la sesión si ya existe).
- **Sistema de estilos con NativeWind 4 + Tailwind CSS 3**, integrado a Metro y Babel.
- **Tema claro/oscuro**: colores y espaciados centralizados en `src/constants/theme.ts`, con hooks `useColorScheme` y `useTheme`.
- **Componentes de interfaz reutilizables** de la plantilla: `ThemedText`, `ThemedView`, `Collapsible`, `ExternalLink`, `HintRow`, `WebBadge`, icono animado de splash.
- **Pantalla de bienvenida** (`src/app/index.tsx`) y pantalla de exploración de la plantilla (`src/app/explore.tsx`).
- **Aliases de importación TypeScript** (`@/*` → `./src/*`, `@/assets/*` → `./assets/*`).
- **React Compiler y rutas tipadas habilitados** experimentalmente (`app.json` → `experiments`).

### 🟡 Parcialmente implementadas

- **Modelo de dominio**: las interfaces `Sale`, `Business`, `BusinessUser` y el tipo `ServiceType` están definidas en `src/types/`, pero **no hay operaciones de lectura/escritura contra Firestore** ni pantallas que los utilicen.
- **Autenticación**: existe el servicio de sesión anónima, pero no está conectado a ninguna pantalla ni hay gestión de sesión en la interfaz.

### 📋 Planificadas / pendientes

Estas funcionalidades **no existen en el código actual**:

- Registro, listado y edición de ventas.
- Administración de negocios y miembros (invitaciones vía `joinCode`, roles `owner`/`member`).
- Catálogo de servicios y precios.
- Reportes, totales y cierres.
- Inventario.
- Gestión de errores global, estados de carga y validación de formularios.
- Pruebas automatizadas e integración continua.

## 3. Stack tecnológico

Versiones detectadas en `package.json` (gestor de paquetes: **npm**, archivo `package-lock.json` presente):

| Tecnología | Versión | Función |
| --- | --- | --- |
| Expo | `~57.0.27` | Framework, tooling, build y desarrollo |
| React Native | `0.86.3` | Framework de UI móvil (New Architecture) |
| React / React DOM | `19.2.3` | Librería de UI (soporte web incluido) |
| TypeScript | `~6.0.3` | Tipado estático (modo `strict`) |
| Expo Router | `~57.0.25` | Navegación basada en archivos (`src/app/`) |
| Firebase JS SDK | `^13.0.0` | Authentication y Firestore |
| NativeWind | `^4.2.7` | Estilos con clases utilitarias (Tailwind CSS 3) |
| Tailwind CSS | `^3.4.19` | Motor de estilos de NativeWind (dev) |
| react-native-reanimated | `^4.5.1` | Animaciones (requerido por NativeWind) |
| react-native-safe-area-context | `~5.7.0` | Áreas seguras (requerido por NativeWind) |
| react-native-worklets | `0.10.1` | Worklets para Reanimated v4 |
| ESLint + eslint-config-expo | flat config | Análisis estático de código |
| prettier-plugin-tailwindcss | `^0.5.14` | Orden de clases Tailwind (dev; sin `.prettierrc` todavía) |

Módulos de Expo en uso: `expo-constants`, `expo-device`, `expo-font`, `expo-image`, `expo-linking`, `expo-splash-screen`, `expo-symbols`, `expo-status-bar`, `expo-system-ui`, `expo-web-browser`, `expo-glass-effect`, `@expo/ui`, `react-native-screens`, `react-native-gesture-handler`, `react-native-web`.

---

## 4. Requisitos previos

- **Node.js** (versión LTS recomendada) y **npm**. El proyecto usa npm; no hay `bun.lock`, así que no se requiere Bun.
- **CLI de Expo**: no se requiere instalación global; se usa la CLI local mediante `npx expo`.
- **Dispositivo físico con Expo Go** (Android/iOS) o **emulador/simulador**:
  - Android: Android Studio con un emulador configurado (opcional).
  - iOS: Xcode con simulador en macOS (opcional).
- **Cuenta de Firebase** con un proyecto web que tenga habilitados **Authentication (proveedor anónimo)** y **Firestore**. Ver la [sección 6](#6-configuración-de-firebase).
- Los directorios nativos `ios/` y `android/` **no existen** en el repositorio (Continuous Native Generation). No deben crearse ni editarse manualmente; el comportamiento nativo se configura en `app.json` y con config plugins.

---

## 5. Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone <URL-del-repositorio>
cd control-ventas
```

### 2. Instalar dependencias

```bash
npm install
```

> Al añadir dependencias nuevas, usa siempre `npx expo install <paquete>` en lugar de `npm install` para obtener versiones compatibles con el SDK.

### 3. Configurar Firebase

El proyecto **no utiliza archivos `.env`**: la configuración de Firebase vive en `src/services/firebase.ts`, que está excluido del repositorio por `.gitignore` (patrón `firebase.ts`). Debes crear tu copia local a partir de la plantilla:

```bash
cp "src/services/firebase_example.ts" src/services/firebase.ts
```

Luego completa los valores de `firebaseConfig` con los datos de tu proyecto de Firebase (ver la [sección 6](#6-configuración-de-firebase)).

### 4. Ejecutar en desarrollo

```bash
npm start          # equivalente a: npx expo start
```

Desde el menú del servidor de desarrollo:

- Pulsa `a` → abre en **emulador Android** (requiere Android Studio).
- Pulsa `i` → abre en **simulador iOS** (requiere Xcode, solo macOS).
- Pulsa `w` → abre la **versión web** (`expo start --web`).
- En un dispositivo físico, escanea el código QR con **Expo Go**.

Scripts disponibles en `package.json`:

| Script | Comando |
| --- | --- |
| `npm start` | `expo start` |
| `npm run android` | `expo start --android` |
| `npm run ios` | `expo start --ios` |
| `npm run web` | `expo start --web` |
| `npm run lint` | `expo lint` |
| `npm run reset-project` | Restablece el proyecto a una plantilla vacía (mueve el código a `/example`) — **no ejecutar** en este proyecto ya inicializado |

### 5. Verificaciones antes de commit

```bash
npx tsc --noEmit   # comprobación de tipos
npm run lint       # análisis estático (ESLint)
npx expo-doctor    # diagnóstico de dependencias y configuración
```

## 6. Configuración de Firebase

### Cómo se configura en este proyecto

El proyecto usa el **Firebase JS SDK** (no `react-native-firebase`), inicializado una única vez en `src/services/firebase.ts`:

```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = { /* ... */ };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

- `src/services/firebase.ts` contiene las credenciales reales y está **excluido de Git** (`.gitignore` → `firebase.ts`).
- `src/services/firebase_example.ts` es la **plantilla** con valores vacíos; sirve como referencia para crear tu copia local.
- **Variables de entorno:** el código no referencia ninguna variable `process.env` propia de Firebase (la única referencia es `process.env.EXPO_OS`, una variable interna de Expo). El archivo `.gitignore` contempla el patrón `.env*.local` por si en el futuro se decide migrar a variables de entorno con el prefijo `EXPO_PUBLIC_` de Expo; sería necesario actualizar `src/services/firebase.ts` para leerlas.

### Servicios de Firebase que se utilizan

| Servicio | Estado | Requisito |
| --- | --- | --- |
| Firebase App | Inicializado | Crear proyecto web en la consola de Firebase |
| Authentication | Inicializado, usado por `authService.ts` | Habilitar el proveedor **Anónimo** en *Authentication → Sign-in method* |
| Firestore | Inicializado (instancia `db` exportada) | Crear la base de datos en *Firestore Database*; **no hay colecciones ni reglas definidas todavía en el repositorio** |

### Verificar la inicialización

La forma más directa de verificar es llamar `authenticateUser()` desde una pantalla y confirmar que la app no lanza errores y que en la consola de Firebase (*Authentication → Users*) aparece un usuario anónimo:

```ts
import { authenticateUser } from '@/services/authService';

await authenticateUser(); // crea o reutiliza la sesión anónima
```

### Seguridad: advertencia importante

- Las credenciales de configuración del SDK web (`apiKey`, `appId`, etc.) **son datos públicos por diseño** de las apps cliente de Firebase, pero **no sustituyen las reglas de seguridad**. Firestore y Authentication deben protegerse con:
  - **Reglas de seguridad de Firestore** (no hay archivo de reglas en el repositorio: pendiente de definir y versionar, idealmente con Firebase CLI).
  - **Authentication** habilitado y reglas que exijan `request.auth != null` según corresponda.
- Nunca publiques claves privadas de cuentas de servicio (`serviceAccountKey.json`, `*.key`) ni valores sensibles; `.gitignore` ya excluye patrones como `*.key`.

## 7. Estructura del proyecto

Árbol real del repositorio (sin archivos generados ni cachés):

```text
control-ventas/
├── app.json                    # Configuración de Expo (nombre, scheme, plugins, web/metro, experiments)
├── babel.config.js             # Preset de Expo + NativeWind (jsxImportSource)
├── metro.config.js             # Metro + withNativeWind (input: ./src/global.css)
├── eslint.config.js            # ESLint con eslint-config-expo (flat config)
├── tsconfig.json               # TypeScript strict + aliases @/*, @/assets/*, @/services/*
├── tailwind.config.js          # Tailwind/NativeWind (content: ./src/**, preset nativewind)
├── nativewind-env.d.ts         # Tipos de className para TypeScript
├── package.json                # Dependencias y scripts (npm)
├── LICENSE                     # MIT heredada de la plantilla de Expo (ver sección 17)
├── AGENTS.md                   # Instrucciones para asistentes de IA que trabajan en este repo
├── assets/
│   └── images/                 # Iconos, splash e imágenes usadas por la app
├── scripts/
│   └── reset-project.js        # Utilidad de la plantilla para reiniciar el proyecto
└── src/
    ├── app/                    # RUTAS de Expo Router — solo pantallas y layouts
    │   ├── _layout.tsx         # Layout raíz: importa global.css, tema y tab navigator
    │   ├── index.tsx           # Pantalla "Home" (actualmente plantilla de bienvenida)
    │   └── explore.tsx         # Pantalla "Explore" (plantilla de documentación)
    ├── components/             # Componentes de interfaz reutilizables
    │   └── ui/                 # Subcomponentes base (collapsible.tsx)
    ├── constants/
    │   └── theme.ts            # Colores claro/oscuro, fuentes, espaciados
    ├── hooks/                  # Hooks reutilizables (use-color-scheme, use-theme)
    ├── services/               # Integración con Firebase y lógica de acceso a datos
    │   ├── firebase.ts         # Inicialización real (IGNORADO por Git)
    │   ├── firebase_example.ts # Plantilla con valores vacíos (referencia)
    │   └── authService.ts      # Autenticación anónima
    ├── types/                  # Tipos e interfaces del dominio (Sale, Business, ...)
    └── global.css              # Directivas de Tailwind + variables CSS de fuentes
```

### Responsabilidades por carpeta

| Carpeta | Debe contener | No debe contener |
| --- | --- | --- |
| `src/app/` | Pantallas (rutas) y `_layout.tsx` con navegadores | Componentes reutilizables, lógica de negocio, servicios, hooks propios |
| `src/components/` | Componentes de UI reutilizables y presentacionales | Llamadas directas a Firebase o reglas de negocio complejas |
| `src/constants/` | Valores estáticos compartidos (tema, espaciados) | Lógica dependiente del estado de la app |
| `src/hooks/` | Hooks compartidos con lógica reutilizable | Componentes con JSX |
| `src/services/` | Clientes de Firebase y funciones de acceso a datos | Componentes de interfaz |
| `src/types/` | Interfaces y tipos del dominio | Implementaciones o lógica ejecutable |
| `assets/` | Recursos estáticos (imágenes, iconos) | Código fuente |

> **Convención clave:** todo el código de aplicación vive en `src/`; únicamente pantallas y layouts van en `src/app/` (Expo Router convierte cada archivo en una ruta).

### Propuesta de estructura futura

A medida que crezcan los módulos funcionales (propuesta, **aún no implementada**):

```text
src/
├── app/
│   ├── (tabs)/            # Grupo de rutas con tabs: ventas, reportes, ajustes
│   └── sale/[id].tsx      # Rutas dinámicas, ej. detalle de venta
├── components/
│   ├── sales/             # Componentes específicos del módulo de ventas
│   └── common/            # Componentes transversales
├── context/               # Contextos (sesión, negocio activo)
├── utils/                 # Funciones puras (formateo de moneda, fechas, validaciones)
└── services/
    ├── saleService.ts     # Operaciones CRUD de ventas en Firestore
    └── businessService.ts # Negocios, miembros e invitaciones
```

## 8. Arquitectura de la aplicación

### Arquitectura actual (detectada en el código)

El proyecto es una app Expo con **New Architecture** y una organización en capas sencilla:

```text
┌──────────────────────────────────────────────┐
│  Presentación                                │
│  src/app/ (pantallas) + src/components/      │
├──────────────────────────────────────────────┤
│  Navegación                                  │
│  Expo Router: _layout.tsx + NativeTabs       │
├──────────────────────────────────────────────┤
│  Dominio (tipos)                             │
│  src/types/ — Sale, Business, BusinessUser   │
├──────────────────────────────────────────────┤
│  Servicios / acceso a datos                  │
│  src/services/ — firebase.ts, authService.ts │
├──────────────────────────────────────────────┤
│  Firebase (JS SDK)                           │
│  Authentication (anónimo) · Firestore        │
└──────────────────────────────────────────────┘
```

- **Presentación:** pantallas en `src/app/` y componentes en `src/components/`. Los estilos se aplican con clases NativeWind y con `StyleSheet` en los componentes de plantilla.
- **Navegación:** declarativa con Expo Router; el layout raíz (`src/app/_layout.tsx`) importa `global.css`, aplica el tema y define las pestañas.
- **Dominio:** tipos centralizados en `src/types/`; aún sin capa de negocio ejecutable.
- **Servicios:** `firebase.ts` inicializa el SDK y exporta `auth` y `db`; `authService.ts` encapsula la autenticación anónima. **No hay operaciones de datos implementadas todavía.**
- **Estado:** solo estado local con `useState` en componentes; no hay gestión de estado global.

### Arquitectura propuesta (no implementada)

Para evolucionar sin sobrearquitectura, se propone un flujo unidireccional sencillo:

1. **Pantalla** (`src/app/`) recibe eventos del usuario y delega en hooks/servicios; no llama a Firestore directamente.
2. **Hooks** (`src/hooks/`) coordinan estado de UI (carga, error, datos) y llaman a servicios. Ejemplo propuesto: `useSales()`.
3. **Servicios** (`src/services/`) ejecutan las operaciones de Firestore y devuelven datos ya tipados con las interfaces de `src/types/`.
4. **Contextos** (futuro, `src/context/`) para sesión de usuario y negocio activo, evitando pasar props por muchos niveles.

Reglas para mantener la separación:

- Los componentes no importan `firebase/*` directamente; solo los servicios.
- Las validaciones de datos y el formateo (moneda, fechas) van en funciones puras (`src/utils/`, propuesta futura) para poder probarlas y reutilizarlas.
- Los tipos del dominio son la fuente de verdad compartida entre UI y servicios.

---

## 9. Convenciones y buenas prácticas

### Convenciones ya aplicadas en el proyecto

- **Nombres de archivos:** `kebab-case` para componentes y hooks (`themed-text.tsx`, `use-theme.ts`), camelCase para servicios (`authService.ts`) y PascalCase conceptual para los tipos (`Sale.ts`).
- **Componentes:** funciones nombradas con `export function Componente` o `export default`, en archivos `.tsx`.
- **Hooks:** prefijo `use` + sufijo de plataforma cuando aplique (`use-color-scheme.ts` / `use-color-scheme.web.ts`).
- **Imports con alias:** `@/components/...`, `@/services/...`, `@/constants/theme` (definidos en `tsconfig.json`).
- **Estilos:** NativeWind instalado y configurado (clases `className="..."`); los componentes de plantilla también usan `StyleSheet.create` con tokens de `@/constants/theme`. Se recomienda preferir clases NativeWind en código nuevo y usar los tokens de `theme.ts` para colores y espaciados que necesiten lógica.
- **Tema claro/oscuro:** mediante `useTheme()`/`useColorScheme()` y los objetos `Colors.light` / `Colors.dark`.

### Recomendaciones (a aplicar conforme crezca el proyecto)

- **Separación de capas:** interfaz → hooks → servicios → Firebase (ver sección 8).
- **Manejo de errores y carga:** cada operación de datos debería exponer estados `loading | error | success` al componente; mostrar indicadores y mensajes accionables.
- **Validación de formularios:** validar en el borde (antes de enviar a un servicio) con funciones puras; evaluar una librería de esquemas (p. ej. Zod) solo cuando la complejidad lo justifique.
- **Variables de entorno:** si se introducen, usar el prefijo `EXPO_PUBLIC_` (visibles en el cliente, nunca secretas) y documentarlas en la sección 6.
- **Reutilización:** extraer a `src/components/` solo cuando un elemento se usa en más de un lugar; evitar abstracciones prematuras.
- **Dependencias:** preferir módulos de Expo (`expo install`) y evitar añadir librerías para problemas resolvibles con el SDK actual.

## 10. Navegación y gestión del estado

### Navegación (implementada)

- **Expo Router** (`~57.0.25`) con enrutamiento por archivos en `src/app/`.
- El layout raíz usa **`NativeTabs`** desde `expo-router/unstable-native-tabs` (API **experimental** de Expo Router, ver `src/components/app-tabs.tsx`), con dos pestañas: `index` (*Home*) y `explore` (*Explore*).
- Configuración relevante en `app.json`: plugin `expo-router`, `scheme: "controlventas"` y `experiments.typedRoutes` habilitado (rutas tipadas).

> Nota: al ser una API experimental, conviene revisar los cambios de Expo Router en cada actualización del SDK.

### Gestión del estado (estado actual)

- Solo **estado local** mediante `useState` en componentes (no hay estado global).
- No hay librerías de estado instaladas (ni Zustand, Redux, React Query, etc.) ni contextos definidos.

### Opciones recomendadas (propuestas, no instaladas)

Cuando existan datos remotos y sesión:

- **React Context** (nativo de React) para sesión de usuario y negocio activo: suficiente para el tamaño actual del proyecto, sin dependencias nuevas.
- Para estado de servidor (listas de ventas con caché y recarga), evaluar **TanStack Query**; para estado de cliente complejo, **Zustand**. Instalar solo cuando el caso de uso lo justifique.

---

## 11. Modelo de datos e integración con Firebase

### Tipos definidos (existen en `src/types/`)

| Tipo | Archivo | Campos principales |
| --- | --- | --- |
| `ServiceType` | `Service.ts` | Unión literal: `COPY_BW`, `COPY_COLOR`, `PRINT_BW`, `PRINT_COLOR`, `RECHARGE`, `OTHER` |
| `Sale` / `CreateSaleInput` | `Sale.ts` | `serviceType`, `quantity`, `unitPriceCents`, `totalCents` (montos en centavos), `createdBy`, `createdByName`, `createdAt`, `updatedAt`, `notes?` |
| `Business` | `Business.ts` | `name`, `joinCode`, `createdBy`, `createdAt` |
| `BusinessUser` / `UserRole` | `User.ts` | `uid`, `name`, `role` (`owner` \| `member`), `createdAt` |

> Estos tipos **solo existen en TypeScript**: no hay colecciones de Firestore creadas ni funciones que lean o escriban estos documentos.

### Colecciones de Firestore (diseño propuesto — NO implementado)

Sobre la base de los tipos anteriores, una propuesta conceptual de colecciones:

```text
businesses/{businessId}
  name, joinCode, createdBy, createdAt
businesses/{businessId}/members/{uid}
  name, role, createdAt
businesses/{businessId}/sales/{saleId}
  serviceType, quantity, unitPriceCents, totalCents,
  createdBy, createdByName, createdAt, updatedAt, notes?
```

Decisiones implícitas del diseño actual que conviene respetar:

- **Montos en centavos** (`unitPriceCents`, `totalCents`) para evitar errores de coma flotante; convertir a moneda solo al mostrar.
- **Ventas anidadas por negocio**: facilita consultar el historial de un negocio y aplicar reglas de seguridad por documento padre.
- `CreateSaleInput` no incluye `createdBy`/`createdAt`: el servicio de datos debe añadirlos en el servidor (servidor de reglas o `FieldValue.serverTimestamp()`).

### Responsabilidades del servicio de datos (propuesta)

- Encapsular todas las llamadas a `db` en funciones tipadas (`saleService.ts`, `businessService.ts`).
- Normalizar fechas (`Timestamp` → `Date`) y validar entradas antes de escribir.
- Los servicios no conocen la UI; devuelven datos o errores tipados.

### Principios de seguridad

- Definir **reglas de Firestore** que restrinjan el acceso por pertenencia al negocio (miembro autenticado del negocio padre) y por rol (`owner`/`member`) cuando aplique.
- La autenticación actual es **anónima**: cualquier dispositivo obtiene un `uid`. Si el negocio requiere identidad real, migrar a proveedores con correo/contraseña o federados.
- Las reglas deben versionarse en el repositorio (Firebase CLI) — pendiente.

---

## 12. Flujo de trabajo de desarrollo

### Crear una nueva pantalla

1. Crea el archivo en `src/app/` (el nombre del archivo define la ruta): `src/app/sales.tsx` → ruta `/sales`.
2. Exporta un componente por defecto.
3. Si necesita pestaña, regístrala en `src/components/app-tabs.tsx` con `<NativeTabs.Trigger name="..." />`.
4. La lógica de acceso a datos va en `src/services/`, no en la pantalla.

### Crear un componente reutilizable

1. Archivo `kebab-case.tsx` en `src/components/` (o `src/components/ui/` para primitivas base).
2. Componente presentacional: recibe datos por props, sin llamadas a Firebase.
3. Si necesita variante web, crea `nombre.web.tsx` (patrón ya usado: `animated-icon.web.tsx`, `app-tabs.web.tsx`).

### Dónde va la lógica de negocio

- **Operaciones con Firebase** → `src/services/*.ts` (funciones asíncronas tipadas con los tipos de `src/types/`).
- **Estado que combina servicios + UI** → hooks en `src/hooks/` (`useSales`, `useAuth`, …).
- **Funciones puras** (formateo, validación) → `src/utils/` (crear cuando sea necesario).

### Integrar una nueva operación con Firebase

1. Habilita el servicio en la consola de Firebase (si aplica).
2. Añade/actualiza el tipo del dominio en `src/types/`.
3. Crea la función en el servicio correspondiente de `src/services/`, importando `db` o `auth` desde `./firebase`.
4. Consume la función desde un hook o directamente en la pantalla, manejando estados de carga y error.

### Coherencia de estilos

- Usa clases NativeWind (`className`) y los tokens de `src/constants/theme.ts`; evita valores mágicos de color/espaciado.
- Extiende el tema en `tailwind.config.js` (sección `theme.extend`) si necesitas tokens nuevos.

### Verificar antes de commit

```bash
npx tsc --noEmit
npm run lint
```

Ambos deben pasar sin errores nuevos (hay 2 incidencias preexistentes documentadas en la sección 13).

## 13. Pruebas y calidad

### Herramientas instaladas y operativas

| Herramienta | Comando | Alcance |
| --- | --- | --- |
| TypeScript (strict) | `npx tsc --noEmit` | Tipado estático de todo el proyecto |
| ESLint (`eslint-config-expo`, flat config) | `npm run lint` | Reglas de React/React Native/Expo |
| Expo Doctor | `npx expo-doctor` | Diagnóstico de dependencias y configuración |

### Incidencias preexistentes detectadas (documentadas, sin corregir en esta tarea)

1. `src/hooks/use-color-scheme.web.ts` (línea 11): error de ESLint `react-hooks/set-state-in-effect` — llama `setHasHydrated(true)` de forma síncrona dentro de un efecto. Es código de plantilla; solo afecta a la variante web del hook.
2. `src/services/firebase_example.ts` (línea 4): advertencia `@typescript-eslint/no-unused-vars` por `firebaseConfig` sin usar (archivo de ejemplo comentado, intencional).

### Pendiente de incorporar (sugerencias, no instalado)

- **Pruebas unitarias**: no hay framework de pruebas configurado (sin Jest ni Vitest). Recomendado: Jest + `jest-expo` y, más adelante, React Native Testing Library.
- **Formateo**: existe `prettier-plugin-tailwindcss` como dependencia, pero no hay `.prettierrc`; conviene añadir la configuración para normalizar el estilo.
- **Integración continua**: no hay workflows de CI en el repositorio.
- **Análisis de tipos en el pipeline**: incorporar `tsc --noEmit` y `expo lint` como pasos obligatorios cuando exista CI.

---

## 14. Git y contribuciones

### Estado actual

- Rama principal: `main` (remoto `origin` configurado).
- Historial reciente: `Initial commit`, `Initial project setup`.
- `.gitignore` ya excluye: `node_modules/`, `.expo/`, `dist/`, directorios nativos `/ios` y `/android`, archivos locales de entorno (`.env*.local`) y **`src/services/firebase.ts`** (credenciales).

### Convenciones sugeridas (no implementadas aún)

- **Ramas:** `feat/<módulo>` (nuevas funcionalidades), `fix/<descripción>` (correcciones), `chore/<tema>` (configuración y herramientas).
- **Commits:** formato *Conventional Commits*, p. ej. `feat(ventas): registrar venta en firestore`, `fix: validar cantidad positiva`.
- **Buenas prácticas:**
  - Cambios pequeños y enfocados en un solo propósito; fáciles de revisar.
  - Ejecutar `npx tsc --noEmit` y `npm run lint` antes de cada commit.
  - Nunca commitear credenciales ni archivos `.env` reales (el `.gitignore` ya protege `firebase.ts`; verificar siempre `git status`).
  - Referenciar issues o tareas en el mensaje del commit cuando existan.

No hay flujo de integración continua ni protección de ramas configurados.

## 15. Solución de problemas

### Instalación de dependencias

- **Versiones incompatibles con el SDK:** usa siempre `npx expo install <paquete>`; si el proyecto ya quedó inconsistente, ejecuta `npx expo install --fix` y `npx expo-doctor`.
- **Instalación corrupta:** borra `node_modules` y `package-lock.json` y ejecuta `npm install` de nuevo.

### Inicio de Expo

- **La app no carga o hay caché obsoleta:** reinicia con `npx expo start --clear`.
- **Puerto 8081 ocupado:** `npx expo start --port 8082`.
- **El dispositivo no encuentra el servidor:** teléfono y ordenador en la misma red Wi-Fi, o usa un túnel (`npx expo start --tunnel`).

### NativeWind / estilos que no se aplican

- Verifica que `src/app/_layout.tsx` importa `../global.css` (el CSS con las directivas `@tailwind`).
- Verifica que `tailwind.config.js` incluye `presets: [require('nativewind/preset')]` y que `content` cubre tus archivos (`./src/**/*.{js,jsx,ts,tsx}`).
- Tras cambiar `tailwind.config.js`, reinicia Metro con caché limpia.
- Los tipos de `className` requieren el archivo `nativewind-env.d.ts` en la raíz.

### Firebase

- **Errores al arrancar (`auth/invalid-api-key`, `app/no-options`):** falta crear `src/services/firebase.ts` desde `src/services/firebase_example.ts` o los valores están incompletos.
- **`auth/operation-not-allowed`:** el proveedor **Anónimo** no está habilitado en Firebase Console → *Authentication → Sign-in method*.
- **`permission-denied` en Firestore:** las reglas de seguridad rechazan la operación; revísalas en la consola.
- Recuerda: el archivo real `firebase.ts` **no viene con el repositorio** por diseño (credenciales fuera de Git).

### Expo Go vs. builds nativos

- **Expo Go** solo incluye los módulos nativos preinstalados. Las dependencias actuales funcionan en Expo Go; si en el futuro se añade una librería con código nativo no incluido, será necesario un **development build**: `npx expo run:android` / `npx expo run:ios` o `eas build --profile development` (no hay `eas.json` configurado todavía).
- Los directorios `ios/` y `android/` no existen (Continuous Native Generation); no los crees ni edites manualmente.

## 16. Hoja de ruta

### ✅ Completado

1. Proyecto Expo SDK 57 con estructura `src/` y Expo Router.
2. NativeWind 4 + Tailwind CSS 3 configurados (Babel, Metro, tipos).
3. Firebase JS SDK inicializado (App, Auth, Firestore) y autenticación anónima.
4. Tipos del dominio definidos (`Sale`, `Business`, `BusinessUser`, `ServiceType`).
5. Documentación técnica del proyecto (este README).

### 🔜 Siguientes etapas propuestas

**Etapa 1 — Estabilizar la base técnica**
- Corregir las 2 incidencias de lint preexistentes (sección 13).
- Añadir configuración de Prettier y versionar las reglas de seguridad de Firestore.
- Conectar `authenticateUser()` en el arranque y decidir el modelo de sesión.
- Evaluar migrar la configuración de Firebase a variables de entorno (`EXPO_PUBLIC_*`).

**Etapa 2 — Núcleo funcional mínimo**
- Colecciones de Firestore y `saleService` (crear/listar ventas).
- Pantalla de registro de ventas con validación de formularios.
- Pantalla de historial con estados de carga y error.

**Etapa 3 — Multi-negocio y usuarios**
- Gestión de negocios y membresías (`joinCode`, roles `owner`/`member`).
- Reglas de seguridad por negocio y rol.

**Etapa 4 — Reportes y calidad**
- Totales por día/servicio y cierres.
- Pruebas unitarias (Jest + jest-expo) e integración continua.
- Builds con EAS (`eas.json`) para distribución interna.

---

## 17. Licencia y estado del proyecto

- **Licencia:** existe un archivo `LICENSE` con la **licencia MIT**, pero a nombre de *650 Industries, Inc. (Expo)* — es la licencia heredada de la plantilla con la que se creó el proyecto. La licencia propia del proyecto **está pendiente de definir**; se recomienda sustituir el archivo por la licencia elegida con el titular correcto.
- **Estado general:** 🚧 en desarrollo activo, fase de fundación técnica. La base (Expo, Firebase, NativeWind, navegación, tipos de dominio) está configurada y operativa; los módulos funcionales de ventas, negocios y reportes están pendientes de implementación.










