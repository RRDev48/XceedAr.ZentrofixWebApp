// Genera src/environments/environment.ts y environment.prod.ts a partir de
// variables de entorno (SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_BUSINESS_NUMBER).
// Se usa en Vercel/CI, donde esos archivos no están en el repositorio.
// En desarrollo local, si ya existen (copiados desde environment.example.ts), no se tocan.
const fs = require('fs');
const path = require('path');

const envDir = path.join(__dirname, '..', 'src', 'environments');
const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const whatsappNumber = process.env['WHATSAPP_BUSINESS_NUMBER'] || '5490000000000';

function fileContent(production) {
  return `export const environment = {
  production: ${production},
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}',
  whatsappBusinessNumber: '${whatsappNumber}',
  appName: 'Zentrofix — Gestión técnica',
};
`;
}

if (supabaseUrl && supabaseAnonKey) {
  fs.writeFileSync(path.join(envDir, 'environment.ts'), fileContent(false));
  fs.writeFileSync(path.join(envDir, 'environment.prod.ts'), fileContent(true));
  console.log('[generate-env] environment.ts y environment.prod.ts generados desde variables de entorno.');
} else {
  const devFile = path.join(envDir, 'environment.ts');
  if (!fs.existsSync(devFile)) {
    console.warn(
      '[generate-env] No se encontraron SUPABASE_URL / SUPABASE_ANON_KEY ni environment.ts existente.\n' +
        'Copiá src/environments/environment.example.ts a environment.ts y environment.prod.ts, o definí esas variables de entorno.',
    );
  } else {
    console.log('[generate-env] Usando src/environments/environment.ts existente (sin variables de entorno definidas).');
  }
}
