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

export async function getResponsiveImageAttrs({
  src,
  widths: _widths,
  sizes,
  width,
  height,
  format: _format = "webp",
  quality: _quality = 75,
}: ResponsiveImageOptions): Promise<ResponsiveImageAttrs> {
  return {
    src,
    sizes,
    width,
    height,
  };
}
