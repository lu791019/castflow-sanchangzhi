/**
 * 目前登入者（server only）。
 * 一律用 auth.getUser()（向 Auth server 驗證），不用 getSession()——cookie 內容可被偽造。
 */

import { createClient } from "@/lib/supabase/server";

export const UNAUTHORIZED_MESSAGE = "請先登入";

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor() {
    super(UNAUTHORIZED_MESSAGE);
    this.name = "UnauthorizedError";
  }
}

export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

interface AuthErrorLike {
  name?: string;
  message?: string;
}

export interface AuthClientLike {
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null }; error: AuthErrorLike | null }>;
  };
}

const RETRYABLE_AUTH_ERROR = "AuthRetryableFetchError";

/**
 * 沒 session 是正常狀態（匿名瀏覽），不記 log；其他錯誤記 log 後視為未登入。
 * 連線抖動（AuthRetryableFetchError）先重試一次，避免把登入中的人當成登出（UX-16）。
 */
export async function userIdFrom(client: AuthClientLike): Promise<string | null> {
  try {
    const first = await client.auth.getUser();
    const { data, error } = first.error?.name === RETRYABLE_AUTH_ERROR ? await client.auth.getUser() : first;
    if (error && error.name !== "AuthSessionMissingError") {
      console.error("[auth] getUser failed", { name: error.name, message: error.message });
    }
    return data.user?.id ?? null;
  } catch (error) {
    console.error("[auth] getUser threw", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  return userIdFrom((await createClient()) as unknown as AuthClientLike);
}

export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new UnauthorizedError();
  return userId;
}
