import { SessionStorageError } from "@/shared/errors";
import {
  serializeSession,
  sessionFileName,
} from "../infrastructure/sessionSerializer";

/**
 * Export a session by triggering a browser download of the versioned JSON file.
 * Browser APIs live here (infrastructure), keeping the application layer clean.
 */
export function exportSession(input: {
  events: Parameters<typeof serializeSession>[0]["events"];
  startedAt?: string;
}): void {
  try {
    const payload = serializeSession(input);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sessionFileName(input.startedAt);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (cause) {
    throw new SessionStorageError("Failed to export the session.", { cause });
  }
}
