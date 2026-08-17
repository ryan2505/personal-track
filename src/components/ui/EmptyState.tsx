/**
 * États vides — CLAUDE.md §10. C'est le premier écran que voit un nouvel
 * utilisateur : il doit dire quoi faire, pas seulement constater le vide.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted max-w-sm text-sm leading-relaxed">{description}</p>
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
