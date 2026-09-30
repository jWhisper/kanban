import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const focusable = () => [...root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
    (focusable()[0] ?? root).focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0], last = items.at(-1);
        if (!items.length) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    root.addEventListener('keydown', key);
    return () => { root.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="cw-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`cw-dialog ${wide ? 'cw-dialog-wide' : ''}`}>
      <div className="cw-dialog-heading"><h2>{title}</h2><button className="cw-icon-button" aria-label="关闭" onClick={onClose}><X size={19} /></button></div>
      {children}
    </div>
  </div>;
}
