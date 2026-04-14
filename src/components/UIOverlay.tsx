import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Download, Palette, Info } from 'lucide-react';
import { Theme, THEMES } from '../types';

interface UIOverlayProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClear: () => void;
  onExport: () => void;
  pointCount: number;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({
  currentTheme,
  onThemeChange,
  onClear,
  onExport,
  pointCount,
}) => {
  const [showThemes, setShowThemes] = React.useState(false);

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      {/* Top Header */}
      <header className="flex justify-between items-start pointer-events-auto">
        <div className="space-y-1">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl md:text-4xl font-bold tracking-tighter uppercase italic"
            style={{ color: currentTheme.primary, textShadow: `0 0 10px ${currentTheme.primary}` }}
          >
            Neon Kinetic Art
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            className="text-xs md:text-sm font-mono uppercase tracking-widest text-white/60"
          >
            Resonance of Dots & Lines // {pointCount} Nodes
          </motion.p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowThemes(!showThemes)}
            className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
            title="Change Theme"
          >
            <Palette className="w-5 h-5 text-white/80 group-hover:text-white" />
          </button>
          <button
            onClick={onClear}
            className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
            title="Clear Canvas"
          >
            <Trash2 className="w-5 h-5 text-white/80 group-hover:text-red-400" />
          </button>
        </div>
      </header>

      {/* Theme Selector Popover */}
      <AnimatePresence>
        {showThemes && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute top-24 right-6 md:right-10 pointer-events-auto bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl z-50 w-48"
          >
            <h3 className="text-[10px] uppercase tracking-widest text-white/40 mb-3 font-bold">Select Palette</h3>
            <div className="grid gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    onThemeChange(t);
                    setShowThemes(false);
                  }}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                    currentTheme.name === t.name ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex -space-x-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.primary }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.secondary }} />
                  </div>
                  <span className="text-xs font-medium text-white/80">{t.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <footer className="flex justify-between items-end">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest font-mono">
            <Info className="w-3 h-3" />
            <span>Click anywhere to create nodes</span>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onExport}
          className="pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-tighter hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all"
        >
          <Download className="w-4 h-4" />
          Export PDF
        </motion.button>
      </footer>
    </div>
  );
};
