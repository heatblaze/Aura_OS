import type { JarvisEvent, AgentName } from "./jarvis-types";

/**
 * Mock JARVIS WebSocket stream.
 * Drop-in replacement for a real WS — emits the same JarvisEvent shape.
 */
type Listener = (e: JarvisEvent) => void;

const AGENTS: AgentName[] = ["intent", "commander", "planner", "executor", "memory", "critic"];

const SAMPLE_DECISIONS: Record<AgentName, string[]> = {
  intent:    ["Parsing semantic vector…", "Classifying domain", "Confidence 96.2%"],
  commander: ["Routing to planner", "Authorizing pipeline", "Pipeline approved"],
  planner:   ["Decomposing into 4 steps", "Estimating tool calls", "Allocating compute"],
  executor:  ["Calling tool: web.search", "Fetching context window", "Streaming partials"],
  memory:    ["Recalling 12 episodic nodes", "Updating long-term store", "Consolidated 1,246 nodes"],
  critic:    ["Cross-checking output", "No hallucinations detected", "Verdict: PASS (0.94)"],
};

export class MockJarvisStream {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  connect() {
    this.emit({ type: "connected", timestamp: now() });
    this.timer = setInterval(() => this.tick(), 1800);
  }

  disconnect() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.emit({ type: "disconnected", timestamp: now() });
  }

  on(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }

  /** Simulate a user submitting a command — runs full pipeline. */
  send(message: string) {
    this.emit({ type: "pipeline_start", timestamp: now(), message });
    let delay = 0;
    const queue: Array<() => void> = [];
    AGENTS.forEach((agent, i) => {
      const decisions = SAMPLE_DECISIONS[agent];
      decisions.forEach((d) => {
        delay += 380 + Math.random() * 320;
        queue.push(() =>
          this.emit({
            type: "agent_thinking",
            agent,
            timestamp: now(),
            data: { content: d, step: i + 1 },
          }),
        );
      });
      delay += 200;
      queue.push(() =>
        this.emit({ type: "agent_response", agent, timestamp: now(), data: { content: decisions[decisions.length - 1] } }),
      );
    });
    queue.push(() =>
      this.emit({
        type: "final_response",
        agent: "commander",
        timestamp: now(),
        data: {
          content: `Acknowledged. Cross-referenced 4 sources, validated by Critic (PASS · 0.94). Executing: "${message}". Result synthesized into your context stream.`,
        },
      }),
    );
    queue.push(() => this.emit({ type: "pipeline_complete", timestamp: now() }));

    let cursor = 0;
    const fire = () => {
      if (cursor >= queue.length) return;
      queue[cursor++]();
      setTimeout(fire, 300 + Math.random() * 280);
    };
    fire();
  }

  private tick() {
    // Background heartbeat / proactive activity
    const roll = Math.random();
    if (roll < 0.35) {
      this.emit({
        type: "memory_updated",
        agent: "memory",
        timestamp: now(),
        data: { content: `Consolidated ${1000 + Math.floor(Math.random() * 800)} nodes` },
      });
    } else if (roll < 0.6) {
      this.emit({
        type: "proactive_suggestion",
        timestamp: now(),
        data: { content: PROACTIVE[Math.floor(Math.random() * PROACTIVE.length)] },
      });
    } else {
      this.emit({ type: "heartbeat", timestamp: now() });
    }
  }

  private emit(e: JarvisEvent) { this.listeners.forEach((l) => l(e)); }
}

const PROACTIVE = [
  "Adaptive Learning Completed · +2.4% baseline",
  "Anomaly resolved in executor cluster",
  "Memory Consolidation: 1,246 nodes optimized",
  "Predicted query cached · −340ms latency",
  "Critic recalibrated · drift compensated",
];

function now() { return new Date().toISOString(); }