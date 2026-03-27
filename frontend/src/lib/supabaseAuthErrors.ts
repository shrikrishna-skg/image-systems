import type { AuthError } from "@supabase/supabase-js";

/** Thrown when signUp succeeds but the user must confirm email before a session exists. */
export class EmailConfirmationPendingError extends Error {
  readonly email: string;

  constructor(email: string) {
    super("Confirm your email to finish signing up.");
    this.name = "EmailConfirmationPendingError";
    this.email = email;
  }
}

function isAuthError(e: unknown): e is AuthError {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as AuthError).message === "string"
  );
}

/** User-facing copy for Supabase Auth API errors (login, signUp errors). */
export function formatSupabaseAuthError(error: unknown): string {
  if (!isAuthError(error)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();

  if (
    code === "email_not_confirmed" ||
    msg.includes("email not confirmed") ||
    msg.includes("email_not_confirmed")
  ) {
    return "Confirm your email before signing in. Check your inbox and spam folder. In Supabase: Authentication → Providers → Email, you can turn off “Confirm email” for testing.";
  }

  if (
    code === "invalid_credentials" ||
    code === "invalid_grant" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid password")
  ) {
    return "Wrong email or password, or no account yet for this Supabase project. Use “Create one” to register first (local dev passwords do not apply here).";
  }

  if (code === "user_already_exists" || msg.includes("already registered")) {
    return "This email is already registered. Sign in instead.";
  }

  if (code === "weak_password" || msg.includes("password")) {
    return error.message || "Password does not meet requirements.";
  }

  return error.message || "Request failed";
}
