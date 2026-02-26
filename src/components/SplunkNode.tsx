import { Handle, Position, type NodeProps } from "reactflow";
import type { SplunkNodeData } from "../types/architecture";
import "./SplunkNode.css";

const layerClassMap = {
  collection: "layer-collection",
  indexing: "layer-indexing",
  search: "layer-search",
  management: "layer-management",
};

function iconTextFor(componentType: string): string {
  const words = componentType.split(" ").filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function SplunkNode({ data, selected }: NodeProps<SplunkNodeData>) {
  const compatibilityClass = data.compatibilityMessage.startsWith("Compatible:") ? "ok" : "warn";

  return (
    <div className={`splunk-node ${layerClassMap[data.layer]} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="splunk-node__header">
        <div className="splunk-node__icon" title={`Icon placeholder for ${data.iconKey}`}>
          {iconTextFor(data.componentType)}
        </div>
        <div>
          <div className="splunk-node__name">{data.name}</div>
          <div className="splunk-node__type">{data.componentType}</div>
        </div>
      </div>
      <div className="splunk-node__meta">
        <span>{data.site}</span>
      </div>
      <div className="splunk-node__meta">
        <span>{data.machineSpec.osName}</span>
        <span>Splunk {data.machineSpec.splunkVersion}</span>
      </div>
      <div className={`splunk-node__compat ${compatibilityClass}`}>{data.compatibilityMessage}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
