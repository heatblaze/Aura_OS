# Aura OS Project Roadmap: The Final Stretch 🚀

This document tracks the remaining core pillars needed to bring the Aura (JARVIS) OS to full production readiness.

## 1. Live Backend Dashboard Integration
The current Dashboard UI (`dashboard/page.tsx`) uses hardcoded data. 
- [ ] **Real-time Stats**: Wire `SYSTEM_STATS` (Neural Load, Latency, etc.) to a backend monitoring endpoint.
- [ ] **Agent Status Stream**: Connect the `AGENTS` array to a WebSocket feed that reflects the real-time state (Thinking, Idle, Executing) of the backend agent registry.
- [ ] **Uptime Counter**: Fetch actual system uptime from the backend service.

## 2. Google OAuth & Personal Intelligence
The proactive engine is ready, but it needs real data to be useful.
- [ ] **Gmail Connection**: Implement the OAuth2 flow to allow JARVIS to scan for actionable emails.
- [ ] **Calendar Sync**: Finalize token persistence so JARVIS can surface 15-minute meeting reminders and morning briefings.
- [ ] **Trigger Activation**: Once connected, enable the `MorningBriefTrigger` and `EventReminderTrigger` globally.

## 3. Interactive Protocol Control
Make the "Protocol Manifest" on the dashboard a functional control panel.
- [ ] **Module Toggles**: Create toggle components for "Semantic Bridge," "Autonomous Shell," and "Live Intelligence."
- [ ] **Permissions Management**: Clicking these should dynamically update the tool availability in the JARVIS backend (e.g., disabling the `LocalSystemTool` on the fly).

## 4. Autonomous "Auto Mode" Stress Testing
Verify the safety and reliability of the `SimulatorAgent`.
- [ ] **Execution Gauntlet**: Test multi-step chains (e.g., "Find all logs in my folder, compress them, and email the summary to me").
- [ ] **Safety Interception**: Ensure the Simulator accurately flags high-risk PowerShell commands and displays detailed predictions in the Mission Control UI before the user clicks "Approve."

---

*Last Updated: 2026-04-24*
