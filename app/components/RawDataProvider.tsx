"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { RawScrapeData } from "../lib/types";

const RawDataContext = createContext<{
  rawScrape: RawScrapeData | null;
  setRawScrape: (data: RawScrapeData | null) => void;
} | null>(null);

export function RawDataProvider({ children }: { children: ReactNode }) {
  const [rawScrape, setRawScrape] = useState<RawScrapeData | null>(null);
  return (
    <RawDataContext.Provider value={{ rawScrape, setRawScrape }}>
      {children}
    </RawDataContext.Provider>
  );
}

export function useRawData() {
  const ctx = useContext(RawDataContext);
  if (!ctx) throw new Error("useRawData must be used within a RawDataProvider");
  return ctx;
}
