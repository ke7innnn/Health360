'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}

export default function AnimatedCounter({ value, duration = 1.2, suffix = '', decimals = 0 }: AnimatedCounterProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => latest.toFixed(decimals));
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    const controls = animate(count, value, { 
      duration, 
      ease: 'easeOut' 
    });
    
    return () => controls.stop();
  }, [value, duration, count]);

  // Sync motion value back to state to avoid SSR hydration issues
  useEffect(() => {
    return rounded.onChange((v) => setDisplayValue(v));
  }, [rounded]);

  return (
    <span>
      {displayValue}
      {suffix}
    </span>
  );
}
