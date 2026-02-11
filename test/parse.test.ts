import { expect, it, describe } from "vitest";
import { inspect } from "node:util";
import { createTar, createTarGzip, parseTar, parseTarGzip, TarFileItem } from "../src";
import { readFile } from "node:fs/promises";

const mtime = 1_700_000_000_000;

const fixture: TarFileItem<any>[] = [
  { name: "hello.txt", data: "Hello World!", attrs: { mtime } },
  { name: "test", attrs: { mtime, uid: 1001, gid: 1001 } },
  { name: "foo/bar.txt", data: "Hello World!", attrs: { mtime } },
];

describe("path traversal prevention", () => {
  it("strips ../ path traversal sequences", () => {
    const tar = createTar([{ name: "../../etc/passwd", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("etc/passwd");
  });

  it("strips leading absolute paths", () => {
    const tar = createTar([{ name: "/etc/shadow", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("etc/shadow");
  });

  it("strips backslash traversal sequences", () => {
    const tar = createTar([{ name: String.raw`..\..\windows\system32\config`, data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("windows/system32/config");
  });

  it("strips drive letter prefixed paths", () => {
    const tar = createTar([{ name: "C:/windows/system32", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("windows/system32");
  });

  it("handles mixed traversal patterns", () => {
    const tar = createTar([{ name: "/foo/../../../etc/passwd", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("etc/passwd");
  });

  it("handles deeply nested traversal", () => {
    const tar = createTar([{ name: "a/b/c/../../../../../../../etc/passwd", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("etc/passwd");
  });

  it("preserves safe relative paths", () => {
    const tar = createTar([{ name: "safe/path/file.txt", data: "safe" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("safe/path/file.txt");
  });

  it("preserves ./ prefix in safe paths", () => {
    const tar = createTar([{ name: "./safe/path/file.txt", data: "safe" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("./safe/path/file.txt");
  });

  it("sanitizes ./ prefix combined with traversal", () => {
    const tar = createTar([{ name: "./../../../etc/passwd", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0].name).toBe("./etc/passwd");
  });
});

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
        const blob = await readFile(new URL(`fixtures/out/${format}.tar`, import.meta.url));
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
