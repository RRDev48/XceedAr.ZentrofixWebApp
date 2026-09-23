import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.profile()?.role === 'admin') {
    return true;
  }
  return router.createUrlTree(['/panel']);
};

// Presupuestos y precios: reservado a Administrador y Recepción. Técnico
// puede diagnosticar y reparar, pero no fija ni aprueba precios (la base
// de datos aplica la misma restricción vía triggers, ver 0014_role_restrictions.sql).
export const pricingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (['admin', 'recepcion'].includes(auth.profile()?.role ?? '')) {
    return true;
  }
  return router.createUrlTree(['/panel']);
};
