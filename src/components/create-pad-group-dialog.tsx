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
      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[4px] px-2 hover:bg-[#242424]"
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
  onSave: (name: string, padIds: string[]) => boolean;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
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
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selected.size) {
        setError("Escolha ao menos um pad para o grupo.");
        return;
      }
      if (!name.trim()) {
        setError("Informe um nome para o grupo.");
        return;
      }
      if (!onSave(name.trim(), [...selected])) {
        setError("Não foi possível salvar neste navegador. Tente novamente.");
        return;
      }
      onOpenChange(false);
    },
    [name, onOpenChange, onSave, selected]
  );
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-[#303030] bg-[#111] text-white [--background:#111] [--border:#303030] [--foreground:#fafafa] [--muted:#a6a6a6] [--primary-foreground:#080808] [--primary:#fafafa] [--ring:#69aeff] [--secondary:#242424] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Criar grupo de pads</DialogTitle>
          <DialogDescription className="text-[#a6a6a6]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor={nameId}>Nome do grupo</Label>
            <Input
              className="border-[#444] bg-[#191919] text-[16px]"
              id={nameId}
              maxLength={80}
              onChange={changeName}
              required
              value={name}
            />
          </div>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-[13px]">Escolha os pads</legend>
            <div className="max-h-[40dvh] overflow-y-auto rounded-[4px] border border-[#303030] p-1">
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
          <p className="text-[12px] text-[#a6a6a6]">
            {selected.size} pads selecionados
          </p>
          {Boolean(error) && (
            <p className="text-[12px] text-[#ff8888]" role="alert">
              {error}
            </p>
          )}
          <Button className="bg-white text-black hover:bg-[#ddd]" type="submit">
            Salvar grupo
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
