import { CanDeactivateFn } from '@angular/router';

export interface CanComponentDeactivate {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (component) => {
  if (component.hasUnsavedChanges()) {
    return window.confirm('Tenés cambios sin guardar. ¿Querés salir de todos modos?');
  }
  return true;
};
