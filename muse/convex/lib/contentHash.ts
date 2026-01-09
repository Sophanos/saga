export async function hashSnapshot(snapshotJson: string): Promise<string> {
  const data = new TextEncoder().encode(snapshotJson);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
