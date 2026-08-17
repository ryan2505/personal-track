"use client";

import { ChevronLeft, ChevronRight, ImagePlus, Quote, Trash2, Type } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import type { HabitCategory, VisionItem, VisionItemKind } from "@/lib/domain";
import { compressImage } from "@/lib/images";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/labels";
import { DEFAULT_QUOTES } from "@/lib/quotes";
import { useStore } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";

/**
 * Grille de tuiles réordonnables, pas un canvas libre.
 * Le drag/resize/z-index coûte énormément — surtout en mobile — pour un gain
 * marginal (CLAUDE.md §12).
 */
export function VisionBoard({ editable = true }: { editable?: boolean }) {
  const { state, addVisionItem, removeVisionItem, moveVisionItem } = useStore();
  const [composing, setComposing] = useState<VisionItemKind | null>(null);

  const items = [...state.visionItems].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setComposing("image")}>
            <ImagePlus className="size-4" />
            Image
          </Button>
          <Button onClick={() => setComposing("text")}>
            <Type className="size-4" />
            Texte
          </Button>
          <Button onClick={() => setComposing("quote")}>
            <Quote className="size-4" />
            Citation
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Vision board vide"
          description="Une image, un mot, une citation. Ce que tu veux avoir sous les yeux les jours où tu n'as pas envie."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <VisionTile
              key={item.id}
              item={item}
              editable={editable}
              first={index === 0}
              last={index === items.length - 1}
              onRemove={() => removeVisionItem(item.id)}
              onMove={(direction) => moveVisionItem(item.id, direction)}
            />
          ))}
        </div>
      )}

      {composing !== null && (
        <VisionComposer
          kind={composing}
          onClose={() => setComposing(null)}
          onSubmit={(item) => addVisionItem(item)}
        />
      )}
    </div>
  );
}

function VisionTile({
  item,
  editable,
  first,
  last,
  onRemove,
  onMove,
}: {
  item: VisionItem;
  editable: boolean;
  first: boolean;
  last: boolean;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <figure className="border-border bg-surface group relative overflow-hidden rounded-md border">
      {item.kind === "image" ? (
        <>
          {/* Données locales encodées : next/image n'apporte rien ici. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.content}
            alt={item.caption ?? "Élément du vision board"}
            className="aspect-square w-full object-cover"
          />
          {item.caption !== null && item.caption !== "" && (
            <figcaption className="text-muted px-3 py-2 text-xs">{item.caption}</figcaption>
          )}
        </>
      ) : (
        <div className="flex aspect-square flex-col justify-center gap-2 p-4">
          <p
            className={cn(
              "leading-snug",
              item.kind === "quote" ? "font-display text-base italic" : "text-sm font-medium",
            )}
          >
            {item.kind === "quote" ? `« ${item.content} »` : item.content}
          </p>
          {item.author !== null && item.author !== "" && (
            <p className="text-faint text-xs">{item.author}</p>
          )}
        </div>
      )}

      {item.category !== null && (
        <span className="text-faint absolute top-2 left-2 rounded-sm bg-black/50 px-1.5 py-0.5 text-[10px] backdrop-blur">
          {CATEGORY_LABELS[item.category]}
        </span>
      )}

      {editable && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <TileAction label="Reculer" onClick={() => onMove(-1)} disabled={first}>
            <ChevronLeft className="size-3.5" />
          </TileAction>
          <TileAction label="Avancer" onClick={() => onMove(1)} disabled={last}>
            <ChevronRight className="size-3.5" />
          </TileAction>
          <TileAction label="Supprimer" onClick={onRemove}>
            <Trash2 className="size-3.5" />
          </TileAction>
        </div>
      )}
    </figure>
  );
}

function TileAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="text-text flex size-7 items-center justify-center rounded-sm bg-black/60 backdrop-blur disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function VisionComposer({
  kind,
  onClose,
  onSubmit,
}: {
  kind: VisionItemKind;
  onClose: () => void;
  onSubmit: (item: Omit<VisionItem, "id" | "order">) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [caption, setCaption] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<HabitCategory | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (file === undefined) return;
    setBusy(true);
    setError(null);
    try {
      setContent(await compressImage(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image illisible.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (content.trim() === "") return;
    onSubmit({
      kind,
      category: category === "" ? null : category,
      content,
      caption: caption.trim() === "" ? null : caption.trim(),
      author: author.trim() === "" ? null : author.trim(),
    });
    onClose();
  };

  const titles: Record<VisionItemKind, string> = {
    image: "Ajouter une image",
    text: "Ajouter un mot-clé",
    quote: "Ajouter une citation",
  };

  return (
    <Modal open onClose={onClose} title={titles[kind]}>
      <div className="space-y-4">
        {kind === "image" ? (
          <div className="space-y-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void pick(event.target.files?.[0])}
            />
            {content === "" ? (
              <Button className="w-full" onClick={() => fileInput.current?.click()} disabled={busy}>
                <ImagePlus className="size-4" />
                {busy ? "Compression…" : "Choisir une image"}
              </Button>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={content} alt="Aperçu" className="max-h-56 w-full rounded-md object-cover" />
                <Button className="w-full" onClick={() => setContent("")}>
                  Changer d&apos;image
                </Button>
              </>
            )}
            <Field label="Légende">
              <TextInput
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Optionnel"
              />
            </Field>
          </div>
        ) : (
          <>
            <Field label={kind === "quote" ? "Citation" : "Texte"}>
              <TextArea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={
                  kind === "quote"
                    ? "La discipline vaut mieux que la motivation."
                    : "Indépendance financière"
                }
                autoFocus
              />
            </Field>

            {/* Proposées seulement tant que le champ est vide : une suggestion
                n'écrase jamais ce que la personne a commencé à écrire. */}
            {kind === "quote" && content.trim() === "" && (
              <div className="space-y-2">
                <p className="text-muted text-xs tracking-wide uppercase">Suggestions</p>
                <div className="space-y-1.5">
                  {DEFAULT_QUOTES.slice(0, 6).map((quote) => (
                    <button
                      key={quote.text}
                      onClick={() => {
                        setContent(quote.text);
                        setAuthor(quote.author ?? "");
                      }}
                      className="border-border hover:border-accent hover:text-text text-muted block w-full rounded-md border px-3 py-2 text-left text-xs leading-relaxed transition-colors"
                    >
                      {quote.text}
                      {quote.author !== null && (
                        <span className="text-faint block pt-0.5">{quote.author}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {kind === "quote" && (
              <Field label="Auteur">
                <TextInput
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder="Optionnel"
                />
              </Field>
            )}
          </>
        )}

        <Field label="Domaine de vie">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as HabitCategory | "")}
            className="border-border bg-surface-2 text-text w-full appearance-none rounded-md border px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Aucun</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </Field>

        {error !== null && <p className="text-danger text-xs leading-relaxed">{error}</p>}

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={submit} disabled={content.trim() === ""}>
            Ajouter
          </Button>
          <Button onClick={onClose}>Annuler</Button>
        </div>
      </div>
    </Modal>
  );
}
