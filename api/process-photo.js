export const config = { runtime: 'edge' };

const PHOTOROOM_KEY = 'sk_pr_default_0e4bfe394304089dc3bb055be84a4071cd2082f3';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image_file');
    const bgUrl = formData.get('background_url');
    const orientation = formData.get('orientation') || 'horizontal';

    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    // Build Photoroom v2 request with proper parameters
    const prForm = new FormData();
    prForm.append('imageFile', imageFile, 'photo.jpg');

    // Background image
    if (bgUrl && bgUrl !== '') {
      prForm.append('background.imageUrl', bgUrl);
    }

    // Output size based on orientation
    if (orientation === 'vertical') {
      prForm.append('outputSize', '1080x1920');
    } else {
      prForm.append('outputSize', '1920x1080');
    }

    // Padding to give subjects some breathing room
    prForm.append('padding', '0.08');

    // AI Shadow for realistic grounding
    prForm.append('shadow.mode', 'ai.preset-soft');

    // AI Lighting to match background
    prForm.append('lighting.mode', 'ai.auto');

    // Background scaling to fill
    prForm.append('background.scaling', 'fill');

    // High quality export
    prForm.append('export.format', 'jpeg');
    prForm.append('export.quality', '95');

    const prRes = await fetch('https://image-api.photoroom.com/v2/edit', {
      method: 'POST',
      headers: {
        'x-api-key': PHOTOROOM_KEY,
        'Accept': 'image/jpeg',
        'pr-ai-shadows-model-version': '2026-04-15',
      },
      body: prForm
    });

    if (!prRes.ok) {
      const errText = await prRes.text();
      console.error('Photoroom v2 error:', prRes.status, errText);

      return new Response(JSON.stringify({ error: 'Photoroom: ' + prRes.status + ' - ' + errText }), {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    const imgBlob = await prRes.blob();
    return new Response(imgBlob, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      }
    });

  } catch (err) {
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  }
}
