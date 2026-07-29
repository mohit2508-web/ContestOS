import { useEffect, useRef } from 'react';

export function useBrowserFullscreen(enabled: boolean = true) {
  const isFullscreenRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          isFullscreenRef.current = true;
        }
      } catch {
        // User gesture required or permission denied — fail silently
      }
    };

    const handleChange = () => {
      isFullscreenRef.current = !!document.fullscreenElement;
    };

    document.addEventListener('fullscreenchange', handleChange);
    enterFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      isFullscreenRef.current = false;
    };
  }, [enabled]);
}
