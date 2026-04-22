# Implementation Plan: 💎 JARVIS UI Overhaul (Phase 5)

This phase will completely overhaul the visual experience, adding the voice visualizer we discussed and creating a stunning, glassmorphic design system that transforms this from a "developer layout" into a truly premium AI OS layout.

## User Review Required

Please review this structural and architectural plan for the frontend overhaul. Once you approve, I will overwrite your existing UI components to implement this new style without breaking any of the backend WebSocket logic.

## Proposed Changes

### 1. The Dynamic Voice Visualizer (Hero Section)

We will replace the static generic text in the center of the screen with a dynamic HUD (Heads Up Display).
- **The Core Orb:** A glowing, CSS-animated sphere in the center of the screen that acts as JARVIS's "face".
- **State Reactive:** 
  - *Idle:* Slow, breathing cyan pulse.
  - *Listening (Continuous Mode):* Expands with wavy visualizer rings mimicking real-time microphone input.
  - *Thinking/Executing:* Rotates rapidly with deep purple and green hues based on the backend pipeline status.

### 2. Floating Command Pill (Input Area)

Instead of a rigid, blocky text box stuck to the bottom of the screen, we will rebuild it.
- **Design:** A floating, pill-shaped input bar centered near the bottom of the screen, tightly wrapping the text and microphone button.
- **VFX:** It will feature a 1px glass border that subtly glows when focused, and the microphone button will be unified into the corner seamlessly.

### 3. Sleek Floating Docks (Layout Refactor)

We are eliminating the harsh, solid-color sidebars.
- **Left Navigation Array:** A minimal, floating glass dock on the far left side holding just the navigation icons (Terminal, Dashboard, Settings). The blue text will be replaced with clean, monochrome SVG icons that glow vibrantly only on hover.
- **Top Status Pill:** The header will detach from the ceiling and become a compact floating glass pill displaying connection status and the Auto Mode toggle symmetrically in the top center.
- **Right System Trace:** The trace log will be encased in a beautiful transparent glass card with a clean header ("System Trace Pipeline"), rather than acting as a harsh screen-divider. Scrollbars will be styled or hidden.

### 4. Background & Global Polish

- **Mesh Gradients:** The rigid dot-grid will be enhanced with soft, moving radial gradients (cyan and purple) layered underneath the glass panels to create an OS that looks "alive".
- **Typography:** Enforce tighter, cleaner font weights for headers and slightly increase tracking for uppercase sub-labels to mimic authentic cinematic OS screens.

## Verification Plan

### Manual Verification
- We will start the front-end server (`npm run dev`) and test the UI layout visually.
- We will click the Microphone button to verify the new Visualizer switches states into the "Expand" animation.
- We will trigger an agent workflow (e.g. typing a prompt) to ensure the trace log renders correctly in the new Right System Trace floating panel without breaking layout constraints.
