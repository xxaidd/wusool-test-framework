export const tokens = {
  primary: "#F97316",
  primaryLight: "#FB923C",
  primaryDark: "#EA580C",
  primaryContainer: "#FFEDD5",
  onPrimary: "#FFFFFF",
  onPrimaryContainer: "#7C2D12",
  secondary: "#F59E0B",
  secondaryLight: "#FBBF24",
  secondaryDark: "#D97706",
  secondaryContainer: "#FEF3C7",
  tertiary: "#FF5722",
  success: "#10B981",
  successContainer: "#D1FAE5",
  warning: "#F59E0B",
  warningContainer: "#FEF3C7",
  danger: "#EF4444",
  dangerContainer: "#FEE2E2",
  info: "#0EA5E9",
  infoContainer: "#E0F2FE",
} as const;

/** Colors used to render each actor type on the map. */
export const actorColors: Record<string, string> = {
  passenger: tokens.primary,
  driver: tokens.info,
  bus: tokens.success,
  trip: tokens.secondary,
  route: tokens.tertiary,
  stop: tokens.warning,
};
