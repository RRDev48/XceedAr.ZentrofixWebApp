import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.ready()) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (auth.ready()) {
          clearInterval(interval);
          resolve();
        }
      }, 25);
    });
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/ingresar']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.ready()) {
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (auth.ready()) {
          clearInterval(interval);
          resolve();
        }
      }, 25);
    });
  }

  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/panel']);
  }

  return true;
};
