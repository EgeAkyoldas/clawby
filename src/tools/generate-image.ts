import { SchemaType } from "@google/generative-ai";
import type { ToolDefinition } from "../agent/types.js";
import { config } from "../config.js";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

async function generateImage(prompt: string): Promise<string> {
  const res = await fetch(`${API_URL}?key=${config.modelApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`  🖼️ Image gen error ${res.status}:`, errBody.slice(0, 200));
    return JSON.stringify({ error: `Image generation failed: ${res.status}` });
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType: string; data: string };
        }>;
      };
    }>;
  };

  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts) {
    return JSON.stringify({ error: "No image generated" });
  }

  // Find the image part
  const imagePart = parts.find((p) => p.inlineData);
  const textPart = parts.find((p) => p.text);

  if (!imagePart?.inlineData) {
    return JSON.stringify({ error: "Model did not return an image", text: textPart?.text });
  }

  console.log(`  🖼️ Image generated (${imagePart.inlineData.mimeType})`);

  return JSON.stringify({
    image: {
      data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    },
    caption: textPart?.text || prompt,
  });
}

export const generateImageTool: ToolDefinition = {
  declaration: {
    name: "generate_image",
    description: "Generate an image from a text description using Gemini. The image will be sent as a photo in the chat. Use this when the user asks to create, draw, generate, or visualize an image.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        prompt: {
          type: SchemaType.STRING,
          description: "Detailed description of the image to generate. Be specific about style, colors, composition, and subject.",
        },
      },
      required: ["prompt"],
    },
  },
  execute: async (args) => generateImage(args.prompt as string),
};
