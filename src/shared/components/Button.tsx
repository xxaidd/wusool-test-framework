"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-primary to-tertiary text-on-primary shadow-md shadow-primary/25 ring-1 ring-primary/30 hover:shadow-glow-orange hover:brightness-105 active:brightness-95",
  secondary:
    "bg-secondary text-on-secondary hover:bg-secondary-light active:bg-secondary-dark",
  ghost:
    "text-ink ring-1 ring-inset ring-border hover:bg-surface-variant hover:text-primary active:bg-border",
  danger: "bg-danger text-white hover:opacity-90 active:opacity-80",
  subtle: "bg-surface-variant text-ink hover:bg-border active:bg-border-hover",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-6 text-base rounded-xl",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  loading,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
