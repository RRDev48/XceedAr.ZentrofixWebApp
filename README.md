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
   7. `0007_reingresos.sql` — agrega `related_order_id` para vincular una orden de reingreso con la orden original.
   8. `0008_short_links.sql` — enlaces cortos para compartir el seguimiento de una orden por WhatsApp.
   9. `0009_short_links_reuse.sql` — permite reutilizar un enlace corto existente en vez de generar uno nuevo.
   10. `0010_quotes_soft_delete.sql` — baja lógica de presupuestos (quedan en historial en vez de borrarse).
   11. `0011_feedback_and_audit.sql` — encuesta de satisfacción post-entrega y ajuste de permisos sobre el historial de auditoría.
   12. `0012_quote_items_inventory_link.sql` — vincula ítems de presupuesto con el inventario.
   13. `0013_technician_assignments.sql` — asignación de técnicos a órdenes, con historial auditable.
   14. `0014_role_restrictions.sql` — restringe a Técnico la edición de precios/descuentos y la eliminación de clientes, equipos y órdenes (Administrador y Recepción no cambian).
   15. `0015_workshops_core.sql` — **multi-tenant**: tabla `workshops`, `workshop_id` en todas las tablas de negocio, funciones/triggers para completarlo y bloquear su edición.
   16. `0016_workshop_constraints.sql` — convierte los FKs entre tablas de negocio en FKs compuestos `(columna, workshop_id)`, y corrige constraints de unicidad que antes eran globales (`settings.key`, `inventory_items.sku`, contador de código de orden).
   17. `0017_workshop_rls.sql` — reescribe todas las policies para que ningún usuario vea ni opere sobre datos de otro taller.
   18. `0018_workshop_functions.sql` — ajusta las funciones que corren con privilegios elevados (alta de usuario, auditoría, encuesta pública, asignación de técnicos, generación de código de orden) para que respeten el taller correspondiente.
   19. `0019_workshop_storage.sql` — aísla el bucket `attachments` por taller (el path pasa a ser `{workshop_id}/{orden}/{archivo}`).
3. Verificá en **Table Editor** que las tablas se crearon y que **RLS está activado** (candado verde) en cada una, y en **Storage** que exista el bucket `attachments` (privado).
4. Recomendado (defensa adicional): en **Authentication → Sign In / Providers → Email**, desactivá "Allow new users to sign up". Los usuarios de Zentrofix se crean siempre desde **Authentication → Users → Add user**, nunca por autoregistro.

Cada migración crea objetos nuevos: si necesitás volver a ejecutar todo desde cero en un proyecto ya inicializado, primero corré [`supabase/reset.sql`](supabase/reset.sql) en el SQL Editor para limpiar el esquema `public` y el bucket `attachments`, y después volvé a ejecutar las migraciones en orden. `reset.sql` es destructivo: borra todos los datos de la aplicación (no los usuarios de Supabase Auth). No correrlo nunca contra producción salvo que sea intencional.

**Si el proyecto ya tenía adjuntos reales subidos antes de la migración 0019** (fotos, comprobantes, garantías), esos archivos quedan con el path viejo (`{orden}/{archivo}`) y dejan de matchear las policies nuevas del bucket. Hay que moverlos a `{workshop_id}/{orden}/{archivo}` (el `workshop_id` del taller "Zentrofix" que crea automáticamente la migración 0015) con la Storage API o a mano desde el dashboard — esto no se puede hacer con SQL.

## 4. Crear un taller (workshop) y su primer usuario Administrador

Zentrofix es multi-tenant: cada taller es un cliente independiente y aislado del resto (ningún dato cruza entre talleres). No hay pantalla pública de alta — un taller nuevo se crea siempre con `scripts/admin/provision-workshop.js`, corrido por vos con la `service_role` key (nunca desde el navegador de un cliente):

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key \
  node scripts/admin/provision-workshop.js \
  --name "Taller Acme" --slug acme \
  --admin-name "Juan Pérez" --admin-email juan@acme.com
```

Esto crea la fila en `workshops` (el `slug` — minúsculas/números, 2 a 12 caracteres — queda incrustado en el código de cada orden de ese taller, ej. `ZF-ACME-2026-000001`) y el primer usuario, con rol Administrador y activo. El script imprime una contraseña temporal si no le pasás `--admin-password`; pasásela al cliente para que la cambie en su primer ingreso.

**Importante**: `handle_new_auth_user` ahora exige `workshop_id` en los metadatos del usuario — crear un usuario desde **Authentication → Users → Add user** en el dashboard de Supabase (sin pasar por el script o por `admin-users`) va a fallar. Usá siempre `provision-workshop.js` para el primer usuario de un taller nuevo.

Para sumar usuarios a un taller que ya existe: andá a **Usuarios** dentro de la aplicación (`/configuracion/usuarios`, solo Administradores) y usá "Dar de alta un usuario" — internamente llama a la Edge Function `admin-users`, que asigna automáticamente el mismo `workshop_id` del Administrador que lo está creando (un Administrador nunca puede crear un usuario en otro taller).

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
  migrations/     migraciones SQL versionadas (0001 a 0019)
  functions/      Edge Functions (admin-users: alta de usuarios; send-whatsapp: arquitectura para WhatsApp Business API, no desplegada todavía)
scripts/
  admin/          scripts locales con la service_role key (provision-workshop.js: alta de un taller nuevo)
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
- Alta guiada (cliente → equipo → orden), código automático `ZF-{SLUG del taller}-AÑO-NNNNNN` generado por la base de datos (único por taller, ver sección 4).
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

**PWA y reingresos**
- La app es instalable (PWA): Service Worker con cacheo del shell y los assets, ícono de marca en varios tamaños, funciona offline para las pantallas ya visitadas. Se instala desde el navegador ("Agregar a la pantalla de inicio" / ícono de instalar en la barra de direcciones).
- **Reingresos**: desde el detalle de cualquier orden, el botón "+ Crear reingreso" abre una orden nueva con el mismo cliente y equipo precargados, vinculada automáticamente a la orden original (`related_order_id`). El detalle de cada orden muestra el enlace a la orden original y/o a sus reingresos.

**Permisos por rol (Técnico vs Recepción)**
- Técnico conserva acceso operativo completo (clientes, equipos, órdenes, diagnóstico, inventario, WhatsApp) pero, a nivel de base de datos, no puede: editar precios/descuentos de una orden o presupuesto, ni eliminar/restaurar clientes, equipos u órdenes. Recepción y Administrador no tienen esa restricción.
- La sección "Presupuesto" del detalle de orden y las pantallas de alta/edición de presupuestos quedan ocultas para Técnico en la interfaz, y bloqueadas también en la base de datos (`0014_role_restrictions.sql`) por si se intenta acceder directo por URL o API.

**Multi-tenant (varios talleres en el mismo proyecto)**
- Zentrofix pasó de ser de un solo taller a soportar múltiples talleres (workshops) aislados entre sí en la misma base de datos, vía `workshop_id` + Row Level Security en todas las tablas (migraciones `0015` a `0019`). Ningún taller puede ver, editar ni referenciar datos de otro — reforzado con FKs compuestos, no solo con las policies.
- Alta de un taller nuevo: `scripts/admin/provision-workshop.js` (ver sección 4). No hay ni va a haber un panel que cruce datos entre talleres — cada uno es una caja negra independiente; para soporte/debug entre talleres alcanza con el SQL Editor de Supabase Studio (corre como `postgres`, sin RLS).
- No hay branding por taller todavía: la interfaz logueada sigue mostrando "Zentrofix" para todos. El portal público de seguimiento y los mensajes de WhatsApp tampoco muestran el nombre del taller. Si hace falta más adelante, ya existe `workshops.name` para usarlo ahí.
- Tampoco hay subdominios ni dominio propio por cliente: todos los talleres entran por la misma URL y el taller se resuelve por el usuario logueado.

## 9. Qué queda pendiente

- **WhatsApp Business API real**: desplegar la Edge Function `send-whatsapp` y cargar las credenciales de Meta cuando Zentrofix las tenga.
- **Verificación de aislamiento multi-tenant**: antes de subir clientes reales, sembrar 2 talleres de prueba y correr la checklist de verificación (ver plan de implementación) — RLS por tabla, FKs compuestos, colisión de códigos de orden, aislamiento de Storage, etc.
