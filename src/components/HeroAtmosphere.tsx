import { useMemo } from 'react';

const TONES = [
  'rgba(122, 171, 138, 0.55)',
  'rgba(74, 124, 89, 0.40)',
  'rgba(255, 255, 255, 0.85)',
];

export function HeroAtmosphere() {
  const particles = useMemo(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    return Array.from({ length: 42 }, (_, i) => ({
      left: rand(2, 98),
      size: rand(8, 86),
      blur: rand(1, 12),
      dur: rand(7, 16),
      delay: -rand(0, 16),
      drift: rand(-70, 70),
      maxO: rand(0.25, 0.6),
      tone: i % 3,
    }));
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        @keyframes hero-rise {
          0%   { transform: translate3d(0,0,0); opacity: 0; }
          6%   { opacity: var(--max-o, .5); }
          88%  { opacity: var(--max-o, .5); }
          100% { transform: translate3d(var(--drift,0px),-115vh,0); opacity: 0; }
        }
        @keyframes hero-breathe {
          0%,100% { transform: translate(-50%,-50%) scale(1);    opacity: .55; }
          50%     { transform: translate(-50%,-50%) scale(1.14); opacity: .9; }
        }
      `}</style>

      <div style={{
        position: 'absolute',
        left: '50%',
        top: '46%',
        width: 'min(62vw, 680px)',
        height: 'min(62vw, 680px)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(234,242,237,.9) 0%, rgba(122,171,138,.18) 45%, transparent 70%)',
        animation: 'hero-breathe 9s ease-in-out infinite',
        willChange: 'transform, opacity',
      }} />

      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            bottom: -100,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${TONES[p.tone]}, transparent 70%)`,
            filter: `blur(${p.blur}px)`,
            ['--drift' as string]: `${p.drift}px`,
            ['--max-o' as string]: String(p.maxO),
            opacity: 0,
            animation: `hero-rise ${p.dur}s linear ${p.delay}s infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}
