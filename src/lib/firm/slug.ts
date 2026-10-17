/** URL-safe workspace slug from a business name. Uniqueness is the caller's job. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `client-${base || "x"}`.replace(/-+$/g, "");
}

// Slugs that would collide with real routes.
export const RESERVED_SLUGS = new Set(["admin", "api", "start", "login", "t", "layaw", "pay", "app", "www", "assets"]);

export function withSuffix(slug: string, n: number): string {
  return n === 0 ? slug : `${slug}-${n + 1}`;
}
