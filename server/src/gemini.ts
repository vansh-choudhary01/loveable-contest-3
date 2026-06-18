import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

export async function generateWithGemini(prompt: string): Promise<string> {
  if (!geminiApiKey) {
    return "Mock mode: GEMINI_API_KEY is not configured, so no files were changed.";
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const result = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  return result.text ?? "";
}
console.log("Environment variables loaded:", {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "configured" : "not configured",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "configured" : "not configured",
  PORT: process.env.PORT ?? "not configured",
  PROJECT_PREVIEW_URL: process.env.PROJECT_PREVIEW_URL ?? "not configured",
});
const openAIApiKey = process.env.OPENAI_API_KEY;
const openAIModelName = process.env.OPENAI_MODEL ?? "gpt-5.5";
const client = new OpenAI({
  apiKey: openAIApiKey,
});

export async function generateWithOpenAI(prompt: string): Promise<string> {
  const response = await client.responses.create({
    model: openAIModelName,
    input: prompt,
  });
  return response.output_text ?? "";
}