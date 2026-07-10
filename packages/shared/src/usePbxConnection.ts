import { useCallback, useEffect, useState } from 'react';
import { getApiBase } from './api';
import {
  fetchPbxEndpoints,
  getCachedPbxEndpoints,
  getPbxConnectionMode,
  getPbxEndpointForMode,
  switchPbxConnection,
  type PbxConnectionMode,
  type PbxEndpoints,
} from './pbxConnection';

export function usePbxConnection() {
  const [endpoints, setEndpoints] = useState<PbxEndpoints | null>(() => getCachedPbxEndpoints());
  const [mode, setMode] = useState<PbxConnectionMode>(() => getPbxConnectionMode());
  const [switching, setSwitching] = useState<'lan' | 'tailscale' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchPbxEndpoints();
    if (next) setEndpoints(next);
    setMode(getPbxConnectionMode());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchTo = useCallback(
    async (target: 'lan' | 'tailscale') => {
      if (switching) return;
      setError(null);
      setSwitching(target);

      try {
        const result = await switchPbxConnection(target);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        setMode(target);
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } finally {
        setSwitching(null);
      }
    },
    [switching],
  );

  const currentUrl = getApiBase();
  const canUseLan = Boolean(getPbxEndpointForMode('lan', endpoints));
  const canUseTailscale = Boolean(getPbxEndpointForMode('tailscale', endpoints));

  return {
    endpoints,
    mode,
    switching,
    error,
    currentUrl,
    canUseLan,
    canUseTailscale,
    refresh,
    switchTo,
  };
}
