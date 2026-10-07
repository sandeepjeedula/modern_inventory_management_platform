export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  readUrl(key: string): Promise<string>;
}
