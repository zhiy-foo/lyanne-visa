import { notFound } from "next/navigation";
import Link from "next/link";
import { screenList } from "./registry";

export default function GalleryIndexPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="font-display text-[32px] font-semibold">Component gallery</h1>
      <p className="mt-1 text-muted">Dev-only. Not available in production builds.</p>
      <ul className="mt-6 flex flex-col gap-4">
        {screenList.map((screen) => (
          <li key={screen.key}>
            <p className="text-[17px] font-bold">{screen.label}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {screen.states.map((state) => (
                <Link
                  key={state}
                  href={`/dev/gallery/${screen.key}?state=${state}`}
                  className="rounded-lg border border-border px-3 py-1 text-[15px] text-accent underline underline-offset-2"
                >
                  {state}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
