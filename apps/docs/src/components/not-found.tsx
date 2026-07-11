import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/lib/layout.shared";

export function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="text-fd-muted-foreground text-sm font-medium">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-fd-muted-foreground mt-3 max-w-md">
          The page you're looking for doesn't exist or has moved.
        </p>
        <a
          href="/docs"
          className="bg-fd-primary text-fd-primary-foreground mt-8 inline-flex rounded-full px-5 py-2.5 text-sm font-medium"
        >
          Back to docs
        </a>
      </main>
    </HomeLayout>
  );
}
