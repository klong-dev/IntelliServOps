type RequestLike = {
  protocol?: string;
  headers?: Record<string, string | string[] | undefined>;
};

export function resolvePublicBaseUrl(options?: {
  configuredBaseUrl?: string | null;
  request?: RequestLike;
  fallbackPort?: string | number | null;
}) {
  const configuredBaseUrl = normalizeBaseUrl(options?.configuredBaseUrl);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const forwardedProto = readHeaderValue(
    options?.request?.headers?.['x-forwarded-proto'],
  );
  const forwardedHost = readHeaderValue(
    options?.request?.headers?.['x-forwarded-host'],
  );
  const host = readHeaderValue(options?.request?.headers?.host);

  if (forwardedHost || host) {
    const protocol = forwardedProto || options?.request?.protocol || 'http';
    return `${protocol}://${(forwardedHost || host)!.replace(/\/+$/g, '')}`;
  }

  return `http://localhost:${options?.fallbackPort || '3000'}`;
}

export function buildPublicFileUrl(
  baseUrl: string,
  uploadDir: string,
  relativePath: string,
) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedUploadDir = uploadDir.replace(/^\/+|\/+$/g, '');
  const normalizedRelativePath = relativePath.replace(/\\/g, '/');

  return `${normalizedBaseUrl}/${normalizedUploadDir}/${normalizedRelativePath}`;
}

function normalizeBaseUrl(baseUrl?: string | null) {
  const normalized = (baseUrl || '').trim().replace(/\/+$/g, '');
  return normalized.length > 0 ? normalized : null;
}

function readHeaderValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.split(',')[0]?.trim();
  }

  if (typeof value === 'string') {
    return value.split(',')[0]?.trim();
  }

  return undefined;
}
