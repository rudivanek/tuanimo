import { useState, useEffect } from 'react';

const FLAGS = {
  recognition: 'elena_dev_force_recognition',
  returnTrigger: 'elena_dev_force_return_trigger',
  insightGreeting: 'elena_dev_force_insight_greeting',
  memoryMatch: 'elena_dev_force_memory_match',
} as const;

type FlagKey = keyof typeof FLAGS;

function getActive(): Record<FlagKey, boolean> {
  return {
    recognition: !!localStorage.getItem(FLAGS.recognition),
    returnTrigger: !!localStorage.getItem(FLAGS.returnTrigger),
    insightGreeting: !!localStorage.getItem(FLAGS.insightGreeting),
    memoryMatch: !!localStorage.getItem(FLAGS.memoryMatch),
  };
}

export function DevPanel() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Record<FlagKey, boolean>>(getActive);

  useEffect(() => {
    if (open) setActive(getActive());
  }, [open]);

  function toggle(key: FlagKey) {
    const flag = FLAGS[key];
    if (localStorage.getItem(flag)) {
      localStorage.removeItem(flag);
    } else {
      localStorage.setItem(flag, '1');
    }
    setActive(getActive());
  }

  function reset() {
    Object.values(FLAGS).forEach(f => localStorage.removeItem(f));
    setActive(getActive());
  }

  const anyActive = Object.values(active).some(Boolean);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        zIndex: 9999,
        fontFamily: 'monospace',
        fontSize: 11,
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: anyActive ? '#dc2626' : '#1e293b',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '3px 7px',
          cursor: 'pointer',
          opacity: 0.85,
          letterSpacing: 0.3,
        }}
      >
        {anyActive ? '⚙ DEV [ON]' : '⚙ DEV'}
      </button>

      {open && (
        <div
          style={{
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '10px 12px',
            marginBottom: 6,
            minWidth: 200,
            position: 'absolute',
            bottom: '100%',
            left: 0,
          }}
        >
          <div style={{ marginBottom: 8, color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Elena Dev Flags
          </div>

          {([
            ['recognition', 'Force Recognition'],
            ['returnTrigger', 'Force Return Trigger'],
            ['insightGreeting', 'Force Insight Greeting'],
            ['memoryMatch', 'Force Memory Match'],
          ] as [FlagKey, string][]).map(([key, label]) => (
            <div key={key} style={{ marginBottom: 5 }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={active[key]}
                  onChange={() => toggle(key)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ color: active[key] ? '#4ade80' : '#94a3b8' }}>{label}</span>
              </label>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #1e293b', marginTop: 8, paddingTop: 8 }}>
            <button
              onClick={reset}
              style={{
                background: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: 3,
                padding: '2px 8px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Reset All Flags
            </button>
          </div>

          <div style={{ marginTop: 8, color: '#475569', fontSize: 9, lineHeight: 1.4 }}>
            Flags take effect on next<br />message / new thread load.
          </div>
        </div>
      )}
    </div>
  );
}
