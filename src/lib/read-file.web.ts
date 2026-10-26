/** Reads a picked file (a blob: or data: URL in the browser) as raw bytes for uploading. */
export async function readFileBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}
