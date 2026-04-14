/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { ArtCanvas, ArtCanvasRef } from './components/ArtCanvas';
import { UIOverlay } from './components/UIOverlay';
import { THEMES, Theme } from './types';
import { jsPDF } from 'jspdf';

export default function App() {
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [pointCount, setPointCount] = useState(0);
  const canvasRef = useRef<ArtCanvasRef>(null);

  const handleExport = () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    // Create PDF
    // We'll use the canvas dimensions to determine the PDF orientation
    const orientation = canvas.width > canvas.height ? 'l' : 'p';
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [canvas.width, canvas.height],
    });

    // To ensure a solid background in the PDF (since the canvas might have transparency from trails)
    // we can create a temporary canvas to draw the solid background + current canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.fillStyle = currentTheme.background;
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);
    }

    const imgData = tempCanvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`neon-kinetic-art-${Date.now()}.pdf`);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <ArtCanvas 
        ref={canvasRef} 
        theme={currentTheme} 
        onPointAdded={setPointCount}
      />
      
      <UIOverlay 
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        onClear={() => canvasRef.current?.clear()}
        onExport={handleExport}
        pointCount={pointCount}
      />

      {/* Background Noise/Texture */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}
