// Provisiona un taller (workshop) nuevo + su primer usuario Administrador.
//
// Reemplaza el flujo manual de "Dashboard > Add user + editar SQL a mano"
// que se usaba para el taller único de Zentrofix. Corré esto vos (el dueño
// del software), nunca desde el navegador del cliente: usa la
// SUPABASE_SERVICE_ROLE_KEY, que ignora RLS por completo.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/admin/provision-workshop.js \
//     --name "Taller Acme" --slug acme \
//     --admin-name "Juan Pérez" --admin-email juan@acme.com \
//     [--admin-password "unaClaveSegura123"]
//
// Si no se pasa --admin-password, se genera una temporal (mostrala al
// cliente una sola vez y pedile que la cambie en su primer ingreso).

const { createClient } = require('@supabase/supabase-js');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      args[key] = value;
      if (value !== true) i += 1;
    }
  }
  return args;
}

function randomPassword() {
  return Buffer.from(String(Math.random()) + String(Date.now()))
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 14);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { url, serviceRoleKey } = readEnv();

  const name = args['name'];
  const slug = args['slug'];
  const adminName = args['admin-name'];
  const adminEmail = args['admin-email'];
  const adminPassword = typeof args['admin-password'] === 'string' ? args['admin-password'] : randomPassword();

  if (!name || !slug || !adminName || !adminEmail) {
    console.error('Faltan argumentos. Uso: --name --slug --admin-name --admin-email [--admin-password]');
    process.exit(1);
  }
  if (!/^[a-z0-9]{2,12}$/.test(slug)) {
    console.error('--slug debe ser minúsculas/números, 2 a 12 caracteres (ej. "acme"). Se usa en los códigos de orden del taller.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey);

  console.log(`Creando taller "${name}" (slug: ${slug})...`);
  const { data: workshop, error: workshopError } = await supabase
    .from('workshops')
    .insert({ name, slug })
    .select('id')
    .single();
  if (workshopError) {
    console.error('No se pudo crear el taller:', workshopError.message);
    process.exit(1);
  }

  console.log(`Creando usuario administrador ${adminEmail}...`);
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: adminEmail.trim().toLowerCase(),
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: adminName.trim(), role: 'admin', workshop_id: workshop.id },
  });
  if (userError || !userData.user) {
    console.error('No se pudo crear el usuario (revirtiendo el taller creado):', userError?.message);
    await supabase.from('workshops').delete().eq('id', workshop.id);
    process.exit(1);
  }

  // Defensa adicional: el trigger handle_new_auth_user ya crea el perfil a
  // partir de los metadatos de arriba, pero lo confirmamos explícitamente
  // por si ese flujo cambia en el futuro (mismo patrón que admin-users/index.ts).
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userData.user.id,
    email: userData.user.email,
    full_name: adminName.trim(),
    role: 'admin',
    active: true,
    workshop_id: workshop.id,
  });
  if (profileError) {
    console.error('El usuario se creó pero el perfil falló:', profileError.message);
    process.exit(1);
  }

  console.log('\n✔ Taller y administrador creados.');
  console.log(`  Taller:   ${name} (${workshop.id}), slug "${slug}"`);
  console.log(`  Usuario:  ${adminEmail}`);
  console.log(`  Password: ${adminPassword}`);
  console.log('\nPasale estas credenciales al cliente y pedile que cambie la contraseña en su primer ingreso.');
}

function readEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('Definí SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY como variables de entorno antes de correr este script.');
    process.exit(1);
  }
  return { url, serviceRoleKey };
}

main().catch((error) => {
  console.error('Error inesperado:', error);
  process.exit(1);
});
