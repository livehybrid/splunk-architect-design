import type { CloudProvider } from "../types/architecture";

export interface InstancePreset {
  provider: Exclude<CloudProvider, "none" | "custom">;
  instanceType: string;
  cpu: number;
  ramGb: number;
  storageGb: number;
  description: string;
}

export const INSTANCE_CATALOG: InstancePreset[] = [
  {
    provider: "aws",
    instanceType: "m6i.2xlarge",
    cpu: 8,
    ramGb: 32,
    storageGb: 500,
    description: "General purpose for management and light indexing.",
  },
  {
    provider: "aws",
    instanceType: "i4i.4xlarge",
    cpu: 16,
    ramGb: 128,
    storageGb: 3750,
    description: "High IOPS profile for indexer-heavy workloads.",
  },
  {
    provider: "azure",
    instanceType: "D8s_v5",
    cpu: 8,
    ramGb: 32,
    storageGb: 512,
    description: "Balanced profile for search and management tiers.",
  },
  {
    provider: "azure",
    instanceType: "E16ds_v5",
    cpu: 16,
    ramGb: 128,
    storageGb: 1024,
    description: "Memory-optimized profile for index/search workloads.",
  },
];

export function getInstancesByProvider(provider: CloudProvider): InstancePreset[] {
  if (provider !== "aws" && provider !== "azure") {
    return [];
  }
  return INSTANCE_CATALOG.filter((instance) => instance.provider === provider);
}
