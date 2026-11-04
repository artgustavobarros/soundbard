import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { HardwareLayoutPrototype } from "../components/hardware-layout-prototype";
import {
  PadLayoutPrototype,
  type PadLayoutVariant,
} from "../components/pad-layout-prototype";
import { SoundboardPreview } from "../components/soundboard-preview";

interface PreviewSearch {
  estudo?: "hardware" | "pads";
  variant: PadLayoutVariant;
}
function validateSearch(search: Record<string, unknown>): PreviewSearch {
  const variant =
    search.variant === "B" || search.variant === "C" ? search.variant : "A";
  return search.estudo === "pads" || search.estudo === "hardware"
    ? { estudo: search.estudo, variant }
    : { variant };
}
const previewSearchOptions = { validateSearch };
export const Route = createFileRoute("/previa")({
  ...previewSearchOptions,
  component: PreviewRoute,
  ssr: false,
  wrapInSuspense: true,
});

function PreviewRoute() {
  const { estudo, variant } = Route.useSearch();
  const navigate = Route.useNavigate();
  const changeVariant = useCallback(
    (next: PadLayoutVariant) => {
      navigate({
        replace: true,
        search: { estudo: estudo ?? "pads", variant: next },
      });
    },
    [estudo, navigate]
  );
  let preview = <SoundboardPreview />;
  if (estudo === "hardware") {
    preview = (
      <HardwareLayoutPrototype
        onVariantChange={changeVariant}
        variant={variant}
      />
    );
  } else if (estudo === "pads") {
    preview = (
      <PadLayoutPrototype onVariantChange={changeVariant} variant={variant} />
    );
  }
  return <ClientOnly>{preview}</ClientOnly>;
}
