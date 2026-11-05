import { cn } from "cn";
import { Clapperboard, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";
import type { Scene } from "../lib/model";
import type { WorkspaceState } from "./application";
import { Button } from "./ui/button";

export function SceneTile({
  state,
  scene,
}: {
  state: WorkspaceState;
  scene: Scene;
}) {
  const { activateScene, playback } = state;
  const active = playback.sceneId === scene.id;
  const play = useCallback(() => activateScene(scene), [activateScene, scene]);
  return (
    <button
      aria-label={`Ativar cena ${scene.name}`}
      className={cn(
        "border-border text-foreground grid w-full flex-1 grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-x-3 gap-y-1.5 rounded-xl border bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-raised)] transition-all hover:border-[var(--border-strong)] sm:max-w-[360px] sm:min-w-[220px]",
        active &&
          "border-primary bg-[var(--selected)] text-[var(--selected-foreground)] shadow-[var(--shadow-inset)]"
      )}
      onClick={play}
      type="button"
    >
      <Clapperboard className="text-muted-foreground row-span-2" size={24} />
      <strong className="truncate font-[550]">{scene.name}</strong>
      <span className="text-muted-foreground col-start-2 text-[11px]">
        {scene.layers.length} camadas · {scene.effectIds.length} efeitos
      </span>
      <span className="text-muted-foreground col-start-3 row-span-2">
        <Play size={16} />
      </span>
    </button>
  );
}

export function ScenePanel({ state }: { state: WorkspaceState }) {
  const { library, openScene } = state;
  const create = useCallback(() => openScene(), [openScene]);
  return (
    <section className="pb-6">
      <div className="[&>h2_svg]:text-muted-foreground [&>p]:text-muted-foreground mb-5 flex items-center justify-between gap-2.5 sm:gap-3.5 [&>h2]:flex [&>h2]:items-center [&>h2]:gap-2 [&>h2]:text-base sm:[&>h2]:text-lg [&>p]:mt-1 [&>p]:text-xs">
        <div>
          <h2>
            <Clapperboard size={19} /> Cenas
          </h2>
          <p>Alterne ambiências completas em um clique durante a narrativa.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {library.scenes.map((scene) => (
          <SceneTile key={scene.id} scene={scene} state={state} />
        ))}
        <button
          className="border-border text-muted-foreground flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-transparent px-6 py-3.5 text-[13px] transition-colors hover:border-[var(--border-strong)] sm:min-h-[76px] sm:w-auto"
          onClick={create}
          type="button"
        >
          <Plus size={16} /> Criar nova cena
        </button>
      </div>
      {library.scenes.length === 0 ? (
        <p className="text-muted-foreground max-w-[80ch] pt-4 text-[13px] leading-[1.7]">
          Crie uma cena para coordenar música, sons de fundo e efeitos
          especiais. Por exemplo: combate na floresta, descanso na taverna ou
          perseguição.
        </p>
      ) : null}
    </section>
  );
}

export function SceneListRow({
  state,
  scene,
}: {
  state: WorkspaceState;
  scene: Scene;
}) {
  const { library, openScene, activateScene, deleteScene, busy } = state;
  const edit = useCallback(() => openScene(scene), [openScene, scene]);
  const activate = useCallback(
    () => activateScene(scene),
    [activateScene, scene]
  );
  const remove = useCallback(() => deleteScene(scene), [deleteScene, scene]);
  return (
    <div className="border-border flex flex-wrap items-center gap-3 border-b px-0 py-5 sm:flex-nowrap sm:gap-4 sm:p-6">
      <Clapperboard className="text-muted-foreground shrink-0" size={24} />
      <div className="min-w-0 flex-1 basis-[70%] sm:basis-auto">
        <h2 className="font-semibold break-words sm:text-lg">{scene.name}</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {library.playlists.find(
            (playlist) => playlist.id === scene.playlistId
          )?.name ?? "Sem música"}{" "}
          · {scene.layers.length} ambientes · {scene.effectIds.length} efeitos
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          aria-label={`Editar cena ${scene.name}`}
          disabled={Boolean(busy)}
          onClick={edit}
          variant="outline"
        >
          <Pencil /> Editar
        </Button>
        <Button aria-label={`Ativar cena ${scene.name}`} onClick={activate}>
          <Play /> Ativar
        </Button>
        <Button
          aria-label={`Excluir cena ${scene.name}`}
          disabled={Boolean(busy)}
          onClick={remove}
          size="icon"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

export function ScenesView({ state }: { state: WorkspaceState }) {
  const { library, openScene } = state;
  const create = useCallback(() => openScene(), [openScene]);
  return (
    <section className="min-w-0">
      <div className="divide-border divide-y">
        {library.scenes.map((scene) => (
          <SceneListRow key={scene.id} scene={scene} state={state} />
        ))}
      </div>
      {library.scenes.length === 0 ? (
        <div className="text-muted-foreground [&>h2]:text-foreground flex flex-col items-center justify-center gap-3 p-8 text-center [&>h2]:text-lg [&>h2]:font-semibold [&>p]:max-w-[50ch] [&>p]:text-sm">
          <Clapperboard size={40} />
          <h2>A narrativa ganha vida em cenas.</h2>
          <p>
            Combine uma música de fundo, chuva na janela e passos de monstros.
            Dispare tudo em um só toque.
          </p>
          <Button onClick={create}>
            <Plus /> Criar primeira cena
          </Button>
        </div>
      ) : null}
    </section>
  );
}
