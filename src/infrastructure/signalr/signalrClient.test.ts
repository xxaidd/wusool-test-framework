import { describe, expect, it, vi } from "vitest";
import {
  resetSignalRConnection,
  SignalRConnectionManager,
} from "./signalrClient";

describe("SignalRConnectionManager", () => {
  it("starts in disconnected state", () => {
    const mgr = new SignalRConnectionManager();
    expect(mgr.getConnectionState()).toBe("disconnected");
  });

  it("throws when invoking without connection options", async () => {
    const mgr = new SignalRConnectionManager();
    await expect(mgr.start()).rejects.toThrow("no connection options provided");
  });

  it("notifies connection state change listeners", () => {
    const mgr = new SignalRConnectionManager();
    const cb = vi.fn();
    const unsub = mgr.onConnectionChange(cb);

    // Simulate state change via private method (accessed through reflection)
    (mgr as unknown as { setState: (s: string) => void }).setState("connected");
    expect(cb).toHaveBeenCalledWith("connected");

    (mgr as unknown as { setState: (s: string) => void }).setState(
      "reconnecting",
    );
    expect(cb).toHaveBeenCalledWith("reconnecting");

    unsub();
    (mgr as unknown as { setState: (s: string) => void }).setState(
      "disconnected",
    );
    // Should not be called after unsubscribe
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("deduplicates state changes", () => {
    const mgr = new SignalRConnectionManager();
    const cb = vi.fn();
    mgr.onConnectionChange(cb);

    (mgr as unknown as { setState: (s: string) => void }).setState("connected");
    (mgr as unknown as { setState: (s: string) => void }).setState("connected");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("stop clears state", async () => {
    const mgr = new SignalRConnectionManager();
    await mgr.stop();
    expect(mgr.getConnectionState()).toBe("disconnected");
  });

  it("configure sets connection options", () => {
    const mgr = new SignalRConnectionManager();
    mgr.configure({ hubUrl: "http://test/hub", accessToken: "token" });
    // No assertion needed; just verify no error
  });

  it("invoke throws when not connected", async () => {
    const mgr = new SignalRConnectionManager();
    await expect(mgr.invoke("test")).rejects.toThrow("not connected");
  });

  it("singleton lifecycle", () => {
    resetSignalRConnection();
    // Should not throw
    resetSignalRConnection();
  });
});
