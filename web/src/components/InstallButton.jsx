import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

// Shows "Install app" when the browser (Chrome/Edge) offers to install JPCS HUB.
let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });
}

export default function InstallButton({ className = 'btn light', style }) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  if (!deferred) return null;
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={async () => { const p = deferred; deferred = null; force((n) => n + 1); await p.prompt(); }}
    >
      <Download size={16} /> Install app
    </button>
  );
}
