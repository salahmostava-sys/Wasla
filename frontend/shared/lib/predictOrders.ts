/** Heuristic next-month order count: rolling average of last 7 + half of last month-over-month delta. */
export function predictOrders(values: number[]) {
  if (!values || values.length < 2) return 0;

  const last7 = values.slice(-7);

  const avg =
    last7.reduce((a, b) => a + b, 0) / last7.length;

  const growth =
    (values.at(-1) ?? 0) - (values.at(-2) ?? 0);

  return Math.round(avg + growth * 0.5);
}
