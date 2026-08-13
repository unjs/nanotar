import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createTar, createTarGzip, parseTar, type TarFileItem } from "../src/index.ts";

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

  it("createTar emits GNU L header for filenames >100 bytes", () => {
    const longName =
      "a/very/long/path/that/definitely/exceeds/one/hundred/characters/in/total/length/yes/indeed/this/is/file.txt";
    expect(longName.length).toBeGreaterThan(100);

    const tar = createTar([{ name: longName, data: "hello", attrs: { mtime } }]);

    // Roundtrip: parseTar should recover the full name
    const parsed = parseTar(tar);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.name).toBe(longName);
    expect(parsed[0]!.size).toBe(5);
  });

  it("createTar long filename is readable by system tar", () => {
    const longName =
      "another/very/long/path/that/definitely/exceeds/one/hundred/characters/in/total/length/yes/indeed/file.txt";
    const tar = createTar([{ name: longName, data: "content", attrs: { mtime } }]);

    const listing = execSync("tar -tf-", { input: tar }).toString().trim();
    expect(listing).toBe(longName);
  });
});
