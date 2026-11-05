import { expect } from "@playwright/test";
import { emptyLibrary } from "../src/lib/model";
import { test } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("a biblioteca de teste usa servidor separado e aceita uma manifestação própria", async ({
  request,
  baseURL,
}) => {
  expect(baseURL).toBeTruthy();
  const { origin } = new URL(baseURL ?? "http://127.0.0.1:3000");
  expect(new URL(origin).port).not.toBe("3000");
  expect(new URL(origin).port).not.toBe("8000");
  const current = await request.get(`${origin}/api/library`);
  expect(current.ok()).toBe(true);
  const library = await current.json();
  const updated = await request.put(`${origin}/api/library`, {
    headers: { Origin: origin },
    multipart: {
      library: JSON.stringify({
        ...emptyLibrary(),
        revision: library.revision,
        tags: ["Somente E2E"],
      }),
    },
  });
  expect(updated.ok()).toBe(true);
  expect(await updated.json()).toMatchObject({ tags: ["Somente E2E"] });
});

test("cada cenário começa com a biblioteca vazia sem reaproveitar a manifestação anterior", async ({
  request,
  baseURL,
}) => {
  expect(baseURL).toBeTruthy();
  const { origin } = new URL(baseURL ?? "http://127.0.0.1:3000");
  expect(new URL(origin).port).not.toBe("3000");
  expect(new URL(origin).port).not.toBe("8000");
  const response = await request.get(`${origin}/api/library`);
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    playlists: [],
    scenes: [],
    sounds: [],
    tags: [],
  });
});
