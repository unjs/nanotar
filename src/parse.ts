import {
  emptyTarEntryHeaders,
  TarEntryCtor,
  tarEntryHeaderKeys,
  tarEntryHeaders,
  tarNumericHeaders,
} from "./entry";
import type { TarEntry, TarEntryHeaders, TarEntryHeaderKey } from "./entry";

export interface ParseTarOptions {
  /**
   * A filter function that determines whether a file entry should be skipped or not.
   */
  filter?: (entry: TarEntryHeaders) => boolean;

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
  _EntryType extends TarEntry | TarEntryHeaders =
     _Opts["metaOnly"] extends true ? TarEntryHeaders : TarEntry,
>(_data: ArrayBuffer | Uint8Array, opts?: _Opts): _EntryType[] {
  const data = _data instanceof Uint8Array ? _data : new Uint8Array(_data);

  const entries: _EntryType[] = [];

  let offset = 0;

  let nextExtendedHeader: undefined | Partial<TarEntryHeaders>;
  let globalExtendedHeader: undefined | Partial<TarEntryHeaders>;

  const tarEntryView: ProxyHandler<Partial<TarEntry> & { data: Uint8Array }> = {
    get(self, prop) {
      let value = self[prop as TarEntryHeaderKey];
      if (value !== undefined) {
        return value;
      }
      const h = tarEntryHeaders[prop as TarEntryHeaderKey];
      if (!h) {
        return undefined;
      }
      value = tarNumericHeaders.has(prop as any)
        ? readNumber(self.data, h[0], h[1])
        : readString(self.data, h[0], h[1]);
      return (self[prop as TarEntryHeaderKey] = value);
    },
    ownKeys() {
      return tarEntryHeaderKeys;
    },
  };

  while (offset < data.byteLength - 512) {
    const entryData = data.subarray(offset, 512);
    const entryObj = new TarEntryCtor(entryData);
    const entry = new Proxy(entryObj, tarEntryView);

    if (entry.path.length === 0) {
      break;
    }

    const size = entry.size || 0;
    const seek = 512 + 512 * Math.trunc(size / 512) + (size % 512 ? 512 : 0);

    // Special types for next entry
    switch (entry.typeFlag) {
      case "x" /* extendedHeader */:
      case "g" /* globalExtendedHeader */: {
        const headers = parseExtendedHeaders(data.subarray(offset + 512, size));
        if (entry.typeFlag === "x") {
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
      case "L" /* gnuLongFileName */:
      case "N" /* gnuOldLongFileName */:
      case "K" /* gnuLongLinkName */: {
        nextExtendedHeader = { path: readString(data, offset + 512, size) };
        offset += seek;
        continue;
      }
    }

    // Reset next extended header
    nextExtendedHeader = undefined;

    // Filter
    if (opts?.filter && !opts.filter(entry)) {
      offset += seek;
      continue;
    }

    // Meta-only mode
    if (opts?.metaOnly) {
      entries.push(entry as _EntryType);
      offset += seek;
      continue;
    }

    entries.push(entry as _EntryType);

    // Next
    offset += seek;
  }

  return entries;
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

// ---- Headers Data View ----

const textDecoder = new TextDecoder();

function readString(data: Uint8Array, offset: number, size: number): string {
  const view = data.subarray(offset, offset + size);
  const i = view.indexOf(0);
  return textDecoder.decode(i === -1 ? view : view.slice(0, i));
}

function readNumber(data: Uint8Array, offset: number, size: number): number {
  const view = data.subarray(offset, offset + size);
  let str = "";
  for (let i = 0; i < size; i++) {
    str += String.fromCodePoint(view[i]);
  }
  return Number.parseInt(str, 8);
}

function parseExtendedHeaders(data: Uint8Array) {
  // TODO: Improve performance by using byte offset reads
  const dataStr = new TextDecoder().decode(data);
  const headers: Record<string, string> = {};
  for (const line of dataStr.split("\n")) {
    const s = line.split(" ")[1]?.split("=");
    if (s) {
      headers[s[0]] = s[1];
    }
  }
  return headers;
}
