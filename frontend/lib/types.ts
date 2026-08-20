// Shared TypeScript types for JARVIS AI OS

export type AgentName = "commander" | "planner" | "executor" | "memory" | "critic" | "intent";

export type EventType =
  | "connected"
  | "pipeline_start"
  | "pipeline_complete"
  | "pipeline_error"
  | "agent_start"
  | "agent_thinking"
  | "agent_response"
  | "intent_extracting"
  | "intent_extracted"
  | "commander_decision"
  | "plan_created"
  | "step_start"
  | "step_complete"
  | "step_failed"
  | "execution_complete"
  | "critic_verdict"
  | "memory_retrieved"
  | "memory_updated"
  | "direct_response_mode"
  | "clarification_needed"
  | "confirmation_required"
  | "executor_info"
  | "simulation_start"
  | "proactive_suggestion"
  | "proactive_executing"
  | "auto_mode_changed"
  | "heartbeat"
  | "session_cleared"
  | "disconnected"
  | "final_response"
  | "switch_channel"
  | "error";

export interface JarvisEvent {
  type: EventType;
  timestamp: string;
  session_id?: string;
  agent?: AgentName;
  message?: string;
  data?: any;
  // Dynamic additional fields
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  agentName?: string;
  intent?: IntentResult;
  isStreaming?: boolean;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  requires_action: boolean;
}

export interface PlanStep {
  step_id: number;
  description: string;
  tool: string | null;
  can_parallel: boolean;
  estimated_duration_ms: number;
  fallback: string;
}

export interface AgentLogEntry {
  id: string;
  type: EventType;
  agent?: AgentName;
  timestamp: string;
  title: string;
  detail?: string;
  status?: "thinking" | "done" | "error";
  content?: string;
  data?: Record<string, unknown>;
}

export interface SystemStatus {
  connected: boolean;
  ollamaAvailable: boolean;
  model: string;
  sessionId: string;
  eventCount: number;
}

export interface ProactiveSuggestion {
  id: string;
  trigger: string;
  title: string;
  description: string;
  action_label: string;
  action?: { type: string; message: string };
  risk_level: "low" | "medium" | "high";
  icon: string;
  created_at: string;
  status: "pending" | "approved" | "dismissed" | "executed";
}

export interface AutoModeState {
  enabled: boolean;
  approval_policy: string;
  policy_description: string;
}

export const AGENT_COLORS: Record<string, string> = {
  commander: "#00E5FF", // Cyan
  planner: "#9D4EDD",   // Purple
  executor: "#F8FAFC",  // White
  memory: "#0077B6",    // Blue
  critic: "#F59E0B",    // Amber
  intent: "#10B981",    // Green
};

export const AGENT_ICONS: Record<string, string> = {
  commander: "CMD",
  planner: "PLN",
  executor: "EXE",
  memory: "MEM",
  critic: "CRT",
  intent: "INT",
};

// ── Visual Data Panel ─────────────────────────────────────────
export interface VizData {
  type: "chart" | "line" | "metrics" | "table" | "code" | "mixed" | "info" | "image" | "svg";
  agent: string;
  title: string;
  description?: string;
  // Bar / line chart data
  rows?: { label: string; value: number }[];
  // Metric cards
  metrics?: { label: string; value: string | number; unit?: string }[];
  // Table data
  headers?: string[];
  tableRows?: string[][];
  // Code block
  code?: string;
}

export const EVENT_LABELS: Partial<Record<EventType, string>> = {
  pipeline_start: "Pipeline activated",
  intent_extracting: "Extracting intent",
  intent_extracted: "Intent identified",
  agent_start: "Agent activated",
  agent_thinking: "Reasoning",
  commander_decision: "Strategy decided",
  plan_created: "Plan generated",
  step_start: "Executing step",
  step_complete: "Step completed",
  step_failed: "Step failed",
  execution_complete: "Execution complete",
  critic_verdict: "Quality assessed",
  memory_retrieved: "Context loaded",
  memory_updated: "Memory updated",
  pipeline_complete: "Task complete",
  direct_response_mode: "Direct response",
};
