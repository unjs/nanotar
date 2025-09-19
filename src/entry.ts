// --- tar entry ---

// prettier-ignore
export type TarEntryHeaderKey =
  "path" | "mode" | "uid" | "gid" | "size" | "mtime" | "checksum" | "typeFlag" |
  "linkpath" | "magic" | "version" | "user" | "group" | "devMajor" | "devMinor" | "prefix" | "padding"

// prettier-ignore
export const tarEntryHeaderKeys: readonly TarEntryHeaderKey[] = Object.freeze([
  "path", "mode", "uid", "gid", "size", "mtime", "checksum", "typeFlag", "linkpath",
  "magic", "version", "user", "group", "devMajor", "devMinor", "prefix", "padding"
]);

// prettier-ignore
export const tarNumericHeaders = new Set(["uid", "gid", "size", "mtime"] as const);
export type TarNumericHeaderKey = "uid" | "gid" | "size" | "mtime";

export const tarEntryHeaders: Record<
  TarEntryHeaderKey,
  [offset: number, size: number]
> = Object.freeze({
  path: [0, 100],
  mode: [100, 8],
  uid: [108, 8],
  gid: [116, 8],
  size: [124, 8],
  mtime: [136, 12],
  checksum: [148, 8],
  typeFlag: [156, 1],
  linkpath: [157, 100],
  magic: [257, 6],
  version: [263, 2],
  user: [265, 32],
  group: [297, 32],
  devMajor: [329, 8],
  devMinor: [337, 8],
  prefix: [345, 155],
  padding: [500, 12],
});

export type TarEntryHeaders = Record<
  Exclude<TarEntryHeaderKey, TarNumericHeaderKey | "typeFlag">,
  string
> &
  Record<TarNumericHeaderKey, number> & {
    typeFlag: keyof typeof tarItemTypeMap | "";
  };

const u = undefined;
// prettier-ignore
export const emptyTarEntryHeaders: Record<TarEntryHeaderKey, undefined> = Object.freeze({
  path: u, mode: u, uid: u, gid: u, size: u, mtime: u, checksum: u, typeFlag: u,linkpath: u,
  magic: u, version: u, user: u, group: u, devMajor: u, devMinor: u, prefix: u, padding: u
});

export class TarEntryCtor {
  data: Uint8Array;

  path?: string = undefined;
  mode?: string = undefined;
  uid?: string = undefined;
  gid?: string = undefined;
  size?: string = undefined;
  mtime?: string = undefined;
  checksum?: string = undefined;
  typeFlag?: string = undefined;
  linkpath?: string = undefined;
  magic?: string = undefined;
  version?: string = undefined;
  user?: string = undefined;
  group?: string = undefined;
  devMajor?: string = undefined;
  devMinor?: string = undefined;
  prefix?: string = undefined;
  padding?: string = undefined;
  constructor(data: Uint8Array) {
    this.data = data;
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return Object.fromEntries(
      tarEntryHeaderKeys.map((key) => [key, this[key as keyof this]]),
    );
  }
}

// ---- type flags ---

// prettier-ignore
export type TarFileItemType = "file" | "hardLink" | "symbolicLink" | "characterDevice" | "blockDevice" | "directory" | "fifo" | "contiguousFile" | "globalExtendedHeader" | "extendedHeader" | "solarisAcl" | "gnuDirectory" | "gnuInodeMetadata" | "gnuLongLinkName" | "gnuLongFileName" | "gnuMultiVolume" | "gnuOldLongFileName" | "gnuSparseFile" | "solarisVolumeLabel" | "solarisOldExtendedHeader" | "gnuExtendedSparse";

// prettier-ignore
export type TarFileItemTypeValue = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "g" | "x" | "A" | "D" | "I" | "K" | "L" | "M" | "N" | "S" | "V" | "X" | "E";

// prettier-ignore
export const tarItemTypeMap = {
  // Standard
  "0": "file",                    // Regular file
  "1": "hardLink",                // Hard link (meta)
  "2": "symbolicLink",            // Symbolic link (meta)
  "3": "characterDevice",         // Character device (meta)
  "4": "blockDevice",             // Block device (meta)
  "5": "directory",               // Directory (meta)
  "6": "fifo",                    // Named pipe (FIFO) (meta)
  "7": "contiguousFile",          // Contiguous file (rarely used, mostly for older systems)

  // Extended headers
  "g": "globalExtendedHeader",    // Global extended header (meta)
  "x": "extendedHeader",          // Extended header for the next file (meta)

  // GNU tar
  "D": "gnuDirectory",             // GNU directory metadata (meta)
  "I": "gnuInodeMetadata",         // GNU inode metadata
  "K": "gnuLongLinkName",          // GNU long link name
  "L": "gnuLongFileName",          // GNU long file name
  "N": "gnuOldLongFileName",       // GNU long file name (old)
  "M": "gnuMultiVolume",           // Multi-volume archive entry
  "S": "gnuSparseFile",            // Sparse file (for files with holes)
  "E": "gnuExtendedSparse",        // Extended sparse file (used in GNU tar for large sparse files)

  // Solaris tar
  "A": "solarisAcl",               // Solaris access control list
  "V": "solarisVolumeLabel",       // Solaris volume label (meta)
  "X": "solarisOldExtendedHeader", // Deprecated extended header format (meta)
} as const satisfies Record<TarFileItemTypeValue, TarFileItemType>;
