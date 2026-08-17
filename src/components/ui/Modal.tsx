"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      {/* Sur mobile la feuille monte du bas : le pouce reste en zone basse. */}
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="border-border bg-surface relative max-h-[90dvh] w-full overflow-y-auto rounded-t-lg border p-5 sm:max-w-lg sm:rounded-lg"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-medium">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted hover:text-text -mr-1 p-1"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
