export type TarFileItem<DataT = Uint8Array> = {
  /**
   * File name
   */
  name: string;

  /**
   * File data (don't provide for directories)
   */
  data?: DataT;

  /**
   * File attributes
   */
  attrs?: TarFileAttrs;
};

export interface ParsedTarFileItem extends TarFileItem {
  type: "file" | "directory" | number;
  size: number;
  readonly text: string;
}

export interface TarFileAttrs {
  /**
   * Default: 664 (-rw-rw-r--) for files and 775 (-rwxrwxr-x) for directories and  */
  mode?: string;

  /**
   * Default: 1000
   */
  uid?: number;

  /**
   * Default: 1000
   */
  gid?: number;

  /**
   * Default: Date.now()
   */
  mtime?: number;

  /**
   * Default: ""
   */
  user?: string;

  /**
   * Default: ""
   */
  group?: string;
}
