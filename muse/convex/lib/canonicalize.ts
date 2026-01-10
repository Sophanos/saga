export function canonicalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}
