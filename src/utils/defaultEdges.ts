import type { Edge, Node } from "reactflow";
import { MarkerType } from "reactflow";
import { CONNECTION_GROUP_LABELS, EDGE_COLORS } from "../data/splunk-ports-reference";
import type { SplunkNodeData } from "../types/architecture";

export type ConnectionGroup =
  | "forwarding"
  | "search"
  | "management"
  | "replication"
  | "hec"
  | "license"
  | "internal_logs"
  | "other";

function edgeId(source: string, target: string, label: string): string {
  return `e-${source}-${target}-${label.replace(/\s+/g, "-").slice(0, 25)}`;
}

function makeEdge(
  source: string,
  target: string,
  label: string,
  connectionGroup: ConnectionGroup,
): Edge<{ connectionGroup: ConnectionGroup }> {
  const stroke = EDGE_COLORS[connectionGroup] ?? EDGE_COLORS.other;
  return {
    id: edgeId(source, target, label),
    source,
    target,
    type: "smoothstep",
    label,
    data: { connectionGroup },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { strokeWidth: 2, stroke },
  };
}

function isIndexerLike(n: Node<SplunkNodeData>): boolean {
  return n.data.componentType === "Indexer" || n.data.componentType === "Single Instance";
}

/** Indexers in same site get bucket replication edges (bidirectional). Only between Indexer type. */
function replicationEdges(nodes: Node<SplunkNodeData>[]): Edge[] {
  const indexersBySite = new Map<string, Node<SplunkNodeData>[]>();
  for (const n of nodes) {
    if (n.data.componentType !== "Indexer") continue;
    const site = n.data.site || "site1";
    if (!indexersBySite.has(site)) indexersBySite.set(site, []);
    indexersBySite.get(site)!.push(n);
  }
  const edges: Edge[] = [];
  const added = new Set<string>();
  for (const [, group] of indexersBySite) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i].id;
        const b = group[j].id;
        const key = [a, b].sort().join("-");
        if (added.has(key)) continue;
        added.add(key);
        edges.push(
          makeEdge(a, b, CONNECTION_GROUP_LABELS.replication.edgeLabel, "replication"),
        );
      }
    }
  }
  return edges;
}

/** Collection → Indexing: UF→HF (if HF exists), UF→Indexer (if no HF), HF→Indexer. All 9997/tcp. */
function collectionToIndexingEdges(nodes: Node<SplunkNodeData>[]): Edge[] {
  const ufs = nodes.filter((n) => n.data.componentType === "Universal Forwarder");
  const hfs = nodes.filter((n) => n.data.componentType === "Heavy Forwarder");
  const indexers = nodes.filter(isIndexerLike);
  const edges: Edge[] = [];
  for (const uf of ufs) {
    const site = uf.data.site || "site1";
    const siteHfs = hfs.filter((n) => (n.data.site || "site1") === site);
    const siteIndexers = indexers.filter((n) => (n.data.site || "site1") === site);
    const indexerTargets = siteIndexers.length > 0 ? siteIndexers : indexers;
    if (siteHfs.length > 0) {
      for (const hf of siteHfs) {
        edges.push(makeEdge(uf.id, hf.id, CONNECTION_GROUP_LABELS.forwarding.edgeLabel, "forwarding"));
      }
    } else {
      for (const idx of indexerTargets) {
        edges.push(makeEdge(uf.id, idx.id, CONNECTION_GROUP_LABELS.forwarding.edgeLabel, "forwarding"));
      }
    }
  }
  for (const hf of hfs) {
    const site = hf.data.site || "site1";
    const sameSite = indexers.filter((n) => (n.data.site || "site1") === site);
    const targets = sameSite.length > 0 ? sameSite : indexers;
    for (const idx of targets) {
      edges.push(makeEdge(hf.id, idx.id, CONNECTION_GROUP_LABELS.forwarding.edgeLabel, "forwarding"));
    }
  }
  return edges;
}

/** Search Head(s) → all Indexers (8089). */
function searchToIndexerEdges(nodes: Node<SplunkNodeData>[]): Edge[] {
  const searchHeads = nodes.filter((n) => n.data.componentType === "Search Head" && n.data.layer === "search");
  const indexers = nodes.filter(isIndexerLike);
  const edges: Edge[] = [];
  for (const sh of searchHeads) {
    for (const idx of indexers) {
      edges.push(makeEdge(sh.id, idx.id, CONNECTION_GROUP_LABELS.search.edgeLabel, "search"));
    }
  }
  return edges;
}

/** Cluster Manager → all Indexers (8089). */
function clusterManagerEdges(nodes: Node<SplunkNodeData>[]): Edge[] {
  const cm = nodes.find((n) => n.data.componentType === "Cluster Manager");
  if (!cm) return [];
  const indexers = nodes.filter(isIndexerLike);
  return indexers.map((idx) =>
    makeEdge(cm.id, idx.id, CONNECTION_GROUP_LABELS.management.edgeLabel, "management"),
  );
}

/** SHC Deployer → Search Heads (8089). */
function deployerToSearchHeadEdges(nodes: Node<SplunkNodeData>[]): Edge[] {
  const deployer = nodes.find((n) => n.data.componentType === "SHC Deployer");
  if (!deployer) return [];
  const searchHeads = nodes.filter((n) => n.data.componentType === "Search Head");
  return searchHeads.map((sh) =>
    makeEdge(deployer.id, sh.id, CONNECTION_GROUP_LABELS.management.edgeLabel, "management"),
  );
}

/** Indexers and Search Heads → License Manager (8089). */
function licenseManagerEdges(nodes: Node<SplunkNodeData>[]): Edge[] {
  const lm = nodes.find((n) => n.data.componentType === "License Manager");
  if (!lm) return [];
  const indexers = nodes.filter(isIndexerLike);
  const searchHeads = nodes.filter((n) => n.data.componentType === "Search Head");
  const edges: Edge[] = [];
  for (const n of indexers) {
    edges.push(makeEdge(n.id, lm.id, CONNECTION_GROUP_LABELS.license.edgeLabel, "license"));
  }
  for (const sh of searchHeads) {
    edges.push(makeEdge(sh.id, lm.id, CONNECTION_GROUP_LABELS.license.edgeLabel, "license"));
  }
  return edges;
}

/** Deduplicate edges by id. */
function dedupeEdges(edges: Edge[]): Edge[] {
  const byId = new Map<string, Edge>();
  for (const e of edges) {
    byId.set(e.id, e);
  }
  return Array.from(byId.values());
}

/**
 * Compute all default edges for the current graph (forwarding, search, cluster control, replication, license).
 * Optionally pass existing edges to merge and avoid duplicates.
 */
export function computeDefaultEdges(
  nodes: Node<SplunkNodeData>[],
  existingEdges: Edge[] = [],
): Edge[] {
  const existingIds = new Set(existingEdges.map((e) => e.id));
  const candidates: Edge[] = [
    ...replicationEdges(nodes),
    ...collectionToIndexingEdges(nodes),
    ...searchToIndexerEdges(nodes),
    ...clusterManagerEdges(nodes),
    ...deployerToSearchHeadEdges(nodes),
    ...licenseManagerEdges(nodes),
  ];
  const merged = [...existingEdges];
  for (const e of dedupeEdges(candidates)) {
    if (!existingIds.has(e.id)) {
      merged.push(e);
      existingIds.add(e.id);
    }
  }
  return merged;
}

export interface SuggestedEdge {
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  label: string;
  connectionGroup: ConnectionGroup;
}

/**
 * Suggest connections for newly added nodes: what to connect to/from based on component type.
 * Used by the "Add connections?" modal after adding a component.
 */
export function suggestConnectionsForNewNodes(
  newNodes: Node<SplunkNodeData>[],
  allNodes: Node<SplunkNodeData>[],
  existingEdges: Edge[],
): SuggestedEdge[] {
  const existingIds = new Set(existingEdges.map((e) => e.id));
  const suggestions: SuggestedEdge[] = [];
  const indexers = allNodes.filter(isIndexerLike);
  const searchHeads = allNodes.filter((n) => n.data.componentType === "Search Head");
  const hfs = allNodes.filter((n) => n.data.componentType === "Heavy Forwarder");
  const lm = allNodes.find((n) => n.data.componentType === "License Manager");

  for (const newNode of newNodes) {
    const comp = newNode.data.componentType;
    const name = newNode.data.name;

    if (comp === "License Manager") {
      for (const idx of indexers) {
        if (idx.id === newNode.id) continue;
        const label = CONNECTION_GROUP_LABELS.license.edgeLabel;
        if (!existingIds.has(edgeId(idx.id, newNode.id, label)))
          suggestions.push({
            source: idx.id,
            target: newNode.id,
            sourceName: idx.data.name,
            targetName: name,
            label,
            connectionGroup: "license",
          });
      }
      for (const sh of searchHeads) {
        if (sh.id === newNode.id) continue;
        const label = CONNECTION_GROUP_LABELS.license.edgeLabel;
        if (!existingIds.has(edgeId(sh.id, newNode.id, label)))
          suggestions.push({
            source: sh.id,
            target: newNode.id,
            sourceName: sh.data.name,
            targetName: name,
            label,
            connectionGroup: "license",
          });
      }
    }

    if (comp === "Heavy Forwarder") {
      for (const idx of indexers) {
        const label = CONNECTION_GROUP_LABELS.forwarding.edgeLabel;
        if (!existingIds.has(edgeId(newNode.id, idx.id, label)))
          suggestions.push({
            source: newNode.id,
            target: idx.id,
            sourceName: name,
            targetName: idx.data.name,
            label,
            connectionGroup: "forwarding",
          });
      }
    }

    if (comp === "Universal Forwarder") {
      const site = newNode.data.site || "site1";
      const siteHfs = hfs.filter((n) => (n.data.site || "site1") === site);
      const siteIndexers = indexers.filter((n) => (n.data.site || "site1") === site);
      const indexerTargets = siteIndexers.length > 0 ? siteIndexers : indexers;
      if (siteHfs.length > 0) {
        for (const hf of siteHfs) {
          const label = CONNECTION_GROUP_LABELS.forwarding.edgeLabel;
          if (!existingIds.has(edgeId(newNode.id, hf.id, label)))
            suggestions.push({
              source: newNode.id,
              target: hf.id,
              sourceName: name,
              targetName: hf.data.name,
              label,
              connectionGroup: "forwarding",
            });
        }
      } else {
        for (const idx of indexerTargets) {
          const label = CONNECTION_GROUP_LABELS.forwarding.edgeLabel;
          if (!existingIds.has(edgeId(newNode.id, idx.id, label)))
            suggestions.push({
              source: newNode.id,
              target: idx.id,
              sourceName: name,
              targetName: idx.data.name,
              label,
              connectionGroup: "forwarding",
            });
        }
      }
    }

    if (comp === "Indexer") {
      const site = newNode.data.site || "site1";
      const otherIndexers = indexers.filter((n) => n.id !== newNode.id && (n.data.site || "site1") === site);
      for (const idx of otherIndexers) {
        const label = CONNECTION_GROUP_LABELS.replication.edgeLabel;
        if (!existingIds.has(edgeId(newNode.id, idx.id, label)))
          suggestions.push({
            source: newNode.id,
            target: idx.id,
            sourceName: name,
            targetName: idx.data.name,
            label,
            connectionGroup: "replication",
          });
      }
    }

    if (comp === "Search Head") {
      for (const idx of indexers) {
        const label = CONNECTION_GROUP_LABELS.search.edgeLabel;
        if (!existingIds.has(edgeId(newNode.id, idx.id, label)))
          suggestions.push({
            source: newNode.id,
            target: idx.id,
            sourceName: name,
            targetName: idx.data.name,
            label,
            connectionGroup: "search",
          });
      }
    }

    if (comp === "Cluster Manager") {
      for (const idx of indexers) {
        const label = CONNECTION_GROUP_LABELS.management.edgeLabel;
        if (!existingIds.has(edgeId(newNode.id, idx.id, label)))
          suggestions.push({
            source: newNode.id,
            target: idx.id,
            sourceName: name,
            targetName: idx.data.name,
            label,
            connectionGroup: "management",
          });
      }
    }

    if (comp === "SHC Deployer") {
      for (const sh of searchHeads) {
        const label = CONNECTION_GROUP_LABELS.management.edgeLabel;
        if (!existingIds.has(edgeId(newNode.id, sh.id, label)))
          suggestions.push({
            source: newNode.id,
            target: sh.id,
            sourceName: name,
            targetName: sh.data.name,
            label,
            connectionGroup: "management",
          });
      }
    }

    if (lm && comp !== "License Manager") {
      const fromNodes = ["Indexer", "Search Head", "Single Instance"].includes(comp)
        ? [newNode]
        : [];
      for (const from of fromNodes) {
        const label = CONNECTION_GROUP_LABELS.license.edgeLabel;
        if (!existingIds.has(edgeId(from.id, lm.id, label)))
          suggestions.push({
            source: from.id,
            target: lm.id,
            sourceName: from.data.name,
            targetName: lm.data.name,
            label,
            connectionGroup: "license",
          });
      }
    }

    if (indexers.length > 0 && comp !== "Indexer" && comp !== "Universal Forwarder" && comp !== "Heavy Forwarder") {
      for (const idx of indexers) {
        const label = CONNECTION_GROUP_LABELS.internal_logs.edgeLabel;
        if (!existingIds.has(edgeId(newNode.id, idx.id, label)))
          suggestions.push({
            source: newNode.id,
            target: idx.id,
            sourceName: name,
            targetName: idx.data.name,
            label,
            connectionGroup: "internal_logs",
          });
      }
    }
  }

  return suggestions;
}

/** Convert suggested edges to real edges and merge into existing (dedupe by id). */
export function addSuggestedEdges(
  suggestions: SuggestedEdge[],
  existingEdges: Edge[],
): Edge[] {
  const existingIds = new Set(existingEdges.map((e) => e.id));
  const toAdd = suggestions.map((s) =>
    makeEdge(s.source, s.target, s.label, s.connectionGroup),
  );
  const merged = [...existingEdges];
  for (const e of toAdd) {
    if (!existingIds.has(e.id)) {
      merged.push(e);
      existingIds.add(e.id);
    }
  }
  return merged;
}
