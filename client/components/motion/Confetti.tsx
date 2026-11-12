import { useEffect, useRef } from "react";

const COLORS = ["#2F4FD8", "#0B0F19", "#E8A317", "#D4653A", "#1F6F62", "#C43B5A"];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  vr: number;
};

export default function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    const pieces: Piece[] = Array.from({ length: 140 }, () => ({
      x: width * Math.random(),
      y: -20 - Math.random() * height * 0.35,
      vx: (Math.random() - 0.5) * 6,
      vy: 2 + Math.random() * 5,
      size: 6 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] || COLORS[0],
      spin: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
    }));
    let frame = 0;
    let raf = 0;
    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (const piece of pieces) {
        piece.vy += 0.28;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.spin += piece.vr;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.spin);
        context.globalAlpha = Math.max(0, 1 - frame / 170);
        context.fillStyle = piece.color;
        if (piece.size > 11) context.fillRect(-piece.size / 2, -piece.size / 5, piece.size, piece.size / 2.4);
        else {
          context.beginPath();
          context.arc(0, 0, piece.size / 3, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      }
      frame += 1;
      if (frame < 170) raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-30" aria-hidden="true" />;
}
