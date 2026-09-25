import { createClient } from 'jsr:@supabase/supabase-js@2';

// El navegador llama a esta función vía supabase.functions.invoke(), que hace un
// fetch cross-origin (la app y la función viven en dominios distintos). El
// Content-Type: application/json dispara un preflight OPTIONS que hay que
// responder explícitamente, y toda respuesta necesita el header CORS.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'No autorizado' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data: authData } = await caller.auth.getUser();
  if (!authData.user) return json({ error: 'No autorizado' }, 401);
  const { data: profile } = await caller.from('profiles').select('role, active, workshop_id').eq('id', authData.user.id).single();
  if (!profile?.active || profile.role !== 'admin') return json({ error: 'Solo un administrador puede crear usuarios' }, 403);
  const workshopId = profile.workshop_id;

  const { email, password, fullName, role = 'tecnico' } = await req.json();
  if (!email || !password || !fullName || !['admin', 'recepcion', 'tecnico'].includes(role)) return json({ error: 'Datos inválidos' }, 400);
  if (String(password).length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // workshop_id sale siempre del perfil del que llama, nunca del body: evita que un
  // admin de un taller cree usuarios en otro taller.
  const { data, error } = await admin.auth.admin.createUser({ email: String(email).trim().toLowerCase(), password,
    email_confirm: true, user_metadata: { full_name: String(fullName).trim(), role, workshop_id: workshopId } });
  if (error || !data.user) return json({ error: error?.message ?? 'No se pudo crear el usuario' }, 400);
  const { error: profileError } = await admin.from('profiles').upsert({ id: data.user.id, email: data.user.email,
    full_name: String(fullName).trim(), role, active: true, workshop_id: workshopId });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return json({ error: profileError.message }, 400);
  }
  return json({ ok: true });
});
