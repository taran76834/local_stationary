import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';

const PIE_COLORS = ['#10b981', '#94a3b8', '#ef4444'];

export default function BillsPieChart({ data }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, n) => [v, n]}
            contentStyle={{
              background: '#1e293b', border: 'none',
              borderRadius: 8, color: '#fff', fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '0 16px 16px', flexWrap: 'wrap' }}>
        {data.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i] }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>{item.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}
