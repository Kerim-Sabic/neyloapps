'use client';
import {useState,type RefObject} from 'react';

type Props={id:string;value:string;onChange:(value:string)=>void;inputRef:RefObject<HTMLInputElement|null>;describedBy:string;invalid?:boolean;busy?:boolean};

/** One native input owns keyboard, paste and provider autofill; the six slots are presentation only. */
export function VerificationCode({id,value,onChange,inputRef,describedBy,invalid=false,busy=false}:Props){
  const [focused,setFocused]=useState(false);
  const [selection,setSelection]=useState({start:0,end:0});
  const active=Math.min(selection.start,5);
  return <div className={`otp-control${invalid?' otp-invalid':''}${focused?' otp-focused':''}`}>
    <div className="otp-slots" aria-hidden="true">
      {Array.from({length:6},(_,index)=><span key={index} className="otp-slot" data-active={focused&&(index===active||(index>=selection.start&&index<selection.end))} data-filled={Boolean(value[index])}>
        {value[index]||<span className={focused&&index===active?'otp-caret':'otp-placeholder'}/>}
      </span>)}
    </div>
    <input ref={inputRef} id={id} name="code" className="otp-native" type="text" inputMode="numeric" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} enterKeyHint="done" pattern="[0-9]{6}" maxLength={6} required readOnly={busy} value={value}
      aria-describedby={describedBy} aria-invalid={invalid||undefined}
      onFocus={event=>{setFocused(true);setSelection({start:event.currentTarget.selectionStart??value.length,end:event.currentTarget.selectionEnd??value.length});}}
      onBlur={()=>setFocused(false)}
      onSelect={event=>setSelection({start:event.currentTarget.selectionStart??0,end:event.currentTarget.selectionEnd??0})}
      onChange={event=>onChange(event.target.value.replace(/\D/g,'').slice(0,6))}
      onPaste={event=>{const digits=event.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);if(digits){event.preventDefault();onChange(digits);setSelection({start:digits.length,end:digits.length});requestAnimationFrame(()=>inputRef.current?.setSelectionRange(digits.length,digits.length));}}}/>
  </div>;
}
