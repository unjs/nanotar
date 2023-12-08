# 📼 mircrotar

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![Codecov][codecov-src]][codecov-href]

Tiny and fast [Tar](<https://en.wikipedia.org/wiki/Tar_(computing)>) utils for any JavaScript runtime!

🌳 Tiny (less than 1.5KB minified + gzipped) and tree-shakable

✨ Written with modern TypeScript and ESM format

✅ Works in any JavaScript runtime Node.js (18+), Bun, Deno, Browsers, and Edge Workers

🌐 Web Standard Compatible

## Installation

Install package:

```sh
# npm
npm install mircrotar

# yarn
yarn add mircrotar

# pnpm
pnpm install mircrotar

# bun
bun install mircrotar
```

Import:

```js
// ESM
import { parseTar, createTar } from "mircrotar";

// CommonJS
const { parseTar, createTar } = require("mircrotar");
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
import { createTar } from "mircrotar";

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

## Parsing a tar archive

Easily parse a tar archive using `parseTar` utility.

**Example:**

```ts
import { parseTar } from "mircrotar";

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

[npm-version-src]: https://img.shields.io/npm/v/mircrotar?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/mircrotar
[npm-downloads-src]: https://img.shields.io/npm/dm/mircrotar?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/mircrotar
[codecov-src]: https://img.shields.io/codecov/c/gh/unjs/mircrotar/main?style=flat&colorA=18181B&colorB=F0DB4F
[codecov-href]: https://codecov.io/gh/unjs/mircrotar
[bundle-src]: https://img.shields.io/bundlephobia/minzip/mircrotar?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=mircrotar
