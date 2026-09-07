const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

function normalizeLegacyPath(image: string): string {
  const normalized = image.trim().replace(/\\/g, '/');

  const uploadsIndex = normalized.toLowerCase().lastIndexOf('/uploads/');
  if (uploadsIndex !== -1) {
    return normalized.slice(uploadsIndex);
  }

  if (normalized.toLowerCase().startsWith('uploads/')) {
    return `/${normalized}`;
  }

  return normalized;
}

export function getDonationImageUrl(image?: string | null): string | undefined {
  if (!image) return undefined;

  const trimmed = image.trim();
  if (!trimmed) return undefined;

  if (/^(https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return trimmed;
  }

  const normalized = normalizeLegacyPath(trimmed);
  const pathPart = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${API_ORIGIN}${pathPart}`;
}
