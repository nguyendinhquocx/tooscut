import type { LoaderOutput } from "fumadocs-core/source";

import { loader } from "fumadocs-core/source";
import { fromConfig } from "fumadocs-mdx/runtime/vite";

import * as config from "../../source.config";
import { blog as blogCollection, docs as docsCollection } from "../../source.generated";
import { blogRoute, docsRoute } from "./shared";

const create = fromConfig<typeof config>();

let _docs: Promise<LoaderOutput<never>> | undefined;
let _blog: Promise<LoaderOutput<never>> | undefined;

export function getDocsSource() {
  _docs ??= (async () =>
    loader({
      source: await create.sourceAsync(docsCollection.doc, docsCollection.meta),
      baseUrl: docsRoute,
    }) as unknown as LoaderOutput<never>)();
  return _docs;
}

export function getBlogSource() {
  _blog ??= (async () =>
    loader({
      source: await create.sourceAsync(blogCollection, {}),
      baseUrl: blogRoute,
    }) as unknown as LoaderOutput<never>)();
  return _blog;
}
