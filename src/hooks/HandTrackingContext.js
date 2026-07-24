import { createContext, useContext } from 'react';

export const HandTrackingContext = createContext(null);

export function useHandTrackingContext() {
  return useContext(HandTrackingContext);
}