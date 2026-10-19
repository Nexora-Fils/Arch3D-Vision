const DAY = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** "aujourd'hui", "hier", "il y a 3 jours", then the date past a week. */
export const formatRelativeDate = (date: Date, now = new Date()): string => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfToday - startOfDay) / DAY);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  return `le ${dateFormatter.format(date)}`;
};
