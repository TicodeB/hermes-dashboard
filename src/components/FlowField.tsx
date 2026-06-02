'use client';

import { useEffect, useRef } from 'react';

export default function FlowField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    let particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
    let time = 0;
    let animId: number;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0, vy: 0,
        life: Math.random() * 300,
        maxLife: 200 + Math.random() * 400
      });
    }

    const noise = (x: number, y: number, t: number) => {
      const n = Math.sin(x * 0.005 + t * 0.3) * Math.cos(y * 0.005 + t * 0.2) * 
                Math.sin((x + y) * 0.003 + t * 0.15);
      return n;
    };

    const draw = () => {
      ctx.fillStyle = 'rgba(15,15,26,0.15)';
      ctx.fillRect(0, 0, w, h);

      particles.forEach(p => {
        p.life--;
        if (p.life <= 0) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = p.maxLife;
        }

        const angle = noise(p.x, p.y, time) * Math.PI * 2;
        const speed = 0.3 + Math.abs(noise(p.x, p.y, time + 100)) * 0.8;
        p.vx += Math.cos(angle) * 0.02;
        p.vy += Math.sin(angle) * 0.02;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx * speed;
        p.y += p.vy * speed;

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        const alpha = p.life / p.maxLife;
        const hue = 220 + noise(p.x, p.y, time) * 40;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.6 + alpha * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${alpha * 0.5})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + alpha * 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha * 0.08})`;
        ctx.fill();
      });

      time++;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="flow-bg" />;
}
