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
    const outputFormat = formData.get('output_format') || 'jpeg';

    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image provided' }), { status: 400 });
    }

    // Build Photoroom request
    const prForm = new FormData();
    prForm.append('imageFile', imageFile, 'photo.jpg');

    // If background URL provided, use it
    if (bgUrl && bgUrl !== '') {
      prForm.append('background.imageUrl', bgUrl);
    }

    // Photoroom settings for professional portrait integration
    prForm.append('outputSize', 'original');
    prForm.append('outputFormat', outputFormat);
    prForm.append('shadow.mode', 'ai.soft'); // AI soft shadow
    prForm.append('lighting.mode', 'ai.auto'); // AI lighting match
    prForm.append('background.scaling', 'fill');

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
      console.error('Photoroom error:', prRes.status, errText);

      // Fallback to v1 segment if v2 fails
      const prForm2 = new FormData();
      prForm2.append('image_file', imageFile, 'photo.jpg');
      prForm2.append('size', 'auto');
      prForm2.append('format', outputFormat);
      if (bgUrl && bgUrl !== '') {
        prForm2.append('bg_image_url', bgUrl);
      }

      const prRes2 = await fetch('https://sdk.photoroom.com/v1/segment', {
        method: 'POST',
        headers: { 'x-api-key': PHOTOROOM_KEY },
        body: prForm2
      });

      if (!prRes2.ok) {
        const err2 = await prRes2.text();
        return new Response(JSON.stringify({ error: 'Photoroom failed: ' + err2 }), {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }

      const imgBlob2 = await prRes2.blob();
      return new Response(imgBlob2, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': imgBlob2.type || 'image/png',
          'Cache-Control': 'no-store',
        }
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
    console.error('Function error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  }
}
