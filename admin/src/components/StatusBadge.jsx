export default function StatusBadge({ tone = "neutral", label }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}
