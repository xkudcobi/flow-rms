---
name: FLOW Restaurant Management System
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#0054cb'
  on-secondary: '#ffffff'
  secondary-container: '#256df0'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#00210d'
  on-tertiary-container: '#009850'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b1c5ff'
  on-secondary-fixed: '#001947'
  on-secondary-fixed-variant: '#00419f'
  tertiary-fixed: '#7cfca5'
  tertiary-fixed-dim: '#5ede8b'
  on-tertiary-fixed: '#00210d'
  on-tertiary-fixed-variant: '#005229'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: monospace
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style
The design system is engineered for high-velocity hospitality environments where clarity and efficiency are paramount. The brand personality is **authoritative, precise, and utilitarian**, mirroring the logistical rigor of a global transportation network. 

The aesthetic is **Corporate Modern with a Minimalist edge**, prioritizing data density without sacrificing legibility. The UI should evoke a sense of "digital infrastructure"—reliable, invisible when working perfectly, and instantly actionable when attention is required. We utilize high-contrast pairings and a strict adherence to a grid to ensure that staff can navigate the system under the high-pressure conditions of peak service hours.

## Colors
This design system employs a "High-Contrast Monochrome" strategy punctuated by "Signal Blue." 

- **Primary Black (#000000):** Used for primary branding, headers, and the most critical call-to-action buttons. It represents the "Ground" of the application.
- **Safety Blue (#276EF1):** Reserved strictly for primary functional actions, active states, and navigational cues. 
- **Surface Tones (#F6F6F6, #EEEEEE):** Used to differentiate interface regions like sidebars and table headers without adding visual noise.
- **Success Green (#05A357):** Used specifically for "Order Complete" states or "Table Available" indicators.

## Typography
The typography system uses **Outfit** for headlines to provide a modern, geometric character that feels premium and architectural. **Inter** is used for all body text and UI elements to ensure maximum legibility and systematic scaling.

- **Contrast:** Headings should always be significantly heavier and darker than body text to establish a clear hierarchy.
- **Data Display:** For financial reports and inventory counts, use the `mono-data` style to ensure numbers align vertically for quick scanning.
- **Micro-copy:** Use `label-md` with uppercase styling for table headers and section overviews to create a "dashboard" feel.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid Grid**. 
- **Desktop:** 12-column grid with a max-width of 1440px for administrative views. Sidebars are fixed at 280px.
- **Tablet (Point of Sale):** Optimized for touch, using a 10px base unit to ensure tap targets are at least 44px high.
- **Spacing Logic:** We use a strict 4px/8px incremental scale. Generous whitespace (32px+) should be used to separate distinct functional areas (e.g., the Menu selection from the Order Summary) to prevent mis-taps during fast-paced service.

## Elevation & Depth
In alignment with the minimalist aesthetic, this design system avoids heavy shadows. 
- **Tonal Separation:** Depth is primarily conveyed through background color shifts (White #FFFFFF on Light Gray #F6F6F6).
- **Interactive States:** Use subtle, low-contrast 1px outlines (#EEEEEE) for cards and containers.
- **Active Elevation:** Only the most critical floating elements (e.g., a "Modify Order" modal) should use a shadow: `0px 4px 12px rgba(0, 0, 0, 0.08)`.
- **Flat UI:** Buttons and inputs remain flat; depth is indicated by high-contrast fill changes rather than physical extrusion.

## Shapes
The shape language is **structured and disciplined**. 
- **Standard Radius:** 4px for inputs and small buttons to maintain a "sharp" professional look.
- **Large Components:** Cards and main containers use 8px (`rounded-lg`) to provide a subtle hint of approachability without feeling "bubbly."
- **Icons:** Use thin-stroke (2px) linear icons with square caps to match the sharp edges of the UI components.

## Components
- **Buttons:** 
  - *Primary:* Solid Black (#000000) with White text. Sharp 4px corners. 
  - *Action:* Safety Blue (#276EF1) for "Send to Kitchen" or "Pay."
  - *Secondary:* Ghost style with 1px black border.
- **Data Tables:** Use a "Zealot" approach to clean lines. 0px borders between rows; use subtle #F6F6F6 row striping only. Headers are `label-md` in Gray #666666.
- **Menu Grid:** Items are presented as flat white tiles with `title-lg` text. Price is anchored to the bottom-right in `mono-data`.
- **Input Fields:** 1px border (#EEEEEE). On focus, the border transitions to 2px Solid Black. No drop shadows. Labels are consistently placed above the field in `label-md`.
- **Chips/Status:** Use rectangular chips with 2px radius. Light background tints with dark text (e.g., "Pending" in light orange with dark orange text).
- **Table Plan:** Use geometric shapes (Circles/Squares) with 2px outlines. Active tables have a solid Safety Blue fill.