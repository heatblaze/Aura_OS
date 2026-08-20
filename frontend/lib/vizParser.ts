/**
 * vizParser.ts
 * Parses agent response text and backend viz_hint payloads
 * to produce a VizData object for the VisualDataPanel.
 */
import { VizData } from "./types";

// ── Markdown table parser ─────────────────────────────────────
function parseMarkdownTable(text: string, agent: string): VizData | null {
  // Detect a markdown table (pipe-delimited)
  const lines = text.split("\n").filter(l => l.trim());
  const tableLines = lines.filter(l => l.includes("|"));
  if (tableLines.length < 3) return null;

  try {
    const headerLine = tableLines[0];
    const headers = headerLine
      .split("|")
      .map(h => h.trim())
      .filter(Boolean);

    // Skip separator row (---)
    const dataLines = tableLines.slice(2);
    const tableRows: string[][] = dataLines.map(l =>
      l.split("|").map(c => c.trim()).filter(Boolean)
    );

    if (headers.length < 2 || tableRows.length < 1) return null;

    // Check if we can convert to a chart
    const hasNumbers = tableRows.every(row => row.length >= 2 && !isNaN(parseFloat(row[1].replace(/[,%$£€]/g, ""))));

    if (hasNumbers && tableRows.length <= 12) {
      // Render as bar chart
      const rows = tableRows.map(row => ({
        label: row[0].substring(0, 20),
        value: parseFloat(row[1].replace(/[,%$£€K]/g, "") || "0") * (row[1].includes("K") ? 1000 : 1),
      }));
      return {
        type: "chart",
        agent,
        title: headers[0] + " vs " + headers[1],
        rows,
      };
    }

    return {
      type: "table",
      agent,
      title: "Data Summary",
      headers,
      tableRows,
    };
  } catch {
    return null;
  }
}

// ── Fenced JSON block parser ─────────────────────────────────
function parseFencedJson(text: string, agent: string): VizData | null {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;

  try {
    const obj = JSON.parse(jsonMatch[1].trim());

    // If the JSON has an explicit viz structure, use it directly
    if (obj.viz_type && obj.data) {
      return {
        type: obj.viz_type,
        agent: obj.agent || agent,
        title: obj.title || "Visual Report",
        description: obj.description,
        rows: obj.data?.rows || obj.data?.chart,
        metrics: obj.data?.metrics,
        headers: obj.data?.headers,
        tableRows: obj.data?.rows,
        code: obj.data?.code,
      } as VizData;
    }

    // Auto-interpret flat key-value objects as metric cards
    if (typeof obj === "object" && !Array.isArray(obj)) {
      const metrics = Object.entries(obj)
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .map(([k, v]) => ({
          label: k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          value: v as string | number,
        }));
      if (metrics.length >= 2) {
        return {
          type: "metrics",
          agent,
          title: "System Metrics",
          metrics,
        };
      }
    }

    // Array of {label, value} → bar chart
    if (Array.isArray(obj) && obj[0]?.label !== undefined && obj[0]?.value !== undefined) {
      return {
        type: "chart",
        agent,
        title: "Data Visualization",
        rows: obj,
      };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

// ── Key-value pair detector ─────────────────────────────────
function parseKeyValueMetrics(text: string, agent: string): VizData | null {
  // Match lines like: "- **Revenue**: $12,450" or "• API Cost: 3.2%" or "Total Savings: 12%"
  const kvPattern = /(?:[-•*]?\s*\*{0,2}([A-Za-z][A-Za-z\s/&]{2,30})\*{0,2}\s*[:\-–]\s*([\$£€]?[\d,]+(?:\.\d+)?(?:[KMBkmbTt%]?)(?:\s*[a-zA-Z%]*)))/gm;
  const matches = [...text.matchAll(kvPattern)];

  if (matches.length < 3) return null;

  const metrics: { label: string; value: string | number; unit?: string }[] = [];
  const seen = new Set<string>();

  for (const m of matches) {
    const label = m[1].trim();
    const rawVal = m[2].trim();
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());

    const numericVal = parseFloat(rawVal.replace(/[,$£€%KMBkmbTt]/g, ""));
    const unit = rawVal.match(/[%KMBkmbTt]$/)?.[0] || (rawVal.startsWith("$") ? "$" : "");

    metrics.push({
      label,
      value: isNaN(numericVal) ? rawVal : numericVal,
      unit: isNaN(numericVal) ? undefined : unit,
    });

    if (metrics.length >= 8) break;
  }

  if (metrics.length < 3) return null;

  return {
    type: "metrics",
    agent,
    title: "Key Metrics",
    metrics,
  };
}

// ── Numbered comparison detector ────────────────────────────
function parseNumberedComparison(text: string, agent: string): VizData | null {
  // "1. Option A: 85%" style lists
  const numPattern = /^\d+\.\s+(.+?):\s*([\d,.]+(?:\s*%)?)/gm;
  const matches = [...text.matchAll(numPattern)];
  if (matches.length < 3) return null;

  const rows = matches.slice(0, 10).map(m => ({
    label: m[1].trim().substring(0, 25),
    value: parseFloat(m[2].replace(/[,%]/g, "")),
  }));

  return {
    type: "chart",
    agent,
    title: "Comparison",
    rows,
  };
}

// ── Backend viz_hint handler ─────────────────────────────────
export function parseVizHint(hint: any, agent: string): VizData | null {
  if (!hint) return null;
  try {
    return {
      type: hint.viz_type || "metrics",
      agent,
      title: hint.title || "Visual Report",
      description: hint.description,
      rows: hint.data?.rows || hint.data?.chart,
      metrics: hint.data?.metrics,
      headers: hint.data?.headers,
      tableRows: hint.data?.table_rows,
      code: hint.data?.code || hint.code,
      imageUrl: hint.imageUrl || hint.image_url || hint.data?.imageUrl || hint.data?.image_url,
    } as any as VizData;
  } catch {
    return null;
  }
}
 
// ── Visual description parser ─────────────────────────────────
function parseVisualDescription(text: string, agent: string): VizData | null {
  // Matches (Visual description: ...) or [Visual description: ...] or (Visual: ...) or [Visual: ...]
  const match = text.match(/[\(\[](?:Visual\s+description|Visual|Visual\s+Representation)\s*:\s*([^\]\)]+)[\)\]]/i);
  if (!match) return null;

  return {
    type: "info",
    agent,
    title: "Visual Display",
    code: match[1].trim(),
  };
}

// ── AGENTS that produce visual data by default ──────────────
const VIZ_AGENTS = new Set(["marcus", "lex", "mia", "elena", "bobby"]);

// ── Main export ───────────────────────────────────────────────
export function parseVisualContent(text: string, agent: string): VizData | null {
  if (!text || text.length < 30) return null; // lowered limit to allow shorter visual descriptions

  // 1. Fenced JSON block (most explicit)
  const fromJson = parseFencedJson(text, agent);
  if (fromJson) return fromJson;

  // 2. Markdown table
  const fromTable = parseMarkdownTable(text, agent);
  if (fromTable) return fromTable;

  // 3. Key-value metric pairs (agent must be a viz-producing agent)
  if (VIZ_AGENTS.has(agent.toLowerCase())) {
    const fromKV = parseKeyValueMetrics(text, agent);
    if (fromKV) return fromKV;
  }

  // 4. Numbered comparison list
  const fromNum = parseNumberedComparison(text, agent);
  if (fromNum) return fromNum;

  // 5. Visual description fallback
  const fromDesc = parseVisualDescription(text, agent);
  if (fromDesc) return fromDesc;

  return null;
}
