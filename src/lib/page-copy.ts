/**
 * CMS page copy helper — loads page-specific editable text from
 * the `pageCopy` content collection.
 */
import { getCollection } from "astro:content";

export async function getPageCopy(pageSlug: string): Promise<Record<string, unknown> | null> {
  try {
    const entries = await getCollection("pageCopy");
    const entry = entries.find((item) => item.id === pageSlug);
    return entry ? (entry.data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
