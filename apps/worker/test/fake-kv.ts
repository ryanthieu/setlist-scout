/** Minimal in-memory stand-in for the subset of KVNamespace this worker uses. */
export function createFakeKv(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
}
