"use client";

import type { SessionRecorder } from "@/features/sessions/application/SessionRecorder";
import { sessionRecorder } from "@/shared/store/sessionRecorder";

/**
 * Access to the centralized session recorder from presentation code. The
 * recorder is the single application path for recording session events;
 * components never call the store's event sink directly.
 */
export function useSessionRecorder(): SessionRecorder {
  return sessionRecorder;
}
