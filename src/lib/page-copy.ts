/**
 * Page copy helper — loads page-specific editable text from
 * the `pageCopy` content collection.
 */
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

type PageCopyData = CollectionEntry<"pageCopy">["data"];
type PageCopySlug = PageCopyData["page"];
type PageCopyBySlug = {
  [Slug in PageCopySlug]: Extract<PageCopyData, { page: Slug }>;
};

export async function getPageCopy<Slug extends PageCopySlug>(
  pageSlug: Slug,
): Promise<PageCopyBySlug[Slug]> {
  const entries = await getCollection("pageCopy");
  const entry = entries.find((item) => item.id === pageSlug);

  if (!entry) {
    throw new Error(
      `[page-copy] Missing required entry for page "${pageSlug}" in src/content/page-copy/${pageSlug}.json`,
    );
  }

  const data = entry.data as PageCopyData;
  if (data.page !== pageSlug) {
    throw new Error(
      `[page-copy] Page field mismatch for "${pageSlug}": expected page="${pageSlug}", received page="${data.page}"`,
    );
  }

  return data as PageCopyBySlug[Slug];
}
