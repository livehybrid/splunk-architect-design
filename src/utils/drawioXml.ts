import type { Edge, Node } from "reactflow";
import type { SplunkNodeData } from "../types/architecture";


function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\r?\n/g, " ");
}

/** Default node size to match our layout (width x height). */
const NODE_WIDTH = 260;
const NODE_HEIGHT = 140;

/**
 * Generate draw.io (diagrams.net) compatible XML from current nodes and edges.
 * Can be saved as .drawio or .xml and opened in draw.io / diagrams.net.
 */
export function toDrawioXml(nodes: Node<SplunkNodeData>[], edges: Edge[]): string {
  const nodeIdToVertexId = new Map<string, string>();
  const vertexIds: string[] = [];
  let vertexIndex = 2; // 0 and 1 reserved by draw.io
  for (const n of nodes) {
    const id = `v${vertexIndex}`;
    nodeIdToVertexId.set(n.id, id);
    vertexIds.push(id);
    vertexIndex++;
  }

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<mxfile host="Splunk HLA Designer" modified="' + new Date().toISOString() + '" agent="Splunk-HLA-Designer" version="1.0" etag="" type="device">',
  );
  lines.push('  <diagram name="Splunk Architecture" id="splunk-hla">');
  lines.push(
    '    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0">',
  );
  lines.push("      <root>");
  lines.push('        <mxCell id="0" />');
  lines.push('        <mxCell id="1" parent="0" />');

  for (const node of nodes) {
    const vid = nodeIdToVertexId.get(node.id)!;
    const x = node.position.x;
    const y = node.position.y;
    const label = escapeXml(`${node.data.name}\n${node.data.componentType}`);
    const style =
      "rounded=1;whiteSpace=wrap;html=1;fillColor=#fff;strokeColor=#4b5e7a;strokeWidth=2;fontSize=11;align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;";
    lines.push(
      `        <mxCell id="${vid}" value="${label}" style="${style}" vertex="1" parent="1">`,
    );
    lines.push(`          <mxGeometry x="${x}" y="${y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" as="geometry" />`);
    lines.push("        </mxCell>");
  }

  let edgeIndex = vertexIndex;
  for (const edge of edges) {
    const srcId = nodeIdToVertexId.get(edge.source);
    const tgtId = nodeIdToVertexId.get(edge.target);
    if (!srcId || !tgtId) continue;
    const eid = `e${edgeIndex}`;
    const label = escapeXml(typeof edge.label === "string" ? edge.label : "");
    const style =
      "endArrow=blockThin;html=1;rounded=0;strokeWidth=2;fontSize=10;labelBackgroundColor=#ffffff;edgeLabel;";
    lines.push(
      `        <mxCell id="${eid}" value="${label}" style="${style}" edge="1" parent="1" source="${srcId}" target="${tgtId}">`,
    );
    lines.push('          <mxGeometry relative="1" as="geometry" />');
    lines.push("        </mxCell>");
    edgeIndex++;
  }

  lines.push("      </root>");
  lines.push("    </mxGraphModel>");
  lines.push("  </diagram>");
  lines.push("</mxfile>");

  return lines.join("\n");
}

/** Trigger download of draw.io XML file. */
export function downloadDrawioXml(nodes: Node<SplunkNodeData>[], edges: Edge[], filename: string): void {
  const xml = toDrawioXml(nodes, edges);
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".drawio") || filename.endsWith(".xml") ? filename : `${filename}.drawio`;
  a.click();
  URL.revokeObjectURL(url);
}
