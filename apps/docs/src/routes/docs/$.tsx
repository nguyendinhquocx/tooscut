import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClientLoader } from "fumadocs-mdx/runtime/vite";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { Suspense } from "react";

import { getMDXComponents } from "@/components/mdx";
import { baseOptions } from "@/lib/layout.shared";
import { getDocsSource } from "@/lib/source";

import { docs as docsCollection } from "../../../source.generated";

const clientLoader = createClientLoader(docsCollection.doc, {
  id: "docs",
  component({ toc, frontmatter, default: MDX }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        {frontmatter.description ? (
          <DocsDescription>{frontmatter.description}</DocsDescription>
        ) : null}
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    );
  },
});

const serverLoader = createServerFn({ method: "GET" })
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const source = await getDocsSource();
    const page = source.getPage(slugs);
    if (!page) throw notFound();
    // Tree contains ReactNode types in its signature but is JSON-safe at runtime.
    return { path: page.path, tree: source.pageTree as unknown as SerializedTree };
  });

type SerializedTree = Record<string, {}>;

export const Route = createFileRoute("/docs/$")({
  component: DocPage,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/").filter(Boolean) ?? [];
    const data = await serverLoader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});

function DocPage() {
  const { path, tree } = Route.useLoaderData();
  const MDXComponent = clientLoader.getComponent(path);

  return (
    <DocsLayout {...baseOptions()} tree={tree as never}>
      <Suspense>
        <MDXComponent />
      </Suspense>
    </DocsLayout>
  );
}
