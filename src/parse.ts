import type { ParsedTarFileItem, ParsedTarFileItemMeta } from "./types.ts";
import { tarItemTypeMap } from "./item-types.ts";

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
>(data: ArrayBuffer | Uint8Array<ArrayBuffer>, opts?: _Opts): _ItemType[] {
  const buffer = (data as Uint8Array<ArrayBuffer>).buffer || data;

  const files: _ItemType[] = [];

  let offset = 0;

  let nextExtendedHeader: undefined | Record<string, string | undefined>;
  let globalExtendedHeader: undefined | Record<string, string | undefined>;

  while (offset < buffer.byteLength - 512) {
    // File name (offset: 0 - length: 100)
    let name = _readString(buffer, offset, 100);
    if (name.length === 0) {
      break;
    }

    // Long file-name handling
    if (nextExtendedHeader) {
      const longName = nextExtendedHeader.path || nextExtendedHeader.linkpath;
      if (longName) {
        name = longName;
      }
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
    // prettier-ignore
    const _type = (_readString(buffer, offset + 156, 1) || "0") as keyof typeof tarItemTypeMap;
    const type = tarItemTypeMap[_type] || _type;

    // Special types
    switch (type) {
      // Extended headers for next entry
      case "extendedHeader" /* x */:
      case "globalExtendedHeader" /* g */: {
        const headers = _parseExtendedHeaders(new Uint8Array(buffer, offset + 512, size));
        if (type === "extendedHeader") {
          nextExtendedHeader = headers;
        } else {
          nextExtendedHeader = undefined;
          globalExtendedHeader = {
            ...globalExtendedHeader,
            ...headers,
          };
        }
        offset += seek;
        continue;
      }
      // GNU tar long file names
      case "gnuLongFileName" /* L */:
      case "gnuOldLongFileName" /* N */:
      case "gnuLongLinkName" /* K */: {
        nextExtendedHeader = { path: _readString(buffer, offset + 512, size) };
        offset += seek;
        continue;
      }
      // No default
    }

    let user, group;
    // Ustar indicator (offset: 257 - length: 6)
    const ustar = _readString(buffer, offset + 257, 6);
    if (ustar == 'ustar'){
      // Ustar version (offset: 263 - length: 2)
      // Ignore

      // File owner user (offset: 265 - length: 32)
      user = _readString(buffer, offset + 265, 32);

      // File owner group (offset: 297 - length: 32)
      group = _readString(buffer, offset + 297, 32);

      // Filename prefix (offset: 345 - length: 155)
      const prefix = _readString(buffer, offset + 345, 155);
      if (prefix){
        const prefixEndsWithSlash = prefix.endsWith('/');
        const nameStartsWithSlash = name.startsWith('/');
        if (prefixEndsWithSlash && nameStartsWithSlash){
          name = prefix + name.substring(1);
        } else if (prefixEndsWithSlash || nameStartsWithSlash){
          name = prefix + name;
        } else {
          name = prefix + '/' + name;
        }
      }
    }

    // Sanitize name to prevent path traversal
    name = _sanitizePath(name);

    // Group all file metadata
    const meta: ParsedTarFileItemMeta = {
      name,
      type,
      size,
      attrs: {
        ...globalExtendedHeader,
        ...nextExtendedHeader,
        mode,
        uid,
        gid,
        mtime,
        user,
        group,
      },
    };

    // Reset next extended header
    nextExtendedHeader = undefined;

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

    // Data (offset: 512 - length: size)
    const data = size === 0 ? undefined : new Uint8Array(buffer, offset + 512, size);

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
  data: ArrayBuffer | Uint8Array<ArrayBuffer>,
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

/**
 * Sanitizes a file path to prevent path traversal attacks.
 * Removes `..` segments, leading slashes, and drive letters.
 */
function _sanitizePath(path: string): string {
  // Normalize backslashes to forward slashes
  let normalized = path.replace(/\\/g, "/");

  // Remove drive letters (e.g., "C:/")
  normalized = normalized.replace(/^[a-zA-Z]:\//, "");

  // Remove leading slashes
  normalized = normalized.replace(/^\/+/, "");

  // Check if it starts with "./" to preserve this common prefix
  const hasLeadingDotSlash = normalized.startsWith("./");

  // Resolve path segments, removing ".." and "."
  const parts = normalized.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }

  let result = resolved.join("/");

  // Restore leading "./" if the original path had it
  if (hasLeadingDotSlash && !result.startsWith("./")) {
    result = "./" + result;
  }

  // Preserve trailing slash (indicates directory)
  if (path.endsWith("/") && !result.endsWith("/")) {
    result += "/";
  }

  return result;
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
    str += String.fromCodePoint(view[i]!);
  }
  return Number.parseInt(str, 8);
}

function _parseExtendedHeaders(data: Uint8Array<ArrayBuffer>) {
  // TODO: Improve performance by using byte offset reads
  const dataStr = new TextDecoder().decode(data);
  const headers: Record<string, string | undefined> = {};
  for (const line of dataStr.split("\n")) {
    const s = line.split(" ")[1]?.split("=");
    if (s) {
      headers[s[0]!] = s[1];
    }
  }
  return headers;
}
