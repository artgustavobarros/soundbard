import { cn } from "cn";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  MapPin,
  Plus,
  Swords,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface PreviewScene {
  id: string;
  name: string;
  type: "characters" | "locations" | "combat";
}

interface PreviewNavigationProps {
  groups: { id: string; name: string }[];
  onCreateGroup: () => void;
  onEffects: (kind: "all" | "ambience" | "effect") => void;
  onGroup: (id: string) => void;
  onScene: (id: string) => void;
  scenes: PreviewScene[];
  selected: string;
}

const triggerClass =
  "h-[44px] min-w-0 gap-1 rounded-[4px] border-[#303030] bg-transparent px-2 text-white shadow-none hover:border-[#69aeff] hover:bg-[#191919] focus-visible:outline-[#69aeff]!";
const menuClass =
  "w-[220px] max-w-[calc(100vw-24px)] rounded-[5px] border-[#303030] bg-[#111] text-white [--background:#111] [--border:#303030] [--foreground:#fafafa] [--muted:#a6a6a6] [--primary:#fafafa] [--ring:#69aeff] [--secondary:#242424]";
const itemClass =
  "min-h-[44px] cursor-pointer text-[13px] focus:bg-[#1b2836] focus:text-white data-[highlighted]:bg-[#1b2836] data-[highlighted]:text-white";
const categories = [
  { icon: Users, label: "Personagens", type: "characters" as const },
  { icon: MapPin, label: "Locais", type: "locations" as const },
  { icon: Swords, label: "Combate", type: "combat" as const },
];
const effectOptions = [
  { label: "Todos os efeitos", value: "all" },
  { label: "Ambiente", value: "ambience" },
  { label: "Pontuais", value: "effect" },
];

function NavigationTrigger({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        aria-current={active ? "true" : undefined}
        className={cn(triggerClass, active && "border-[#aaa] bg-[#202020]")}
        variant="outline"
      >
        <span className="text-[12px]">{label}</span>
        <ChevronDown aria-hidden="true" className="size-[12px]" />
      </Button>
    </DropdownMenuTrigger>
  );
}

function SceneCategoryItem({
  category,
  onSelect,
}: {
  category: (typeof categories)[number];
  onSelect: (type: PreviewScene["type"]) => void;
}) {
  const selectCategory = useCallback(
    (event: Event) => {
      event.preventDefault();
      onSelect(category.type);
    },
    [category.type, onSelect]
  );
  return (
    <DropdownMenuItem
      className={cn(itemClass, "gap-2")}
      onSelect={selectCategory}
    >
      <category.icon
        aria-hidden="true"
        className="size-[16px] text-[#a6a6a6]"
      />
      {category.label}
      <ChevronRight
        aria-hidden="true"
        className="ml-auto size-[16px] text-[#a6a6a6]"
      />
    </DropdownMenuItem>
  );
}

export function PreviewNavigation({
  scenes,
  groups,
  selected,
  onScene,
  onEffects,
  onGroup,
  onCreateGroup,
}: PreviewNavigationProps) {
  const [category, setCategory] = useState<PreviewScene["type"] | null>(null);
  const changeScenesOpen = useCallback((open: boolean) => {
    if (!open) {
      setCategory(null);
    }
  }, []);
  const showCategories = useCallback((event: Event) => {
    event.preventDefault();
    setCategory(null);
  }, []);
  const categoryName = categories.find((item) => item.type === category)?.label;
  const select = useCallback(
    (value: string) => {
      if (value.startsWith("scene:")) {
        onScene(value.slice(6));
        return;
      }
      if (value.startsWith("group:")) {
        onGroup(value.slice(6));
        return;
      }
      const kind = value.slice(8);
      if (kind === "all" || kind === "ambience" || kind === "effect") {
        onEffects(kind);
      }
    },
    [onEffects, onGroup, onScene]
  );

  return (
    <nav
      aria-label="Conjuntos de pads"
      className="flex h-[44px] shrink-0 gap-2"
    >
      <DropdownMenu modal={false} onOpenChange={changeScenesOpen}>
        <NavigationTrigger
          active={selected.startsWith("scene:")}
          label="Cenas"
        />
        <DropdownMenuContent
          align="start"
          className={menuClass}
          collisionPadding={12}
        >
          {category === null ? (
            categories.map((item) => (
              <SceneCategoryItem
                category={item}
                key={item.type}
                onSelect={setCategory}
              />
            ))
          ) : (
            <>
              <DropdownMenuItem className={itemClass} onSelect={showCategories}>
                <ArrowLeft aria-hidden="true" className="size-[16px]" />
                Voltar
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#303030]" />
              <DropdownMenuRadioGroup
                aria-label={categoryName}
                onValueChange={select}
                value={selected}
              >
                {scenes
                  .filter((scene) => scene.type === category)
                  .map((scene) => (
                    <DropdownMenuRadioItem
                      className={itemClass}
                      key={scene.id}
                      value={`scene:${scene.id}`}
                    >
                      <span className="min-w-0 break-words">{scene.name}</span>
                    </DropdownMenuRadioItem>
                  ))}
                {!scenes.some((scene) => scene.type === category) && (
                  <DropdownMenuItem
                    className="min-h-[44px] text-[13px]"
                    disabled
                  >
                    Nenhuma cena salva
                  </DropdownMenuItem>
                )}
              </DropdownMenuRadioGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu modal={false}>
        <NavigationTrigger
          active={selected.startsWith("effects:")}
          label="Efeitos"
        />
        <DropdownMenuContent
          align="start"
          className={menuClass}
          collisionPadding={12}
        >
          <DropdownMenuRadioGroup onValueChange={select} value={selected}>
            {effectOptions.map((option) => (
              <DropdownMenuRadioItem
                className={itemClass}
                key={option.value}
                value={`effects:${option.value}`}
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu modal={false}>
        <NavigationTrigger
          active={selected.startsWith("group:")}
          label="Personalizado"
        />
        <DropdownMenuContent
          align="start"
          className={menuClass}
          collisionPadding={12}
        >
          <DropdownMenuRadioGroup onValueChange={select} value={selected}>
            {groups.map((group) => (
              <DropdownMenuRadioItem
                className={itemClass}
                key={group.id}
                value={`group:${group.id}`}
              >
                <span className="min-w-0 break-words">{group.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {groups.length === 0 && (
            <DropdownMenuItem className="min-h-[44px] text-[13px]" disabled>
              Nenhum grupo salvo
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-[#303030]" />
          <DropdownMenuItem className={itemClass} onSelect={onCreateGroup}>
            <Plus aria-hidden="true" className="size-[16px]" />
            Criar grupo de pads
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
