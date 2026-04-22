# JARVIS UI — Neural Evolution Plan

This plan aims to transform the current interface into a premium, immersive AI OS that meets the high aesthetic and functional standards requested.

## Proposed Changes

### 1. Core Design System
#### [MODIFY] [globals.css](file:///d:/daw%20n/P.A/frontend/app/globals.css)
- **Base Color**: Change `--bg-primary` to `#0A0F1C`.
- **Symmetry**: Ensure `body` and `html` are strictly `100vh` and `overflow-hidden`.
- **Grid System**: Implement an 8px spacing utility and consistent border-radius (16px cards, 12px buttons).
- **Typography**: Refine font hierarchy (24-32px headings, 16px subheadings).

### 2. Main Architecture
#### [MODIFY] [layout.tsx](file:///d:/daw%20n/P.A/frontend/app/layout.tsx)
- Move the sidebar logic here to ensure it's shared across all pages.
- Implement the 3-column layout as the root structure.

### 3. Mission Control (Home)
#### [MODIFY] [page.tsx](file:///d:/daw%20n/P.A/frontend/app/page.tsx)
- **Symmetry**: Use absolute centering for the `NebulaVisualizer` within the main panel.
- **Layout**: Ensure the central panel is dominant and perfectly aligned.

### 4. Reactive Visualizer
#### [MODIFY] [NebulaVisualizer.tsx](file:///d:/daw%20n/P.A/frontend/app/components/NebulaVisualizer.tsx)
- **States**: Implement visual changes for:
  - **Idle**: Slow, rhythmic pulse.
  - **Listening**: Expanding ripples/glow.
  - **Thinking**: Rotational neural motion (faster spinning rings).
  - **Speaking**: Pulsing core with waveform effect.

### 5. System Dashboard
#### [MODIFY] [dashboard/page.tsx](file:///d:/daw%20n/P.A/frontend/app/dashboard/page.tsx)
- **Overhaul**: Simplify the layout into a clean grid.
- **Hierarchy**: Top (Stats), Middle (Agent Modules), Bottom (System Logs).
- **Consistency**: Use the same glassmorphism and spacing as the main UI.

### 6. Cognitive Memory
#### [NEW] [memory/page.tsx](file:///d:/daw%20n/P.A/frontend/app/memory/page.tsx)
- **Route**: Implement the missing memory management page.
- **Design**: Visual representation of vectorized memory clusters and long-term behavioral patterns.

## Verification Plan

### Manual Verification
- **Symmetry Check**: Verify that the visualizer is centered at various screen sizes.
- **Route Check**: Ensure sidebar navigation between Home, Dashboard, and Memory works without layout shifts.
- **Reactivity Check**: Test voice states to confirm the visualizer responds correctly.
- **Design Check**: Verify full-height panels and consistent border-radius.
