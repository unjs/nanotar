import type { TarFileItem, TarFileAttrs } from "./types";

export interface CreateTarOptions {
  /**
   * Default attributes applied to all file unless overridden. See {@link TarFileAttrs}.
   * @optional
   */
  attrs?: TarFileAttrs;
}

export type TarFileInput = TarFileItem<string | Uint8Array | ArrayBuffer>;

/**
 * Creates a TAR file from a list of file inputs and options, returning the TAR file as an `Uint8Array`.
 * This function takes care of normalising the file data, setting default attributes and calculating the TAR structure.
 *
 * @param {TarFileInput[]} files - An array of files to include in the TAR archive. Each file can contain different data types. See {@link TarFileInput}.
 * @param {CreateTarOptions} opts - File creation configuration options, including default file attributes. See {@link CreateTarOptions}.
 * @returns {Uint8Array} The TAR file encoded as an `Uint8Array`.
 */
export function createTar(files: TarFileInput[], opts: CreateTarOptions = {}): Uint8Array {
  // Normalize file data in order to allow calculating final size
  type NormalizedFile = TarFileItem<Uint8Array> & { size: number };
  const _files: NormalizedFile[] = files.map((file) => {
    const data = _normalizeData(file.data);
    return {
      ...file,
      data,
      size: data?.length || 0,
    };
  });

  // Create data buffer
  let tarDataSize = 0;
  for (let i = 0; i < files.length; i++) {
    const size = _files[i].data?.length ?? 0;
    tarDataSize += 512 + 512 * Math.trunc(size / 512);
    if (size % 512) {
      tarDataSize += 512;
    }
  }
  let bufSize = 10_240 * Math.trunc(tarDataSize / 10_240);
  if (tarDataSize % 10_240) {
    bufSize += 10_240;
  }
  const buffer = new ArrayBuffer(bufSize);

  let offset = 0;

  for (const file of _files) {
    const isDir = !file.data;

    // -- Header --
    // File name (offset: 0 - length: 100)
    _writeString(buffer, file.name, offset, 100);

    // File mode (offset: 100 - length: 8)
    const mode = file.attrs?.mode ?? opts.attrs?.mode ?? (isDir ? "775" : "664");
    _writeString(buffer, _leftPad(mode, 7), offset + 100, 8);

    // File uid (offset: 108 - length: 8)
    const uid = file.attrs?.uid ?? opts.attrs?.uid ?? 1000;
    _writeString(buffer, _leftPad(uid.toString(8), 7), offset + 108, 8);

    // File gid (offset: 116 - length: 8)
    const gid = file.attrs?.gid ?? opts.attrs?.gid ?? 1000;
    _writeString(buffer, _leftPad(gid.toString(8), 7), offset + 116, 8);

    // File size (offset: 124 - length: 12)
    _writeString(buffer, _leftPad(file.size.toString(8), 11), offset + 124, 12);

    // File mtime (offset: 136 - length: 12)
    const mtime = file.attrs?.mtime ?? opts.attrs?.mtime ?? Date.now();
    _writeString(buffer, _leftPad(Math.trunc(mtime / 1000).toString(8), 11), offset + 136, 12);

    // File type (offset: 156 - length: 1)
    const type = isDir ? "5" : "0";
    _writeString(buffer, type, offset + 156, 1);

    // USTAR indicator (offset: 257 - length: 512)
    _writeString(buffer, "ustar", offset + 257, 6 /* magic string */);

    // USTAR version (offset: 263 - length: 2)
    _writeString(buffer, "00", offset + 263, 2 /* magic version */);

    // File owner user (offset: 265 - length: 32)
    const user = file.attrs?.user ?? opts.attrs?.user ?? "";
    _writeString(buffer, user, offset + 265, 32);

    // File owner group (offset: 297 - length: 32)
    const group = file.attrs?.group ?? opts.attrs?.group ?? "";
    _writeString(buffer, group, offset + 297, 32);

    // Checksum (offset: 148 - length: 8) -- must be last
    _writeString(buffer, "        ", offset + 148, 8);
    const header = new Uint8Array(buffer, offset, 512);
    let chksum = 0;
    for (let i = 0; i < 512; i++) {
      chksum += header[i];
    }
    _writeString(buffer, chksum.toString(8), offset + 148, 8);

    // -- Data --
    if (!isDir) {
      const destArray = new Uint8Array(buffer, offset + 512, file.size);
      for (let byteIdx = 0; byteIdx < file.size; byteIdx++) {
        destArray[byteIdx] = file.data![byteIdx];
      }
      offset += 512 * Math.trunc(file.size / 512);
      if (file.size % 512) {
        offset += 512;
      }
    }
    offset += 512;
  }

  return new Uint8Array(buffer);
}

/**
 * Creates a gzipped TAR file stream from an array of file inputs, using optional compression settings.
 *
 * @param {TarFileInput[]} files - The files to include in the gzipped TAR archive. See {@link TarFileInput}.
 * @param {CreateTarOptions & { Compression? CompressionFormat }} opts - Options for TAR creation and gzip compression. See {@link CreateTarOptions}.
 * @returns {ReadableStream} A stream of the gzipped TAR file data.
 */
export function createTarGzipStream(
  files: TarFileInput[],
  opts: CreateTarOptions & { compression?: CompressionFormat } = {},
): ReadableStream {
  const buffer = createTar(files, opts);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buffer);
      controller.close();
    },
  }).pipeThrough(new CompressionStream(opts.compression ?? "gzip"));
}

/**
 * Asynchronously creates a gzipped TAR file from an array of file inputs.
 * This function is suitable for scenarios where a complete gzipped TAR file is required as a single `Uint8` array.
 *
 * @param {TarFileInput[]} files - The files to include in the gzipped TAR archive.
 * @param {CreateTarOptions & { Compression? CompressionFormat }} opts - Options for TAR creation and gzip compression.
 * @returns {Promise<Uint8Array>} A promise that resolves to the gzipped TAR file as an Uint8Array.
 */
export async function createTarGzip(
  files: TarFileInput[],
  opts: CreateTarOptions & { compression?: CompressionFormat } = {},
): Promise<Uint8Array> {
  const data = await new Response(createTarGzipStream(files, opts))
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer));
  return data;
}

function _writeString(buffer: ArrayBuffer, str: string, offset: number, size: number) {
  const strView = new Uint8Array(buffer, offset, size);
  const te = new TextEncoder();
  const written = te.encodeInto(str, strView).written;
  for (let i = written; i < size; i++) {
    strView[i] = 0;
  }
}

function _leftPad(input: number | string, targetLength: number) {
  return String(input).padStart(targetLength, "0");
}

function _normalizeData(data: string | Uint8Array | ArrayBuffer | null | undefined) {
  if (data === null || data === undefined) {
    return undefined;
  }
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return data;
}
