'use client';

import { useEffect, useState, useRef } from 'react';
import { useSpring } from 'framer-motion';

export default function CountUp({ from = 0, to, duration = 2, suffix = '', prefix = '' }: {
  from?: number; to: number; duration?: number; suffix?: string; prefix?: string;
}) {
  const [display, setDisplay] = useState(() => formatValue(from, to));
  const spring = useSpring(from, { stiffness: 100, damping: 30, duration: duration * 1000 });

  function formatValue(v: number, target: number) {
    if (target >= 1000) return Math.floor(v).toLocaleString();
    if (Number.isInteger(target)) return Math.floor(v).toString();
    return v.toFixed(1);
  }

  useEffect(() => {
    spring.set(to);
    const unsub = spring.on('change', (v: number) => {
      setDisplay(formatValue(v, to));
    });
    return () => unsub();
  }, [to, spring]);

  return <span>{prefix}{display}{suffix}</span>;
}