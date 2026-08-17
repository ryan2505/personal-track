import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-muted text-xs tracking-wide uppercase">{label}</span>
      {children}
      {hint !== undefined && <span className="text-faint block text-xs">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "border-border bg-surface-2 text-text placeholder:text-faint w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export function TextInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL, "appearance-none", className)} {...props} />;
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "min-h-20 resize-y", className)} {...props} />;
}
