import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useKineticEngine } from '../hooks/useKineticEngine';
import { Theme } from '../types';

interface ArtCanvasProps {
  theme: Theme;
  onPointAdded?: (count: number) => void;
}

export interface ArtCanvasRef {
  clear: () => void;
  getCanvas: () => HTMLCanvasElement | null;
}

export const ArtCanvas = forwardRef<ArtCanvasRef, ArtCanvasProps>(({ theme, onPointAdded }, ref) => {
  const { canvasRef, addPoint, clearCanvas, pointCount } = useKineticEngine(theme);

  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        canvasRef.current.width = window.innerWidth * dpr;
        canvasRef.current.height = window.innerHeight * dpr;
        canvasRef.current.style.width = `${window.innerWidth}px`;
        canvasRef.current.style.height = `${window.innerHeight}px`;
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    onPointAdded?.(pointCount);
  }, [pointCount, onPointAdded]);

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = (e as React.MouseEvent).clientX - rect.left;
      y = (e as React.MouseEvent).clientY - rect.top;
    }

    addPoint(x, y);
  };

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 cursor-crosshair touch-none"
      onClick={handleClick}
      onTouchStart={handleClick}
      style={{ background: theme.background }}
    />
  );
});

ArtCanvas.displayName = 'ArtCanvas';
