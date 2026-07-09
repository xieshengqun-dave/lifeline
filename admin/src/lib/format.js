export function formatMoney(value) {
  if (value == null) return "—";
  return `RM ${value.toFixed(2)}`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
