import { compileCv } from "./app/actions";
async function run() {
  const res = await compileCv("cleanup", "cv:\n  name: Test");
  console.log("Result:", res);
}
run();
