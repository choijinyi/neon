export interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  id: string;
}

export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export const THEMES: Theme[] = [
  {
    name: "Cyberpunk",
    primary: "#ff00ff", // Neon Pink
    secondary: "#00ffff", // Electric Blue
    accent: "#ffff00", // Neon Yellow
    background: "#050505",
  },
  {
    name: "Matrix",
    primary: "#00ff00", // Lime Green
    secondary: "#003300", // Dark Green
    accent: "#ffffff",
    background: "#000a00",
  },
  {
    name: "Synthwave",
    primary: "#f92aad", // Hot Pink
    secondary: "#7209b7", // Purple
    accent: "#4cc9f0", // Sky Blue
    background: "#1a1a2e",
  },
  {
    name: "Vaporwave",
    primary: "#ff71ce", // Pink
    secondary: "#01cdfe", // Blue
    accent: "#b967ff", // Purple
    background: "#241734",
  },
];
