import { useEffect } from 'react';
import { useSidebar } from '../contexts/SidebarContext';

/**
 * Hook to hide the sidebar when a component mounts, and restore it when it unmounts.
 * Useful for full-screen experiences like interviews or focus modes.
 */
export function useFullScreenMode(isActive: boolean = true) {
  const { setSidebarHidden } = useSidebar();

  useEffect(() => {
    if (isActive) {
      // Hide sidebar on mount/active
      setSidebarHidden(true);
      
      // Restore sidebar on unmount/inactive
      return () => {
        setSidebarHidden(false);
      };
    } else {
      setSidebarHidden(false);
    }
  }, [setSidebarHidden, isActive]);
}
