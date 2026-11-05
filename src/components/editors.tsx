import { cn } from "cn";
import { AudioLines, Youtube } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useCallback } from "react";
import { restoreWorkspaceFocus } from "../lib/dialog-focus";
import type { Layer, Library, Playlist, Scene, Sound } from "../lib/model";
import { TagsInput } from "./tags-input";
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

function CheckLine({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: O componente encapsula o Checkbox e o texto via children
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 py-2 text-[13px] break-words select-none [&>button]:shrink-0 [&>input]:shrink-0 [&>span]:min-w-0 [&>span]:break-words",
        className
      )}
    >
      {children}
    </label>
  );
}

function Picker({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-h-[220px] overflow-auto rounded-lg bg-[var(--surface-inset)] px-3 py-1.5 shadow-[var(--shadow-inset)] [&>p]:py-2.5 [&>p]:leading-[1.7]",
        className
      )}
    >
      {children}
    </div>
  );
}

export type Editor =
  | { type: "import" }
  | { type: "sound"; sound: Sound }
  | { type: "playlist"; playlist?: Playlist }
  | { type: "scene"; scene?: Scene }
  | {
      type: "confirm";
      title: string;
      description: string;
      label: string;
      action: () => Promise<void>;
    };

export const kindNames = {
  ambience: "Ambiente",
  effect: "Efeito",
  music: "Música",
};

function editorCopy(editor: Editor) {
  switch (editor.type) {
    case "import":
      return {
        description:
          "Escolha de onde vem o áudio. Depois de carregar, você poderá ouvir, cortar e organizar.",
        label: "Importar arquivos",
        title: "Importar áudios",
      };
    case "sound":
      return {
        description: "Organize este som e defina suas configurações iniciais.",
        label: "Salvar",
        title: "Editar som",
      };
    case "playlist":
      return {
        description: "A mesma música pode participar de várias playlists.",
        label: "Salvar",
        title: editor.playlist ? "Editar playlist" : "Nova playlist",
      };
    case "scene":
      return {
        description:
          "Combine uma playlist, ambientes e efeitos para preparar a próxima sessão.",
        label: "Salvar",
        title: editor.scene ? "Editar cena" : "Nova cena",
      };
    case "confirm":
      return {
        description: editor.description,
        label: editor.label,
        title: editor.title,
      };
    default:
      return editor satisfies never;
  }
}

function KindOptions() {
  return Object.entries(kindNames).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}

function SoundFields({ sound, tags }: { sound: Sound; tags: string[] }) {
  return (
    <>
      <Label htmlFor="sound-name">Nome do som</Label>
      <Input
        defaultValue={sound.name}
        id="sound-name"
        maxLength={200}
        name="name"
        required
      />
      <Label htmlFor="kind">Tipo do som</Label>
      <select defaultValue={sound.kind} id="kind" name="kind">
        <KindOptions />
      </select>
      <TagsInput
        defaultValue={sound.tags}
        id="sound-tags"
        name="tags"
        options={tags}
      />
      <Label htmlFor="base-volume">Volume inicial</Label>
      <input
        defaultValue={sound.volume}
        id="base-volume"
        max="1"
        min="0"
        name="volume"
        step="0.01"
        type="range"
      />
      <CheckLine>
        <Checkbox defaultChecked={sound.loop} name="loop" /> Repetir este som
      </CheckLine>
    </>
  );
}

function PlaylistFields({
  playlist,
  sounds,
}: {
  playlist?: Playlist;
  sounds: Sound[];
}) {
  const music = sounds.filter((sound) => sound.kind === "music");
  const selected = new Set(playlist?.soundIds);
  return (
    <>
      <Label htmlFor="playlist-name">Nome da playlist</Label>
      <Input
        defaultValue={playlist?.name ?? ""}
        id="playlist-name"
        maxLength={200}
        name="name"
        placeholder="Músicas de combate"
        required
      />
      <Label htmlFor="repeat">Repetição</Label>
      <select
        defaultValue={playlist?.repeat ?? "off"}
        id="repeat"
        name="repeat"
      >
        <option value="off">Sem repetição</option>
        <option value="one">Repetir música atual</option>
        <option value="all">Repetir playlist</option>
      </select>
      <CheckLine>
        <Checkbox defaultChecked={playlist?.shuffle ?? false} name="shuffle" />{" "}
        Embaralhar músicas
      </CheckLine>
      <h3>Músicas da biblioteca</h3>
      <Picker>
        {music.map((sound) => (
          <CheckLine key={sound.id}>
            <Checkbox
              defaultChecked={selected.has(sound.id)}
              name="soundIds"
              value={sound.id}
            />
            <span>{sound.name}</span>
          </CheckLine>
        ))}
        {music.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">
            Importe arquivos como Música para montar sua playlist.
          </p>
        ) : null}
      </Picker>
    </>
  );
}

function SceneLayerFields({ sound, layer }: { sound: Sound; layer?: Layer }) {
  return (
    <div className="border-border border-b py-1.5">
      <CheckLine>
        <Checkbox
          defaultChecked={Boolean(layer)}
          name="layers"
          value={sound.id}
        />
        <span>{sound.name}</span>
      </CheckLine>
      <div className="[&>label:first-child]:text-muted-foreground flex items-center gap-5 pl-6 [&_input[type=range]]:w-full [&>label:first-child]:grid [&>label:first-child]:flex-1 [&>label:first-child]:gap-1 [&>label:first-child]:text-[11px]">
        <label>
          Volume de {sound.name}
          <input
            defaultValue={layer?.volume ?? sound.volume}
            max="1"
            min="0"
            name={`volume-${sound.id}`}
            step="0.01"
            type="range"
          />
        </label>
        <CheckLine>
          <Checkbox
            defaultChecked={layer?.loop ?? sound.loop}
            name={`loop-${sound.id}`}
          />{" "}
          Loop
        </CheckLine>
      </div>
    </div>
  );
}

function SceneFields({ scene, library }: { scene?: Scene; library: Library }) {
  const ambience = library.sounds.filter((sound) => sound.kind === "ambience");
  const effects = library.sounds.filter((sound) => sound.kind === "effect");
  const layers = new Map(scene?.layers.map((layer) => [layer.soundId, layer]));
  const selectedEffects = new Set(scene?.effectIds);
  return (
    <>
      <Label htmlFor="scene-name">Nome da cena</Label>
      <Input
        defaultValue={scene?.name ?? ""}
        id="scene-name"
        maxLength={200}
        name="name"
        placeholder="Taverna ao anoitecer"
        required
      />
      <Label htmlFor="scene-type">Tipo da cena</Label>
      <select
        defaultValue={scene?.type ?? "locations"}
        id="scene-type"
        name="type"
      >
        <option value="characters">Personagens</option>
        <option value="locations">Locais</option>
        <option value="combat">Combate</option>
      </select>
      <Label htmlFor="scene-playlist">Playlist da cena</Label>
      <select
        defaultValue={scene?.playlistId ?? ""}
        id="scene-playlist"
        name="playlistId"
      >
        <option value="">Sem música</option>
        {library.playlists.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>
            {playlist.name}
          </option>
        ))}
      </select>
      <Label htmlFor="scene-volume">Volume da música</Label>
      <input
        defaultValue={scene?.musicVolume ?? 0.7}
        id="scene-volume"
        max="1"
        min="0"
        name="musicVolume"
        step="0.01"
        type="range"
      />
      <h3>Ambientes</h3>
      <Picker>
        {ambience.map((sound) => (
          <SceneLayerFields
            key={sound.id}
            layer={layers.get(sound.id)}
            sound={sound}
          />
        ))}
        {ambience.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">
            Importe arquivos como Ambiente para criar camadas.
          </p>
        ) : null}
      </Picker>
      <h3>Efeitos disponíveis</h3>
      <Picker>
        {effects.map((sound) => (
          <CheckLine key={sound.id}>
            <Checkbox
              defaultChecked={selectedEffects.has(sound.id)}
              name="effects"
              value={sound.id}
            />
            <span>{sound.name}</span>
          </CheckLine>
        ))}
        {effects.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">
            Os efeitos ficam prontos para disparar durante a cena.
          </p>
        ) : null}
      </Picker>
    </>
  );
}

function EditorFields({
  editor,
  library,
}: {
  editor: Editor;
  library: Library;
}) {
  switch (editor.type) {
    case "import":
      return null;
    case "sound":
      return <SoundFields sound={editor.sound} tags={library.tags ?? []} />;
    case "playlist":
      return (
        <PlaylistFields playlist={editor.playlist} sounds={library.sounds} />
      );
    case "scene":
      return <SceneFields library={library} scene={editor.scene} />;
    case "confirm":
      return null;
    default:
      return editor satisfies never;
  }
}

export function Editors({
  editor,
  library,
  busy,
  close,
  save,
  onYouTube,
  onFile,
  onTrim,
  onDeleteSound,
}: {
  onYouTube: () => void;
  onFile: () => void;
  onTrim: (sound: Sound) => void;
  onDeleteSound?: (sound: Sound) => void;
  editor: Editor | null;
  library: Library;
  busy: string;
  close: () => void;
  save: (data: FormData, files: File[]) => Promise<void>;
}) {
  const handleClose = useCallback(
    (open: boolean) => {
      if (!(open || busy)) {
        close();
      }
    },
    [busy, close]
  );
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      save(new FormData(event.currentTarget), []);
    },
    [save]
  );
  const trim = useCallback(() => {
    if (editor?.type === "sound") {
      onTrim(editor.sound);
    }
  }, [editor, onTrim]);
  const removeSound = useCallback(() => {
    if (editor?.type === "sound" && onDeleteSound) {
      const { sound } = editor;
      close();
      onDeleteSound(sound);
    }
  }, [close, editor, onDeleteSound]);
  if (!editor) {
    return null;
  }
  const copy = editorCopy(editor);
  return (
    <Dialog onOpenChange={handleClose} open>
      <DialogContent
        className="sm:max-w-[500px]"
        onCloseAutoFocus={restoreWorkspaceFocus}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {editor.type === "import" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className="min-h-[100px] flex-col gap-3"
              disabled={Boolean(busy)}
              onClick={onYouTube}
              variant="outline"
            >
              <Youtube aria-hidden="true" className="size-6" />
              Importar do YouTube
            </Button>
            <Button
              className="min-h-[100px] flex-col gap-3"
              disabled={Boolean(busy)}
              onClick={onFile}
              variant="outline"
            >
              <AudioLines aria-hidden="true" className="size-6" />
              Arquivo de áudio
            </Button>
          </div>
        ) : (
          <>
            {editor.type === "sound" && (
              <Button disabled={Boolean(busy)} onClick={trim} variant="outline">
                Cortar áudio
              </Button>
            )}
            <form onSubmit={handleSubmit}>
              <fieldset
                className="mt-2.5 flex min-w-0 flex-col gap-3 border-0 p-0 [&>h3]:mt-3 [&>h3]:text-sm [&>h3]:font-semibold [&>label]:mt-1.5"
                disabled={Boolean(busy)}
              >
                <EditorFields editor={editor} library={library} />
              </fieldset>
              {busy ? (
                <p
                  className="text-foreground py-2.5 text-[13px] leading-[1.7]"
                  role="status"
                >
                  {busy}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-6">
                {editor.type === "sound" && onDeleteSound ? (
                  <Button
                    disabled={Boolean(busy)}
                    onClick={removeSound}
                    type="button"
                    variant="destructive"
                  >
                    Excluir som
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <Button
                    disabled={Boolean(busy)}
                    onClick={close}
                    type="button"
                    variant="outline"
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={Boolean(busy)}
                    type="submit"
                    variant={
                      editor.type === "confirm" ? "destructive" : "default"
                    }
                  >
                    {copy.label}
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
