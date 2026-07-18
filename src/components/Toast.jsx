import { useRef, useState } from 'react';
import React from 'react';

// 極簡 toast：show('訊息') 後 2.2 秒自動消失
export function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const show = (m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  };
  return { msg, show };
}

export default function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}
