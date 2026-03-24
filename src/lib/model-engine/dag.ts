/**
 * Directed acyclic graph (DAG) infrastructure for three-statement model evaluation.
 *
 * The model is organized into dependency phases. Phase 3 contains a strongly
 * connected component (SCC) — the Interest-Cash-Revolver circular reference —
 * which requires iterative solving rather than direct topological evaluation.
 *
 * Usage:
 *   const nodes = buildModelDAG();
 *   const plan  = getEvaluationPlan(nodes);
 *   // plan.phases is ordered; phases where isSCC === true need fixed-point iteration.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DAGNode {
  id: string;
  phase: number;
  dependsOn: string[];
}

export interface EvaluationPhase {
  id: string;
  phase: number;
  /** true when this phase contains SCC nodes that require iterative solving */
  isSCC: boolean;
  /** node IDs belonging to this phase, in topological order within the phase */
  nodes: string[];
}

export interface EvaluationPlan {
  phases: EvaluationPhase[];
  /** IDs of phases that contain SCC nodes */
  sccPhaseIds: string[];
}

// ---------------------------------------------------------------------------
// Canonical model graph
// ---------------------------------------------------------------------------

/**
 * Returns the canonical model nodes representing the evaluation build order
 * for a full three-statement financial model.
 *
 * Phase layout:
 *   1 — Operating income (no circular references)
 *   2 — Working capital schedules, PP&E, and equity/SBC (depend on IS operations)
 *   3 — Interest/debt, below-EBIT IS items, tax, cash flow (SCC: circular reference)
 *   4 — Cash flow statement (SCC: depends on Phase 3 loop outputs)
 *   5 — Balance sheet (depends on all prior phases)
 *   6 — Diagnostics and checks (depends on completed BS)
 */
export function buildModelDAG(): DAGNode[] {
  return [
    {
      id: "is_operating",
      phase: 1,
      dependsOn: [],
    },
    {
      id: "working_capital",
      phase: 2,
      dependsOn: ["is_operating"],
    },
    {
      id: "ppe",
      phase: 2,
      dependsOn: ["is_operating"],
    },
    {
      id: "equity_sbc",
      phase: 2,
      dependsOn: ["is_operating"],
    },
    {
      id: "debt_interest",
      phase: 3,
      dependsOn: ["is_operating", "ppe"],
    },
    {
      id: "is_below_ebit",
      phase: 3,
      dependsOn: ["debt_interest", "ppe", "equity_sbc"],
    },
    {
      id: "tax",
      phase: 3,
      dependsOn: ["is_below_ebit"],
    },
    {
      id: "cash_flow",
      phase: 4,
      dependsOn: ["is_below_ebit", "tax", "working_capital", "ppe", "equity_sbc"],
    },
    {
      id: "balance_sheet",
      phase: 5,
      dependsOn: [
        "cash_flow",
        "working_capital",
        "ppe",
        "debt_interest",
        "equity_sbc",
        "tax",
      ],
    },
    {
      id: "diagnostics",
      phase: 6,
      dependsOn: ["balance_sheet"],
    },
  ];
}

// ---------------------------------------------------------------------------
// Topological sort — Kahn's algorithm
// ---------------------------------------------------------------------------

/**
 * Returns a topologically ordered copy of the provided nodes using Kahn's
 * algorithm (BFS-based). All nodes with no remaining in-edges are processed
 * first, then their successors, and so on.
 *
 * Throws an Error if a cycle is detected among nodes not belonging to a known
 * SCC phase. (Cycles within an SCC phase are expected and handled by the
 * fixed-point solver, not this function.)
 */
export function topologicalSort(nodes: DAGNode[]): DAGNode[] {
  const nodeMap = new Map<string, DAGNode>(nodes.map((n) => [n.id, n]));

  // Build in-degree counts and adjacency list
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    if (!inDegree.has(node.id)) inDegree.set(node.id, 0);
    if (!adjacency.has(node.id)) adjacency.set(node.id, []);

    for (const dep of node.dependsOn) {
      // dep -> node.id (dep must come before node)
      if (!adjacency.has(dep)) adjacency.set(dep, []);
      adjacency.get(dep)!.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  // Seed the queue with nodes that have no dependencies present in this set
  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id);
    }
  }

  const sorted: DAGNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    for (const successor of adjacency.get(id) ?? []) {
      const newDegree = (inDegree.get(successor) ?? 0) - 1;
      inDegree.set(successor, newDegree);
      if (newDegree === 0) queue.push(successor);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error(
      `Cycle detected in model DAG: processed ${sorted.length} of ${nodes.length} nodes. ` +
        `Unresolved nodes: ${nodes
          .filter((n) => !sorted.find((s) => s.id === n.id))
          .map((n) => n.id)
          .join(", ")}`
    );
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Strongly connected components — Tarjan's algorithm
// ---------------------------------------------------------------------------

/**
 * Finds all strongly connected components (SCCs) in the node graph using
 * Tarjan's algorithm. Returns an array of arrays; each inner array contains
 * the node IDs of one SCC. Trivial SCCs (single nodes with no self-edge) are
 * included so callers can identify which phases are purely linear.
 *
 * Primarily used to confirm the Interest-Cash-Revolver circular reference and
 * to identify which phases require iterative solving.
 */
export function findSCCs(nodes: DAGNode[]): string[][] {
  const nodeIds = nodes.map((n) => n.id);
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    if (!adjacency.has(node.id)) adjacency.set(node.id, []);
    for (const dep of node.dependsOn) {
      if (!adjacency.has(dep)) adjacency.set(dep, []);
    }
  }

  // Build forward edges: dep -> node (same direction as evaluation)
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      adjacency.get(dep)!.push(node.id);
    }
  }

  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Map<string, boolean>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  function strongConnect(id: string): void {
    index.set(id, counter);
    lowlink.set(id, counter);
    counter++;
    stack.push(id);
    onStack.set(id, true);

    for (const neighbor of adjacency.get(id) ?? []) {
      if (!index.has(neighbor)) {
        strongConnect(neighbor);
        lowlink.set(id, Math.min(lowlink.get(id)!, lowlink.get(neighbor)!));
      } else if (onStack.get(neighbor)) {
        lowlink.set(id, Math.min(lowlink.get(id)!, index.get(neighbor)!));
      }
    }

    // If id is the root of an SCC, pop the stack to collect the component
    if (lowlink.get(id) === index.get(id)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.set(w, false);
        component.push(w);
      } while (w !== id);
      sccs.push(component);
    }
  }

  for (const id of nodeIds) {
    if (!index.has(id)) {
      strongConnect(id);
    }
  }

  return sccs;
}

// ---------------------------------------------------------------------------
// Evaluation plan builder
// ---------------------------------------------------------------------------

/** Node IDs that participate in the Interest-Cash-Revolver SCC. */
const SCC_NODE_IDS = new Set(["debt_interest", "is_below_ebit", "tax", "cash_flow"]);

/**
 * Builds an ordered EvaluationPlan from the model DAG.
 *
 * Nodes are grouped by their `phase` property. Phases that contain any SCC
 * node are marked with `isSCC: true`, indicating the phase must be solved via
 * fixed-point iteration rather than direct evaluation.
 *
 * @param nodes - Optional override; defaults to `buildModelDAG()`.
 */
export function getEvaluationPlan(nodes?: DAGNode[]): EvaluationPlan {
  const modelNodes = nodes ?? buildModelDAG();

  // Group node IDs by phase number
  const phaseMap = new Map<number, string[]>();
  for (const node of modelNodes) {
    if (!phaseMap.has(node.phase)) phaseMap.set(node.phase, []);
    phaseMap.get(node.phase)!.push(node.id);
  }

  // Sort phase numbers for deterministic ordering
  const phaseNumbers = Array.from(phaseMap.keys()).sort((a, b) => a - b);

  const phases: EvaluationPhase[] = phaseNumbers.map((phaseNum) => {
    const nodeIds = phaseMap.get(phaseNum)!;
    const hasSCC = nodeIds.some((id) => SCC_NODE_IDS.has(id));
    return {
      id: `phase_${phaseNum}`,
      phase: phaseNum,
      isSCC: hasSCC,
      nodes: nodeIds,
    };
  });

  const sccPhaseIds = phases
    .filter((p) => p.isSCC)
    .map((p) => p.id);

  return { phases, sccPhaseIds };
}
