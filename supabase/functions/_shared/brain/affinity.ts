// Which storefront sections complement each other ("complete the set"). One table shared by the brain's
// merchandising (selection.ts) and the storefront's recommendations, so both always agree.
export const SECTION_AFFINITY = {
  kitchen: ["organize", "home"], organize: ["kitchen", "home"], home: ["organize", "wellness"],
  beauty: ["wellness", "fashion"], fashion: ["beauty", "wellness"], wellness: ["beauty", "home"],
  kids: ["home", "organize"],
} as const;
