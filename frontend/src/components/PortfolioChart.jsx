import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#ff6b3d", "#ffc145", "#1dbab4", "#2d7ff9", "#f94993", "#8892a6"];

export default function PortfolioChart({ positions }) {
  const chartData = positions.map((asset) => ({
    name: asset.symbol,
    value: Number(asset.valueUsd.toFixed(2))
  }));

  return (
    <section className="panel chart-panel">
      <header className="panel-header">
        <h3>Portfolio Distribution</h3>
      </header>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={95} paddingAngle={3}>
            {chartData.map((entry, idx) => (
              <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `$${value}`} />
        </PieChart>
      </ResponsiveContainer>
    </section>
  );
}
