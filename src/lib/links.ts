const SAFE_EXTERNAL_PROTOCOLS = new Set(["https:", "http:"]);
const SAFE_CMS_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);
const INTERNAL_PATH_PATTERN = /^\/(?!\/)[^\s]*$/;

export function isSafeExternalUrl(url: string | undefined | null): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function isApprovedInternalPath(path: string | undefined | null): path is string {
  if (!path) return false;
  const trimmed = path.trim();
  if (!trimmed) return false;
  return INTERNAL_PATH_PATTERN.test(trimmed);
}

export function isSafeCmsHref(href: string | undefined | null): href is string {
  if (!href) return false;
  const trimmed = href.trim();
  if (!trimmed) return false;

  if (isApprovedInternalPath(trimmed)) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return SAFE_CMS_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function getSafeCmsHref(href: string | undefined | null): string | undefined {
  return isSafeCmsHref(href) ? href.trim() : undefined;
}

export function isExternalHref(href: string): boolean {
  return !isApprovedInternalPath(href);
}
