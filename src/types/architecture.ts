export type TopologyId = "S1" | "D1" | "C3" | "M3" | "CLOUD";

export type ArchitectureLayer = "collection" | "indexing" | "search" | "management";

export type CloudProvider = "none" | "aws" | "azure" | "custom";

export interface MachineSpec {
  provider: CloudProvider;
  instanceType: string;
  cpu: number;
  ramGb: number;
  storageGb: number;
  osName: string;
  osVersion: string;
  splunkVersion: string;
  isCustom: boolean;
}

export interface SplunkNodeData {
  componentType: string;
  name: string;
  layer: ArchitectureLayer;
  site: string;
  scale: number;
  machineSpec: MachineSpec;
  compatibilityMessage: string;
  iconKey: string;
}

export interface TopologyOption {
  id: TopologyId;
  title: string;
  description: string;
}

export interface OsSupportEntry {
  name: string;
  minVersion: string;
}

export interface SplunkCompatibilityEntry {
  splunkVersion: string;
  supportedOs: OsSupportEntry[];
}

export interface SplunkCompatibilityMatrix {
  schemaVersion: string;
  matrix: SplunkCompatibilityEntry[];
}
