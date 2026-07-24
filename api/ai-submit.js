// api/ai-submit.js
// Manda la foto a la cola de fal.ai y guarda el request_id.
// Responde de inmediato, NO espera a que termine la generación.

const SUPABASE_URL = 'https://egvtxhtfgkwfyirklkbn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndnR4aHRmZ2t3Znlpcmtsa2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNDM4NTksImV4cCI6MjA5NDcxOTg1OX0.kQ5q1nKAQ847Pm_7jsZ9-NVGKg3xRoqGpUC-PasQqQc';
const BUCKET = 'fotos-eventos';

const PROMPT = `Transform the people in this photo into a classic comic strip illustration style: simple clean black ink outlines, minimal facial features with small dot eyes and simple curved smiles, oversized round heads on small bodies, flat solid pastel colors with no shading or gradients, childlike hand-drawn quality, retro mid-century newspaper comic aesthetic.

Keep the exact same number of people in the same positions and poses. Preserve each person's recognizable features, hairstyle, hair color, skin tone, gender, and the colors and style of their clothing. Keep the plain white background.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // .trim() elimina espacios y saltos de linea invisibles que se cuelan al copiar la clave
  const FAL_KEY = (process.env.FAL_KEY || '').trim();
  if (!FAL_KEY) return res.status(500).json({ error: 'Falta FAL_KEY en Vercel' });

  try {
    const { fotoId, storagePath } = req.body || {};
    if (!fotoId || !storagePath) {
      return res.status(400).json({ error: 'Falta fotoId o storagePath' });
    }

    // URL pública de la foto original en Supabase
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(storagePath)}`;

    // Mandar a la cola de fal (responde de inmediato con request_id)
    const falRes = await fetch('https://queue.fal.run/fal-ai/nano-banana-2/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: PROMPT,
        image_urls: [imageUrl],
        num_images: 1,
        output_resolution: '1K'
      })
    });

    const falData = await falRes.json();

    if (!falRes.ok || !falData.request_id) {
      await updateFoto(fotoId, {
        ai_status: 'failed',
        ai_error: JSON.stringify(falData).slice(0, 400)
      });
      return res.status(502).json({ error: 'fal rechazó la petición', detail: falData });
    }

    // Guardar el request_id para consultarlo después
    await updateFoto(fotoId, {
      ai_request_id: falData.request_id,
      ai_status: 'processing'
    });

    return res.status(200).json({ ok: true, request_id: falData.request_id });

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
