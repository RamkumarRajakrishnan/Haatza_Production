/**
 * Utility function to convert Wix image URIs, relative media keys, and legacy Wix URLs
 * into Google Cloud Storage public media URLs (haatza-media-bucket).
 *
 * Example outputs:
 *   - wix:image://v1/5fba3390-f2ce-4a4a-a9e9-5daa4f543d3f.webp -> https://storage.googleapis.com/haatza-media-bucket/products/5fba3390-f2ce-4a4a-a9e9-5daa4f543d3f.webp
 *   - products/5fba3390-f2ce-4a4a-a9e9-5daa4f543d3f.webp -> https://storage.googleapis.com/haatza-media-bucket/products/5fba3390-f2ce-4a4a-a9e9-5daa4f543d3f.webp
 *   - https://static.wixstatic.com/media/5fba3390-f2ce-4a4a-a9e9-5daa4f543d3f.webp -> https://storage.googleapis.com/haatza-media-bucket/products/5fba3390-f2ce-4a4a-a9e9-5daa4f543d3f.webp
 */
export function formatImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  const mediaBaseUrl = (
    process.env.MEDIA_BASE_URL ||
    'https://storage.googleapis.com/haatza-media-bucket'
  ).replace(/\/+$/, '');

  // 1. Handle wix:image://v1/... format
  if (trimmed.startsWith('wix:image://v1/')) {
    const rawPath = trimmed.replace('wix:image://v1/', '').split('#')[0] || '';
    let mediaKey = rawPath;

    const slashIdx = rawPath.indexOf('/');
    if (slashIdx !== -1) {
      mediaKey = rawPath.substring(0, slashIdx);
    }

    if (mediaKey.startsWith('products/')) {
      return `${mediaBaseUrl}/${mediaKey}`;
    }
    return `${mediaBaseUrl}/products/${mediaKey}`;
  }

  // 2. Handle static.wixstatic.com URLs
  if (trimmed.includes('static.wixstatic.com')) {
    const parts = trimmed.split('?')[0].split('#')[0].split('/');
    const filename = parts[parts.length - 1] || '';
    if (filename.startsWith('products/')) {
      return `${mediaBaseUrl}/${filename}`;
    }
    return `${mediaBaseUrl}/products/${filename}`;
  }

  // 3. Handle full HTTP / HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 4. Handle relative object keys / paths (e.g. products/uuid.webp or uuid.webp)
  const cleanKey = trimmed
    .replace(/^\/+/, '')
    .replace(/^public\/uploads\//, '')
    .replace(/^uploads\//, '');

  if (cleanKey.startsWith('products/')) {
    return `${mediaBaseUrl}/${cleanKey}`;
  }

  return `${mediaBaseUrl}/products/${cleanKey}`;
}

