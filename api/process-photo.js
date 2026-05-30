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

    const prForm = new FormData();
    prForm.append('imageFile', imageFile, 'photo.jpg');

    if (bgUrl && bgUrl !== '') {
      prForm.append('background.imageUrl', bgUrl);
    }

    if (orientation === 'vertical') {
      prForm.append('outputSize', '1080x1920');
    } else {
      prForm.append('outputSize', '1920x1080');
    }

    prForm.append('padding', '0.05');
    prForm.append('background.scaling', 'fill');
    prForm.append('export.format', 'jpeg');
    prForm.append('export.quality', '92');

    const prRes = await fetch('https://image-api.photoroom.com/v2/edit', {
      method: 'POST',
      headers: {
        'x-api-key': PHOTOROOM_KEY,
        'Accept': 'image/jpeg, image/png',
      },
      body: prForm
    });

    if (!prRes.ok) {
      const errText = await prRes.text();
      return new Response(JSON.stringify({ error: 'Photoroom: ' + prRes.status + ' - ' + errText }), {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    const imgBlob = await prRes.blob();
    return new Response(imgBlob, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': imgBlob.type || 'image/jpeg',
        'Cache-Control': 'no-store',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  }
}
