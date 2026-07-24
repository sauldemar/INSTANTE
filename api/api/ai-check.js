// api/ai-check.js
// Consulta si el trabajo de fal ya terminó. Si terminó, guarda la imagen en Supabase.

const SUPABASE_URL = 'https://egvtxhtfgkwfyirklkbn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndnR4aHRmZ2t3Znlpcmtsa2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNDM4NTksImV4cCI6MjA5NDcxOTg1OX0.kQ5q1nKAQ847Pm_7jsZ9-NVGKg3xRoqGpUC-PasQqQc';
const BUCKET = 'fotos-eventos';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) return res.status(500).json({ error: 'Falta FAL_KEY en Vercel' });

  try {
    const { fotoId } = req.body || {};
    if (!fotoId) return res.status(400).json({ error: 'Falta fotoId' });

    // Leer el registro
    const rowRes = await fetch(
      `${SUPABASE_URL}/rest/v1/fotos?id=eq.${fotoId}&select=id,ai_status,ai_path,ai_request_id,event_id`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await rowRes.json();
    const foto = rows[0];
    if (!foto) return res.status(404).json({ error: 'Foto no encontrada' });

    // Ya está lista
    if (foto.ai_status === 'done' && foto.ai_path) {
      return res.status(200).json({ status: 'done', ai_path: foto.ai_path });
    }
    if (foto.ai_status === 'failed') {
      return res.status(200).json({ status: 'failed' });
    }
    if (!foto.ai_request_id) {
      return res.status(200).json({ status: 'pending' });
    }

    // Preguntar a fal si ya terminó
    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/nano-banana-2/requests/${foto.ai_request_id}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } }
    );
    const statusData = await statusRes.json();

    if (statusData.status !== 'COMPLETED') {
      return res.status(200).json({ status: 'processing' });
    }

    // Obtener el resultado
    const resultRes = await fetch(
      `https://queue.fal.run/fal-ai/nano-banana-2/requests/${foto.ai_request_id}`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } }
    );
    const result = await resultRes.json();
    const outUrl = result?.images?.[0]?.url;

    if (!outUrl) {
      await updateFoto(fotoId, { ai_status: 'failed', ai_error: 'Sin imagen en respuesta' });
      return res.status(200).json({ status: 'failed' });
    }

    // Descargar la imagen generada
    const imgRes = await fetch(outUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Subir a Supabase Storage
    const aiPath = `${foto.event_id}/ia/${fotoId}_ia.png`;
    const upRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(aiPath)}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true'
        },
        body: imgBuffer
      }
    );

    if (!upRes.ok) {
      const t = await upRes.text();
      await updateFoto(fotoId, { ai_status: 'failed', ai_error: t.slice(0, 400) });
      return res.status(200).json({ status: 'failed', detail: t });
    }

    await updateFoto(fotoId, { ai_status: 'done', ai_path: aiPath });
    return res.status(200).json({ status: 'done', ai_path: aiPath });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateFoto(fotoId, fields) {
  await fetch(`${SUPABASE_URL}/rest/v1/fotos?id=eq.${fotoId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(fields)
  });
}
