export type { TarFileItemType, TarFileItemTypeValue } from "./entry";

// ------------ Create ------------

export type TarFileItem<DataT = Uint8Array> = {
  /**
   * File name
   */
  name: string;

  /**
   * The data associated with the file. This field is usually omitted for directories.
   * @optional
   */
  data?: DataT;

  /**
   * The attributes of the file. See {@link TarFileAttrs}.
   * @optional
   */
  attrs?: TarFileAttrs;
};

// ------------ Attrs ------------

export interface TarFileAttrs {
  /**
   * File mode in octal (e.g., `664`) represents read, write, and execute permissions for the owner, group, and others.
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
