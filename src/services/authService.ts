import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

import { supabase } from "../lib/supabase";

type SignUpWithEmailResult = Awaited<ReturnType<typeof supabase.auth.signUp>>;
type SignInWithEmailResult = Awaited<
  ReturnType<typeof supabase.auth.signInWithPassword>
>;
type SignOutResult = Awaited<ReturnType<typeof supabase.auth.signOut>>;
type ResetPasswordResult = Awaited<
  ReturnType<typeof supabase.auth.resetPasswordForEmail>
>;
type UpdatePasswordResult = Awaited<ReturnType<typeof supabase.auth.updateUser>>;
type CurrentSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
type CurrentUserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;
type SignInWithAppleData = Awaited<
  ReturnType<typeof supabase.auth.signInWithIdToken>
>["data"];

type AppleSignInResult =
  | {
      data: SignInWithAppleData;
      fullName: string | null;
      status: "success";
    }
  | {
      status:
        | "canceled"
        | "missingToken"
        | "providerSetupRequired"
        | "unavailable"
        | "unknownError";
    };

const APPLE_NONCE_BYTES = 32;

export function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<SignUpWithEmailResult> {
  return supabase.auth.signUp({
    email,
    options: fullName ? { data: { full_name: fullName } } : undefined,
    password,
  });
}

export function signInWithEmail(
  email: string,
  password: string,
): Promise<SignInWithEmailResult> {
  return supabase.auth.signInWithPassword({ email, password });
}

function compactDisplayName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
) {
  if (!fullName) {
    return null;
  }

  const displayName = compactDisplayName(
    [
      fullName.namePrefix,
      fullName.givenName,
      fullName.middleName,
      fullName.familyName,
      fullName.nameSuffix,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return displayName || null;
}

async function generateRawNonce() {
  const bytes = await Crypto.getRandomBytesAsync(APPLE_NONCE_BYTES);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function isAppleCancelError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_REQUEST_CANCELED"
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "";
}

function isAppleProviderSetupError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("provider") &&
    (message.includes("not enabled") ||
      message.includes("disabled") ||
      message.includes("not configured") ||
      message.includes("unsupported"))
  );
}

async function saveProfileFullName(userId: string, fullName: string | null) {
  if (!fullName) {
    return;
  }

  await supabase.auth.updateUser({
    data: {
      full_name: fullName,
    },
  });

  await supabase.from("profiles").upsert(
    {
      full_name: fullName,
      id: userId,
    },
    {
      onConflict: "id",
    },
  );
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const isAvailable = await AppleAuthentication.isAvailableAsync();

  if (!isAvailable) {
    return { status: "unavailable" };
  }

  try {
    const rawNonce = await generateRawNonce();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const identityToken = credential.identityToken;

    if (!identityToken) {
      return { status: "missingToken" };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      nonce: rawNonce,
      provider: "apple",
      token: identityToken,
    });

    if (error) {
      return {
        status: isAppleProviderSetupError(error)
          ? "providerSetupRequired"
          : "unknownError",
      };
    }

    const fullName = formatAppleFullName(credential.fullName);

    if (data.user) {
      await saveProfileFullName(data.user.id, fullName);
    }

    return {
      data,
      fullName,
      status: "success",
    };
  } catch (error) {
    if (isAppleCancelError(error)) {
      return { status: "canceled" };
    }

    return {
      status: isAppleProviderSetupError(error)
        ? "providerSetupRequired"
        : "unknownError",
    };
  }
}

export function signOut(): Promise<SignOutResult> {
  return supabase.auth.signOut();
}

export function getPasswordResetRedirectUrl() {
  return Linking.createURL("/reset-password");
}

export function resetPassword(email: string): Promise<ResetPasswordResult> {
  const redirectTo = getPasswordResetRedirectUrl();

  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}

export function updatePassword(password: string): Promise<UpdatePasswordResult> {
  return supabase.auth.updateUser({ password });
}

export function getCurrentSession(): Promise<CurrentSessionResult> {
  return supabase.auth.getSession();
}

export function getCurrentUser(): Promise<CurrentUserResult> {
  return supabase.auth.getUser();
}

export function getProfileFullName(userId: string) {
  return supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
}
