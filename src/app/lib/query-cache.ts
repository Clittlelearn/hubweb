import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

const CACHE_KEY = 'hub.read-model-cache.v1';
const MAX_AGE = 5 * 60_000;
const PREFIXES = ['wallet-', 'delegate-', 'governance-', 'flow-', 'lock-', 'staking-', 'dashboard-'];

// Persist only public read models, never wallet providers, mutations or signatures.
export function installReadModelCache(client: QueryClient, scope: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (saved?.scope === scope && Date.now() - saved.savedAt < MAX_AGE) {
      const queries = saved.state.queries.filter((query: any) =>
        PREFIXES.some(prefix => String(query.queryKey?.[0]).startsWith(prefix)));
      hydrate(client, { mutations: [], queries: queries.map((query: any) => ({
        ...query, state: { ...query.state, status: 'success', error: null, fetchStatus: 'idle', isInvalidated: true },
      })) });
    }
  } catch { /* Storage may be disabled or contain an old snapshot. */ }
  const save = () => {
    try {
      const state = dehydrate(client, { shouldDehydrateMutation: () => false,
        shouldDehydrateQuery: query => query.state.data !== undefined &&
          (!query.state.isInvalidated || query.state.status === 'error') &&
          PREFIXES.some(prefix => String(query.queryKey[0]).startsWith(prefix)) &&
          Date.now() - query.state.dataUpdatedAt < MAX_AGE });
      state.queries = state.queries.sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt).slice(0, 60);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ scope, savedAt: Date.now(), state }));
    } catch { /* Quota and privacy settings must not interrupt the application. */ }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = client.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(save, 300);
  });
  window.addEventListener('pagehide', save);
  return () => { unsubscribe(); clearTimeout(timer); window.removeEventListener('pagehide', save); };
}
