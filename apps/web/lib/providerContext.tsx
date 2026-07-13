'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Provider } from './openrouter';
import { getStored, setStored } from './settings';

interface ProviderCtx {
  provider: Provider;
  setProvider: (p: Provider) => void;
}

const Ctx = createContext<ProviderCtx>({ provider: 'openrouter', setProvider: () => {} });

export const ProviderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProviderState] = useState<Provider>('openrouter');
  useEffect(() => setProviderState(getStored<Provider>('or.provider', 'openrouter')), []);
  const setProvider = (p: Provider) => {
    setProviderState(p);
    setStored('or.provider', p);
  };
  return <Ctx.Provider value={{ provider, setProvider }}>{children}</Ctx.Provider>;
};

export const useProvider = () => useContext(Ctx);
