import {
  type ChangeEvent,
  type SubmitEvent,
  useCallback,
  useId,
  useState,
} from "react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface PadChoice {
  id: string;
  name: string;
}

function GroupPadChoice({
  pad,
  checked,
  onToggle,
}: {
  pad: PadChoice;
  checked: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const id = useId();
  const toggle = useCallback(
    (value: boolean | "indeterminate") => onToggle(pad.id, value === true),
    [onToggle, pad.id]
  );
  return (
    <Label
      className="hover:bg-secondary flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[4px] px-2"
      htmlFor={id}
    >
      <Checkbox checked={checked} id={id} onCheckedChange={toggle} />
      <span className="min-w-0 text-[13px] break-words">{pad.name}</span>
    </Label>
  );
}

export function CreatePadGroupDialog({
  pads,
  onOpenChange,
  onSave,
  description = "Reúna os pads que você quer usar juntos, incluindo pads de playlists. Grupos desta prévia ficam salvos neste navegador.",
}: {
  pads: PadChoice[];
  description?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, padIds: string[]) => boolean | Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const changeName = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setName(event.currentTarget.value),
    []
  );
  const togglePad = useCallback((id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    setError("");
  }, []);
  const submit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (saving) {
        return;
      }
      if (!selected.size) {
        setError("Escolha ao menos um pad para o grupo.");
        return;
      }
      if (!name.trim()) {
        setError("Informe um nome para o grupo.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        if (await onSave(name.trim(), [...selected])) {
          onOpenChange(false);
        } else {
          setError("Não foi possível salvar o grupo. Tente novamente.");
        }
      } catch {
        setError("Não foi possível salvar o grupo. Tente novamente.");
      } finally {
        setSaving(false);
      }
    },
    [name, onOpenChange, onSave, selected, saving]
  );
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="border-border text-foreground max-h-[90dvh] overflow-y-auto bg-(--surface-raised) sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Criar grupo de pads</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Nome do grupo</Label>
            <Input
              className="border-border bg-(--surface-raised) text-[16px]"
              disabled={saving}
              id={nameId}
              maxLength={80}
              onChange={changeName}
              required
              value={name}
            />
          </div>
          <fieldset className="min-w-0" disabled={saving}>
            <legend className="mb-2 text-[13px]">Escolha os pads</legend>
            <div className="border-border max-h-[40dvh] overflow-y-auto rounded-[4px] border p-1">
              {pads.map((pad) => (
                <GroupPadChoice
                  checked={selected.has(pad.id)}
                  key={pad.id}
                  onToggle={togglePad}
                  pad={pad}
                />
              ))}
            </div>
          </fieldset>
          <p className="text-muted-foreground text-[12px]">
            {selected.size} pads selecionados
          </p>
          {Boolean(error) && (
            <p className="text-destructive text-[12px]" role="alert">
              {error}
            </p>
          )}
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            type="submit"
          >
            {saving ? "Salvando grupo…" : "Salvar grupo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
