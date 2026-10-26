import { File } from 'expo-file-system';

/** Reads a local file (from the camera, gallery or document picker) as raw bytes for uploading. */
export function readFileBytes(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}
