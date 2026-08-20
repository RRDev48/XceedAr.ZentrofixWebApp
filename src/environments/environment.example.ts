// Copiar como environment.ts y environment.prod.ts, y completar con los valores
// reales del proyecto de Supabase (Project Settings > API).
// La "anon key" es pública por diseño (la protección real la da Row Level Security),
// pero de todos modos este archivo de ejemplo no debe contener credenciales reales.
export const environment = {
  production: false,
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU-ANON-KEY',
  whatsappBusinessNumber: '5490000000000',
  appName: 'Zentrofix — Gestión técnica',
};
