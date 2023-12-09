import type { ParsedTarFileItem, TarFileItem } from "./types";

export function parseTar(data: ArrayBuffer | Uint8Array): TarFileItem[] {
  const buffer = (data as Uint8Array).buffer || data;

  const files: ParsedTarFileItem[] = [];

  let offset = 0;

  while (offset < buffer.byteLength - 512) {
    // File name (offset: 0 - length: 100)
    const name = _readString(buffer, offset, 100);
    if (name.length === 0) {
      break;
    }

    // File mode (offset: 100 - length: 8)
    const mode = _readString(buffer, offset + 100, 8);

    // File uid (offset: 108 - length: 8)
    const uid = Number.parseInt(_readString(buffer, offset + 108, 8));

    // File gid (offset: 116 - length: 8)
    const gid = Number.parseInt(_readString(buffer, offset + 116, 8));

    // File size (offset: 124 - length: 12)
    const size = _readNumber(buffer, offset + 124, 12);

    // File mtime (offset: 136 - length: 12)
    const mtime = _readNumber(buffer, offset + 136, 12);

    // File type (offset: 156 - length: 1)
    const _type = _readNumber(buffer, offset + 156, 1);
    const type = _type === 0 ? "file" : (_type === 5 ? "directory" : _type); // prettier-ignore

    // Ustar indicator (offset: 257 - length: 6)
    // Ignore

    // Ustar version (offset: 263 - length: 2)
    // Ignore

    // File owner user (offset: 265 - length: 32)
    const user = _readString(buffer, offset + 265, 32);

    // File owner group (offset: 297 - length: 32)
    const group = _readString(buffer, offset + 297, 32);

    // File data (offset: 512 - length: size)
    const data = new Uint8Array(buffer, offset + 512, size);

    files.push({
      name,
      type,
      size,
      data,
      get text() {
        return new TextDecoder().decode(this.data);
      },
      attrs: {
        mode,
        uid,
        gid,
        mtime,
        user,
        group,
      },
    });

    offset += 512 + 512 * Math.trunc(size / 512);
    if (size % 512) {
      offset += 512;
    }
  }

  return files;
}

export async function parseTarGzip(
  data: ArrayBuffer | Uint8Array,
  opts: { compression?: CompressionFormat } = {},
): Promise<TarFileItem[]> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(data));
      controller.close();
    },
  }).pipeThrough(new DecompressionStream(opts.compression ?? "gzip"));

  const decompressedData = await new Response(stream).arrayBuffer();

  return parseTar(decompressedData);
}

function _readString(buffer: ArrayBuffer, offset: number, size: number) {
  const view = new Uint8Array(buffer, offset, size);
  const i = view.indexOf(0);
  const td = new TextDecoder();
  return td.decode(view.slice(0, i));
}

function _readNumber(buffer: ArrayBuffer, offset: number, size: number) {
  const view = new Uint8Array(buffer, offset, size);
  let str = "";
  for (let i = 0; i < size; i++) {
    str += String.fromCodePoint(view[i]);
  }
  return Number.parseInt(str, 8);
}
