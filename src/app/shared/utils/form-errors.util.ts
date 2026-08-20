import { ValidationErrors } from '@angular/forms';

const MESSAGES: Record<string, string> = {
  required: 'Este campo es obligatorio.',
  email: 'Ingresá un correo electrónico válido.',
  telefonoInvalido: 'Ingresá un número de WhatsApp argentino válido (ej. 341 5123456).',
  importeInvalido: 'Ingresá un importe válido, mayor o igual a 0.',
  imeiInvalido: 'Ingresá un IMEI (15 dígitos) o número de serie válido.',
  dniInvalido: 'Ingresá un DNI válido (7 u 8 dígitos).',
  minlength: 'El valor ingresado es demasiado corto.',
  maxlength: 'El valor ingresado es demasiado largo.',
  min: 'El valor es menor al permitido.',
  max: 'El valor es mayor al permitido.',
};

export function firstErrorMessage(errors: ValidationErrors | null | undefined): string | null {
  if (!errors) {
    return null;
  }
  const key = Object.keys(errors)[0];
  return MESSAGES[key] ?? 'El valor ingresado no es válido.';
}
