import { execSync } from "node:child_process";
import { parseTar, createTar } from "../src";

const data = createTar(
  [
    { name: "README.md", data: "# Hello World!" },
    { name: "test", attrs: { mode: "777", mtime: 0 } },
    { name: "src/index.js", data: "console.log('wow!')" },
  ],
  { attrs: { user: "js", group: "js" } },
);

console.log(execSync("tar -tvf-", { input: data }).toString());

console.log(parseTar(data));
