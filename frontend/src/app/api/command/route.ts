import { openai } from '@ai-sdk/openai';
import { generateText, tool, generateObject } from 'ai';
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

  console.log('\n--- CONVERSATION HISTORY & MEMORY ---');
  console.log('USER PROMPT:', prompt);

  // Summarize context for the AI
  const currentNodesSummary = context?.nodes?.map((n: any) => `- ${n.id} (${n.data?.label})`).join('\n') || 'None';
  const currentEdgesSummary = context?.edges?.map((e: any) => `- ${e.source} -> ${e.target}`).join('\n') || 'None';

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      system: `You are the Workflow Architect. Convert the user's exact request into a sequence of logical operations.
      
      Nodes available:
      ${Object.entries(NODE_TYPES).map(([id, n]) => `- ${id}: ${n.label} (${n.desc})`).join('\n')}
      
      CRITICAL RULES:
      1. Map the user's request strictly to the exact node types available.
      2. Do NOT add any nodes that the user did not explicitly ask for.
      3. For each step, specify the "node_name" (which must be a valid node type), its "source" (the node type it receives data from, or "none"), and its "target" (the node type it sends data to, or "none").
      4. Ensure a logical directed flow from sources to sinks.`,
      prompt,
      schema: z.object({
        workflow: z.array(z.object({
          node_name: z.string(),
          source: z.string(),
          target: z.string()
        }))
      })
    });

    // Double-checking loop to prevent hallucinations and unrequested nodes
    const { object: verifiedObject } = await generateObject({
      model: openai('gpt-4o-mini'),
      system: `You are the strict Quality Assurance Architect. 
      Your only job is to review a proposed workflow against the original user prompt and remove ANY nodes that the user did not explicitly request.
      Also, remove any completely disconnected nodes (nodes where both source and target are 'none' in a multi-node graph).`,
      prompt: `Original User Request: "${prompt}"
      Proposed Workflow:
      ${JSON.stringify(object.workflow, null, 2)}
      
      Return the corrected workflow exactly matching the original request without unrequested fluff.`,
      schema: z.object({
        workflow: z.array(z.object({
          node_name: z.string(),
          source: z.string(),
          target: z.string()
        }))
      })
    });

    // Swap the original hallucinated object for the verified one
    const finalObject = verifiedObject;

    console.log('AGENT GENERATED RAW WORKFLOW:', JSON.stringify(object.workflow, null, 2));
    console.log('QA LOOP VERIFIED WORKFLOW:', JSON.stringify(finalObject.workflow, null, 2));

    // Hardcoded logic to build the workflow from the simple sequence
    console.log(`[Architect] Opening connection for workflow update...`);
    let socket: Socket;
    try {
      socket = await connectSocket();
    } catch (err) {
      console.error('Failed to connect socket:', err);
      return Response.json({ error: 'WebSocket connection failed' }, { status: 500 });
    }

    try {
      const nodeInstances = new Map<string, string>(); // Maps node_type to instance_id
      let idCounter = 1;
      
      const emittedNodes = new Set<string>();
      const emittedEdges = new Set<string>();
      
      // Track edges we want to draw, and draw them AS SOON as both nodes exist
      const pendingEdges: { id: string, source: string, target: string }[] = [];

      for (const step of finalObject.workflow) {
        // Collect types mentioned in this step
        const typesToProcess = [];
        if (step.source && step.source !== 'none') typesToProcess.push(step.source);
        if (step.node_name && step.node_name !== 'none') typesToProcess.push(step.node_name);
        if (step.target && step.target !== 'none') typesToProcess.push(step.target);

        // 1. Assign IDs to any newly seen nodes
        for (const type of typesToProcess) {
          if (!nodeInstances.has(type)) {
            nodeInstances.set(type, `${type}_${idCounter++}`);
          }
        }

        // 2. Register desired edges from this step
        const currentType = step.node_name;
        if (currentType && currentType !== 'none') {
          const currentId = nodeInstances.get(currentType)!;
          
          if (step.source && step.source !== 'none') {
            const sourceId = nodeInstances.get(step.source)!;
            const edgeId = `e-${sourceId}-${currentId}`;
            pendingEdges.push({ id: edgeId, source: sourceId, target: currentId });
          }
          if (step.target && step.target !== 'none') {
            const targetId = nodeInstances.get(step.target)!;
            const edgeId = `e-${currentId}-${targetId}`;
            pendingEdges.push({ id: edgeId, source: currentId, target: targetId });
          }
        }

        // 3. Emit nodes sequentially, immediately drawing any edges that become valid
        for (const type of typesToProcess) {
          const typeKey = type as keyof typeof NODE_TYPES;
          if (!NODE_TYPES[typeKey]) continue; // Skip invalid nodes

          const nodeId = nodeInstances.get(type)!;

          if (!emittedNodes.has(nodeId)) {
            const nodeInfo = NODE_TYPES[typeKey];
            socket.emit('UI_COMMAND:ADD_NODE', { 
              id: nodeId, 
              type: 'workflowNode', 
              data: { 
                label: nodeInfo.label, 
                description: nodeInfo.desc,
                icon: nodeInfo.icon,
                color: nodeInfo.color
              } 
            });
            emittedNodes.add(nodeId);
            console.log(`[Architect] Emitted Node: ${nodeId}`);
            await new Promise(r => setTimeout(r, 600)); // Delay for node render

            // Check if any pending edges can be drawn now that this node exists
            let i = 0;
            while (i < pendingEdges.length) {
              const edge = pendingEdges[i];
              if (emittedNodes.has(edge.source) && emittedNodes.has(edge.target)) {
                if (!emittedEdges.has(edge.id)) {
                  socket.emit('UI_COMMAND:ADD_EDGE', { 
                    id: edge.id, 
                    source: edge.source, 
                    target: edge.target,
                    animated: true 
                  });
                  emittedEdges.add(edge.id);
                  console.log(`[Architect] Emitted Edge: ${edge.source} -> ${edge.target}`);
                  await new Promise(r => setTimeout(r, 400)); // Delay for edge render
                }
                pendingEdges.splice(i, 1); // Remove from queue
              } else {
                i++;
              }
            }
          }
        }
      }
    } finally {
      await new Promise(r => setTimeout(r, 500));
      socket.disconnect();
      console.log(`[Architect] Connection closed.`);
    }

    console.log('-------------------------------------\n');
    return Response.json({ text: 'Workflow created successfully.' });
  } catch (error: any) {
    console.error('AI Workflow Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
