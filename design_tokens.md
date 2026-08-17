# Wusool Dashboard — Design Tokens (Orange Edition)

This file contains the canonical design tokens for the **Wusool Dashboard** platform.

---

## 1. Color System

### Brand Colors (Vibrant Orange Core)

| Token Name | Hex Code | CSS Variable | Use Case |
|---|---|---|---|
| Primary | `#F97316` | `--color-primary` | Main interactive brand color (Buttons, active states, key icons) |
| Primary Light | `#FB923C` | `--color-primary-light` | Hover states for primary elements, active borders |
| Primary Dark | `#EA580C` | `--color-primary-dark` | Active pressed state, focused rings |
| Primary Container | `#FFEDD5` | `--color-primary-container` | Light mode active item tint, subtle highlight fills |
| On Primary | `#FFFFFF` | `--color-on-primary` | Text/icon color over Primary |
| On Primary Container | `#7C2D12` | `--color-on-primary-container` | High-contrast dark text inside Primary Container |

### Secondary Accent (Amber & Warm Palette)

| Token Name | Hex Code | CSS Variable | Use Case |
|---|---|---|---|
| Secondary | `#F59E0B` | `--color-secondary` | Secondary brand accent, highlights, warning tags |
| Secondary Light | `#FBBF24` | `--color-secondary-light` | Hover states for secondary highlights |
| Secondary Dark | `#D97706` | `--color-secondary-dark` | Pressed secondary elements |
| Secondary Container | `#FEF3C7` | `--color-secondary-container` | Soft amber container fill |
| On Secondary | `#000000` | `--color-on-secondary` | Text over secondary |
| On Secondary Container | `#78350F` | `--color-on-secondary-container` | Dark text over amber container |

### Tertiary Accent (Electric Sunset Coral)

| Token Name | Hex Code | CSS Variable | Use Case |
|---|---|---|---|
| Tertiary | `#FF5722` | `--color-tertiary` | Flame accent highlight |
| Tertiary Light | `#FF8A65` | `--color-tertiary-light` | Light flame highlight |
| Tertiary Dark | `#E64A19` | `--color-tertiary-dark` | Deep flame highlight |
| Tertiary Container | `#FBE9E7` | `--color-tertiary-container` | Flame surface container |

---

## 2. Semantic Colors

| Semantic State | Base Color | Light Container | Dark Glow Container |
|---|---|---|---|
| **Success / Active / On-Time** | `#10B981` | `#D1FAE5` | `rgba(16, 185, 129, 0.15)` |
| **Warning / Delay / Caution** | `#F59E0B` | `#FEF3C7` | `rgba(245, 158, 11, 0.15)` |
| **Error / Offline / Danger** | `#EF4444` | `#FEE2E2` | `rgba(239, 68, 68, 0.15)` |
| **Info / Scheduled** | `#0EA5E9` | `#E0F2FE` | `rgba(14, 165, 233, 0.15)` |

---

## 3. Surface & Background Tokens

### Light Theme
- `--color-bg-base`: `#F8FAFC`
- `--color-surface`: `#FFFFFF`
- `--color-surface-variant`: `#F1F5F9`
- `--color-border`: `#E2E8F0`
- `--color-border-hover`: `#CBD5E1`
- `--text-primary`: `#0F172A`
- `--text-secondary`: `#64748B`
- `--text-disabled`: `#94A3B8`

### Dark Theme
- `--color-bg-base`: `#0B0F17`
- `--color-surface`: `#141C2B`
- `--color-surface-variant`: `#1E293B`
- `--color-border`: `#2D3748`
- `--color-border-hover`: `#4A5568`
- `--text-primary`: `#F8FAFC`
- `--text-secondary`: `#94A3B8`
- `--text-disabled`: `#64748B`

---

## 4. Typography Scale

- **Display Large**: 48px / 1.1 / Bold
- **Display Medium**: 36px / 1.2 / Bold
- **Headline Large**: 28px / 1.3 / SemiBold
- **Headline Medium**: 22px / 1.3 / SemiBold
- **Body Large**: 16px / 1.5 / Regular
- **Body Medium**: 14px / 1.5 / Regular
- **Label / Small**: 12px / 1.4 / Medium

---

## 5. Spacing, Radius & Shadows

### Spacing Scale (8px Grid)
- `--space-xs`: `4px`
- `--space-sm`: `8px`
- `--space-md`: `16px`
- `--space-lg`: `24px`
- `--space-xl`: `32px`
- `--space-2xl`: `48px`

### Border Radius
- `--radius-sm`: `6px`
- `--radius-md`: `10px`
- `--radius-lg`: `14px`
- `--radius-xl`: `20px`
- `--radius-full`: `9999px`

### Shadows & Glows
- `--shadow-sm`: `0 1px 3px rgba(0,0,0,0.1)`
- `--shadow-md`: `0 4px 12px rgba(0,0,0,0.15)`
- `--shadow-glow-orange`: `0 0 25px -4px rgba(249, 115, 22, 0.35)`
