import { createContext, useContext, useState } from 'react';

const HideAmountContext = createContext(null);

export function HideAmountProvider({ children }) {
  const [hidden, setHidden] = useState(false);
  const toggle = () => setHidden(v => !v);
  return (
    <HideAmountContext.Provider value={{ hidden, toggle }}>
      {children}
    </HideAmountContext.Provider>
  );
}

export function useHideAmount() {
  return useContext(HideAmountContext);
}
