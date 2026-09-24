export default function TableLoader({ cols }) {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i} style={{ opacity: 1 - i * 0.12 }}>
          {[...Array(cols)].map((_, j) => (
            <td key={j}>
              <div style={{
                height: 14,
                borderRadius: 6,
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s infinite',
                width: j === 0 ? '40%' : j === 1 ? '70%' : '55%',
              }} />
            </td>
          ))}
        </tr>
      ))}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}
