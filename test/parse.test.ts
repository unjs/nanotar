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

/** Writes an ASCII string into `buffer` at `offset`, NUL padded up to `size`. */
function _writeString(buffer: Uint8Array, str: string, offset: number, size: number) {
  const bytes = new TextEncoder().encode(str);
  buffer.set(bytes.subarray(0, size), offset);
}

/**
 * Builds a raw ustar archive so header fields can be exercised directly.
 *
 * `createTar` always writes the path into the 100-byte `name` field, so it cannot
 * produce the `prefix` split that ustar writers (GNU tar, npm pack, ...) emit for
 * long paths.
 */
function ustarTar(
  entries: { name: string; prefix?: string; type?: string; magic?: string; data?: string }[],
) {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const data = new TextEncoder().encode(entry.data ?? "");
    const header = new Uint8Array(512);
    _writeString(header, entry.name, 0, 100);
    _writeString(header, "0000644\0", 100, 8); // mode
    _writeString(header, "0000000\0", 108, 8); // uid
    _writeString(header, "0000000\0", 116, 8); // gid
    _writeString(header, `${data.length.toString(8).padStart(11, "0")}\0`, 124, 12); // size
    _writeString(header, `${(mtime / 1000).toString(8).padStart(11, "0")}\0`, 136, 12);
    header.fill(32, 148, 156); // checksum placeholder (spaces)
    _writeString(header, entry.type ?? "0", 156, 1);
    _writeString(header, entry.magic ?? "ustar\0", 257, 6);
    _writeString(header, "00", 263, 2); // version
    _writeString(header, entry.prefix ?? "", 345, 155);

    // Checksum is the sum of all header bytes with the field itself read as spaces
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    _writeString(header, `${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8);

    blocks.push(header, data, new Uint8Array((512 - (data.length % 512)) % 512));
  }
  blocks.push(new Uint8Array(1024)); // end-of-archive marker

  const size = blocks.reduce((total, block) => total + block.length, 0);
  const tar = new Uint8Array(size);
  let offset = 0;
  for (const block of blocks) {
    tar.set(block, offset);
    offset += block.length;
  }
  return tar;
}

/** Encodes a single `<len> <key>=<value>\n` pax extended header record. */
function paxRecord(key: string, value: string) {
  const body = ` ${key}=${value}\n`;
  const len = body.length + String(body.length).length;
  return `${len}${body}`;
}

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

describe("ustar prefix field", () => {
  // Paths longer than 100 bytes are split by ustar writers into
  // `prefix` (offset 345, 155 bytes) + "/" + `name` (offset 0, 100 bytes).
  const longDir = "package/node_modules/@scope/some-rather-long-package-name/dist/esm/internal";
  const longName = "a-file-with-a-name-that-pushes-the-path-past-one-hundred-bytes.mjs";

  it("joins prefix and name back into the full path", () => {
    const tar = ustarTar([{ prefix: longDir, name: longName }]);
    expect(parseTar(tar)[0]!.name).toBe(`${longDir}/${longName}`);
  });

  it("ignores the prefix area when the ustar magic is absent", () => {
    // v7 headers leave offset 345 as padding, so any bytes there are not a path prefix.
    const tar = ustarTar([{ prefix: longDir, name: longName, magic: "" }]);
    expect(parseTar(tar)[0]!.name).toBe(longName);
  });

  it("sanitizes traversal sequences coming from the prefix", () => {
    const tar = ustarTar([{ prefix: "../../etc", name: "passwd" }]);
    expect(parseTar(tar)[0]!.name).toBe("etc/passwd");
  });

  it("prefers an extended header path over the prefix", () => {
    const tar = ustarTar([
      { name: "././@PaxHeader", type: "x", data: paxRecord("path", "pax/path.txt") },
      { prefix: longDir, name: longName },
    ]);
    expect(parseTar(tar)[0]!.name).toBe("pax/path.txt");
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
