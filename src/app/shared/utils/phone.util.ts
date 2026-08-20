/**
 * Normaliza un número de teléfono argentino al formato E.164 requerido por wa.me
 * (54 9 + código de área + número, sin el "15" de celular ni signos).
 */
export function normalizeArgentinePhone(raw: string): string | null {
  if (!raw) {
    return null;
  }
  let digits = raw.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  // Quita el 0 inicial de larga distancia (ej. 0341...)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Ya viene con código de país
  if (digits.startsWith('549')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54')) {
    digits = digits.slice(2);
  }

  // Quita el "15" de celular local (ej. 341 15 1234567 -> 341 1234567)
  digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2');

  if (digits.length < 8 || digits.length > 12) {
    return null;
  }

  return `549${digits}`;
}

export function buildWhatsAppLink(phoneRaw: string, message: string): string | null {
  const normalized = normalizeArgentinePhone(phoneRaw);
  if (!normalized) {
    return null;
  }
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
