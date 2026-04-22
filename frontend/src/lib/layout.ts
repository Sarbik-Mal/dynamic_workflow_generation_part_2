import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  // Increased spacing for a premium "breathing" feel
  'elk.layered.spacing.nodeNodeLayer': '160', 
  'elk.spacing.nodeNode': '120',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
  'elk.alignment': 'CENTER',
  // Better crossing minimization
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
};

export const getLayoutedElements = async (nodes: any[], edges: any[]) => {
  const isHorizontal = elkOptions['elk.direction'] === 'RIGHT';
  
  // Safety check: Filter out edges that reference non-existent nodes to prevent ELK.js crashes
  const validNodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target));

  const graph: any = {
    id: 'root',
    layoutOptions: elkOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: 260, // Adjusted to match w-60 cards + padding breathing room
      height: 140, // Account for text and description height
    })),
    edges: validEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layoutedGraph = await elk.layout(graph);

  return {
    nodes: nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
      return {
        ...node,
        position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
        // Ensure React Flow knows the node has a new position
        style: { ...node.style, opacity: 1 },
      };
    }),
    edges,
  };
};
