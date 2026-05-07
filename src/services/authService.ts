import { supabase } from "../lib/supabase";

type SignUpWithEmailResult = Awaited<ReturnType<typeof supabase.auth.signUp>>;
type SignInWithEmailResult = Awaited<
  ReturnType<typeof supabase.auth.signInWithPassword>
>;
type SignOutResult = Awaited<ReturnType<typeof supabase.auth.signOut>>;
type ResetPasswordResult = Awaited<
  ReturnType<typeof supabase.auth.resetPasswordForEmail>
>;
type CurrentSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
type CurrentUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;

export function signUpWithEmail(
  email: string,
  password: string,
): Promise<SignUpWithEmailResult> {
  return supabase.auth.signUp({ email, password });
}

export function signInWithEmail(
  email: string,
  password: string,
): Promise<SignInWithEmailResult> {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut(): Promise<SignOutResult> {
  return supabase.auth.signOut();
}

export function resetPassword(email: string): Promise<ResetPasswordResult> {
  return supabase.auth.resetPasswordForEmail(email);
}

export function getCurrentSession(): Promise<CurrentSessionResult> {
  return supabase.auth.getSession();
}

export function getCurrentUser(): Promise<CurrentUserResult> {
  return supabase.auth.getUser();
}
