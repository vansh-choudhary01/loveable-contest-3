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
let summeryMemory: string = '';

const summeryGenerationPrompt = `You are an summerizer that summarizes the already summeryzed conversation between a user and an assistant that is trying to update a react project. Your task is to generate a concise summary of the conversation so far, which can be used to provide context for future interactions. The summary should capture the main points and decisions made during the conversation, as well as any important details about the project updates that have been discussed. The summary should be clear, concise, and informative, providing a quick overview of the conversation history without going into unnecessary detail. Here is the conversation history so far:
"${summeryMemory}"
it needs summarize again because the summery memory has a token limit and now the conversation is too long to fit in the context window. Please generate a new summary that captures the most important information from the conversation while staying within the token limit.
try to cut 50% of the content from the original summery, but make sure to keep all important information and details.`;

const systemPrompt = `You are an assistant for updating a React project. You have access to the following files in the project folder:
${await listProjectFiles().then((files) => files.map((file) => `- ${JSON.stringify(file)}`).join("\n"))}
When you receive a user message, determine which files need to be updated to fulfill the user's request. Only update the files that are necessary. If the user message is not clear, ask for clarification. Always respond with the full content of any file you choose to update. Never respond with just a diff or a part of the file content. Always include the complete content of the updated file in your response.
previous conversation summery:
${summeryMemory ? summeryMemory : "No conversation yet."}
response format:
{
  files: {
    "/src/App.tsx": "full content of the file after update",
    "/src/index.ts": "full content of the file after update",
    ...
  },
  appendSummary: "a concise summary of the changes made and the current state of the project after this update, and make sure don't repeat existing summery i'll just append this to the existing summery and use it as context for future interactions"
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
    summary: summeryMemory,
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
    for (const [filePath, fileContent] of Object.entries(parsedResponse.files)) {
      fsTool(filePath, fileContent as string);
    }
    if (parsedResponse.appendSummary) {
      summeryMemory = summeryMemory.concat("\n", parsedResponse.appendSummary);
      console.log("Summary:", parsedResponse.appendSummary);
    }
    const snapshot: ProjectSnapshot = {
      summary: summeryMemory,
      messageHistory,
      files: await listProjectFiles(),
      updatedAt: new Date().toISOString(),
      previewUrl
    };
    response.json(snapshot);

    if (summeryMemory.length > 3000) {
      // console.log('current summery memory:', summeryMemory);
      const summeryResponse = await generateWithOpenAI(summeryGenerationPrompt);
      summeryMemory = summeryResponse;
      console.log("New Summary after summarization:", summeryMemory);
    }
    // console.log('current summery memory length:', summeryMemory.length);
  } catch (error) {
    console.error("Error processing message:", error);
    response.status(500).json({ error: "An error occurred while processing the message." });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
