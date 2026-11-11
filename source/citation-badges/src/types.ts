export interface Definition {
  id: string;
  from: number;
  to: number;
  content: string;
}

export interface Reference {
  kind: 'standard' | 'inline';
  sourceId: string;
  from: number;
  to: number;
  number: number | null;
  occurrence: number;
  definition: Definition | null;
  content: string;
}

export interface Cluster {
  from: number;
  to: number;
  members: Reference[];
  numbers: number[];
  label: string;
}

export interface DocumentModel {
  source: string;
  definitions: Map<string, Definition>;
  references: Reference[];
  clusters: Cluster[];
}
