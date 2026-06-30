"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { exchangeAuthCode } from "@/lib/streaming/spotifyPlayer";

/**
 * Spotify OAuth redirect target. Exchanges the auth code for a token via PKCE,
 * then sends the user back to the portfolio.
 */
export default function SpotifyCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Connecting to Spotify…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      setStatus(`Spotify denied access: ${error}`);
      return;
    }
    if (!code) {
      setStatus("Missing authorization code.");
      return;
    }

    exchangeAuthCode(code)
      .then(() => {
        router.replace("/?spotify=connected");
      })
      .catch((err) => {
        setStatus(err instanceof Error ? err.message : "Auth failed.");
      });
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink px-6">
      <p className="font-mono text-sm text-cream">{status}</p>
    </main>
  );
}
