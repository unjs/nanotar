import { expect, it, describe } from "vitest";
import { inspect } from "node:util";
import { createTarGzip, parseTar, parseTarGzip, TarFileItem } from "../src";
import { readFile } from "node:fs/promises";

const mtime = 1_700_000_000_000;

const fixture: TarFileItem<any>[] = [
  { name: "hello.txt", data: "Hello World!", attrs: { mtime } },
  { name: "test", attrs: { mtime, uid: 1001, gid: 1001 } },
  { name: "foo/bar.txt", data: "Hello World!", attrs: { mtime } },
];

describe("parse", () => {
  it("parseTarGzip", async () => {
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

  it("parseTarGzip (with filter)", async () => {
    const data = await createTarGzip(fixture);
    const files = (
      await parseTarGzip(data, {
        filter: (file) => file.name.startsWith("foo/"),
      })
    ).map((f) => ({
      ...f,
      data: f.data ? inspect(f.data).replace(/\s+/g, " ") : undefined,
    }));
    expect(files.map((f) => f.name)).toMatchObject(["foo/bar.txt"]);
  });

  describe("parse different formats", async () => {
    const formats = ["gnu", "pax", "ustar", "v7"];

    for (const format of formats) {
      it(`parseTar (${format})`, async () => {
        const blob = await readFile(
          new URL(`fixtures/out/${format}.tar`, import.meta.url),
        );
        const parsed = await parseTar(blob);

        const expectedFiles = ["./foo.txt", "./bar/baz.txt"];

        // Long filenames
        if (!["v7", "ustar"].includes(format)) {
          expectedFiles.push(
            `./long/[160]#${"-".repeat(153)}#/file.txt`,
            `./long/[160]#${"-".repeat(153)}#/link`,
          );
        }

        expect(
          parsed
            .filter((i) => i.type !== "directory")
            .map((i) => i.name)
            .sort(),
        ).toMatchObject(expectedFiles.sort());
      });
    }
  });
});
