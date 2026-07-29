import { useBlocker } from 'react-router-dom';
import { useEffect } from 'react';

export function useNavigationBlock(shouldBlock: boolean) {
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock]);

  return blocker;
}
