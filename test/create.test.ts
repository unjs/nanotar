import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createTarGzip, TarFileItem } from "../src";

const mtime = 1_700_000_000_000;

const fixture: TarFileItem<any>[] = [
  { name: "hello.txt", data: "Hello World!", attrs: { mtime } },
  { name: "test", attrs: { mtime, uid: 1001, gid: 1001 } },
  { name: "foo/bar.txt", data: "Hello World!", attrs: { mtime } },
];

describe("create", () => {
  it("createTarGzip", async () => {
    const data = await createTarGzip(fixture);
    expect(data).toBeInstanceOf(Uint8Array);

    const out = execSync("tar -tzvf-", { input: data })
      .toString()
      .split("\n")
      .map((l) => {
        // other columns might be insconsistent between platforms
        const parts = l.trim().split(/\s+/);
        const mod = parts[0];
        const name = parts.at(-1);
        return `${mod} ${name}`;
      })
      .join("\n");

    expect(out).toMatchInlineSnapshot(`
      "-rw-rw-r-- hello.txt
      drwxrwxr-x test
      -rw-rw-r-- foo/bar.txt
       "
    `);
  });
});
