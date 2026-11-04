import { X } from "lucide-react";
import { Popover } from "radix-ui";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeTags, suggestTags, tagKey } from "../lib/tags";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface TagsInputProps {
  defaultValue?: string[];
  disabled?: boolean;
  id?: string;
  label?: string;
  name?: string;
  onChange?: (tags: string[]) => void;
  options: string[];
  value?: string[];
}

function preventAutoFocus(event: Event) {
  event.preventDefault();
}

export function TagsInput({
  defaultValue = [],
  disabled = false,
  id,
  label = "Tags",
  name,
  onChange,
  options,
  value,
}: TagsInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-options`;
  const hintId = `${inputId}-hint`;
  const input = useRef<HTMLInputElement | null>(null);
  const [localValue, setLocalValue] = useState(() =>
    normalizeTags(defaultValue)
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const newTag = query.trim();
  const { selected, known, matches, canCreate, choices } = useMemo(() => {
    const selectedTags = normalizeTags(value ?? localValue);
    const knownTags = normalizeTags([...options, ...selectedTags]);
    const suggestions = suggestTags(knownTags, newTag, selectedTags).slice(
      0,
      8
    );
    const create =
      newTag.length > 0 &&
      !knownTags.some((tag) => tagKey(tag) === tagKey(newTag));
    return {
      canCreate: create,
      choices: create ? [...suggestions, newTag] : suggestions,
      known: knownTags,
      matches: suggestions,
      selected: selectedTags,
    };
  }, [localValue, newTag, options, value]);
  const expanded = open && !disabled && choices.length > 0;
  const activeIndex = Math.min(active, Math.max(0, choices.length - 1));

  const change = useCallback(
    (tags: string[]) => {
      const next = normalizeTags(tags);
      if (value === undefined) {
        setLocalValue(next);
      }
      onChange?.(next);
    },
    [onChange, value]
  );

  const add = useCallback(
    (tag: string) => {
      const canonical =
        known.find((item) => tagKey(item) === tagKey(tag)) ?? tag;
      change([...selected, canonical]);
      setQuery("");
      setOpen(false);
      setActive(0);
      input.current?.focus();
    },
    [change, known, selected]
  );

  const close = useCallback(() => setOpen(false), []);
  const focus = useCallback(() => setOpen(true), []);
  const search = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
    setActive(0);
    setOpen(true);
  }, []);
  const choose = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { tag } = event.currentTarget.dataset;
      if (tag) {
        add(tag);
      }
    },
    [add]
  );
  const keepFocus = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);
  const interactOutside = useCallback(
    (event: { preventDefault: () => void; target: EventTarget | null }) => {
      if (event.target === input.current) {
        event.preventDefault();
      }
    },
    []
  );
  const remove = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      change(selected.filter((tag) => tag !== event.currentTarget.dataset.tag));
    },
    [change, selected]
  );
  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing) {
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setOpen(true);
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setActive((previous) =>
          choices.length
            ? (previous + direction + choices.length) % choices.length
            : 0
        );
        return;
      }
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        const choice = expanded ? choices[activeIndex] : newTag;
        if (choice) {
          add(choice);
        }
      }
    },
    [activeIndex, add, choices, expanded, newTag, open]
  );

  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Popover.Root onOpenChange={setOpen} open={expanded}>
        <Popover.Anchor asChild>
          <Input
            aria-activedescendant={
              expanded ? `${listId}-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={listId}
            aria-describedby={hintId}
            aria-expanded={expanded}
            autoComplete="off"
            className="min-h-11 border-[#444] bg-[#191919] text-base text-white"
            disabled={disabled}
            id={inputId}
            maxLength={60}
            onBlur={close}
            onChange={search}
            onFocus={focus}
            onKeyDown={keyDown}
            placeholder="Buscar ou criar tag"
            ref={input}
            role="combobox"
            value={query}
          />
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            aria-label="Sugestões de tags"
            className="z-[60] grid max-h-[min(14rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-md border border-[#444] bg-[#191919] p-1 shadow-lg"
            collisionPadding={12}
            id={listId}
            onCloseAutoFocus={preventAutoFocus}
            onInteractOutside={interactOutside}
            onOpenAutoFocus={preventAutoFocus}
            role="listbox"
            sideOffset={4}
          >
            {choices.map((tag, index) => {
              const optionLabel =
                canCreate && index === matches.length ? `Criar “${tag}”` : tag;
              return (
                <button
                  aria-selected={index === activeIndex}
                  className="min-h-11 min-w-0 rounded-sm px-3 py-2 text-left text-sm break-words text-white hover:bg-[#303030] focus-visible:outline-2 focus-visible:outline-[#69aeff] aria-selected:bg-[#303030]"
                  data-tag={tag}
                  id={`${listId}-${index}`}
                  key={tagKey(tag)}
                  onClick={choose}
                  onMouseDown={keepFocus}
                  onPointerDown={keepFocus}
                  role="option"
                  tabIndex={-1}
                  type="button"
                >
                  {optionLabel}
                </button>
              );
            })}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <p className="text-xs text-[#b8b8b8]" id={hintId}>
        Digite para buscar. Enter adiciona; as setas escolhem uma sugestão.
      </p>
      {selected.length > 0 ? (
        <ul aria-label="Tags selecionadas" className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <li
              className="inline-flex max-w-full items-center rounded-md border border-[#444] bg-[#222] pl-2.5 text-sm text-white"
              key={tagKey(tag)}
            >
              <span className="min-w-0 break-words">{tag}</span>
              <Button
                aria-label={`Remover tag ${tag}`}
                className="size-11 hover:bg-[#333]"
                data-tag={tag}
                disabled={disabled}
                onClick={remove}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {name ? (
        <input
          disabled={disabled}
          name={name}
          type="hidden"
          value={selected.join(", ")}
        />
      ) : null}
    </div>
  );
}
