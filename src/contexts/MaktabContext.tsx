import { createContext, useContext, ReactNode } from "react";

type Maktab = "boys" | "girls";

interface MaktabContextType {
  maktab: Maktab;
}

const MaktabContext = createContext<MaktabContextType | undefined>(undefined);

export const useMaktab = () => {
  const context = useContext(MaktabContext);
  if (!context) {
    throw new Error("useMaktab must be used within a MaktabProvider");
  }
  return context;
};

interface MaktabProviderProps {
  maktab: Maktab;
  children: ReactNode;
}

export const MaktabProvider = ({ maktab, children }: MaktabProviderProps) => {
  return (
    <MaktabContext.Provider value={{ maktab }}>
      {children}
    </MaktabContext.Provider>
  );
};
