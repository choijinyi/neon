import { useEffect, useRef, useState, useCallback } from 'react';
import { Point, Theme } from '../types';

export function useKineticEngine(theme: Theme) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const requestRef = useRef<number>(0);
  const [pointCount, setPointCount] = useState(0);

  const addPoint = useCallback((x: number, y: number) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    const newPoint: Point = {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: theme.primary,
      id: Math.random().toString(36).substr(2, 9),
    };
    pointsRef.current.push(newPoint);
    setPointCount(pointsRef.current.length);
  }, [theme]);

  const clearCanvas = useCallback(() => {
    pointsRef.current = [];
    setPointCount(0);
  }, []);

  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;

    // Clear with a slight trail effect
    ctx.fillStyle = `${theme.background}33`; // Add alpha for trail
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    const points = pointsRef.current;

    // Update positions and bounce
    points.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > logicalWidth) p.vx *= -1;
      if (p.y < 0 || p.y > logicalHeight) p.vy *= -1;
    });

    // Draw lines
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 15;
    
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const p1 = points[i];
        const p2 = points[j];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        
        // Only connect if they are relatively close, or connect all? 
        // PRD says "connect with previous point". Let's try connecting all within a range or just sequential.
        // "Second point connects to previous point" implies a chain.
        // Let's implement a chain connection for "Resonance of Dots and Lines".
        if (j === i + 1) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = theme.secondary;
          ctx.shadowColor = theme.secondary;
          ctx.stroke();
        }
      }
    }

    // Draw points
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = theme.primary;
      ctx.shadowColor = theme.primary;
      ctx.shadowBlur = 20;
      ctx.fill();
    });

    requestRef.current = requestAnimationFrame(update);
  }, [theme]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  return { canvasRef, addPoint, clearCanvas, pointCount };
}
