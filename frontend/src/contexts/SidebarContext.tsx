import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface SidebarContextType {
  isSidebarHidden: boolean;
  setSidebarHidden: (hidden: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isSidebarHidden: false,
  setSidebarHidden: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isSidebarHidden, setSidebarHidden] = useState(false);

  return (
    <SidebarContext.Provider value={{ isSidebarHidden, setSidebarHidden }}>
      {children}
    </SidebarContext.Provider>
  );
}
