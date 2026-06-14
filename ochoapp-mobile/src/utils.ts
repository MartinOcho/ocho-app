// Re-export all functions from organized modules
export * from "./auth";
export * from "./users";
export * from "./posts";
export * from "./comments";
export * from "./notifications";
export * from "./devices";
export * from "./messages";
export * from "./search";
export * from "./trending";


export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^a-z0-9-]/g, "")
}