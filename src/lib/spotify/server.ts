/** Spotify 使用者授權的 server 端接線：env → 用戶端設定（權杖快取與 429 冷卻同一個 process 共用） */

import { siteOriginString } from "@/lib/seo/site";
import { createSpotifyAppState, spotifyCredentialsFromEnv, spotifyUrlsFromEnv, type SpotifyAppDeps } from "./api";
import { spotifyRedirectUri } from "./connect";

const sharedState = createSpotifyAppState();

export function spotifyUserDepsFromEnv(): SpotifyAppDeps | null {
  const credentials = spotifyCredentialsFromEnv();
  return credentials ? { fetch, credentials, urls: spotifyUrlsFromEnv(), state: sharedState } : null;
}

export function serverRedirectUri(): string {
  return spotifyRedirectUri(siteOriginString());
}
