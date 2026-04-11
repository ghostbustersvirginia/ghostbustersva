import { getImage } from "astro:assets";

interface LocalImageSource {
  src: string;
  width: number;
  height: number;
}

const contentImageModules = import.meta.glob<{ default: LocalImageSource }>(
  "../content/images/**/*.{avif,gif,jpg,jpeg,png,webp,svg}",
  { eager: true },
);

type ResponsiveImageSource = string | LocalImageSource;

interface ResponsiveImageOptions {
  src: ResponsiveImageSource;
  widths: number[];
  sizes: string;
  width: number;
  height: number;
  format?: "webp" | "avif";
  quality?: number;
}

export interface ResponsiveImageAttrs {
  src: string;
  srcset?: string;
  sizes: string;
  width: number;
  height: number;
}

function getFileExtension(path: string): string | null {
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? "";
  const lastDotIndex = withoutQuery.lastIndexOf(".");
  if (lastDotIndex === -1) return null;
  return withoutQuery.slice(lastDotIndex + 1).toLowerCase();
}

function normalizeImageUrl(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
    return src;
  }
  return `/${src}`;
}

function isImageMetadata(src: ResponsiveImageSource): src is LocalImageSource {
  return typeof src === "object" && src !== null && "src" in src && "width" in src;
}

function resolveLocalImageSource(src: string): LocalImageSource | undefined {
  const normalizedSrc = normalizeImageUrl(src);
  const cleanPath = normalizedSrc.split("?")[0]?.split("#")[0] ?? normalizedSrc;

  if (!cleanPath.startsWith("/images/")) {
    return undefined;
  }

  const relativePath = cleanPath.slice("/images/".length);
  const moduleKey = `../content/images/${relativePath}`;
  return contentImageModules[moduleKey]?.default;
}

async function getResponsiveAttrsFromMetadata({
  source,
  widths,
  sizes,
  width,
  height,
  quality,
  format,
}: {
  source: LocalImageSource;
  widths: number[];
  sizes: string;
  width: number;
  height: number;
  quality: number;
  format?: "webp" | "avif";
}): Promise<ResponsiveImageAttrs> {
  const extension = getFileExtension(source.src);
  const isTransformable = extension !== "svg" && extension !== "gif";

  if (!isTransformable) {
    return {
      src: source.src,
      sizes,
      width,
      height,
    };
  }

  const responsiveWidths = [...new Set([...widths, width])]
    .filter((candidate) => Number.isFinite(candidate) && candidate > 0)
    .map((candidate) => Math.round(candidate))
    .filter((candidate) => candidate <= source.width)
    .sort((a, b) => a - b);

  if (responsiveWidths.length > 0) {
    const variants = await Promise.all(
      responsiveWidths.map(async (candidateWidth) => ({
        candidateWidth,
        image: await getImage({
          src: source as Parameters<typeof getImage>[0]["src"],
          width: candidateWidth,
          quality,
          ...(format ? { format } : {}),
        }),
      })),
    );

    const srcset = variants
      .map((variant) => `${variant.image.src} ${variant.candidateWidth}w`)
      .join(", ");
    const largestVariant = variants[variants.length - 1]?.image;

    if (largestVariant) {
      return {
        src: largestVariant.src,
        srcset,
        sizes,
        width,
        height,
      };
    }
  }

  const baseImage = await getImage({
    src: source as Parameters<typeof getImage>[0]["src"],
    width: Math.min(width, source.width),
    quality,
    ...(format ? { format } : {}),
  });

  return {
    src: baseImage.src,
    sizes,
    width,
    height,
  };
}

export async function getResponsiveImageAttrs({
  src,
  widths,
  sizes,
  width,
  height,
  quality = 75,
  format,
}: ResponsiveImageOptions): Promise<ResponsiveImageAttrs> {
  if (isImageMetadata(src)) {
    return getResponsiveAttrsFromMetadata({
      source: src,
      widths,
      sizes,
      width,
      height,
      quality,
      format,
    });
  }

  const localImageSource = resolveLocalImageSource(src);
  if (localImageSource) {
    return getResponsiveAttrsFromMetadata({
      source: localImageSource,
      widths,
      sizes,
      width,
      height,
      quality,
      format,
    });
  }

  // String paths (for /public and external URLs) are served directly.
  return {
    src: normalizeImageUrl(src),
    sizes,
    width,
    height,
  };
}
