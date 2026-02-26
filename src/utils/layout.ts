import type { Node } from "reactflow";
import type { ArchitectureLayer, SplunkNodeData } from "../types/architecture";

/** Tier order top → bottom: Users/Search at top, data sources at bottom */
const LAYER_TIER_ORDER: ArchitectureLayer[] = ["management", "search", "indexing", "collection"];
const TIER_BASE_Y: Record<ArchitectureLayer, number> = {
  management: 40,
  search: 280,
  indexing: 520,
  collection: 760,
};
const NODE_WIDTH = 260;
const HORIZONTAL_GAP = 200;
const SITE_COLUMN_WIDTH = 1600;

export interface LayoutBounds {
  layer: ArchitectureLayer;
  site: string;
  indexInGroup: number;
  groupSize: number;
  siteColumnIndex: number;
}

/**
 * Group nodes by layer, then by site. Assign positions so that:
 * - Top = management, then search, then indexing, then collection (bottom).
 * - Within a layer, sites are side-by-side; within a site, nodes are in a row.
 */
export function computeLayout<N extends Node<SplunkNodeData>>(nodes: N[]): N[] {
  const byLayer = new Map<ArchitectureLayer, Map<string, N[]>>();
  for (const layer of LAYER_TIER_ORDER) {
    byLayer.set(layer, new Map());
  }
  for (const node of nodes) {
    const layer = node.data.layer;
    const site = node.data.site || "site1";
    if (!byLayer.has(layer)) byLayer.set(layer, new Map());
    const siteMap = byLayer.get(layer)!;
    if (!siteMap.has(site)) siteMap.set(site, []);
    siteMap.get(site)!.push(node);
  }

  const sitesOrder = Array.from(new Set(nodes.map((n) => (n.data.site || "site1").trim()))).sort();
  const siteToColumn = new Map<string, number>();
  sitesOrder.forEach((s, i) => siteToColumn.set(s, i));

  const result = nodes.map((node) => ({ ...node }));
  for (const layer of LAYER_TIER_ORDER) {
    const siteMap = byLayer.get(layer);
    if (!siteMap) continue;
    let siteIndex = 0;
    for (const [site, groupNodes] of siteMap) {
      const col = siteToColumn.get(site) ?? siteIndex;
      const baseX = 80 + col * SITE_COLUMN_WIDTH;
      const baseY = TIER_BASE_Y[layer];
      for (let i = 0; i < groupNodes.length; i++) {
        const node = groupNodes[i];
        const idx = result.findIndex((n) => n.id === node.id);
        if (idx === -1) continue;
        result[idx] = {
          ...result[idx],
          position: {
            x: baseX + i * (NODE_WIDTH + HORIZONTAL_GAP),
            y: baseY,
          },
        };
      }
      siteIndex++;
    }
  }
  return result;
}

/**
 * Return positions for N new nodes in the given layer/site, without overlapping existing nodes.
 */
export function getPositionsForNewNodes(
  layer: ArchitectureLayer,
  site: string,
  count: number,
  existingNodes: Node<SplunkNodeData>[],
): { x: number; y: number }[] {
  const inTier = existingNodes.filter((n) => n.data.layer === layer && (n.data.site || "site1") === site);
  const sitesOrder = Array.from(
    new Set([...existingNodes.map((n) => (n.data.site || "site1").trim()), site]),
  ).sort();
  const siteCol = sitesOrder.indexOf(site);
  const baseX = 80 + siteCol * SITE_COLUMN_WIDTH;
  const baseY = TIER_BASE_Y[layer];
  const startIndex = inTier.length;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      x: baseX + (startIndex + i) * (NODE_WIDTH + HORIZONTAL_GAP),
      y: baseY,
    });
  }
  return positions;
}
