import { useEffect, useState } from 'preact/hooks';

/** Lê uma chave do chrome.storage.local e reage a mudanças (ex.: sessão iniciada em outra aba). */
export function useStorageValue<T>(key: string): { value: T | undefined; loaded: boolean } {
  const [state, setState] = useState<{ value: T | undefined; loaded: boolean }>({ value: undefined, loaded: false });
  useEffect(() => {
    chrome.storage.local.get(key).then((r) => setState({ value: r[key] as T | undefined, loaded: true }));
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes[key]) setState({ value: changes[key].newValue as T | undefined, loaded: true });
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [key]);
  return state;
}
