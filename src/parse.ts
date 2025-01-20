import type { ParsedTarFileItem, ParsedTarFileItemMeta } from "./types";

const TAR_TYPE_FILE = 0;
const TAR_TYPE_DIR = 5;

export interface ParseTarOptions {
  /**
   * A filter function that determines whether a file entry should be skipped or not.
   */
  filter?: (file: ParsedTarFileItemMeta) => boolean;

  /**
   * If `true`, only the metadata of the files will be parsed, and the file data will be omitted for listing purposes.
   */
  metaOnly?: boolean;
}

/**
 * Parses a TAR file from a binary buffer and returns an array of {@link TarFileItem} objects.
 *
 * @param {ArrayBuffer | Uint8Array} data - The binary data of the TAR file.
 * @returns {ParsedTarFileItem[]} An array of file items contained in the TAR file.
 */
export function parseTar<
  _ = never,
  _Opts extends ParseTarOptions = ParseTarOptions,
  // prettier-ignore
  _ItemType extends ParsedTarFileItem | ParsedTarFileItemMeta =
     _Opts["metaOnly"] extends true ? ParsedTarFileItemMeta : ParsedTarFileItem,
>(data: ArrayBuffer | Uint8Array, opts?: _Opts): _ItemType[] {
  const buffer = (data as Uint8Array).buffer || data;

  const files: _ItemType[] = [];

  let offset = 0;

  while (offset < buffer.byteLength - 512) {
    // File name (offset: 0 - length: 100)
    const name = _readString(buffer, offset, 100);
    if (name.length === 0) {
      break;
    }

    // File mode (offset: 100 - length: 8)
    const mode = _readString(buffer, offset + 100, 8).trim();

    // File uid (offset: 108 - length: 8)
    const uid = Number.parseInt(_readString(buffer, offset + 108, 8));

    // File gid (offset: 116 - length: 8)
    const gid = Number.parseInt(_readString(buffer, offset + 116, 8));

    // File size (offset: 124 - length: 12)
    const size = _readNumber(buffer, offset + 124, 12);

    // Calculate next seek offset based on size
    const seek = 512 + 512 * Math.trunc(size / 512) + (size % 512 ? 512 : 0);

    // File mtime (offset: 136 - length: 12)
    const mtime = _readNumber(buffer, offset + 136, 12);

    // File type (offset: 156 - length: 1)
    const _type = _readNumber(buffer, offset + 156, 1);
    const type = _type === TAR_TYPE_FILE ? "file" : (_type === TAR_TYPE_DIR ? "directory" : _type); // prettier-ignore

    // Ustar indicator (offset: 257 - length: 6)
    // Ignore

    // Ustar version (offset: 263 - length: 2)
    // Ignore

    // File owner user (offset: 265 - length: 32)
    const user = _readString(buffer, offset + 265, 32);

    // File owner group (offset: 297 - length: 32)
    const group = _readString(buffer, offset + 297, 32);

    // Group all file metadata
    const meta: ParsedTarFileItemMeta = {
      name,
      type,
      size,
      attrs: {
        mode,
        uid,
        gid,
        mtime,
        user,
        group,
      },
    };

    // Filter
    if (opts?.filter && !opts.filter(meta)) {
      offset += seek;
      continue;
    }

    // Meta-only mode
    if (opts?.metaOnly) {
      files.push(meta as _ItemType);
      offset += seek;
      continue;
    }

    // File data (offset: 512 - length: size)
    const data =
      _type === TAR_TYPE_DIR
        ? undefined
        : new Uint8Array(buffer, offset + 512, size);

    files.push({
      ...meta,
      data,
      get text() {
        return new TextDecoder().decode(this.data);
      },
    } satisfies ParsedTarFileItem as _ItemType);

    offset += seek;
  }

  return files;
}

/**
 * Decompresses a gzipped TAR file and parses it to produce an array of file elements.
 * This function handles the decompression of the gzip format before parsing the contents of the TAR.
 *
 * @param {ArrayBuffer | Uint8Array} data - The binary data of the gzipped TAR file.
 * @param {object} opts - Decompression options.
 * @param {CompressionFormat} [opts.compression="gzip"] - Specifies the compression format to use, defaults to `"gzip"`.
 * @returns {Promise<TarFileItem[]>} A promise that resolves to an array of file items as described by {@link TarFileItem}.
 */
export async function parseTarGzip(
  data: ArrayBuffer | Uint8Array,
  opts: ParseTarOptions & { compression?: CompressionFormat } = {},
): Promise<ParsedTarFileItem[]> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(data));
      controller.close();
    },
  }).pipeThrough(new DecompressionStream(opts.compression ?? "gzip"));

  const decompressedData = await new Response(stream).arrayBuffer();

  return parseTar(decompressedData, opts);
}

function _readString(buffer: ArrayBufferLike, offset: number, size: number) {
  const view = new Uint8Array(buffer, offset, size);
  const i = view.indexOf(0);
  const td = new TextDecoder();
  return td.decode(i === -1 ? view : view.slice(0, i));
}

function _readNumber(buffer: ArrayBufferLike, offset: number, size: number) {
  const view = new Uint8Array(buffer, offset, size);
  let str = "";
  for (let i = 0; i < size; i++) {
    str += String.fromCodePoint(view[i]);
  }
  return Number.parseInt(str, 8);
}
