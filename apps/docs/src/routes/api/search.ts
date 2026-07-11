import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";

import { getDocsSource } from "@/lib/source";

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const source = await getDocsSource();
        const server = createFromSource(source, { language: "english" });
        return server.GET(request);
      },
    },
  },
});
