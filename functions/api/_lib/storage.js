/**
 * Storage abstraction layer.
 * Uses R2 (env.DOCUMENTS) if available, falls back to KV with a "DOC:" prefix.
 * Exposes the same interface as an R2 bucket:  put / get / delete
 */

const KV_PREFIX = 'DOC:';

function kvStorage(kv) {
  return {
    async put(key, value, opts = {}) {
      const metadata = Object.assign({}, opts.httpMetadata, opts.customMetadata);
      await kv.put(KV_PREFIX + key, value, { metadata });
    },

    async get(key) {
      const { value, metadata } = await kv.getWithMetadata(KV_PREFIX + key, 'arrayBuffer');
      if (!value) return null;
      const bytes = value; // ArrayBuffer
      return {
        get body() {
          return new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(bytes));
              controller.close();
            },
          });
        },
        arrayBuffer() { return Promise.resolve(bytes); },
        text()        { return Promise.resolve(new TextDecoder().decode(bytes)); },
        httpMetadata: metadata || {},
      };
    },

    async delete(key) {
      await kv.delete(KV_PREFIX + key);
    },
  };
}

/**
 * Returns the storage backend for the given env.
 * Priority: R2 bucket (DOCUMENTS) → KV fallback
 */
export function getStorage(env) {
  if (env.DOCUMENTS) return env.DOCUMENTS;
  if (env.KV)        return kvStorage(env.KV);
  throw new Error('No document storage available (DOCUMENTS or KV binding required)');
}
