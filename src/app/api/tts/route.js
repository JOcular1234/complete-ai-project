import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';

export async function POST(req) {
  let text;
  try {
    const body = await req.json();
    text = body.text;
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'Invalid JSON body',
        details: 'Failed to parse request body. Ensure it’s valid JSON with a "text" field.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (!text) {
    return new Response(
      JSON.stringify({
        error: 'Text is required',
        details: 'The "text" field in the request body is missing or empty',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

  if (!ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'ElevenLabs API key missing. Please add ELEVENLABS_API_KEY to your .env.local file.',
        debug: 'No API key found in environment variables',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let audioBuffer;
  let response;
  try {
    response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('API response:', errorBody);
      throw new Error(`HTTP error ${response.status}: ${errorBody}`);
    }

    const audioStream = response.body;
    audioBuffer = await streamToBuffer(audioStream);
  } catch (err) {
    console.error('TTS error:', err);
    console.error('Error details:', {
      statusCode: err.statusCode || response?.status,
      message: err.message,
      body: err.body,
      stack: err.stack,
    });

    if (err.statusCode === 401 || response?.status === 401) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or expired API key. Please check your ElevenLabs API key at https://elevenlabs.io/',
          details:
            'The API key provided is not valid or has expired. Please verify you’re using the correct key from your ElevenLabs dashboard.',
          debug: {
            statusCode: err.statusCode || response?.status,
            hasBody: !!err.body,
            message: err.message,
            keyFormat: ELEVENLABS_API_KEY ? ELEVENLABS_API_KEY.substring(0, 7) : 'none',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (err.statusCode === 401 && err.body?.detail?.status === 'missing_permissions') {
      return new Response(
        JSON.stringify({
          error:
            'API key missing required permissions. Please ensure your ElevenLabs API key has the necessary permissions. You may need to upgrade your plan at https://elevenlabs.io/ or check your API key settings.',
          details: err.body.detail.message,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (err.statusCode || response?.status) {
      return new Response(
        JSON.stringify({
          error: `TTS generation failed (Status: ${err.statusCode || response?.status})`,
          details: err.body?.detail?.message || err.message || 'Unknown error occurred',
        }),
        {
          status: err.statusCode || response?.status || 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'TTS generation failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return the audio buffer directly as an audio/mpeg response
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="tts-${Date.now()}.mp3"`,
    },
  });
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}