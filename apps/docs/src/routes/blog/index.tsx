import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/lib/layout.shared";
import { getBlogSource } from "@/lib/source";

const listPosts = createServerFn({ method: "GET" }).handler(async () => {
  const blog = await getBlogSource();
  return blog
    .getPages()
    .map((p) => ({
      slug: p.slugs[p.slugs.length - 1] ?? "",
      url: p.url,
      title: (p.data as { title: string }).title,
      description: (p.data as { description?: string }).description,
      author: (p.data as { author: string }).author,
      date: String((p.data as { date: string | Date }).date),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
});

export const Route = createFileRoute("/blog/")({
  component: BlogIndex,
  loader: () => listPosts(),
});

function BlogIndex() {
  const posts = Route.useLoaderData();

  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
        <header className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tight">Blog</h1>
          <p className="text-fd-muted-foreground mt-2">
            Updates from the Tooscut team on rendering, editing, and the web platform.
          </p>
        </header>
        <ul className="divide-fd-border border-fd-border flex flex-col divide-y border-y">
          {posts.map((post) => (
            <li key={post.url}>
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="group hover:bg-fd-muted/40 flex flex-col gap-1 py-6 transition-colors"
              >
                <time className="text-fd-muted-foreground text-xs tracking-wide uppercase">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <h2 className="text-fd-foreground group-hover:text-fd-primary text-xl font-medium">
                  {post.title}
                </h2>
                {post.description ? (
                  <p className="text-fd-muted-foreground text-sm">{post.description}</p>
                ) : null}
                <p className="text-fd-muted-foreground mt-1 text-xs">by {post.author}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </HomeLayout>
  );
}
