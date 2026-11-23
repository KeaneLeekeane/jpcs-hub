import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

export function useCollection(path, opts = {}) {
  const [rows, setRows] = useState(null);
  const key = path ? path + JSON.stringify(opts) : '';
  useEffect(() => {
    if (!path) { setRows([]); return undefined; }
    setRows(null);
    return api.sub(path, opts, setRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows; // null while loading
}

export function useDoc(path) {
  const [row, setRow] = useState(undefined);
  useEffect(() => {
    if (!path) { setRow(null); return undefined; }
    setRow(undefined);
    return api.subDoc(path, setRow);
  }, [path]);
  return row; // undefined while loading, null if missing
}

// Re-renders every `ms` so "Active now" labels stay current.
export function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);
