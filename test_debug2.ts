import fs from "fs";
import path from "path";
import { compileCv } from "./app/actions";

async function run() {
  const outputDir = path.join(process.cwd(), "data", "rendercv_output");
  fs.mkdirSync(outputDir, { recursive: true });
  const oldPngPath = path.join(outputDir, "cleanup_1.png");
  fs.writeFileSync(oldPngPath, "old png");
  console.log("Before:", fs.readdirSync(outputDir));
  
  await compileCv("cleanup", "cv:\n  name: Test");
  
  console.log("After:", fs.readdirSync(outputDir));
}

run();
