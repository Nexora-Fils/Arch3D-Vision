export interface TemplateFact {
  label: string;
  value: string;
}

/** Key figures of a house model, as a compact definition grid. */
export const TemplateFacts = ({ facts }: { facts: TemplateFact[] }) => (
  <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5">
    {facts.map(({ label, value }) => (
      <div key={label} className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium text-midnight">{value}</dd>
      </div>
    ))}
  </dl>
);
