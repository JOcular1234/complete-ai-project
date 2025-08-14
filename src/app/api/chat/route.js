// src/app/api/route.js
import OpenAI from "openai";

export const runtime = "nodejs"; // Ensure it's running in Node.js environment

export async function POST(req) {
  const { message } = await req.json();

  const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: process.env.HF_TOKEN,
  });

  const stream = await client.chat.completions.create({
    model: "openai/gpt-oss-120b:cerebras",
    messages: [{ role: "user", content: message }],
    stream: true, // important for streaming
  });

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const token = chunk.choices?.[0]?.delta?.content || "";
            controller.enqueue(encoder.encode(token));
          }
        } catch (err) {
          console.error(err);
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    }
  );
}
