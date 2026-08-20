import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'panel' },
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
    ],
  },
  { path: '**', redirectTo: 'panel' },
];
