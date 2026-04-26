export default function StatCard({ title, value, helper }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{title}</p>
      <h3 className="stat-value">{value}</h3>
      <p className="stat-helper">{helper}</p>
    </article>
  );
}
