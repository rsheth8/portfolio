/**
 * Spotify Web Playback SDK — optional full-track playback when
 * NEXT_PUBLIC_SPOTIFY_CLIENT_ID is set. Requires Spotify Premium.
 *
 * PKCE flow keeps the client secret off the browser. Tokens live in
 * sessionStorage for the tab session only.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
  "playlist-read-private",
  "user-library-read",
].join(" ");

const TOKEN_KEY = "spotify-access-token";
const EXPIRES_KEY = "spotify-token-expires";
const VERIFIER_KEY = "spotify-pkce-verifier";

export function isSpotifyConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

/** Redirect URI sent to Spotify — must match the dashboard exactly (scheme, host, port, path). */
export function getSpotifyRedirectUri(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/spotify-callback`;
  }
  return "http://localhost:3000/spotify-callback";
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expires = Number(sessionStorage.getItem(EXPIRES_KEY) ?? 0);
  if (!token || Date.now() > expires - 60_000) return null;
  return token;
}

function storeToken(accessToken: string, expiresIn: number) {
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresIn * 1000));
}

function randomString(len: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Redirect the user to Spotify's authorize screen (call from a click handler). */
export async function startSpotifyAuth(): Promise<void> {
  if (!CLIENT_ID) throw new Error("Spotify is not configured on this site.");
  const verifier = randomString(64);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await sha256Base64Url(verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getSpotifyRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

/** Called from /spotify-callback to finish PKCE and store the token. */
export async function exchangeAuthCode(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Missing PKCE verifier — try connecting again.");
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: getSpotifyRedirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify auth failed: ${err}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  storeToken(data.access_token, data.expires_in);
  sessionStorage.removeItem(VERIFIER_KEY);
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (
    event: string,
    cb: (state: SpotifyPlaybackState | { message: string }) => void,
  ) => void;
  removeListener: (event: string) => void;
  getCurrentState: () => Promise<SpotifyPlaybackState | null>;
  setVolume: (v: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  togglePlay: () => Promise<void>;
  activateElement: () => Promise<void>;
}

interface SpotifyPlaybackState {
  paused: boolean;
  track_window: {
    current_track: { name: string; artists: { name: string }[] };
  };
}

let sdkPromise: Promise<void> | null = null;
let playerInstance: SpotifyPlayer | null = null;

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Spotify SDK load timed out.")),
      15000,
    );
    window.onSpotifyWebPlaybackSDKReady = () => {
      window.clearTimeout(timer);
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("Failed to load Spotify SDK."));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export type SpotifyPlayerCallbacks = {
  onStateChange?: (playing: boolean, trackName: string) => void;
  onError?: (msg: string) => void;
  onReady?: () => void;
};

/** Connect the Web Playback SDK player. Returns teardown fn. */
export async function connectSpotifyPlayer(
  callbacks: SpotifyPlayerCallbacks,
): Promise<() => void> {
  const token = getStoredToken();
  if (!token) throw new Error("Connect Spotify first — tap the button below.");

  await loadSdk();
  if (!window.Spotify) throw new Error("Spotify SDK unavailable.");

  if (playerInstance) {
    playerInstance.disconnect();
    playerInstance = null;
  }

  const player = new window.Spotify.Player({
    name: "Portfolio Audio Reactive",
    getOAuthToken: (cb) => cb(getStoredToken() ?? token),
    volume: 0.8,
  });
  playerInstance = player;

  player.addListener("ready", () => callbacks.onReady?.());
  player.addListener("not_ready", () =>
    callbacks.onError?.("Spotify player disconnected."),
  );
  player.addListener("initialization_error", (payload) =>
    callbacks.onError?.("message" in payload ? payload.message : "Init error"),
  );
  player.addListener("authentication_error", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    callbacks.onError?.("Spotify session expired — reconnect.");
  });
  player.addListener("account_error", () =>
    callbacks.onError?.("Spotify Premium is required for playback."),
  );
  player.addListener("player_state_changed", (state) => {
    if (!state || !("track_window" in state)) return;
    const s = state as SpotifyPlaybackState;
    const name = `${s.track_window.current_track.name} — ${s.track_window.current_track.artists[0]?.name ?? ""}`;
    callbacks.onStateChange?.(!s.paused, name);
  });

  const connected = await player.connect();
  if (!connected) throw new Error("Could not connect to Spotify.");
  // iOS Safari requires explicit element activation before audio plays.
  await player.activateElement();

  return () => {
    player.disconnect();
    playerInstance = null;
  };
}

/** Start playback of a Spotify URI (track / album / playlist). */
export async function playSpotifyUri(uri: string): Promise<void> {
  const token = getStoredToken();
  if (!token) throw new Error("Connect Spotify first.");

  const isTrack = uri.includes(":track:");
  const body = isTrack ? { uris: [uri] } : { context_uri: uri };

  const res = await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 204) return;
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify playback failed: ${err}`);
  }
}

export function disconnectSpotify(): void {
  playerInstance?.disconnect();
  playerInstance = null;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}
