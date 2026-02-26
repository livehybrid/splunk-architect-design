import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, type Node, useEdgesState, useNodesState } from "reactflow";
import "reactflow/dist/style.css";
import "./App.css";
import { SplunkNode } from "./components/SplunkNode";
import { CONNECTION_GROUP_LABELS } from "./data/splunk-ports-reference";
import { getInstancesByProvider } from "./data/instance-catalog";
import { createPreset, TOPOLOGY_OPTIONS } from "./data/sva-presets";
import type { ArchitectureLayer, CloudProvider, MachineSpec, SplunkNodeData, TopologyId } from "./types/architecture";
import { checkOsCompatibility, getSupportedOsForSplunk } from "./utils/compatibility";
import type { ConnectionGroup } from "./utils/defaultEdges";
import {
  addSuggestedEdges,
  suggestConnectionsForNewNodes,
  type SuggestedEdge,
} from "./utils/defaultEdges";
import { downloadDrawioXml, toDrawioXml } from "./utils/drawioXml";
import { computeLayout, getPositionsForNewNodes } from "./utils/layout";
import { exportElementToPdf } from "./utils/pdf";

const nodeTypes = { splunkNode: SplunkNode };

const COMPONENT_TYPES = [
  "Universal Forwarder",
  "Heavy Forwarder",
  "Indexer",
  "Search Head",
  "Cluster Manager",
  "Monitoring Console",
  "Deployment Server",
  "License Manager",
  "HEC Endpoint",
  "Custom Component",
];

const SPLUNK_VERSIONS = ["9.2.0", "9.1.0", "9.0.0"];

interface LayerVisibility {
  collection: boolean;
  indexing: boolean;
  search: boolean;
  management: boolean;
}

/** Toggles for connection/port types (edges). */
interface ConnectionVisibility {
  forwarding: boolean;
  search: boolean;
  management: boolean;
  replication: boolean;
  hec: boolean;
  license: boolean;
  internal_logs: boolean;
  other: boolean;
}

interface ComponentFormState {
  componentType: string;
  name: string;
  layer: ArchitectureLayer;
  site: string;
  scale: number;
  provider: CloudProvider;
  instanceType: string;
  cpu: number;
  ramGb: number;
  storageGb: number;
  osName: string;
  osVersion: string;
  splunkVersion: string;
}

const initialPreset = createPreset("C3");

const defaultForm: ComponentFormState = {
  componentType: "Indexer",
  name: "New Component",
  layer: "indexing",
  site: "site1",
  scale: 1,
  provider: "none",
  instanceType: "",
  cpu: 8,
  ramGb: 32,
  storageGb: 500,
  osName: "RHEL",
  osVersion: "8.0",
  splunkVersion: "9.2.0",
};

function createMachineSpec(form: ComponentFormState): MachineSpec {
  if (form.provider === "aws" || form.provider === "azure") {
    const matched = getInstancesByProvider(form.provider).find((preset) => preset.instanceType === form.instanceType);
    if (matched) {
      return {
        provider: form.provider,
        instanceType: matched.instanceType,
        cpu: matched.cpu,
        ramGb: matched.ramGb,
        storageGb: matched.storageGb,
        osName: form.osName,
        osVersion: form.osVersion,
        splunkVersion: form.splunkVersion,
        isCustom: false,
      };
    }
  }

  if (form.provider === "custom") {
    return {
      provider: form.provider,
      instanceType: form.instanceType || "custom",
      cpu: form.cpu,
      ramGb: form.ramGb,
      storageGb: form.storageGb,
      osName: form.osName,
      osVersion: form.osVersion,
      splunkVersion: form.splunkVersion,
      isCustom: true,
    };
  }

  return {
    provider: "none",
    instanceType: "n/a",
    cpu: 0,
    ramGb: 0,
    storageGb: 0,
    osName: form.osName,
    osVersion: form.osVersion,
    splunkVersion: form.splunkVersion,
    isCustom: false,
  };
}

function compatibilityFor(spec: MachineSpec): string {
  return checkOsCompatibility(spec.splunkVersion, spec.osName, spec.osVersion);
}

function App() {
  const [topology, setTopology] = useState<TopologyId>("C3");
  const [nodes, setNodes, onNodesChange] = useNodesState<SplunkNodeData>(initialPreset.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialPreset.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [form, setForm] = useState<ComponentFormState>(defaultForm);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    collection: true,
    indexing: true,
    search: true,
    management: true,
  });
  const [connectionVisibility, setConnectionVisibility] = useState<ConnectionVisibility>({
    forwarding: true,
    search: true,
    management: true,
    replication: true,
    hec: true,
    license: true,
    internal_logs: true,
    other: true,
  });
  const [statusMessage, setStatusMessage] = useState<string>("Ready.");
  const [showDrawioXml, setShowDrawioXml] = useState(false);
  const [suggestedConnections, setSuggestedConnections] = useState<{
    newNodes: Node<SplunkNodeData>[];
    suggestions: SuggestedEdge[];
  } | null>(null);
  const [suggestedSelectedIndices, setSuggestedSelectedIndices] = useState<Set<number>>(new Set());

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId]);

  const visibleNodes = useMemo(
    () => nodes.filter((node) => layerVisibility[node.data.layer]),
    [nodes, layerVisibility],
  );
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    const filtered = edges.filter((edge) => {
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false;
      const group = (edge.data as { connectionGroup?: ConnectionGroup } | undefined)?.connectionGroup ?? "other";
      return connectionVisibility[group];
    });
    const key = (e: (typeof edges)[0]) => `${e.source}-${e.target}`;
    const byPair = new Map<string, number>();
    return filtered.map((edge) => {
      const pair = key(edge);
      const index = byPair.get(pair) ?? 0;
      byPair.set(pair, index + 1);
      const offset = index % 2 === 0 ? (index / 2) * 18 : -((index + 1) / 2) * 18;
      return {
        ...edge,
        pathOptions: { offset, borderRadius: 8 },
      };
    });
  }, [edges, visibleNodeIds, connectionVisibility]);

  const providerInstances = useMemo(() => getInstancesByProvider(form.provider), [form.provider]);
  const supportedOs = useMemo(() => getSupportedOsForSplunk(form.splunkVersion), [form.splunkVersion]);

  const handleTopologyChange = (topologyId: TopologyId) => {
    const preset = createPreset(topologyId);
    setTopology(topologyId);
    setNodes(preset.nodes);
    setEdges(preset.edges);
    setSelectedNodeId(null);
    setStatusMessage(`Loaded ${topologyId} baseline with default connections.`);
  };

  const handleAddComponent = () => {
    const machineSpec = createMachineSpec(form);
    const compatibilityMessage = compatibilityFor(machineSpec);
    const baseName = form.name.trim() || form.componentType;
    const site = form.site.trim() || "site1";
    const count = Math.max(1, form.scale);
    const positions = getPositionsForNewNodes(form.layer, site, count, nodes);

    const newNodes: Node<SplunkNodeData>[] = positions.map((pos, i) => ({
      id: `node-${Date.now()}-${i}`,
      type: "splunkNode",
      position: pos,
      data: {
        componentType: form.componentType,
        name: count > 1 ? `${baseName} ${i + 1}` : baseName,
        layer: form.layer,
        site,
        scale: 1,
        machineSpec: { ...machineSpec },
        compatibilityMessage,
        iconKey: form.componentType.toLowerCase().replace(/\s+/g, "-"),
      },
    }));

    setNodes((currentNodes) => [...currentNodes, ...newNodes]);

    const allNodesAfter = [...nodes, ...newNodes];
    const suggestions = suggestConnectionsForNewNodes(newNodes, allNodesAfter, edges);

    if (suggestions.length > 0) {
      setSuggestedConnections({ newNodes, suggestions });
      setSuggestedSelectedIndices(new Set(suggestions.map((_, i) => i)));
      setStatusMessage(
        `Added ${count} node${count > 1 ? "s" : ""}. Choose connections to add below.`,
      );
    } else {
      setStatusMessage(
        `Added ${count} node${count > 1 ? "s" : ""}: ${newNodes.map((n) => n.data.name).join(", ")}. ${compatibilityMessage}`,
      );
    }
  };

  const handleApplySuggestedConnections = () => {
    if (!suggestedConnections) return;
    const selected = suggestedConnections.suggestions.filter((_, i) =>
      suggestedSelectedIndices.has(i),
    );
    setEdges((currentEdges) => addSuggestedEdges(selected, currentEdges));
    setSuggestedConnections(null);
    setSuggestedSelectedIndices(new Set());
    setStatusMessage(`Added ${selected.length} connection(s).`);
  };

  const handleSkipSuggestedConnections = () => {
    setSuggestedConnections(null);
    setSuggestedSelectedIndices(new Set());
    setStatusMessage("Skipped connection suggestions.");
  };

  const toggleSuggestedIndex = (index: number) => {
    setSuggestedSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleAutoArrange = () => {
    setNodes((currentNodes) => computeLayout(currentNodes));
    setStatusMessage("Layout updated: management → search → indexing → collection, grouped by site.");
  };

  const handleExportDrawio = () => {
    downloadDrawioXml(nodes, edges, `splunk-hla-${topology.toLowerCase()}.drawio`);
    setStatusMessage("Exported draw.io XML. Open in draw.io / diagrams.net.");
  };

  const handleCopyDrawioXml = async () => {
    const xml = toDrawioXml(nodes, edges);
    await navigator.clipboard.writeText(xml);
    setStatusMessage("Draw.io XML copied to clipboard. Paste into draw.io or save as .drawio file.");
  };

  const handleExportPdf = async () => {
    const canvas = document.getElementById("diagram-canvas");
    if (!canvas) {
      setStatusMessage("Could not find diagram canvas.");
      return;
    }
    await exportElementToPdf(canvas, `splunk-hla-${topology.toLowerCase()}.pdf`);
    setStatusMessage("Exported PDF successfully.");
  };

  const handleLayerToggle = (layer: keyof LayerVisibility) => {
    setLayerVisibility((current) => ({ ...current, [layer]: !current[layer] }));
  };

  const handleConnectionToggle = (group: keyof ConnectionVisibility) => {
    setConnectionVisibility((current) => ({ ...current, [group]: !current[group] }));
  };

  const updateSelectedNode = (updater: (node: Node<SplunkNodeData>) => Node<SplunkNodeData>) => {
    if (!selectedNodeId) {
      return;
    }
    setNodes((currentNodes) => currentNodes.map((node) => (node.id === selectedNodeId ? updater(node) : node)));
  };

  const removeSelectedNode = () => {
    if (!selectedNodeId) {
      return;
    }
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNodeId));
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
    );
    setStatusMessage("Removed selected component.");
    setSelectedNodeId(null);
  };

  return (
    <div className="app-shell">
      <aside className="panel left-panel">
        <h1>Splunk HLA Designer</h1>
        <p className="muted">Draw.io-style editor for Splunk validated architecture diagrams.</p>

        <section className="panel-section">
          <h2>Topology Baseline</h2>
          <select value={topology} onChange={(event) => handleTopologyChange(event.target.value as TopologyId)}>
            {TOPOLOGY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </select>
          <p className="muted">{TOPOLOGY_OPTIONS.find((item) => item.id === topology)?.description}</p>
        </section>

        <section className="panel-section">
          <h2>Layer Toggles</h2>
          <p className="muted">Show/hide component tiers.</p>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.collection}
              onChange={() => handleLayerToggle("collection")}
            />
            Collection
          </label>
          <label>
            <input type="checkbox" checked={layerVisibility.indexing} onChange={() => handleLayerToggle("indexing")} />
            Indexing
          </label>
          <label>
            <input type="checkbox" checked={layerVisibility.search} onChange={() => handleLayerToggle("search")} />
            Search
          </label>
          <label>
            <input
              type="checkbox"
              checked={layerVisibility.management}
              onChange={() => handleLayerToggle("management")}
            />
            Management
          </label>
        </section>

        <section className="panel-section">
          <h2>Connection / Port Toggles</h2>
          <p className="muted">
            Show/hide by port. Reference:{" "}
            <a
              href="https://help.splunk.com/en/splunk-enterprise/administer/inherit-a-splunk-deployment/9.0/inherited-deployment-tasks/components-and-their-relationship-with-the-network"
              target="_blank"
              rel="noopener noreferrer"
            >
              Splunk components and network
            </a>
          </p>
          <label>
            <input
              type="checkbox"
              checked={connectionVisibility.forwarding}
              onChange={() => handleConnectionToggle("forwarding")}
            />
            {CONNECTION_GROUP_LABELS.forwarding.toggleLabel} ({CONNECTION_GROUP_LABELS.forwarding.ports})
          </label>
          <label>
            <input
              type="checkbox"
              checked={connectionVisibility.search}
              onChange={() => handleConnectionToggle("search")}
            />
            {CONNECTION_GROUP_LABELS.search.toggleLabel} ({CONNECTION_GROUP_LABELS.search.ports})
          </label>
          <label>
            <input
              type="checkbox"
              checked={connectionVisibility.management}
              onChange={() => handleConnectionToggle("management")}
            />
            {CONNECTION_GROUP_LABELS.management.toggleLabel} ({CONNECTION_GROUP_LABELS.management.ports})
          </label>
          <label>
            <input
              type="checkbox"
              checked={connectionVisibility.replication}
              onChange={() => handleConnectionToggle("replication")}
            />
            {CONNECTION_GROUP_LABELS.replication.toggleLabel} ({CONNECTION_GROUP_LABELS.replication.ports})
          </label>
          <label>
            <input
              type="checkbox"
              checked={connectionVisibility.hec}
              onChange={() => handleConnectionToggle("hec")}
            />
            {CONNECTION_GROUP_LABELS.hec.toggleLabel} ({CONNECTION_GROUP_LABELS.hec.ports})
          </label>
          <label>
            <input
              type="checkbox"
              checked={connectionVisibility.license}
              onChange={() => handleConnectionToggle("license")}
            />
            {CONNECTION_GROUP_LABELS.license.toggleLabel} ({CONNECTION_GROUP_LABELS.license.ports})
          </label>
          <label>
            <input
              type="checkbox"
              checked={connectionVisibility.internal_logs}
              onChange={() => handleConnectionToggle("internal_logs")}
            />
            {CONNECTION_GROUP_LABELS.internal_logs.toggleLabel} ({CONNECTION_GROUP_LABELS.internal_logs.ports})
          </label>
          <label>
            <input
              type="checkbox"
              checked={connectionVisibility.other}
              onChange={() => handleConnectionToggle("other")}
            />
            {CONNECTION_GROUP_LABELS.other.toggleLabel}
          </label>
        </section>

        <section className="panel-section">
          <h2>Add Component</h2>
          <select
            value={form.componentType}
            onChange={(event) => setForm((current) => ({ ...current, componentType: event.target.value }))}
          >
            {COMPONENT_TYPES.map((componentType) => (
              <option key={componentType} value={componentType}>
                {componentType}
              </option>
            ))}
          </select>
          <input
            value={form.name}
            placeholder="Component name"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <div className="row two">
            <select
              value={form.layer}
              onChange={(event) =>
                setForm((current) => ({ ...current, layer: event.target.value as ArchitectureLayer }))
              }
            >
              <option value="collection">collection</option>
              <option value="indexing">indexing</option>
              <option value="search">search</option>
              <option value="management">management</option>
            </select>
            <input
              value={form.site}
              placeholder="site"
              onChange={(event) => setForm((current) => ({ ...current, site: event.target.value }))}
            />
          </div>
          <div className="panel-label">Number of instances (e.g. 3 = three nodes)</div>
          <input
            type="number"
            min={1}
            value={form.scale}
            onChange={(event) => setForm((current) => ({ ...current, scale: Number(event.target.value) }))}
          />

          <h3>Machine Spec</h3>
          <div className="row two">
            <select
              value={form.provider}
              onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as CloudProvider }))}
            >
              <option value="none">none</option>
              <option value="aws">aws</option>
              <option value="azure">azure</option>
              <option value="custom">custom</option>
            </select>
            {form.provider === "aws" || form.provider === "azure" ? (
              <select
                value={form.instanceType}
                onChange={(event) => setForm((current) => ({ ...current, instanceType: event.target.value }))}
              >
                <option value="">Select {form.provider} instance</option>
                {providerInstances.map((instance) => (
                  <option key={instance.instanceType} value={instance.instanceType}>
                    {instance.instanceType}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={form.instanceType}
                placeholder="instance type"
                onChange={(event) => setForm((current) => ({ ...current, instanceType: event.target.value }))}
              />
            )}
          </div>

          {form.provider === "custom" && (
            <div className="row three">
              <input
                type="number"
                min={1}
                value={form.cpu}
                placeholder="cpu"
                onChange={(event) => setForm((current) => ({ ...current, cpu: Number(event.target.value) }))}
              />
              <input
                type="number"
                min={1}
                value={form.ramGb}
                placeholder="ram"
                onChange={(event) => setForm((current) => ({ ...current, ramGb: Number(event.target.value) }))}
              />
              <input
                type="number"
                min={1}
                value={form.storageGb}
                placeholder="storage"
                onChange={(event) => setForm((current) => ({ ...current, storageGb: Number(event.target.value) }))}
              />
            </div>
          )}

          <div className="row three">
            <input
              value={form.osName}
              placeholder="OS name"
              onChange={(event) => setForm((current) => ({ ...current, osName: event.target.value }))}
            />
            <input
              value={form.osVersion}
              placeholder="OS version"
              onChange={(event) => setForm((current) => ({ ...current, osVersion: event.target.value }))}
            />
            <select
              value={form.splunkVersion}
              onChange={(event) => setForm((current) => ({ ...current, splunkVersion: event.target.value }))}
            >
              {SPLUNK_VERSIONS.map((version) => (
                <option key={version} value={version}>
                  Splunk {version}
                </option>
              ))}
            </select>
          </div>
          <p className="muted">Supported OS for Splunk {form.splunkVersion}: {supportedOs.join(", ") || "none"}</p>
          <button onClick={handleAddComponent}>Add Component</button>
        </section>
      </aside>

      <main id="diagram-canvas" className="diagram-area">
        <div className="toolbar">
          <button onClick={handleAutoArrange}>Auto-arrange</button>
          <button onClick={handleExportPdf}>Export PDF</button>
          <button onClick={handleExportDrawio}>Export draw.io</button>
          <button onClick={() => setShowDrawioXml(true)}>View draw.io XML</button>
          <span>{statusMessage}</span>
        </div>
        {showDrawioXml && (
          <div className="drawio-xml-overlay" role="dialog" aria-label="Draw.io XML">
            <div className="drawio-xml-modal">
              <div className="drawio-xml-header">
                <h3>Draw.io XML</h3>
                <button type="button" onClick={() => setShowDrawioXml(false)} className="drawio-xml-close">
                  Close
                </button>
              </div>
              <p className="muted">Save as .drawio or .xml and open in draw.io / diagrams.net, or copy and paste.</p>
              <textarea
                className="drawio-xml-textarea"
                readOnly
                value={toDrawioXml(nodes, edges)}
                spellCheck={false}
              />
              <div className="drawio-xml-actions">
                <button type="button" onClick={handleCopyDrawioXml}>
                  Copy to clipboard
                </button>
                <button type="button" onClick={handleExportDrawio}>
                  Download .drawio file
                </button>
                <button type="button" onClick={() => setShowDrawioXml(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        {suggestedConnections && (
          <div className="drawio-xml-overlay" role="dialog" aria-label="Suggested connections">
            <div className="drawio-xml-modal suggested-connections-modal">
              <div className="drawio-xml-header">
                <h3>Add connections?</h3>
                <button type="button" onClick={handleSkipSuggestedConnections} className="drawio-xml-close">
                  Skip
                </button>
              </div>
              <p className="muted">
                Select which links to add. Uncheck any you don’t want. License Manager: connect indexers/SHs to it.
                Internal logs: any host can send its own logs to indexers.
              </p>
              <div className="suggested-connections-list">
                {suggestedConnections.suggestions.map((s, i) => (
                  <label key={i} className="suggested-connection-item">
                    <input
                      type="checkbox"
                      checked={suggestedSelectedIndices.has(i)}
                      onChange={() => toggleSuggestedIndex(i)}
                    />
                    <span>
                      <strong>{s.sourceName}</strong> → <strong>{s.targetName}</strong>: {s.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="drawio-xml-actions">
                <button type="button" onClick={handleApplySuggestedConnections}>
                  Add selected ({suggestedSelectedIndices.size})
                </button>
                <button type="button" onClick={handleSkipSuggestedConnections}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="react-flow-wrapper">
          <ReactFlow
            nodeTypes={nodeTypes}
            nodes={visibleNodes}
            edges={visibleEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
          >
            <MiniMap zoomable pannable />
            <Controls />
            <Background gap={20} />
          </ReactFlow>
        </div>
      </main>

      <aside className="panel right-panel">
        <h2>Inspector</h2>
        {!selectedNode && <p className="muted">Select a component to edit name, site, and software details.</p>}
        {selectedNode && (
          <>
            <input
              value={selectedNode.data.name}
              onChange={(event) =>
                updateSelectedNode((node) => ({
                  ...node,
                  data: { ...node.data, name: event.target.value },
                }))
              }
            />
            <input
              value={selectedNode.data.site}
              placeholder="Site"
              onChange={(event) =>
                updateSelectedNode((node) => ({
                  ...node,
                  data: { ...node.data, site: event.target.value },
                }))
              }
            />
            <select
              value={selectedNode.data.layer}
              onChange={(event) =>
                updateSelectedNode((node) => ({
                  ...node,
                  data: { ...node.data, layer: event.target.value as ArchitectureLayer },
                }))
              }
            >
              <option value="collection">collection</option>
              <option value="indexing">indexing</option>
              <option value="search">search</option>
              <option value="management">management</option>
            </select>
            <div className="row two">
              <input
                value={selectedNode.data.machineSpec.osName}
                onChange={(event) =>
                  updateSelectedNode((node) => {
                    const machineSpec = { ...node.data.machineSpec, osName: event.target.value };
                    return {
                      ...node,
                      data: { ...node.data, machineSpec, compatibilityMessage: compatibilityFor(machineSpec) },
                    };
                  })
                }
              />
              <input
                value={selectedNode.data.machineSpec.osVersion}
                onChange={(event) =>
                  updateSelectedNode((node) => {
                    const machineSpec = { ...node.data.machineSpec, osVersion: event.target.value };
                    return {
                      ...node,
                      data: { ...node.data, machineSpec, compatibilityMessage: compatibilityFor(machineSpec) },
                    };
                  })
                }
              />
            </div>
            <select
              value={selectedNode.data.machineSpec.splunkVersion}
              onChange={(event) =>
                updateSelectedNode((node) => {
                  const machineSpec = { ...node.data.machineSpec, splunkVersion: event.target.value };
                  return {
                    ...node,
                    data: { ...node.data, machineSpec, compatibilityMessage: compatibilityFor(machineSpec) },
                  };
                })
              }
            >
              {SPLUNK_VERSIONS.map((version) => (
                <option key={version} value={version}>
                  Splunk {version}
                </option>
              ))}
            </select>
            <p className="muted">{selectedNode.data.compatibilityMessage}</p>
            <button className="danger" onClick={removeSelectedNode}>
              Delete Component
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

export default App;
