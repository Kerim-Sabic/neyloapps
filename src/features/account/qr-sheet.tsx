'use client';
import { useEffect,useRef,useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy,Check,X } from 'lucide-react';
export default function QrSheet({url,handle,onClose}:{url:string;handle:string;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);const [copied,setCopied]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const element=dialog.current;const prior=document.activeElement;const old=document.body.style.overflow;element?.showModal();document.body.style.overflow='hidden';return()=>{element?.close();document.body.style.overflow=old;if(prior instanceof HTMLElement)prior.focus();};},[]);
  async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setError('Select and copy the invitation URL below.');}}
  return <dialog ref={dialog} className="qr-dialog" aria-labelledby="qr-title" aria-describedby="qr-description" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <button className="icon-button close-dialog" aria-label="Close invitation QR" onClick={onClose}><X size={21}/></button>
    <p className="eyebrow">YOUR INVITATION</p><h2 id="qr-title">A little closer.<br/>A little more neylo.</h2><div className="qr-paper"><QRCodeSVG value={url} size={240} level="M" marginSize={4} bgColor="#ffffff" fgColor="#050913" title={`Early-access invitation from @${handle}`} /></div><p className="qr-handle">@{handle}</p><p id="qr-description">Early access invitation—not a payment request.</p><button className="button secondary" onClick={copy}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Invitation copied':'Copy invitation'}</button><a className="qr-url" href={url}>{url}</a><p className="form-error" role="alert">{error}</p>
  </dialog>;
}
