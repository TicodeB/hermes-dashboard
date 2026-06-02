'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

export default function CountUp({ from = 0, to, duration = 2, suffix = '', prefix = '' }: {
  from?: number; to: number; duration?: number; suffix?: string; prefix?: string;
}) {
  const spring = useSpring(from, { stiffness: 100, damping: 30, duration: duration * 1000 });
  const display = useTransform(spring, (v: number) => {
    if (to >= 1000) return Math.floor(v).toLocaleString();
    if (Number.isInteger(to)) return Math.floor(v).toString();
    return v.toFixed(1);
  });

  useEffect(() => { spring.set(to); }, [to, spring]);

  return <motion.span>{prefix}{display}{suffix}</motion.span>;
}
