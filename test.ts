import { compileCv } from "./app/actions";
import fs from "fs";
compileCv("default", fs.readFileSync("data/cv_versions/default.yaml", "utf-8")).then(console.log).catch(console.error);
