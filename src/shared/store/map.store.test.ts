import { beforeEach, describe, expect, it } from "vitest";
import { useMapStore } from "./map.store";

describe("useMapStore", () => {
  beforeEach(() => {
    useMapStore.setState({
      route: [],
      drawing: false,
      following: false,
      followActorId: null,
      speed: 400,
      showHistory: false,
      viewport: { center: { lat: 32.027, lng: 44.3887 }, zoom: 12 },
      pendingLocation: null,
      locationStatus: {},
    });
  });

  describe("route management", () => {
    it("adds route points", () => {
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().addRoutePoint({ lat: 3, lng: 4 });
      expect(useMapStore.getState().route).toEqual([
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
      ]);
    });

    it("deduplicates consecutive identical points", () => {
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      expect(useMapStore.getState().route).toHaveLength(1);
    });

    it("allows non-consecutive duplicate points", () => {
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().addRoutePoint({ lat: 3, lng: 4 });
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      expect(useMapStore.getState().route).toHaveLength(3);
    });

    it("undoes the last route point", () => {
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().addRoutePoint({ lat: 3, lng: 4 });
      useMapStore.getState().undoRoutePoint();
      expect(useMapStore.getState().route).toEqual([{ lat: 1, lng: 2 }]);
    });

    it("undo on empty route is a no-op", () => {
      useMapStore.getState().undoRoutePoint();
      expect(useMapStore.getState().route).toEqual([]);
    });

    it("clears the route", () => {
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().addRoutePoint({ lat: 3, lng: 4 });
      useMapStore.getState().clearRoute();
      expect(useMapStore.getState().route).toEqual([]);
    });
  });

  describe("drawing lifecycle", () => {
    it("startDrawing enables drawing and clears route", () => {
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().startDrawing();
      expect(useMapStore.getState().drawing).toBe(true);
      expect(useMapStore.getState().route).toEqual([]);
    });

    it("startDrawing stops following", () => {
      useMapStore.getState().startFollowing("actor-1");
      expect(useMapStore.getState().following).toBe(true);
      useMapStore.getState().startDrawing();
      expect(useMapStore.getState().following).toBe(false);
    });

    it("finishDrawing disables drawing", () => {
      useMapStore.getState().startDrawing();
      useMapStore.getState().finishDrawing();
      expect(useMapStore.getState().drawing).toBe(false);
    });

    it("cancelDrawing disables drawing and clears route", () => {
      useMapStore.getState().startDrawing();
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().cancelDrawing();
      expect(useMapStore.getState().drawing).toBe(false);
      expect(useMapStore.getState().route).toEqual([]);
    });
  });

  describe("following lifecycle", () => {
    it("startFollowing sets following state and actor id", () => {
      useMapStore.getState().startFollowing("actor-1");
      expect(useMapStore.getState().following).toBe(true);
      expect(useMapStore.getState().followActorId).toBe("actor-1");
    });

    it("stopFollowing clears following state and actor id", () => {
      useMapStore.getState().startFollowing("actor-1");
      useMapStore.getState().stopFollowing();
      expect(useMapStore.getState().following).toBe(false);
      expect(useMapStore.getState().followActorId).toBeNull();
    });
  });

  describe("speed", () => {
    it("sets speed", () => {
      useMapStore.getState().setSpeed(800);
      expect(useMapStore.getState().speed).toBe(800);
    });
  });

  describe("history toggle", () => {
    it("toggles showHistory", () => {
      expect(useMapStore.getState().showHistory).toBe(false);
      useMapStore.getState().toggleHistory();
      expect(useMapStore.getState().showHistory).toBe(true);
      useMapStore.getState().toggleHistory();
      expect(useMapStore.getState().showHistory).toBe(false);
    });
  });

  describe("viewport", () => {
    it("sets viewport", () => {
      useMapStore.getState().setViewport({ lat: 40.7128, lng: -74.006 }, 15);
      expect(useMapStore.getState().viewport).toEqual({
        center: { lat: 40.7128, lng: -74.006 },
        zoom: 15,
      });
    });
  });

  describe("pending location", () => {
    it("setPendingLocation stores coordinates and marks actor pending", () => {
      useMapStore.getState().setPendingLocation("a1", 1, 2, 3, 4);
      const s = useMapStore.getState();
      expect(s.pendingLocation).toEqual({
        actorId: "a1",
        lat: 1,
        lng: 2,
        originalLat: 3,
        originalLng: 4,
      });
      expect(s.locationStatus.a1).toBe("pending");
    });

    it("setPendingLocation preserves other actors' statuses", () => {
      useMapStore.getState().setLocationStatus("a1", "accepted");
      useMapStore.getState().setPendingLocation("a2", 1, 2, 3, 4);
      const s = useMapStore.getState();
      expect(s.locationStatus.a1).toBe("accepted");
      expect(s.locationStatus.a2).toBe("pending");
    });

    it("confirmPendingLocation marks actor sent and returns the location", () => {
      useMapStore.getState().setPendingLocation("a1", 1, 2, 3, 4);
      const confirmed = useMapStore.getState().confirmPendingLocation();
      expect(confirmed).toEqual({
        actorId: "a1",
        lat: 1,
        lng: 2,
        originalLat: 3,
        originalLng: 4,
      });
      const s = useMapStore.getState();
      expect(s.pendingLocation).toBeNull();
      expect(s.locationStatus.a1).toBe("sent");
    });

    it("confirmPendingLocation without pending is a no-op", () => {
      expect(useMapStore.getState().confirmPendingLocation()).toBeNull();
    });

    it("cancelPendingLocation reverts actor to visual placement", () => {
      useMapStore.getState().setPendingLocation("a1", 1, 2, 3, 4);
      useMapStore.getState().cancelPendingLocation();
      const s = useMapStore.getState();
      expect(s.pendingLocation).toBeNull();
      expect(s.locationStatus.a1).toBe("visual");
    });

    it("setLocationStatus updates the actor's status", () => {
      useMapStore.getState().setLocationStatus("a1", "rejected");
      expect(useMapStore.getState().locationStatus.a1).toBe("rejected");
    });

    it("resetForEnvironment clears pending location and statuses", () => {
      useMapStore.getState().setPendingLocation("a1", 1, 2, 3, 4);
      useMapStore.getState().resetForEnvironment();
      const s = useMapStore.getState();
      expect(s.pendingLocation).toBeNull();
      expect(s.locationStatus).toEqual({});
    });
  });

  describe("environment reset", () => {
    it("resets all session-scoped state but preserves nothing", () => {
      useMapStore.getState().addRoutePoint({ lat: 1, lng: 2 });
      useMapStore.getState().startDrawing();
      useMapStore.getState().startFollowing("actor-1");
      useMapStore.getState().toggleHistory();

      useMapStore.getState().resetForEnvironment();

      const s = useMapStore.getState();
      expect(s.route).toEqual([]);
      expect(s.drawing).toBe(false);
      expect(s.following).toBe(false);
      expect(s.followActorId).toBeNull();
      expect(s.showHistory).toBe(false);
      expect(s.speed).toBe(400); // default
      expect(s.viewport).toEqual({
        center: { lat: 32.027, lng: 44.3887 },
        zoom: 12,
      });
    });
  });
});
