// Boundary-level validation shared by every server action that writes a
// name, address or email (design.md; the database functions re-check all of
// this themselves — Law 2 — this is the "early refusal and UX" half of
// Law 6, not the authority).

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

export const NAME_MAX = 80;
export const ADDRESS_MAX = 300;

export function validateName(name: string): ValidationResult<string> {
  const trimmed = (name ?? "").trim();
  if (trimmed.length < 1 || trimmed.length > NAME_MAX) {
    return { ok: false, message: `Enter a name between 1 and ${NAME_MAX} characters.` };
  }
  return { ok: true, value: trimmed };
}

/** `null` value means "no address" (the field is optional). */
export function validateAddress(address: string | undefined | null): ValidationResult<string | null> {
  const trimmed = (address ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > ADDRESS_MAX) {
    return { ok: false, message: "Please keep the address under 300 characters." };
  }
  return { ok: true, value: trimmed };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult<string> {
  const trimmed = (email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true, value: trimmed };
}
