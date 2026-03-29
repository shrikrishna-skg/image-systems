class EmailConfirmationPendingError extends Error {
  email;
  constructor(email) {
    super("Confirm your email to finish signing up.");
    this.name = "EmailConfirmationPendingError";
    this.email = email;
  }
}
function isAuthError(e) {
  return typeof e === "object" && e !== null && "message" in e && typeof e.message === "string";
}
function formatSupabaseAuthError(error) {
  if (!isAuthError(error)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();
  if (code === "email_not_confirmed" || msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
    return "Confirm your email before signing in. Check your inbox and spam folder. In Supabase: Authentication \u2192 Providers \u2192 Email, you can turn off \u201CConfirm email\u201D for testing.";
  }
  if (code === "invalid_credentials" || code === "invalid_grant" || msg.includes("invalid login credentials") || msg.includes("invalid password")) {
    return "Wrong email or password, or no account yet for this Supabase project. Use \u201CCreate one\u201D to register first (local dev passwords do not apply here).";
  }
  if (code === "user_already_exists" || msg.includes("already registered")) {
    return "This email is already registered. Sign in instead.";
  }
  if (code === "weak_password" || msg.includes("password")) {
    return error.message || "Password does not meet requirements.";
  }
  return error.message || "Request failed";
}
export {
  EmailConfirmationPendingError,
  formatSupabaseAuthError
};
