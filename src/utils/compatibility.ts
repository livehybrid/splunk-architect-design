import matrixData from "../data/splunk-os-compatibility.json";
import type { SplunkCompatibilityMatrix } from "../types/architecture";

const matrix = matrixData as SplunkCompatibilityMatrix;

function toVersionValue(version: string): number {
  const [major = "0", minor = "0"] = version.split(".");
  return Number(major) * 1000 + Number(minor);
}

export function checkOsCompatibility(splunkVersion: string, osName: string, osVersion: string): string {
  const entry = matrix.matrix.find((item) => item.splunkVersion === splunkVersion);
  if (!entry) {
    return `Splunk ${splunkVersion} is not currently in the local support matrix.`;
  }

  const osEntry = entry.supportedOs.find((item) => item.name.toLowerCase() === osName.toLowerCase());
  if (!osEntry) {
    return `${osName} is not listed for Splunk ${splunkVersion}.`;
  }

  if (toVersionValue(osVersion) < toVersionValue(osEntry.minVersion)) {
    return `${osName} ${osVersion} is below minimum supported version ${osEntry.minVersion} for Splunk ${splunkVersion}.`;
  }

  return `Compatible: ${osName} ${osVersion} supports Splunk ${splunkVersion}.`;
}

export function getSupportedOsForSplunk(splunkVersion: string): string[] {
  const entry = matrix.matrix.find((item) => item.splunkVersion === splunkVersion);
  if (!entry) {
    return [];
  }
  return entry.supportedOs.map((item) => item.name);
}
