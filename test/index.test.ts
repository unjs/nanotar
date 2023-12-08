import { execSync } from 'node:child_process'
import { expect, it, describe } from "vitest";
import { createTar, parseTar, TarFileItem } from "../src";

const mtime = 1_700_000_000_000

const fixture: TarFileItem<any>[] = [
  { name: "hello.txt", data: "Hello World!", attrs: { mtime } },
  { name: "test", attrs: { mtime, uid: 1001, gid: 1001 } },
  { name: "foo/bar.txt", data: "Hello World!", attrs: { mtime } },
]

describe("mircrotar", () => {
  it("createTar", () => {
    const data = createTar(fixture)
    expect(data).toBeInstanceOf(Uint8Array)
    expect(execSync("tar -tvf-", { input: data }).toString()).toMatchInlineSnapshot(`
      "-rw-rw-r--  0 1000   1000       12 Nov 14 23:13 hello.txt
      drwxrwxr-x  0 1001   1001        0 Nov 14 23:13 test
      -rw-rw-r--  0 1000   1000       12 Nov 14 23:13 foo/bar.txt
      "
    `)
  });

  it("parseTar", () => {
    const data = createTar(fixture)
    const files = parseTar(data)
      .map(f => ({ ...f, data: '<hidden>' }))
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
          "data": "<hidden>",
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
          "data": "<hidden>",
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
          "data": "<hidden>",
          "name": "foo/bar.txt",
          "size": 12,
          "text": "Hello World!",
          "type": "file",
        },
      ]
    `)
  });
});
