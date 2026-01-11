import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface GhostParent {
  id: string;
  email: string;
  full_name: string | null;
}

interface ParentGhostModeContextType {
  ghostParent: GhostParent | null;
  isGhostMode: boolean;
  enterGhostMode: (parent: GhostParent) => void;
  exitGhostMode: () => void;
}

const ParentGhostModeContext = createContext<ParentGhostModeContextType | undefined>(undefined);

export const useParentGhostMode = () => {
  const context = useContext(ParentGhostModeContext);
  if (!context) {
    throw new Error("useParentGhostMode must be used within a ParentGhostModeProvider");
  }
  return context;
};

interface ParentGhostModeProviderProps {
  children: ReactNode;
}

const PARENT_GHOST_MODE_KEY = "parent_ghost_mode";

export const ParentGhostModeProvider = ({ children }: ParentGhostModeProviderProps) => {
  const [ghostParent, setGhostParent] = useState<GhostParent | null>(() => {
    const stored = sessionStorage.getItem(PARENT_GHOST_MODE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (ghostParent) {
      sessionStorage.setItem(PARENT_GHOST_MODE_KEY, JSON.stringify(ghostParent));
    } else {
      sessionStorage.removeItem(PARENT_GHOST_MODE_KEY);
    }
  }, [ghostParent]);

  const enterGhostMode = (parent: GhostParent) => {
    setGhostParent(parent);
  };

  const exitGhostMode = () => {
    setGhostParent(null);
  };

  return (
    <ParentGhostModeContext.Provider
      value={{
        ghostParent,
        isGhostMode: ghostParent !== null,
        enterGhostMode,
        exitGhostMode,
      }}
    >
      {children}
    </ParentGhostModeContext.Provider>
  );
};
