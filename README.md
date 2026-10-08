# 📼 nanotar

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]

<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

Tiny and fast [tar](<https://en.wikipedia.org/wiki/Tar_(computing)>) utils for any JavaScript runtime!

🌳 Tiny (~1KB minified + gzipped with all utils) and tree-shakable!

✨ Written with modern TypeScript and ESM format

✅ Works in any JavaScript runtime Node.js (18+), Bun, Deno, Browsers, and Edge Workers

🌐 Web Standard Compatible

🗜️ Built-in compression and decompression support

## Installation

Install package:

```sh
# npm
npm install nanotar

# yarn
yarn add nanotar

# pnpm
pnpm install nanotar

# bun
bun install nanotar
```

Import:

```js
// ESM
import { createTar, createTarGzip, createTarGzipStream, parseTar, parseTarGzip } from "nanotar";

// CommonJS
const { createTar } = require("nanotar");
```

## Creating a tar archive

Easily create a new tar archive using the `createTar` utility.

The first argument is an array of files to archive:

- `name` field is required and you can use `/` to specify files within sub-directories.
- `data` field is optional for directories and can be either a [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String), [`ArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) or [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array).
- `attrs` field is optional for file attributes.

The second argument is for archive options. You can use `attrs` to set default attributes for all files (can still be overridden per file).

Possible attributes are:

- `mtime`: Last modification time. The default is `Date.now()`
- `uid`: Owner user id. The default is `1000`
- `gid`: Owner group id. The default is `1000`
- `user`: Owner user name. The default is `""`
- `group`: Owner user group. The default is `""`
- `mode`: file mode (permissions). Default is `664` (`-rw-rw-r--`) for files and `775` (`-rwxrwxr-x`) for directories

**Example:**

```ts
import { createTar } from "nanotar";

const data = createTar(
  [
    { name: "README.md", data: "# Hello World!" },
    { name: "test", attrs: { mode: "777", mtime: 0 } },
    { name: "src/index.js", data: "console.log('wow!')" },
  ],
  { attrs: { user: "js", group: "js" } },
);

// Data is a Uint8Array view you can send or write to a file
```

### Compression

You can optionally use `createTarGzip` or `createTarGzipStream` to create a compressed tar data stream (returned value is a [`Promise<Uint8Array>`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) or [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) piped to [`CompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream))

```js
import { createTarGzip, createTarGzipStream } from "nanotar";

createTarGzip([]); // Promise<Uint8Array>

createTarGzipStream([]); // ReadableStream
```

## Parsing a tar archive

Easily parse a tar archive using `parseTar` utility.

**Example:**

```ts
import { parseTar } from "nanotar";

// Read tar data from file or other sources into an ArrayBuffer or Uint8Array

const files = parseTar(data);

/**
[
  {
    "type": "file",
    "name": "hello.txt",
    "size": 12,
    "data": Uint8Array [ ... ],
    "text": "Hello World!",
    "attrs": {
      "gid": 1750,
      "group": "",
      "mode": "0000664",
      "mtime": 1702076997,
      "uid": 1750,
      "user": "root",
    },
  },
  ...
]
 */
```

Parsed files array has two additional properties: `size` file size and `text`, a lazy getter that decodes `data` view as a string.

You can filter iterms to read using `filter` option:

```ts
const files = parseTar(data, {
  filter: (file) => file.name.starsWith("dir/"),
});
```

Additionally, you can use `metaOnly` option to skip reading file data and listing purposes:

```ts
const fileMetas = parseTar(data, {
  metaOnly: true,
});
```

### Decompression

If input is compressed, use `parseTarGzip` to decompress and parse it. It uses [`DecompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream) internally and returns a `Promise<ParsedTarFileItem[]>`.

```js
import { parseTarGzip } from "nanotar";

parseTarGzip(data); // Promise<ParsedTarFileItem[]>
```

Use `maxOutputLength` to limit the number of decompressed bytes:

```js
const files = await parseTarGzip(data, {
  maxOutputLength: 10 * 1024 * 1024, // 10 MiB
});
```

The limit must be a non-negative safe integer. It includes tar headers and padding, even when using `filter` or `metaOnly`. Output exactly at the limit is allowed. If the output exceeds the limit, decompression is canceled and the promise rejects with a `RangeError` before tar parsing starts. Invalid limits also reject with a `RangeError`.

No limit is applied when `maxOutputLength` is omitted. A limit of `0` allows only empty decompressed output. The limit controls decompressed bytes, not total process memory.

## Development

- Clone this repository
- Install the latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

## License

Made with 💛

Inspired by [ankitrohatgi/tarballjs](https://github.com/ankitrohatgi/tarballjs)

Published under the [MIT License](./LICENSE).

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/nanotar?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/nanotar
[npm-downloads-src]: https://img.shields.io/npm/dm/nanotar?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/nanotar
[codecov-src]: https://img.shields.io/codecov/c/gh/unjs/nanotar/main?style=flat&colorA=18181B&colorB=F0DB4F
[codecov-href]: https://codecov.io/gh/unjs/nanotar
[bundle-src]: https://img.shields.io/bundlephobia/minzip/nanotar?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=nanotar
