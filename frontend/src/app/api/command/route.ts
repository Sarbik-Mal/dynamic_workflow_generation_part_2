import { openai } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { io, Socket } from 'socket.io-client';
import { NODE_TYPES } from '@/lib/nodes';

// Helper to connect once and return a socket promise
const connectSocket = () => {
  const socket = io('http://localhost:4000', {
    transports: ['websocket'],
  });

  return new Promise<Socket>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timed out'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });
  });
};

export async function POST(req: Request) {
  const { prompt, context } = await req.json(); // RECEIVING MEMORY

  // Summarize context for the AI
  const currentNodesSummary = context?.nodes?.map((n: any) => `- ${n.id} (${n.data?.label})`).join('\n') || 'None';
  const currentEdgesSummary = context?.edges?.map((e: any) => `- ${e.source} -> ${e.target}`).join('\n') || 'None';

  try {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: `You are the Workflow Architect with Graph Memory.
      You can see the current canvas and build upon it or modify it.
      
      Nodes available:
      ${Object.entries(NODE_TYPES).map(([id, n]) => `- ${id}: ${n.label} (${n.desc})`).join('\n')}
      
      CURRENT CANVAS STATE:
      Nodes:
      ${currentNodesSummary}
      
      Edges:
      ${currentEdgesSummary}
      
      CRITICAL RULES:
      1. If the user asks for a feature that already exists, don't recreate it.
      2. When adding new nodes, ensure they are logically connected to the existing graph.
      3. Use internally consistent IDs. If you reference an existing node, use its exact ID from the summary.
      4. Always think in terms of the COMPLETE architecture.`,
      prompt,
      tools: {
        createWorkflow: tool({
          description: 'Add new nodes and edges to the existing workflow',
          inputSchema: z.object({
            nodes: z.array(z.object({
              id: z.string().describe('Unique ID for the node'),
              type: z.enum(Object.keys(NODE_TYPES) as [string, ...string[]]),
            })),
            edges: z.array(z.object({
              source: z.string().describe('ID of the source node'),
              target: z.string().describe('ID of the target node'),
            })),
          }),
          execute: async ({ nodes, edges }) => {
            console.log(`[Architect] Opening connection for workflow update...`);
            
            let socket: Socket;
            try {
              socket = await connectSocket();
            } catch (err) {
              console.error('Failed to connect socket:', err);
              return { error: 'WebSocket connection failed' };
            }

            // Track what we've rendered in THIS session
            const newNodes = new Set<string>();
            // Add existing nodes to the set so we don't think they are missing context
            context?.nodes?.forEach((n: any) => newNodes.add(n.id));

            const remainingEdges = [...edges];

            try {
              for (const n of nodes) {
                // Only emit if it doesn't already exist on canvas
                const exists = context?.nodes?.some((existing: any) => existing.id === n.id);
                
                if (!exists) {
                  const nodeInfo = NODE_TYPES[n.type as keyof typeof NODE_TYPES];
                  socket.emit('UI_COMMAND:ADD_NODE', { 
                    id: n.id, 
                    type: 'workflowNode', 
                    data: { 
                      label: nodeInfo.label, 
                      description: nodeInfo.desc,
                      icon: nodeInfo.icon,
                      color: nodeInfo.color // RESTORED COLOR
                    } 
                  });
                  newNodes.add(n.id);
                  console.log(`[Architect] Emitted Node: ${n.id}`);
                  await new Promise(r => setTimeout(r, 800));
                }

                // Try to emit edges as nodes become available
                let foundEdge = true;
                while (foundEdge) {
                  foundEdge = false;
                  for (let i = 0; i < remainingEdges.length; i++) {
                    const e = remainingEdges[i];
                    if (newNodes.has(e.source) && newNodes.has(e.target)) {
                      // Check if edge already exists
                      const edgeExists = context?.edges?.some((ex: any) => ex.source === e.source && ex.target === e.target);
                      if (!edgeExists) {
                        socket.emit('UI_COMMAND:ADD_EDGE', { 
                          id: `e-${e.source}-${e.target}`, 
                          source: e.source, 
                          target: e.target,
                          animated: true 
                        });
                        console.log(`[Architect] Emitted Edge: ${e.source} -> ${e.target}`);
                        await new Promise(r => setTimeout(r, 400));
                      }
                      remainingEdges.splice(i, 1);
                      foundEdge = true;
                      break; 
                    }
                  }
                }
              }
            } finally {
              await new Promise(r => setTimeout(r, 500));
              socket.disconnect();
              console.log(`[Architect] Connection closed.`);
            }

            return { success: true };
          },
        }),
      },
    });

    return Response.json({ text: result.text });
  } catch (error: any) {
    console.error('AI Workflow Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
