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
});

describe("end-of-archive marker", () => {
  // A tar archive must end with two 512-byte all-zero blocks.
  const hasMarker = (tar: Uint8Array) =>
    tar.length >= 1024 && tar.length % 512 === 0 && tar.subarray(-1024).every((b) => b === 0);

  it("always emits the marker, including on 10240-byte record boundaries", () => {
    // Sweep 20 consecutive block counts so the packed size hits every
    // 512-aligned residue mod 10240, including the exact-multiple case (which
    // regressed to no marker) and the 512-short case (only a single block).
    for (let blocks = 1; blocks <= 20; blocks++) {
      const data = new Uint8Array(blocks * 512).fill(0x41);
      const tar = createTar([{ name: "a.bin", data }]);
      expect(hasMarker(tar), `size ${tar.length}`).toBe(true);
      // ...and the archive still reads back intact (name and payload).
      const [entry] = parseTar(tar);
      expect(entry!.name).toBe("a.bin");
      expect(entry!.data).toEqual(data);
    }
  });

  it("returns a valid empty archive for an empty file list", () => {
    // Previously this returned a zero-length buffer, which is not a valid tar
    // stream; now it is a single all-zero record (marker only, no entries).
    const tar = createTar([]);
    expect(tar.length).toBe(10_240);
    expect(tar.every((b) => b === 0)).toBe(true);
    expect(parseTar(tar)).toEqual([]);
  });
});
