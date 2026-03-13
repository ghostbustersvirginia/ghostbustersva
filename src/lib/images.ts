interface ResponsiveImageOptions {
  src: string;
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

function buildAstroImageUrl(src: string, width: number, quality: number): string {
  const imageUrl = encodeURIComponent(normalizeImageUrl(src));
  return `/_image?href=${imageUrl}&w=${width}&q=${quality}`;
}

export async function getResponsiveImageAttrs({
  src,
  widths,
  sizes,
  width,
  height,
  quality = 75,
}: ResponsiveImageOptions): Promise<ResponsiveImageAttrs> {
  const extension = getFileExtension(src);
  const isTransformable =
    src.length > 0 && !src.startsWith("/_image?") && extension !== "svg" && extension !== "gif";

  if (!isTransformable) {
    return {
      src,
      sizes,
      width,
      height,
    };
  }

  const responsiveWidths = [...new Set([...widths, width])]
    .filter((candidate) => Number.isFinite(candidate) && candidate > 0)
    .sort((a, b) => a - b);

  if (responsiveWidths.length === 0) {
    return {
      src,
      sizes,
      width,
      height,
    };
  }

  const srcset = responsiveWidths
    .map(
      (candidateWidth) => `${buildAstroImageUrl(src, candidateWidth, quality)} ${candidateWidth}w`,
    )
    .join(", ");
  const largestWidth = responsiveWidths[responsiveWidths.length - 1] ?? width;

  return {
    src: buildAstroImageUrl(src, largestWidth, quality),
    srcset,
    sizes,
    width,
    height,
  };
}
