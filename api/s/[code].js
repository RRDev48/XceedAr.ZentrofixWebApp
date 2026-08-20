// Resuelve un enlace corto (gestor-zentrofix.vercel.app/s/xxxxxxxx) creado desde
// la app y muestra una página con vista previa de marca (para que WhatsApp genere
// un preview prolijo) con un botón que lleva al archivo real en Supabase Storage.
// No usa la service_role key: solo la anon key pública, igual que el resto del
// frontend, contra una función de base de datos (resolve_short_link) que no
// permite listar la tabla completa.

module.exports = async (req, res) => {
  const code = req.query.code;

  if (!code || typeof code !== 'string') {
    return sendNotFound(res);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(500).send('Configuración incompleta.');
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_short_link`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_code: code }),
    });

    if (!response.ok) {
      return sendNotFound(res);
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row || !row.target_url) {
      return sendNotFound(res);
    }

    return sendLandingPage(res, row.target_url, row.title || 'Comprobante digital');
  } catch {
    return sendNotFound(res);
  }
};

function sendLandingPage(res, targetUrl, title) {
  const safeTitle = escapeHtml(title);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${safeTitle} — Zentrofix</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:title" content="${safeTitle} — Zentrofix">
<meta property="og:description" content="Gestión técnica de reparaciones · Zentrofix">
<meta property="og:image" content="https://gestor-zentrofix.vercel.app/assets/branding/logo-principal.png">
<meta property="og:type" content="website">
<meta name="theme-color" content="#08090c">
<style>
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#08090c; font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding:24px; }
  .card { max-width:380px; width:100%; background:#121620; border:1px solid #23272f;
    border-radius:16px; padding:36px 28px; text-align:center; }
  img { width:56px; height:56px; margin-bottom:18px; }
  h1 { color:#fff; font-size:1.15rem; margin:0 0 6px; font-weight:700; }
  p { color:#8c93a1; font-size:0.88rem; margin:0 0 28px; }
  a.btn { display:inline-block; background:linear-gradient(135deg,#1e9bff,#9c2cff); color:#fff;
    text-decoration:none; font-weight:600; font-size:0.95rem; padding:14px 30px; border-radius:10px; }
  .foot { color:#5b6270; font-size:0.72rem; margin-top:22px; }
</style>
</head>
<body>
  <div class="card">
    <img src="https://gestor-zentrofix.vercel.app/assets/branding/isotipo.png" alt="Zentrofix">
    <h1>${safeTitle}</h1>
    <p>Zentrofix — Gestión técnica</p>
    <a class="btn" href="${targetUrl}">Ver comprobante</a>
    <div class="foot">Este enlace es temporal y de uso personal.</div>
  </div>
</body>
</html>`);
}

function sendNotFound(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(404).send(`<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Enlace no disponible — Zentrofix</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#08090c;color:#8c93a1;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
  <p>Este enlace ya no está disponible. Pedile a Zentrofix que te comparta uno nuevo.</p>
</body>
</html>`);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
