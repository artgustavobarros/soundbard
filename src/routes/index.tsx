import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Application } from "../components/application";

function LocalApplication() {
  return (
    <ClientOnly>
      <Application />
    </ClientOnly>
  );
}

export const Route = createFileRoute("/")({
  component: LocalApplication,
  ssr: false,
  // O shell SPA e o cliente precisam manter a mesma boundary durante a hidratação.
  wrapInSuspense: true,
});
