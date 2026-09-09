import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // The engine and its harnesses. No DOM, because there is no DOM in the engine.
        test: {
          name: "rules",
          include: ["packages/*/tests/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        // The web app, driven through real components in jsdom. `jsx: automatic` because
        // the app tsconfig leaves JSX to Next, so vitest has to be told separately.
        esbuild: { jsx: "automatic" },
        test: {
          name: "web",
          include: ["apps/web/tests/**/*.test.tsx", "apps/web/tests/**/*.test.ts"],
          environment: "jsdom",
          globals: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
    },
  },
});
