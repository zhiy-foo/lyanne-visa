import type { SignInProps } from "@/ui/types";
import { SignInClient } from "./SignInClient";

const KNOWN_ERRORS = new Set<SignInProps["error"]>(["link-expired", "google-cancelled", "generic"]);

type PageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const { error, next } = await searchParams;
  const knownError = KNOWN_ERRORS.has(error as SignInProps["error"]) ? (error as SignInProps["error"]) : undefined;

  return <SignInClient error={knownError} next={next} />;
}
