// =====================================================================
// Gestor Zentrofix — Edge Function: envío por WhatsApp Business API
// =====================================================================
// NO está desplegada ni conectada desde Angular todavía: es la
// arquitectura preparada para la Etapa 5, cuando Zentrofix cuente con
// credenciales reales de WhatsApp Business API (Meta Cloud API).
//
// Por qué una Edge Function y no una llamada directa desde Angular:
// el token de acceso de WhatsApp Business es una credencial privada que
// NUNCA debe viajar al navegador. Esta función corre en el servidor de
// Supabase, lee el token desde una variable de entorno secreta
// (`supabase secrets set WHATSAPP_BUSINESS_TOKEN=...`) y es la única
// que se comunica con la API de Meta.
//
// Para activarla en el futuro:
//   1. supabase functions deploy send-whatsapp
//   2. supabase secrets set WHATSAPP_BUSINESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=...
//   3. En Angular, reemplazar (o complementar) el enlace wa.me del
//      WhatsappService por una llamada a
//      supabase.functions.invoke('send-whatsapp', { body: { ... } }),
//      y solo entonces pasar de registrar "mensaje preparado/abierto" a
//      registrar "mensaje enviado" de verdad.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface SendWhatsAppPayload {
  repairOrderId: string;
  destinationPhone: string; // E.164, ej. 5493415123456
  message: string;
}

// El navegador invoca esta función vía supabase.functions.invoke() (cross-origin):
// hay que responder el preflight OPTIONS y devolver el header CORS en toda respuesta.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'No autorizado' }, 401);
  }

  // Valida que quien llama es un usuario autenticado y activo de Zentrofix
  // (mismas reglas que el resto de la app), usando su propio JWT.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'No autorizado' }, 401);
  }
  const { data: profile } = await supabase.from('profiles').select('active').eq('id', userData.user.id).single();
  if (!profile?.active) {
    return json({ error: 'Tu usuario no está activo' }, 403);
  }

  const payload = (await req.json()) as SendWhatsAppPayload;

  const token = Deno.env.get('WHATSAPP_BUSINESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneNumberId) {
    return json({ error: 'WhatsApp Business API todavía no está configurada en este proyecto.' }, 501);
  }

  const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: payload.destinationPhone,
      type: 'text',
      text: { body: payload.message },
    }),
  });

  const result = await metaResponse.json();
  if (!metaResponse.ok) {
    return json({ error: result }, 502);
  }

  // Registra el envío real (a diferencia de communications.status, que hoy
  // solo distingue "preparado" / "abierto_en_whatsapp").
  await supabase.from('communications').insert({
    repair_order_id: payload.repairOrderId,
    channel: 'whatsapp',
    template_type: 'consulta_estado',
    destination_phone: payload.destinationPhone,
    message_text: payload.message,
    status_at_send: 'recibido',
    status: 'abierto_en_whatsapp',
    created_by: userData.user.id,
  });

  return json({ ok: true, result });
});
