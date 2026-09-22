const sharp = require("sharp");

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const MAX_DIMENSION = 800;
const MAX_IMAGE_BYTES = 500 * 1024;

function isAllowedImageMimeType(mimeType) {
  return typeof mimeType === "string" && ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

async function resizeImageBuffer(buffer, mimeType) {
  if (!buffer || buffer.length === 0) {
    throw new Error("Image file is empty");
  }

  if (!isAllowedImageMimeType(mimeType)) {
    throw new Error("Unsupported image type");
  }

  const format = mimeType.toLowerCase().split("/")[1] || "jpeg";
  const sharpInstance = sharp(buffer).rotate().resize({
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: "inside",
    withoutEnlargement: true
  });

  const outputOptions = {
    jpeg: { quality: 80, mozjpeg: true },
    png: { quality: 80, compressionLevel: 9 },
    webp: { quality: 80 },
    gif: { effort: 5 }
  };

  let current = await sharpInstance.toFormat(format, outputOptions[format] || undefined).toBuffer();

  if (current.length > MAX_IMAGE_BYTES) {
    let quality = 75;
    while (current.length > MAX_IMAGE_BYTES && quality > 20) {
      quality -= 5;
      current = await sharpInstance
        .toFormat(format, outputOptions[format] ? { ...outputOptions[format], quality } : { quality })
        .toBuffer();
    }
  }

  if (current.length > MAX_IMAGE_BYTES) {
    const ratio = Math.sqrt(MAX_IMAGE_BYTES / current.length);
    current = await sharp(buffer)
      .rotate()
      .resize({
        width: Math.max(1, Math.floor(MAX_DIMENSION * ratio)),
        height: Math.max(1, Math.floor(MAX_DIMENSION * ratio)),
        fit: "inside",
        withoutEnlargement: true
      })
      .toFormat(format, outputOptions[format] || undefined)
      .toBuffer();
  }

  return current;
}

async function processImageBuffer(buffer, mimeType, originalName = "upload") {
  if (!buffer || buffer.length === 0) {
    throw new Error("Image file is empty");
  }

  if (!isAllowedImageMimeType(mimeType)) {
    throw new Error("Unsupported image type");
  }

  const finalBuffer = await resizeImageBuffer(buffer, mimeType);
  const normalizedMimeType = mimeType.toLowerCase();
  return `data:${normalizedMimeType};base64,${finalBuffer.toString("base64")}`;
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  isAllowedImageMimeType,
  processImageBuffer,
  MAX_DIMENSION,
  MAX_IMAGE_BYTES
};
