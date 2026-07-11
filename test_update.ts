import { compileCv } from "./app/actions";
import fs from "fs";

async function run() {
  let yaml = fs.readFileSync("data/cv_versions/default.yaml", "utf-8");
  yaml = yaml.replace("name: default", "name: TEST_NAME");
  console.log("Compiling with TEST_NAME");
  const res = await compileCv("default", yaml);
  console.log(res);
}
run().catch(console.error);
