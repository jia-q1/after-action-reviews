export function formatMonthYear(value: string) {
  if (!value) return "";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function formatPeriod(start: string, end: string) {
  const startLabel = formatMonthYear(start);
  const endLabel = formatMonthYear(end);
  if (!startLabel) return endLabel;
  if (!endLabel || startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}
