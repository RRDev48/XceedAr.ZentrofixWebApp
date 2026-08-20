import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { normalizeArgentinePhone } from '../utils/phone.util';

export function argentinePhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null;
    }
    const normalized = normalizeArgentinePhone(String(control.value));
    return normalized ? null : { telefonoInvalido: true };
  };
}

export function positiveAmountValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (control.value === null || control.value === undefined || control.value === '') {
      return null;
    }
    const value = Number(control.value);
    if (Number.isNaN(value) || value < 0) {
      return { importeInvalido: true };
    }
    return null;
  };
}

export function imeiOrSerialValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) {
      return null;
    }
    const digitsOnly = /^\d+$/.test(value);
    if (digitsOnly) {
      return value.length >= 14 && value.length <= 16 ? null : { imeiInvalido: true };
    }
    return value.length >= 5 ? null : { imeiInvalido: true };
  };
}

export function dniValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    if (!value) {
      return null;
    }
    const digits = value.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 8 ? null : { dniInvalido: true };
  };
}
