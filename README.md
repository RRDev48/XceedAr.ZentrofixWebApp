# Gestor Zentrofix

Aplicación web de gestión técnica para Zentrofix (servicio técnico de reparación de celulares).

Stack: **Angular 22 (standalone, Reactive Forms) + Supabase (PostgreSQL, Auth, Storage, RLS)**.

## 1. Requisitos

- Node.js 20+ y npm.
- Un proyecto de Supabase (gratuito) creado en [supabase.com](https://supabase.com).

## 2. Configuración del entorno

1. Copiá `src/environments/environment.example.ts` como `src/environments/environment.ts` y `src/environments/environment.prod.ts`.
2. Completá `supabaseUrl` y `supabaseAnonKey` con los valores de tu proyecto (**Project Settings → API** en el dashboard de Supabase). La *anon key* es pública por diseño — la protección real la da Row Level Security — pero estos archivos igual quedan fuera del repositorio (ver `.gitignore`).
3. Completá `whatsappBusinessNumber` con el número oficial de WhatsApp de Zentrofix (formato `54 9 + código de área + número`, sin espacios).

Alternativamente, en CI/CD (por ejemplo Vercel) podés definir las variables de entorno `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `WHATSAPP_BUSINESS_NUMBER`: el script `scripts/generate-env.js` genera los archivos de entorno automáticamente antes de cada build (`npm run build` lo ejecuta solo).

## 3. Base de datos (Supabase)

1. Abrí tu proyecto en supabase.com → **SQL Editor**.
2. Pegá y ejecutá el contenido completo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Crea todas las tablas, tipos, índices, triggers, la vista `repair_orders_list`, la función `change_repair_order_status` y las políticas de Row Level Security.
3. Verificá en **Table Editor** que las tablas se crearon y que **RLS está activado** (candado verde) en cada una.

La migración es idempotente en el sentido de que crea todo desde cero: si necesitás volver a ejecutarla en un proyecto ya inicializado, primero hay que limpiar el esquema `public`.

## 4. Crear el primer usuario Administrador

No hay una pantalla de "crear cuenta" (por diseño: Zentrofix es un local único con un Administrador). Para crear el primer usuario:

1. En el dashboard de Supabase, andá a **Authentication → Users → Add user**.
2. Cargá el correo y una contraseña (podés marcar "Auto Confirm User" para no depender del correo de confirmación).
3. Al crear el usuario, un trigger de la base de datos (`handle_new_auth_user`) genera automáticamente su fila en `profiles` con `role = 'admin'` y `active = true`.
4. Ingresá a la aplicación con ese correo y contraseña.

Para usuarios futuros de "Recepción" o "Técnico" (Etapa 5), se crean de la misma forma y luego se actualiza su rol manualmente:

```sql
update profiles set role = 'recepcion' where email = 'recepcion@zentrofix.com';
```

## 5. Desarrollo local

```bash
npm install
npm start        # genera environment.ts (si hace falta) y levanta ng serve en http://localhost:4200
```

## 6. Compilación

```bash
npm run build          # build de desarrollo, respeta environment.ts existente
npm run build:prod     # build de producción (configuration production)
npm test                # pruebas unitarias (Vitest)
```

## 7. Estructura del proyecto

```
src/app/
  core/           auth, guards, layout (shell con navegación), servicios de acceso a Supabase
  shared/         componentes reutilizables (toast), validadores y utilidades (teléfono AR, errores de formulario)
  features/
    auth/         login, recuperar/restablecer contraseña
    dashboard/    panel principal con indicadores
    customers/    clientes (listado, ficha, alta/edición)
    devices/      equipos (alta/edición, asociados a un cliente)
    repair-orders/  órdenes de reparación (alta guiada, listado con filtros, detalle con estado y WhatsApp)
    diagnostics/  quotes/  inventory/  cash/  warranties/  settings/   → carpetas preparadas para las próximas etapas
  models/         interfaces TypeScript compartidas
supabase/migrations/  migraciones SQL versionadas
```

## 8. Qué funciona en esta entrega (Etapa 1 + WhatsApp básico)

- Login, cierre de sesión, recuperación de contraseña y rutas protegidas por guard.
- Panel principal con 10 indicadores en vivo y listado de reparaciones recientes.
- Clientes: alta, edición, ficha con historial de equipos y reparaciones, detección de posibles duplicados por teléfono/DNI.
- Equipos: alta, edición, datos sensibles (PIN/patrón) separados de los listados.
- Órdenes de reparación: alta guiada (cliente → equipo → orden), código automático `ZF-AÑO-NNNNNN` generado por la base de datos, listado con búsqueda y filtros (estado, pago, marca, fechas), detalle con edición de diagnóstico/costos, cambio de estado con historial con fecha y hora.
- WhatsApp: plantillas de mensaje, mensaje editable antes de enviar, botón que abre `wa.me` con el número normalizado, registro de "mensaje preparado / WhatsApp abierto" (nunca se afirma que el mensaje fue enviado).
- Toda la información persiste en PostgreSQL (Supabase), protegida por Row Level Security; nada crítico depende de `localStorage`.

## 9. Qué queda para las próximas etapas

- **Etapa 2:** pantallas dedicadas de diagnóstico y presupuesto por ítems (`quotes`/`quote_items`, ya modeladas en la base de datos), registro de aprobación/rechazo del cliente.
- **Etapa 3:** inventario con movimientos de stock, pagos parciales múltiples, caja diaria, rentabilidad.
- **Etapa 4:** comprobantes en PDF, flujo de entrega, garantías digitales, reingresos.
- **Etapa 5:** portal de seguimiento para clientes, fotografías/adjuntos vía Supabase Storage, integración con WhatsApp Business API mediante Edge Functions, reportes avanzados, usuarios de recepción y técnico con permisos diferenciados, Service Worker/PWA instalable (el `manifest.webmanifest` ya está preparado).

Todas las tablas de estas etapas futuras (`diagnostics`, `quotes`, `quote_items`, `inventory_items`, `inventory_movements`, `payments`, `cash_movements`, `warranties`, `attachments`, `settings`) ya existen en la base de datos con RLS activo, para no tener que migrar datos más adelante.
