import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import express from "express";
import { listProjectFiles } from "./projectFiles.js";
import type { Message, ProjectSnapshot } from "./types.js";
import { generateWithGemini, generateWithOpenAI } from "./gemini.js";
import { fsTool } from "./tools.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const previewUrl = process.env.PROJECT_PREVIEW_URL ?? "http://localhost:5174";
const messageHistory: Message[] = [];
const summeryMemory: string = '';

const systemPrompt = `You are an assistant for updating a React project. You have access to the following files in the project folder:
${await listProjectFiles().then((files) => files.map((file) => `- ${JSON.stringify(file)}`).join("\n"))}
When you receive a user message, determine which files need to be updated to fulfill the user's request. Only update the files that are necessary. If the user message is not clear, ask for clarification. Always respond with the full content of any file you choose to update. Never respond with just a diff or a part of the file content. Always include the complete content of the updated file in your response.
response format:
{
  "/src/App.tsx": "full content of the file after update",
  "/src/index.ts": "full content of the file after update",
  ...
}`;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/project", async (_request, response) => {
  // you'll use this endpoint to show preview of your running react project , messages  , files , only one project for now is supported.
  // make sure the above state is synced with fe, even some changes are applied
  // return ProjectSnapshot type here

  const snapshot: ProjectSnapshot = {
    summary: "This is a summary of the current project state.",
    messageHistory,
    files: await listProjectFiles(),
    updatedAt: new Date().toISOString(),
    previewUrl
  };
  response.json(snapshot);
});

app.post("/api/messages", async (request, response) => {
  // read user message here and make changes to files present in projects folder in root dir
  // writeProjectFile(path, content). After writes, return a fresh project snapshot.
  const userMessage: string = request.body.message;
  messageHistory.push({ role: "user", content: userMessage, createdAt: new Date().toISOString() });
  const prompt = `${systemPrompt}

Here is the message history of the conversation so far:
${messageHistory.map((message) => `- ${message.role}: ${message.content}`).join("\n")}

Based on the above message history and the user message, determine which files need to be updated to fulfill the user's request. Only update the files that are necessary. If the user message is not clear, ask for clarification. Always respond with the full content of any file you choose to update. Never respond with just a diff or a part of the file content. Always include the complete content of the updated file in your response.

User message: ${userMessage}
`;

  try {
    const assistantResponse = await generateWithOpenAI(prompt);
    messageHistory.push({ role: "assistant", content: assistantResponse, createdAt: new Date().toISOString() });

    // console.log("Assistant Response:", assistantResponse);
    const parsedResponse = JSON.parse(assistantResponse);
    for (const [filePath, fileContent] of Object.entries(parsedResponse)) {
      fsTool(filePath, fileContent as string);
    }
    const snapshot: ProjectSnapshot = {
      summary: "This is a summary of the current project state.",
      messageHistory,
      files: await listProjectFiles(),
      updatedAt: new Date().toISOString(),
      previewUrl
    };
    response.json(snapshot);
  } catch (error) {
    console.error("Error processing message:", error);
    response.status(500).json({ error: "An error occurred while processing the message." });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
