function normalizeStoredImagePath(rawImage) {
  if (!rawImage || typeof rawImage !== "string") return undefined;

  const value = rawImage.trim();
  if (!value) return undefined;

  if (/^https?:\/\//i.test(value) || /^data:/i.test(value)) {
    return value;
  }

  const normalized = value.replace(/\\/g, "/");

  // Convert absolute or relative legacy filesystem paths ending with /uploads/<file>.
  const uploadIdx = normalized.toLowerCase().lastIndexOf("/uploads/");
  if (uploadIdx !== -1) {
    const relativeUploadPath = normalized.slice(uploadIdx);
    return relativeUploadPath.startsWith("/") ? relativeUploadPath : `/${relativeUploadPath}`;
  }

  if (normalized.toLowerCase().startsWith("uploads/")) {
    return `/${normalized}`;
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  return `/${normalized}`;
}

module.exports = {
  normalizeStoredImagePath
};
