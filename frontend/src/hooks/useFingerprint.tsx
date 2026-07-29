import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface FingerprintContextValue {
  visitorId: string | null;
  loading: boolean;
  error: string | null;
}

const FingerprintContext = createContext<FingerprintContextValue>({
  visitorId: null,
  loading: true,
  error: null,
});

export function useFingerprint() {
  return useContext(FingerprintContext);
}

export function FingerprintProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FingerprintContextValue>({
    visitorId: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    FingerprintJS.load()
      .then(fp => fp.get())
      .then(result => {
        if (!cancelled) {
          setState({ visitorId: result.visitorId, loading: false, error: null });
        }
      })
      .catch(err => {
        if (!cancelled) {
          setState({ visitorId: null, loading: false, error: err.message });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <FingerprintContext.Provider value={state}>
      {children}
    </FingerprintContext.Provider>
  );
}
