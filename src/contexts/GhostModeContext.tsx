import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface GhostModeUser {
  id: string;
  full_name: string;
  maktab: "boys" | "girls";
}

interface GhostModeContextType {
  ghostUser: GhostModeUser | null;
  isGhostMode: boolean;
  enterGhostMode: (user: GhostModeUser) => void;
  exitGhostMode: () => void;
}

const GhostModeContext = createContext<GhostModeContextType | undefined>(undefined);

export const useGhostMode = () => {
  const context = useContext(GhostModeContext);
  if (!context) {
    throw new Error("useGhostMode must be used within a GhostModeProvider");
  }
  return context;
};

interface GhostModeProviderProps {
  children: ReactNode;
}

const GHOST_MODE_KEY = "ghost_mode_user";

export const GhostModeProvider = ({ children }: GhostModeProviderProps) => {
  const [ghostUser, setGhostUser] = useState<GhostModeUser | null>(() => {
    const stored = sessionStorage.getItem(GHOST_MODE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (ghostUser) {
      sessionStorage.setItem(GHOST_MODE_KEY, JSON.stringify(ghostUser));
    } else {
      sessionStorage.removeItem(GHOST_MODE_KEY);
    }
  }, [ghostUser]);

  const enterGhostMode = (user: GhostModeUser) => {
    setGhostUser(user);
  };

  const exitGhostMode = () => {
    setGhostUser(null);
  };

  return (
    <GhostModeContext.Provider
      value={{
        ghostUser,
        isGhostMode: ghostUser !== null,
        enterGhostMode,
        exitGhostMode,
      }}
    >
      {children}
    </GhostModeContext.Provider>
  );
};
