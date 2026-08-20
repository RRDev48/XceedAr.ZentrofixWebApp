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
2. Ejecutá, **en orden**, el contenido completo de cada archivo de [`supabase/migrations/`](supabase/migrations/):
   1. `0001_init.sql` — esquema completo (tablas, tipos, índices, triggers, vista `repair_orders_list`, función `change_repair_order_status`, RLS).
   2. `0002_secure_signup.sql` — endurece el alta de usuarios. **No te lo saltees**: sin esto, cualquiera con la anon key pública podría autoregistrarse con acceso administrativo.
   3. `0003_quotes_functions.sql` — funciones para presupuestos (`save_quote`, `mark_quote_sent`, `respond_quote`).
   4. `0004_inventory_payments_cash.sql` — movimientos de stock automáticos, pagos que actualizan la orden y generan su ingreso en caja.
   5. `0005_storage_attachments.sql` — crea el bucket privado `attachments` (fotos, comprobantes, garantías) y sus políticas.
   6. `0006_roles_and_tracking.sql` — restringe pagos/caja/configuración a rol Administrador, y crea la función pública `public_track_order` para el portal de seguimiento de clientes.
3. Verificá en **Table Editor** que las tablas se crearon y que **RLS está activado** (candado verde) en cada una, y en **Storage** que exista el bucket `attachments` (privado).
4. Recomendado (defensa adicional): en **Authentication → Sign In / Providers → Email**, desactivá "Allow new users to sign up". Los usuarios de Zentrofix se crean siempre desde **Authentication → Users → Add user**, nunca por autoregistro.

Cada migración crea objetos nuevos: si necesitás volver a ejecutar todo desde cero en un proyecto ya inicializado, primero hay que limpiar el esquema `public` y el bucket `attachments`.

## 4. Crear el primer usuario Administrador

No hay una pantalla de "crear cuenta" (por diseño: Zentrofix es un local único con un Administrador). Para crear el primer usuario:

1. En el dashboard de Supabase, andá a **Authentication → Users → Add user**.
2. Cargá el correo y una contraseña (podés marcar "Auto Confirm User" para no depender del correo de confirmación).
3. Al crear el usuario, un trigger de la base de datos (`handle_new_auth_user`) genera automáticamente su fila en `profiles` con `role = 'admin'` y `active = true`.
4. Ingresá a la aplicación con ese correo y contraseña.

Para usuarios de "Recepción" o "Técnico": creá la cuenta igual que la del Administrador (**Authentication → Users → Add user**) y después andá a **Usuarios** dentro de la aplicación (visible solo para Administradores, en `/configuracion/usuarios`) para asignarle el rol y activarla. Si el registro público llegara a estar habilitado, cualquier cuenta creada por esa vía nace **inactiva** y sin acceso a ningún dato hasta que un Administrador la active desde esa misma pantalla.

Diferencia de permisos entre roles (implementada a nivel de base de datos, no solo en la interfaz):
- **Administrador**: acceso total, incluyendo pagos, caja, reportes y gestión de usuarios.
- **Recepción / Técnico**: clientes, equipos, órdenes, diagnósticos, presupuestos, inventario, WhatsApp y garantías — pero sin acceso a pagos, caja ni configuración (esas pantallas no aparecen en el menú y la base de datos las bloquea aunque se intente acceder directo por URL).

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
  core/           auth, guards (autenticación + admin), layout (shell con navegación), servicios de acceso a Supabase
  shared/         componentes reutilizables (toast), validadores y utilidades (teléfono AR, errores de formulario)
  features/
    auth/           login, recuperar/restablecer contraseña
    dashboard/      panel principal con indicadores
    customers/      clientes (listado, ficha, alta/edición)
    devices/        equipos (alta/edición, asociados a un cliente)
    repair-orders/  órdenes de reparación (alta guiada, listado, detalle con estado, pagos, garantía, adjuntos y WhatsApp)
    quotes/         presupuestos con ítems y aprobación del cliente
    inventory/      inventario y movimientos de stock
    cash/           caja (ingresos/egresos) y rentabilidad
    reports/        reportes (ingresos por mes, órdenes por estado, marcas más reparadas)
    tracking/       portal público de seguimiento para clientes (sin login)
    settings/       gestión de usuarios y roles (solo Administrador)
    diagnostics/  warranties/  → cubiertas hoy dentro de repair-orders; carpetas de referencia para separarlas más adelante si crecen
  models/         interfaces TypeScript compartidas
supabase/
  migrations/     migraciones SQL versionadas (0001 a 0006)
  functions/      Edge Functions (send-whatsapp: arquitectura para WhatsApp Business API, no desplegada todavía)
```

## 8. Qué funciona en esta entrega (Etapas 1 a 5)

**Acceso y usuarios**
- Login, cierre de sesión, recuperación de contraseña, rutas protegidas por guard.
- Roles Administrador / Recepción / Técnico con permisos distintos aplicados en la base de datos (no solo en la interfaz): pagos, caja y configuración quedan reservados al Administrador.
- Pantalla de gestión de usuarios (`/configuracion/usuarios`, solo Administrador).

**Clientes y equipos**
- Clientes: alta, edición, ficha con historial de equipos y reparaciones, detección de posibles duplicados por teléfono/DNI.
- Equipos: alta, edición, datos sensibles (PIN/patrón) separados de los listados.

**Órdenes de reparación**
- Alta guiada (cliente → equipo → orden), código automático `ZF-AÑO-NNNNNN` generado por la base de datos.
- Listado con búsqueda y filtros (estado, pago, marca, fechas); detalle con diagnóstico, costos, cambio de estado con historial y hora.
- **Presupuestos**: ítems con cantidad/costo/precio, mano de obra, descuento, vigencia; marcar como enviado; registrar aprobación o rechazo del cliente (sincroniza el precio de la orden automáticamente al aprobar).
- **Pagos**: se registran contra la orden (efectivo, transferencia, tarjeta, billetera virtual); actualizan el saldo pendiente y generan su ingreso en caja solos.
- **Garantías**: se generan al entregar el equipo, con cobertura y vigencia configurables.
- **Comprobante digital en PDF**: se genera en el navegador (sin impresoras), se descarga y queda guardado como adjunto de la orden.
- **Adjuntos**: fotos de recepción/diagnóstico y comprobantes en un bucket privado de Supabase Storage, con acceso por enlace temporal.
- Confirmación antes de marcar una orden como entregada si todavía tiene saldo pendiente.

**Inventario, caja y reportes**
- Inventario de repuestos/insumos con stock mínimo, y movimientos (ingreso/egreso/ajuste) que actualizan el stock automáticamente y quedan como historial permanente.
- Caja: ingresos y egresos (los pagos de órdenes se cargan solos), registro manual de otros movimientos, resultado neto y margen de reparaciones por período.
- Reportes: ingresos por mes, órdenes por estado, marcas más reparadas.

**WhatsApp**
- Plantillas de mensaje, mensaje editable antes de enviar, botón que abre `wa.me` con el número normalizado.
- Registro de "mensaje preparado / WhatsApp abierto" (nunca se afirma que el mensaje fue enviado automáticamente).
- Arquitectura lista para WhatsApp Business API vía Edge Function (`supabase/functions/send-whatsapp`) — no desplegada ni conectada todavía porque requiere credenciales reales de Meta.

**Portal de clientes**
- `/seguimiento` (público, sin login): el cliente ingresa el código de su orden y su WhatsApp, y ve el estado, fecha estimada y saldo — sin exponer costos internos ni datos sensibles del equipo.

Toda la información persiste en PostgreSQL (Supabase), protegida por Row Level Security; nada crítico depende de `localStorage`.

## 9. Qué queda pendiente

- **PWA instalable**: el `manifest.webmanifest` ya está preparado; falta agregar el Service Worker (`ng add @angular/pwa`) para que funcione offline/sea instalable.
- **WhatsApp Business API real**: desplegar la Edge Function `send-whatsapp` y cargar las credenciales de Meta cuando Zentrofix las tenga.
- **Reingresos**: hoy se gestionan creando una nueva orden para el mismo cliente/equipo (el flujo de alta ya permite reutilizarlos) y usando el estado "Garantía o reingreso"; no hay todavía un botón dedicado que enlace automáticamente la orden nueva con la original.
- Diferenciación más fina de permisos entre Recepción y Técnico (hoy comparten el mismo nivel de acceso operativo, distinto del Administrador).
