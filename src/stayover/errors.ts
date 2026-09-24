// Maps the closed list of database refusal codes (P0001 exceptions raised in
// supabase/migrations/20260924000300_foundation_functions.sql,
// 20260924000400_join_code_status.sql and
// 20260924000600_admin_delete_member.sql — the exception *message* is always
// the code) to the spec's user-facing wording. An unmapped code means a new
// refusal was added to the database without a matching entry here; that is
// a bug, so it is logged server-side and shown as a generic message rather
// than leaking the raw code to the person using the app.

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const MESSAGES: Record<string, string> = {
  not_signed_in: "You need to be signed in to do that.",
  not_admin: "Only the admin can do that.",
  invalid_status_transition: "That account can't change status right now.",
  not_found: "That couldn't be found — it may have been removed.",
  admin_cannot_register: "The admin account can't register as a parent or host.",
  already_registered: "This account is already registered.",
  invalid_role: "Choose parent or host.",
  invalid_name: "Enter a name between 1 and 80 characters.",
  invalid_code: "The join code must be at least 6 characters.",
  role_change_has_links: "Remove this account's links before changing its role.",
  not_active: "Your account is not active.",
  not_parent: "Only parents can add children.",
  not_guardian_of_child: "Only this child's parents can do that.",
  no_parent_account: "There is no parent account with that email.",
  last_parent: "Every child needs at least one parent.",
  not_host: "Only hosts can add homes.",
  not_host_of_place: "Only this home's hosts can do that.",
  no_host_account: "There is no host account with that email.",
  last_host: "Every home needs at least one host.",
  link_role_mismatch:
    "Only parent accounts can be a child's parent, and only host accounts can host a home.",
  invalid_time_zone: "Please choose a valid time zone.",
  not_deletable: "Only deactivated accounts with no history can be deleted.",
};

function extractCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.length > 0 ? message : null;
}

/** Maps a Supabase RPC error (PostgrestError-shaped: `.message` carries the
 * P0001 code) to the message the spec asks for. Unknown codes and anything
 * that isn't a recognisable database error fall back to a generic message. */
export function mapDbError(err: unknown): string {
  const code = extractCode(err);
  if (code && code in MESSAGES) {
    return MESSAGES[code];
  }
  console.error("Unmapped database error:", err);
  return GENERIC_MESSAGE;
}
