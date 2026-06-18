// put your tools here
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const projectRoot = path.resolve(currentDirectory, "../../project");

export const fsTool = (filePath: string, newContent: string) => {
    console.log(`Updating file: ${filePath}`);

    const path = projectRoot + "/" + filePath;
    fs.writeFileSync(path, newContent);
    if (fs.readFileSync(path, "utf-8") !== newContent) {
        // throw new Error(`Failed to update file: ${filePath}`);
        console.log(`Failed to update file: ${filePath}. This might be due to a file system issue or permission problem.`);
    } else {
        console.log(`File updated: ${filePath}`);
    }
};

// fsTool("src/App.tsx", `import React from "react";

// function App() {
//   return (
//     <div>
//       <h1>Hello, World!</h1>
//     </div>
//   );
// }`);