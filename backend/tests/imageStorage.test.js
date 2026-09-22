const sharp = require("sharp");
const { processImageBuffer, isAllowedImageMimeType } = require("../src/utils/imageStorage");

describe("image storage helper", () => {
  test("accepts a valid image MIME type and returns a data URL", async () => {
    const image = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 4,
        background: { r: 255, g: 140, b: 0, alpha: 1 }
      }
    })
      .png()
      .toBuffer();

    const result = await processImageBuffer(image, "image/png", "sample.png");
    expect(isAllowedImageMimeType("image/png")).toBe(true);
    expect(result).toMatch(/^data:image\/png;base64,/i);
    expect(result.length).toBeLessThan(700000);
  });

  test("rejects invalid MIME types", async () => {
    await expect(processImageBuffer(Buffer.from("hello"), "text/plain", "bad.txt")).rejects.toThrow("Unsupported image type");
  });
});
