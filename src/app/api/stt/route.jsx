// // // src/app/api/stt/route.jsx
export const runtime = "nodejs";

export async function POST(req) {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

  if (!ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "ElevenLabs API key missing",
        details: "Please add ELEVENLABS_API_KEY to your .env.local file",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");

    if (!audioFile) {
      return new Response(
        JSON.stringify({
          error: "No audio file uploaded",
          details: "Please upload an audio file in the 'audio' field",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Send to ElevenLabs API
    const apiFormData = new FormData();
    apiFormData.append("file", audioFile, audioFile.name);
    apiFormData.append("model_id", "scribe_v1");
    apiFormData.append("tag_audio_events", "true");
    apiFormData.append("diarize", "true");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("ElevenLabs API error:", errorBody);
      throw new Error(`HTTP error ${response.status}: ${errorBody}`);
    }

    const transcription = await response.json();
    console.log("ElevenLabs API response:", transcription); // Debug log

    // Normalize response fields
    return new Response(
      JSON.stringify({
        text: transcription.text || "No transcription available",
        language: transcription.language_code || "Unknown",
        language_confidence: transcription.language_probability != null ? transcription.language_probability : 0,
        words: transcription.words || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("STT error:", err);
    return new Response(
      JSON.stringify({
        error: "Transcription failed",
        details: err.message || "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}