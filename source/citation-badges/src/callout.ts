import type { Cluster, DocumentModel } from './types';

/** Native Live Preview parses callouts without the document's footnote definitions. */
export function prepareCallout(model: DocumentModel, from: number, to: number): {
  source: string;
  clusters: Cluster[];
} {
  const clusters = model.clusters.filter(cluster => cluster.from >= from && cluster.to <= to);
  let source = model.source.slice(from, to);
  for (let index = clusters.length - 1; index >= 0; index--) {
    const cluster = clusters[index];
    source = source.slice(0, cluster.from - from)
      + `<span data-citation-callout="${index}"></span>`
      + source.slice(cluster.to - from);
  }
  return { source, clusters };
}
