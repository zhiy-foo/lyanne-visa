import { notFound } from "next/navigation";
import { screenList } from "../registry";
import { GalleryShell } from "../GalleryShell";

type PageProps = {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ state?: string }>;
};

export default async function GalleryScreenPage({ params, searchParams }: PageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { screen } = await params;
  const { state } = await searchParams;

  const entry = screenList.find((item) => item.key === screen);
  if (!entry || (state && !entry.states.includes(state))) {
    notFound();
  }

  return <GalleryShell screenKey={screen} state={state} />;
}
