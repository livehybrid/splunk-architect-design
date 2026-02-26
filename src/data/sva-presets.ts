import type { Edge, Node } from "reactflow";
import { MarkerType } from "reactflow";
import type { ArchitectureLayer, MachineSpec, SplunkNodeData, TopologyId, TopologyOption } from "../types/architecture";
import { CONNECTION_GROUP_LABELS } from "./splunk-ports-reference";
import type { ConnectionGroup } from "../utils/defaultEdges";
import { computeDefaultEdges } from "../utils/defaultEdges";
import { computeLayout } from "../utils/layout";

type SplunkNode = Node<SplunkNodeData>;

interface Preset {
  nodes: SplunkNode[];
  edges: Edge[];
}

const defaultMachineSpec: MachineSpec = {
  provider: "none",
  instanceType: "n/a",
  cpu: 0,
  ramGb: 0,
  storageGb: 0,
  osName: "RHEL",
  osVersion: "8.0",
  splunkVersion: "9.2.0",
  isCustom: false,
};

function presetNode(
  id: string,
  componentType: string,
  name: string,
  layer: ArchitectureLayer,
  site = "site1",
): SplunkNode {
  return {
    id,
    type: "splunkNode",
    position: { x: 0, y: 0 },
    data: {
      componentType,
      name,
      layer,
      site,
      scale: 1,
      machineSpec: { ...defaultMachineSpec },
      compatibilityMessage: "Compatibility not checked yet.",
      iconKey: componentType.toLowerCase().replace(/\s+/g, "-"),
    },
  };
}

function presetEdge(
  id: string,
  source: string,
  target: string,
  label: string,
  connectionGroup: ConnectionGroup = "other",
): Edge<{ connectionGroup: ConnectionGroup }> {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    label,
    data: { connectionGroup },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 16,
      height: 16,
    },
    style: {
      strokeWidth: 2,
    },
  };
}

export const TOPOLOGY_OPTIONS: TopologyOption[] = [
  {
    id: "S1",
    title: "S1 - Single Server",
    description: "Small non-HA deployment for onboarding and lab use cases.",
  },
  {
    id: "D1",
    title: "D1 - Distributed Non-Clustered",
    description: "Scale indexing horizontally with independent indexers.",
  },
  {
    id: "C3",
    title: "C3 - Clustered + SHC (Single Site)",
    description: "High availability for indexing and search in one site.",
  },
  {
    id: "M3",
    title: "M3 - Clustered + SHC (Multi-Site)",
    description: "Multi-site resilience with search and indexing redundancy.",
  },
  {
    id: "CLOUD",
    title: "CLOUD - Splunk Cloud",
    description: "Managed indexing/search tier with customer-controlled collection tier.",
  },
];

const PRESETS: Record<TopologyId, Preset> = {
  S1: {
    nodes: [
      presetNode("uf-1", "Universal Forwarder", "UF", "collection"),
      presetNode("s1-1", "Single Instance", "Single Splunk Server", "indexing"),
    ],
    edges: [],
  },
  D1: {
    nodes: [
      presetNode("uf-d1", "Universal Forwarder", "UF Tier", "collection"),
      presetNode("hf-d1", "Heavy Forwarder", "HF", "collection"),
      presetNode("idx-d1-a", "Indexer", "Indexer A", "indexing"),
      presetNode("idx-d1-b", "Indexer", "Indexer B", "indexing"),
      presetNode("sh-d1", "Search Head", "Search Head", "search"),
      presetNode("mc-d1", "Monitoring Console", "Monitoring Console", "management"),
    ],
    edges: [],
  },
  C3: {
    nodes: [
      presetNode("uf-c3", "Universal Forwarder", "UF Tier", "collection"),
      presetNode("hf-c3", "Heavy Forwarder", "HF Tier", "collection"),
      presetNode("cm-c3", "Cluster Manager", "Cluster Manager", "management"),
      presetNode("idx-c3-a", "Indexer", "Indexer 1", "indexing"),
      presetNode("idx-c3-b", "Indexer", "Indexer 2", "indexing"),
      presetNode("idx-c3-c", "Indexer", "Indexer 3", "indexing"),
      presetNode("shc-c3-a", "Search Head", "SHC Member 1", "search"),
      presetNode("shc-c3-b", "Search Head", "SHC Member 2", "search"),
      presetNode("shc-c3-c", "Search Head", "SHC Member 3", "search"),
      presetNode("deployer-c3", "SHC Deployer", "SHC Deployer", "management"),
    ],
    edges: [],
  },
  M3: {
    nodes: [
      presetNode("cm-m3", "Cluster Manager", "Cluster Manager", "management"),
      presetNode("idx-m3-a1", "Indexer", "SiteA Indexer 1", "indexing", "siteA"),
      presetNode("idx-m3-a2", "Indexer", "SiteA Indexer 2", "indexing", "siteA"),
      presetNode("idx-m3-b1", "Indexer", "SiteB Indexer 1", "indexing", "siteB"),
      presetNode("idx-m3-b2", "Indexer", "SiteB Indexer 2", "indexing", "siteB"),
      presetNode("sh-m3-a", "Search Head", "SiteA SHC", "search", "siteA"),
      presetNode("sh-m3-b", "Search Head", "SiteB SHC", "search", "siteB"),
    ],
    edges: [],
  },
  CLOUD: {
    nodes: [
      presetNode("uf-cloud", "Universal Forwarder", "On-Prem Forwarders", "collection"),
      presetNode("hec-cloud", "HEC Endpoint", "HEC", "collection"),
      presetNode("idx-cloud", "Splunk Cloud Indexing", "Managed Indexing Tier", "indexing"),
      presetNode("sh-cloud", "Splunk Cloud Search", "Managed Search Tier", "search"),
      presetNode("idm-cloud", "Inputs Data Manager", "IDM", "management"),
    ],
    edges: [
      presetEdge("e28", "uf-cloud", "idx-cloud", CONNECTION_GROUP_LABELS.forwarding.edgeLabel, "forwarding"),
      presetEdge("e29", "hec-cloud", "idx-cloud", CONNECTION_GROUP_LABELS.hec.edgeLabel, "hec"),
      presetEdge("e30", "sh-cloud", "idx-cloud", CONNECTION_GROUP_LABELS.search.edgeLabel, "search"),
      presetEdge("e31", "idm-cloud", "hec-cloud", "Input orchestration (IDM)", "management"),
    ],
  },
};

export function createPreset(topologyId: TopologyId): Preset {
  const preset = PRESETS[topologyId];
  const nodes = preset.nodes.map((node) => ({
    ...node,
    data: { ...node.data, machineSpec: { ...node.data.machineSpec } },
  }));
  const laidOut = computeLayout(nodes);
  const edges =
    topologyId === "CLOUD"
      ? preset.edges.map((e) => ({ ...e }))
      : computeDefaultEdges(laidOut, []);
  return { nodes: laidOut, edges };
}
