import { SessionStorageError } from "@/shared/errors";
import type { SessionDownloader } from "./sessionDownloader";
import { serializeSession } from "./sessionSerializer";

/**
 * Export a session by serializing it to the versioned JSON format and handing
 * the payload to the {@link SessionDownloader} (infrastructure) for delivery.
 */
export function exportSession(input: {
  events: Parameters<typeof serializeSession>[0]["events"];
  startedAt?: string;
  sessionId?: string;
  name?: string;
  environment?: { id: string; label?: string };
  logs?: Parameters<typeof serializeSession>[0]["logs"];
  download: SessionDownloader;
}): void {
  try {
    const payload = serializeSession(input);
    input.download.download({
      startedAt: input.startedAt,
      content: JSON.stringify(payload, null, 2),
      mimeType: "application/json",
    });
  } catch (cause) {
    throw new SessionStorageError("Failed to export the session.", { cause });
  }
}
