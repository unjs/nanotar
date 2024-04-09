export type TarFileItem<DataT = Uint8Array> = {
  /**
   * File name
   */
  name: string;

  /**
   * The data associated with the file. This field is usually omitted for directories.
   * optional
   */
  data?: DataT;

  /**
   * The attributes of the file. See {@link TarFileAttrs}.
   * @optional
   */
  attrs?: TarFileAttrs;
};

export interface ParsedTarFileItem extends TarFileItem {
  /**
   * The type of file system element. It can be 'file', 'directory' or an operating system specific numeric code.
   */
  type: "file" | "directory" | number;

  /**
   * The size of the file in bytes.
   */
  size: number;

  /**
   * The textual representation of the file data. This property is read-only.
   */
  readonly text: string;
}

export interface TarFileAttrs {
   /**
   * The file mode as a string (e.g. '-rw-rw-r--' for files and '-rwxrwxr-x' for directories).
   * @default "664" for files, "775" for directories
   */
  mode?: string;

  /**
   * The user ID associated with the file.
   * @default 1000
   */
  uid?: number;

  /**
   * The group ID associated with the file.
   * @default 1000
   */
  gid?: number;

  /**
   * The modification time of the file, expressed as the number of milliseconds since the UNIX epoch.
   * @default Date.now()
   */
  mtime?: number;

  /**
   * The name of the user who owns the file.
   * @default ""
   */
  user?: string;

  /**
   * The name of the group that owns the file.
   * @default ""
   */
  group?: string;
}
