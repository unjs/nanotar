import { expect, it, describe } from "vitest";
import { inspect } from "node:util";
import {
  createTar,
  createTarGzip,
  parseTar,
  parseTarGzip,
  type TarFileItem,
} from "../src/index.ts";
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
    expect(files[0]!.name).toBe("etc/passwd");
  });

  it("strips leading absolute paths", () => {
    const tar = createTar([{ name: "/etc/shadow", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0]!.name).toBe("etc/shadow");
  });

  it("strips backslash traversal sequences", () => {
    const tar = createTar([{ name: String.raw`..\..\windows\system32\config`, data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0]!.name).toBe("windows/system32/config");
  });

  it("strips drive letter prefixed paths", () => {
    const tar = createTar([{ name: "C:/windows/system32", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0]!.name).toBe("windows/system32");
  });

  it("handles mixed traversal patterns", () => {
    const tar = createTar([{ name: "/foo/../../../etc/passwd", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0]!.name).toBe("etc/passwd");
  });

  it("handles deeply nested traversal", () => {
    const tar = createTar([{ name: "a/b/c/../../../../../../../etc/passwd", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0]!.name).toBe("etc/passwd");
  });

  it("preserves safe relative paths", () => {
    const tar = createTar([{ name: "safe/path/file.txt", data: "safe" }]);
    const files = parseTar(tar);
    expect(files[0]!.name).toBe("safe/path/file.txt");
  });

  it("preserves ./ prefix in safe paths", () => {
    const tar = createTar([{ name: "./safe/path/file.txt", data: "safe" }]);
    const files = parseTar(tar);
    expect(files[0]!.name).toBe("./safe/path/file.txt");
  });

  it("sanitizes ./ prefix combined with traversal", () => {
    const tar = createTar([{ name: "./../../../etc/passwd", data: "malicious" }]);
    const files = parseTar(tar);
    expect(files[0]!.name).toBe("./etc/passwd");
  });
});

describe("pax extended headers", () => {
  /**
   * Build a PAX record: `"%d %s=%s\n"` where the leading decimal is the total
   * byte length of the record, including the digits, the space and the newline.
   */
  function paxRecord(key: string, value: string): string {
    const rest = ` ${key}=${value}\n`;
    let length = rest.length;
    // The length prefix is part of the length it describes.
    while (String(length).length + rest.length !== length) {
      length = String(length).length + rest.length;
    }
    return String(length) + rest;
  }

  /**
   * Create a tar with a PAX extended header entry (typeflag `x`) followed by
   * the file it applies to. `createTar` has no typeflag option, so the type
   * byte of the first header is patched afterwards.
   */
  function createPaxTar(records: string, file: TarFileItem<string>) {
    const tar = createTar([{ name: "PaxHeaders/0", data: records, attrs: { mtime } }, file]);
    tar[156] = "x".charCodeAt(0); // typeflag of the first header
    return tar;
  }

  it("keeps spaces in a long file name", () => {
    const name = `${"a".repeat(120)} with spaces.txt`;
    const tar = createPaxTar(paxRecord("path", name), {
      name: name.slice(0, 100),
      data: "x",
      attrs: { mtime },
    });
    expect(parseTar(tar)[0]!.name).toBe(name);
  });

  it("keeps `=` in a long file name", () => {
    const name = `${"a".repeat(120)}=equals.txt`;
    const tar = createPaxTar(paxRecord("path", name), {
      name: name.slice(0, 100),
      data: "x",
      attrs: { mtime },
    });
    expect(parseTar(tar)[0]!.name).toBe(name);
  });

  it("parses consecutive records", () => {
    const name = "b".repeat(120);
    const records = paxRecord("comment", "a b=c") + paxRecord("path", name);
    const tar = createPaxTar(records, { name: name.slice(0, 100), data: "x", attrs: { mtime } });
    const file = parseTar(tar)[0]!;
    expect(file.name).toBe(name);
    expect((file.attrs as Record<string, unknown>).comment).toBe("a b=c");
  });

  it("ignores a truncated record instead of emitting a bogus key", () => {
    const tar = createPaxTar(`${paxRecord("path", "ok.txt")}999 comment=truncated\n`, {
      name: "fallback.txt",
      data: "x",
      attrs: { mtime },
    });
    const file = parseTar(tar)[0]!;
    expect(file.name).toBe("ok.txt");
    expect((file.attrs as Record<string, unknown>).comment).toBeUndefined();
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
