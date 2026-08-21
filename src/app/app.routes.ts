import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'panel' },
  {
    path: 'seguimiento',
    loadComponent: () => import('./features/tracking/tracking.component').then((m) => m.TrackingComponent),
    title: 'Seguimiento de tu equipo — Zentrofix',
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      {
        path: 'ingresar',
        loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'recuperar-contrasena',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.component').then(
            (m) => m.ForgotPasswordComponent,
          ),
      },
      {
        path: 'restablecer-contrasena',
        loadComponent: () =>
          import('./features/auth/forgot-password/reset-password.component').then(
            (m) => m.ResetPasswordComponent,
          ),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'panel',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Panel principal — Zentrofix',
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./features/customers/customer-list/customer-list.component').then(
            (m) => m.CustomerListComponent,
          ),
        title: 'Clientes — Zentrofix',
      },
      {
        path: 'clientes/nuevo',
        loadComponent: () =>
          import('./features/customers/customer-form/customer-form.component').then(
            (m) => m.CustomerFormComponent,
          ),
        canDeactivate: [unsavedChangesGuard],
        title: 'Nuevo cliente — Zentrofix',
      },
      {
        path: 'clientes/:id',
        loadComponent: () =>
          import('./features/customers/customer-detail/customer-detail.component').then(
            (m) => m.CustomerDetailComponent,
          ),
        title: 'Cliente — Zentrofix',
      },
      {
        path: 'clientes/:id/editar',
        loadComponent: () =>
          import('./features/customers/customer-form/customer-form.component').then(
            (m) => m.CustomerFormComponent,
          ),
        canDeactivate: [unsavedChangesGuard],
        title: 'Editar cliente — Zentrofix',
      },
      {
        path: 'clientes/:customerId/equipos/nuevo',
        loadComponent: () => import('./features/devices/device-form.component').then((m) => m.DeviceFormComponent),
        canDeactivate: [unsavedChangesGuard],
        title: 'Nuevo equipo — Zentrofix',
      },
      {
        path: 'equipos/:id/editar',
        loadComponent: () => import('./features/devices/device-form.component').then((m) => m.DeviceFormComponent),
        canDeactivate: [unsavedChangesGuard],
        title: 'Editar equipo — Zentrofix',
      },
      {
        path: 'ordenes',
        loadComponent: () =>
          import('./features/repair-orders/order-list/order-list.component').then((m) => m.OrderListComponent),
        title: 'Órdenes de reparación — Zentrofix',
      },
      {
        path: 'ordenes/nueva',
        loadComponent: () =>
          import('./features/repair-orders/order-form/order-form.component').then((m) => m.OrderFormComponent),
        canDeactivate: [unsavedChangesGuard],
        title: 'Nueva orden — Zentrofix',
      },
      {
        path: 'ordenes/:id',
        loadComponent: () =>
          import('./features/repair-orders/order-detail/order-detail.component').then(
            (m) => m.OrderDetailComponent,
          ),
        title: 'Orden — Zentrofix',
      },
      {
        path: 'ordenes/:originalOrderId/reingreso',
        loadComponent: () =>
          import('./features/repair-orders/order-form/order-form.component').then((m) => m.OrderFormComponent),
        canDeactivate: [unsavedChangesGuard],
        title: 'Nuevo reingreso — Zentrofix',
      },
      {
        path: 'ordenes/:orderId/presupuestos/nuevo',
        loadComponent: () => import('./features/quotes/quote-form.component').then((m) => m.QuoteFormComponent),
        canDeactivate: [unsavedChangesGuard],
        title: 'Nuevo presupuesto — Zentrofix',
      },
      {
        path: 'ordenes/:orderId/presupuestos/:quoteId/editar',
        loadComponent: () => import('./features/quotes/quote-form.component').then((m) => m.QuoteFormComponent),
        canDeactivate: [unsavedChangesGuard],
        title: 'Editar presupuesto — Zentrofix',
      },
      {
        path: 'inventario',
        loadComponent: () =>
          import('./features/inventory/inventory-list.component').then((m) => m.InventoryListComponent),
        title: 'Inventario — Zentrofix',
      },
      {
        path: 'inventario/nuevo',
        loadComponent: () =>
          import('./features/inventory/inventory-form.component').then((m) => m.InventoryFormComponent),
        canDeactivate: [unsavedChangesGuard],
        title: 'Nuevo ítem — Zentrofix',
      },
      {
        path: 'inventario/:id',
        loadComponent: () =>
          import('./features/inventory/inventory-detail.component').then((m) => m.InventoryDetailComponent),
        title: 'Ítem de inventario — Zentrofix',
      },
      {
        path: 'inventario/:id/editar',
        loadComponent: () =>
          import('./features/inventory/inventory-form.component').then((m) => m.InventoryFormComponent),
        canDeactivate: [unsavedChangesGuard],
        title: 'Editar ítem — Zentrofix',
      },
      {
        path: 'caja',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/cash/cash.component').then((m) => m.CashComponent),
        title: 'Caja — Zentrofix',
      },
      {
        path: 'reportes',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent),
        title: 'Reportes — Zentrofix',
      },
      {
        path: 'configuracion/usuarios',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/settings/users.component').then((m) => m.UsersComponent),
        title: 'Usuarios — Zentrofix',
      },
      {
        path: 'actividad',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/audit/audit-log.component').then((m) => m.AuditLogComponent),
        title: 'Actividad reciente — Zentrofix',
      },
    ],
  },
  { path: '**', redirectTo: 'panel' },
];
