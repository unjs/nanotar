import { execSync } from "node:child_process";
import { expect, it, describe } from "vitest";
import { inspect } from "node:util";
import { createTarGzip, parseTarGzip, TarFileItem } from "../src";

const mtime = 1_700_000_000_000;

const fixture: TarFileItem<any>[] = [
  { name: "hello.txt", data: "Hello World!", attrs: { mtime } },
  { name: "test", attrs: { mtime, uid: 1001, gid: 1001 } },
  { name: "foo/bar.txt", data: "Hello World!", attrs: { mtime } },
];

describe("nanotar", () => {
  it("createTar", async () => {
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

  it("parseTar", async () => {
    const data = await createTarGzip(fixture);
    const files = (await parseTarGzip(data)).map((f) => ({
      ...f,
      data: f.data ? inspect(f.data).replace(/\s+/g, " ") : undefined,
    }));
    expect(files).toMatchInlineSnapshot(`
      [
        {
          "attrs": {
            "gid": 1750,
            "group": "",
            "mode": "0000664",
            "mtime": 1700000000,
            "uid": 1750,
            "user": "",
          },
          "data": "Uint8Array(12) [ 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33 ]",
          "name": "hello.txt",
          "size": 12,
          "text": "Hello World!",
          "type": "file",
        },
        {
          "attrs": {
            "gid": 1751,
            "group": "",
            "mode": "0000775",
            "mtime": 1700000000,
            "uid": 1751,
            "user": "",
          },
          "data": undefined,
          "name": "test",
          "size": 0,
          "text": "",
          "type": "directory",
        },
        {
          "attrs": {
            "gid": 1750,
            "group": "",
            "mode": "0000664",
            "mtime": 1700000000,
            "uid": 1750,
            "user": "",
          },
          "data": "Uint8Array(12) [ 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33 ]",
          "name": "foo/bar.txt",
          "size": 12,
          "text": "Hello World!",
          "type": "file",
        },
      ]
    `);
  });
});
