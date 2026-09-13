'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function BottomSheet({ open, title, onClose, children, closeLabel='Close advanced routing', kicker='YOUR TRANSFER, YOUR CHOICE' }: { open: boolean; title: string; onClose: () => void; children: ReactNode; closeLabel?:string; kicker?:string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  useEffect(() => {
    const element = dialog.current; if (!element || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const phone = element.closest('.demo-phone');
    const place = () => {
      if (innerWidth < 768 || !phone) { element.style.left = ''; element.style.top = ''; element.style.width = ''; element.style.margin = ''; element.style.maxHeight = ''; return; }
      const bounds = phone.getBoundingClientRect();
      element.style.width = `${bounds.width - 16}px`; element.style.maxHeight = `${bounds.height - 50}px`;
      element.style.left = `${bounds.left + 8}px`; element.style.top = `${Math.max(bounds.top + 24, bounds.bottom - element.offsetHeight - 8)}px`; element.style.margin = '0';
    };
    const observer = new ResizeObserver(place); if (phone) observer.observe(phone); observer.observe(element);
    window.addEventListener('resize', place); window.addEventListener('scroll', place); place();
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place); element.close(); document.body.style.overflow = previous; if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, [open]);
  return <dialog ref={dialog} className="demo-sheet" aria-labelledby="demo-sheet-title" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]'));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { event.preventDefault(); onCloseRef.current(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="demo-sheet-content"><div className="demo-sheet-grip" aria-hidden="true"/><header><div><p className="demo-kicker">{kicker}</p><h2 id="demo-sheet-title">{title}</h2></div><button type="button" className="demo-icon-button" aria-label={closeLabel} onClick={onClose}><X size={20}/></button></header>{children}</div>
  </dialog>;
}
