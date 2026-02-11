import { execSync } from "node:child_process";
import { createTarGzip, parseTarGzip } from "../src/index.ts";

async function main() {
  const data = await createTarGzip(
    [
      { name: "README.md", data: "# Hello World!" },
      { name: "test", attrs: { mode: "777", mtime: 0 } },
      { name: "src/index.js", data: "console.log('wow!')" },
    ],
    { attrs: { user: "js", group: "js" } },
  );

  console.log("Len:", data.length);

  console.log(execSync("tar -tvzf-", { input: data }).toString());

  console.log(await parseTarGzip(data));
}

main();
