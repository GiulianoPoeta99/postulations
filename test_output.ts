import { compileCv } from "./app/actions";
import fs from "fs";

async function run() {
  const yaml = fs.readFileSync("data/cv_versions/default.yaml", "utf-8");
  const res = await compileCv("default", yaml);
  console.log(res);
}
run().catch(console.error);
