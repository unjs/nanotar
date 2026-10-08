import { deflateSync, gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTar, parseTarGzip } from "../src/index.ts";

const tar = createTar([{ name: "hello.txt", data: "Hello World!", attrs: { mtime: 0 } }]);
const gzip = gzipSync(tar);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseTarGzip maxOutputLength", () => {
  it.each([0, 1])("accepts output with %i bytes remaining in the limit", async (remaining) => {
    const files = await parseTarGzip(gzip, { maxOutputLength: tar.byteLength + remaining });
    expect(files).toHaveLength(1);
    expect(files[0]!.text).toBe("Hello World!");
  });

  it("counts all decompressed bytes, including tar padding", async () => {
    const maxOutputLength = tar.byteLength - 1;
    await expect(parseTarGzip(gzip, { maxOutputLength })).rejects.toThrow(
      new RangeError(`Decompressed data exceeds maxOutputLength (${maxOutputLength} bytes)`),
    );
  });

  it.each([false, true])(
    "rejects oversized output before filtering (metaOnly: %s)",
    async (metaOnly) => {
      const largeTar = createTar([{ name: "large.bin", data: new Uint8Array(2 * 1024 * 1024) }]);
      const data = gzipSync(largeTar);
      const filter = vi.fn(() => false);
      expect(data.byteLength).toBeLessThan(10_000);

      await expect(
        parseTarGzip(data, { maxOutputLength: 64 * 1024, filter, metaOnly }),
      ).rejects.toThrow(RangeError);
      expect(filter).not.toHaveBeenCalled();
    },
  );

  it("preserves filter and metaOnly options within the limit", async () => {
    const filter = vi.fn(() => true);
    const files = await parseTarGzip(gzip, {
      maxOutputLength: tar.byteLength,
      filter,
      metaOnly: true,
    });
    expect(filter).toHaveBeenCalledOnce();
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe("hello.txt");
    expect(files[0]).not.toHaveProperty("data");
  });

  it("supports the compression option with a limit", async () => {
    const data = deflateSync(tar);
    const files = await parseTarGzip(data, {
      compression: "deflate",
      maxOutputLength: tar.byteLength,
    });
    expect(files[0]!.text).toBe("Hello World!");
    await expect(
      parseTarGzip(data, { compression: "deflate", maxOutputLength: tar.byteLength - 1 }),
    ).rejects.toThrow(RangeError);
  });

  it("allows a zero limit only for empty output", async () => {
    await expect(parseTarGzip(gzipSync(new Uint8Array()), { maxOutputLength: 0 })).resolves.toEqual(
      [],
    );
    await expect(parseTarGzip(gzip, { maxOutputLength: 0 })).rejects.toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid limit before decompressing: %s",
    async (maxOutputLength) => {
      const decompress = vi.fn();
      vi.stubGlobal("DecompressionStream", decompress);
      await expect(parseTarGzip(gzip, { maxOutputLength })).rejects.toThrow(
        new RangeError("maxOutputLength must be a non-negative safe integer"),
      );
      expect(decompress).not.toHaveBeenCalled();
    },
  );

  it("propagates decompression errors", async () => {
    await expect(
      parseTarGzip(gzip.subarray(0, -8), { maxOutputLength: tar.byteLength }),
    ).rejects.toThrow();
  });

  it("cancels the decompressed stream before consuming all chunks", async () => {
    const cancel = vi.fn();
    const totalChunks = 16;
    const chunkBytes = 16;
    let producedChunks = 0;
    const readable = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          producedChunks++;
          controller.enqueue(new Uint8Array(chunkBytes));
          if (producedChunks === totalChunks) {
            controller.close();
          }
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    vi.stubGlobal(
      "DecompressionStream",
      class {
        readable = readable;
        writable = new WritableStream();
      },
    );

    await expect(parseTarGzip(gzip, { maxOutputLength: chunkBytes })).rejects.toThrow(RangeError);
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledWith(expect.any(RangeError)));
    expect(producedChunks).toBeLessThan(totalChunks);
  });
});
