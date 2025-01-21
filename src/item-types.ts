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
