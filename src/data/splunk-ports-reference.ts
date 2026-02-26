/**
 * Splunk Enterprise default/conventional network ports.
 * Source: https://help.splunk.com/en/splunk-enterprise/administer/inherit-a-splunk-deployment/9.0/inherited-deployment-tasks/components-and-their-relationship-with-the-network
 */

export interface PortEntry {
  component: string;
  purpose: string;
  listensOn: string;
}

/** Official port table: component, purpose, listens on (TCP/UDP). */
export const SPLUNK_PORTS_REFERENCE: PortEntry[] = [
  {
    component: "All components",
    purpose: "Management / REST API",
    listensOn: "TCP/8089",
  },
  {
    component: "Search head / Indexer",
    purpose: "Splunk Web access",
    listensOn: "TCP/8000",
  },
  {
    component: "Search head",
    purpose: "App Key Value Store",
    listensOn: "TCP/8065, TCP/8191",
  },
  {
    component: "Indexer",
    purpose: "Receiving data from forwarders",
    listensOn: "TCP/9997",
  },
  {
    component: "Search head cluster member",
    purpose: "Cluster replication",
    listensOn: "TCP/8081, TCP/9887, TCP/8181",
  },
  {
    component: "Indexer cluster peer node",
    purpose: "Cluster replication",
    listensOn: "TCP/8080, TCP/9887",
  },
  {
    component: "Heavy Forwarder or Indexer",
    purpose: "Receiving data over HTTP Event Collector (HEC)",
    listensOn: "TCP/8088",
  },
];

/** Edge label and toggle description by connection group (for UI and diagram labels). */
export const CONNECTION_GROUP_LABELS: Record<
  string,
  { edgeLabel: string; toggleLabel: string; ports: string }
> = {
  forwarding: {
    edgeLabel: "TCP/9997 (receive from forwarders)",
    toggleLabel: "Receive from forwarders",
    ports: "TCP/9997",
  },
  search: {
    edgeLabel: "TCP/8089 (Management/REST)",
    toggleLabel: "Management / REST API (search peer)",
    ports: "TCP/8089",
  },
  management: {
    edgeLabel: "TCP/8089 (Management/REST)",
    toggleLabel: "Management / REST API",
    ports: "TCP/8089",
  },
  replication: {
    edgeLabel: "TCP/8080, 9887 (indexer cluster replication)",
    toggleLabel: "Indexer cluster replication",
    ports: "TCP/8080, TCP/9887",
  },
  hec: {
    edgeLabel: "TCP/8088 (HEC)",
    toggleLabel: "HTTP Event Collector",
    ports: "TCP/8088",
  },
  license: {
    edgeLabel: "TCP/8089 (license)",
    toggleLabel: "License (to License Manager)",
    ports: "TCP/8089",
  },
  internal_logs: {
    edgeLabel: "TCP/9997 (internal logs)",
    toggleLabel: "Internal logs to indexers",
    ports: "TCP/9997",
  },
  other: {
    edgeLabel: "",
    toggleLabel: "Other",
    ports: "",
  },
};

/** Edge stroke color by connection group (for diagram readability). */
export const EDGE_COLORS: Record<string, string> = {
  forwarding: "#0a84ff",
  search: "#7f5af0",
  management: "#f59e0b",
  replication: "#2eb67d",
  hec: "#e5534b",
  license: "#8b5cf6",
  internal_logs: "#64748b",
  other: "#475569",
};
