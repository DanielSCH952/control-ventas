# Firebase — Configuración y Sprint 2 (identidad y negocio)

Este documento resume la configuración de Firebase del proyecto y las tareas
manuales necesarias en Firebase Console para el Sprint 2.

## Servicios usados

- **Firebase Authentication**: solo proveedor **anónimo** (Anonymous).
- **Cloud Firestore**: base de datos en modo nativo (no Datastore).
- Firebase JS SDK **v13** (`firebase` npm) + `@react-native-async-storage/async-storage`
  para persistir la sesión anónima entre reinicios de la app.

> Sin backend propio. Toda la lógica vive en el cliente y se protege con
> las **reglas de seguridad** de Firestore (`firestore.rules`).

## Modelo de datos

```
users/{uid}                         → perfil: { uid, name, businessId, createdAt, updatedAt }
businesses/{businessId}             → { name, joinCode, createdBy, createdAt }
businesses/{businessId}/users/{uid} → membresía: { uid, name, role, joinCode?, createdAt }
joinCodes/{code}                     → { businessId }  // búsqueda por código
```

- `role`: `'owner'` (creador del negocio) o `'member'` (se unió por código).
- Fuente de verdad para "¿a qué negocio pertenece el usuario?":
  `users/{uid}.businessId`. La membresía
  (`businesses/{id}/users/{uid}`) es la que **autoriza** el acceso según las
  reglas. Ambas se escriben siempre juntas (batch o transacción).
- `joinCodes/{code}` existe para poder buscar un negocio por código **sin**
  permitir listar la colección `businesses` (los IDs de Firestore no son
  adivinables y las reglas no permiten `list`).

## Reglas de seguridad

Archivo: `firestore.rules`. Está referenciado desde `firebase.json`.

Resumen de las reglas (detalle en el propio archivo):

- Todo requiere `request.auth != null` (sesión anónima).
- `users/{uid}`: cada usuario solo lee/escribe **su** perfil; `businessId`
  solo puede ser `null`, igual al actual, o apuntar a un negocio existente.
- `joinCodes/{code}`: `get` para autenticados (probar un código concreto);
  `create` solo por el creador del negocio y solo para SU código; sin
  `list`, `update` ni `delete`.
- `businesses/{id}`: lectura solo para miembros (existe su membresía);
  `create` por usuarios sin negocio que figuran como `createdBy`;
  `update`/`delete` bloqueados en este sprint.
- Membresías: lectura solo por miembros; `create` por el propio usuario
  como `owner` (si creó el negocio) o como `member` (si presenta un código
  válido que apunta a ESE negocio y su perfil no pertenece ya a otro);
  cambio de rol y borrado bloqueados en este sprint.

No hay índices compuestos: todas las lecturas son por ID de documento, por
lo que no es necesario crear ningún índice en Firestore.

### Publicar las reglas

Opción A (Firebase Console): Firestore Database → Reglas → pegar el
contenido de `firestore.rules` → Publicar.

Opción B (CLI, si se instala `firebase-tools`):

```bash
npx firebase-tools deploy --only firestore:rules
```

## Tareas manuales en Firebase Console (checklist)

1. **Authentication → Sign-in method**: habilitar el proveedor **Anónimo**
   (Anonymous). Si ya estaba habilitado, no hacer nada.
2. **Firestore Database**: crear la base de datos en la región preferida
   (p. ej. `us-central1`) si aún no existe.
3. **Firestore → Reglas**: publicar el contenido de `firestore.rules`
   (reemplaza las reglas por defecto de prueba, que vencen a los 30 días y
   son inseguras).
4. Verificar que el `apiKey`/`projectId`/`appId` de `src/services/firebase.ts`
   corresponden a la app web registrada (valores de configuración web del
   proyecto).

## Flujo del Sprint 2 en la app

1. Al abrir la app, `AuthContext` observa `onAuthStateChanged`. La sesión
   anónima se restaura desde AsyncStorage (mismo `uid` entre reinicios) o se
   crea una nueva si no existe.
2. Se carga el perfil (`users/{uid}`) y, si tiene `businessId`, el negocio.
3. Estados: `loading` → pantalla de carga; error → pantalla con reintento;
   sin perfil → pedir el nombre; con nombre pero sin negocio → crear o
   unirse por código; con negocio → pestañas principales.
4. Crear negocio: genera un código de 6 caracteres (sin 0/O/1/I/L), lo
   valida contra `joinCodes`, crea el negocio y luego un batch atómico con
   la membresía `owner`, el código y el `businessId` del perfil.
5. Unirse por código: transacción que valida el código, que el negocio
   existe y que el usuario no pertenece ya a otro negocio; crea la
   membresía `member` y actualiza el perfil.

## Sprint 3 — Ventas

### Modelo de datos

```
businesses/{businessId}/sales/{saleId} → {
  serviceType:   'COPY_BW' | 'COPY_COLOR' | 'PRINT_BW' | 'PRINT_COLOR' | 'RECHARGE' | 'OTHER',
  quantity:      int (1–1000),
  unitPriceCents: int ≥ 0 (máx. 10000000 = $100,000.00),
  totalCents:    int == quantity * unitPriceCents,
  createdBy:     uid del usuario autenticado,
  createdByName: nombre del perfil al registrar (1–50 caracteres),
  createdAt:     serverTimestamp(),
  updatedAt:     serverTimestamp(),
  notes?:        string (≤ 200 caracteres),
}
```

- El dinero se guarda en **centavos enteros** (sin punto flotante).
- El ID del documento lo genera Firestore (`addDoc`).
- `businessId` proviene del perfil autenticado (`useAuth`), nunca de la
  pantalla; `createdBy` siempre es el UID de la sesión activa.
- Cada venta conserva su precio y total finales; no se recalculan con las
  tarifas vigentes.

### Reglas de seguridad para ventas

Resumen (detalle en `firestore.rules`, bloque `match /sales/{saleId}`):

- `read`: solo usuarios autenticados que sean miembros del negocio.
- `create`: miembros autenticados + validación completa del documento:
  campos exactos (con `notes` opcional), `serviceType` del catálogo,
  cantidad entera 1–1000, precio y total enteros no negativos con límites,
  `totalCents == quantity * unitPriceCents`, `createdBy == request.auth.uid`,
  `createdByName` de 1–50 caracteres, `createdAt`/`updatedAt` iguales a
  `request.time` (garantiza `serverTimestamp()`).
- `update`/`delete`: bloqueados (no implementados en este sprint).

### Índices

La consulta de ventas usa un único `orderBy('createdAt', 'desc')` con
`limit`, que se resuelve con el índice automático de un solo campo.
**No se necesita crear ningún índice compuesto** en Firestore Console.
Si un sprint posterior filtra por servicio/usuario además de ordenar,
sí se requerirá un índice compuesto.

### Tarifas implementadas (`src/utils/pricing.ts`)

- **Copia B/N**: 1–4 copias → $1.50 c/u; 5 o más → $1.00 c/u.
- **Copia a color**: $2.00 c/u (editable para trabajos especiales).
- **Impresión B/N, impresión a color, recarga y otro**: sin tarifa
  automática → precio manual obligatorio (no se permite guardar $0.00).

### Publicar las reglas (necesario tras este sprint)

Opción A (Firebase Console): Firestore Database → Reglas → pegar el
contenido actualizado de `firestore.rules` → Publicar.

Opción B (CLI):

```bash
npx firebase-tools deploy --only firestore:rules
```

### Prueba funcional real con Firebase (Sprint 3) — PENDIENTE

La conexión funcional con Firebase real no se ha podido ejecutar desde el
entorno de desarrollo (requiere dispositivo/emulador). Verificar manualmente:

1. Que el usuario tiene un UID válido (abrir la app y ver el nombre/negocio).
2. Que puede recuperar su perfil (al reabrir la app persiste).
3. Que el perfil contiene el `businessId` esperado (Firestore Console →
   `users/{uid}`).
4. Crear una venta desde la app (p. ej. Copia B/N, cantidad 8, $1.00 c/u,
   total $8.00) en el negocio correcto.
5. Que la venta aparece en Firestore Console en
   `businesses/{businessId}/sales/{saleId}` con los campos del contrato y
   `createdBy`/`createdByName` correctos.
6. Que la app consulta la venta (aparece en la lista de "Ventas del
   negocio" en la pantalla principal).
7. Que un usuario miembro del mismo negocio (otro teléfono, unido por
   código) consulta la venta en su lista.
8. Que un usuario que NO pertenece al negocio no puede leer ni escribir
   ventas (probar con una instalación nueva con otro negocio; la app
   mostrará el error "No pudimos cargar/guardar la venta…" y en Firestore
   Console → Reglas → Playground la petición debe rechazarse).

## Pruebas en dispositivos (manual) — Sprint 2

No se puede validar Firebase real desde el entorno de desarrollo sin
dispositivo/emulador. Verificar en dos teléfonos distintos:

1. Instalación A: abrir app → escribir nombre → crear negocio → ver el
   código; cerrar y reabrir → debe volver directo a la pantalla principal
   con el mismo negocio.
2. Instalación B: abrir app → escribir nombre → unirse con el código →
   debe entrar al mismo negocio; reabrir → persiste.
3. Código inválido → mensaje "No encontramos un negocio con ese código…".
4. En Firestore Console, comprobar documentos creados: `users/{uid}`,
   `businesses/{id}`, `businesses/{id}/users/{uid}` (roles owner/member) y
   `joinCodes/{code}`.
