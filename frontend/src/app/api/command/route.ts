import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { io, Socket } from 'socket.io-client';
import { NODE_TYPES } from '@/lib/nodes';

// Helper to connect once and return a socket promise
const connectSocket = () => {
  const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
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
  // Receive the conversation history (user and assistant messages) from the frontend
  const { messages } = await req.json(); 

  const systemPrompt = `You are the Workflow Architect. Convert the user's exact request into a sequence of logical operations.
      
Nodes available:
${Object.entries(NODE_TYPES).map(([id, n]) => `- ${id}: ${n.label} (${n.desc})`).join('\n')}

CRITICAL RULES:
1. Map the user's request strictly to the exact node types available.
2. Do NOT add any nodes that the user did not explicitly ask for.
3. For each step, specify the "node_name" (which must be a valid node type), its "source" (the node type it receives data from, or "none"), and its "target" (the node type it sends data to, or "none").
4. Ensure a logical directed flow from sources to sinks.
5. Consider the conversation history to understand what nodes have already been added or modified.`;

  // Combine system prompt with the ongoing conversation history
  const fullMemory = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  // Print the complete memory payload to the terminal
  console.log('\n=============================================');
  console.log('--- FULL CONVERSATION HISTORY & MEMORY ---');
  console.log(JSON.stringify(fullMemory, null, 2));
  console.log('=============================================\n');

  try {
    // Generate the workflow sequence using the full memory array
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      messages: fullMemory as any, // AI SDK accepts the combined system/user/assistant array
      schema: z.object({
        workflow: z.array(z.object({
          node_name: z.string(),
          source: z.string(),
          target: z.string()
        }))
      })
    });

    const finalObject = object;

    console.log('AGENT GENERATED RAW WORKFLOW:', JSON.stringify(finalObject.workflow, null, 2));

    console.log(`[Architect] Opening connection for workflow update...`);
    let socket: Socket;
    try {
      socket = await connectSocket();
    } catch (err) {
      console.error('Failed to connect socket:', err);
      return Response.json({ error: 'WebSocket connection failed' }, { status: 500 });
    }

    try {
      const nodeInstances = new Map<string, string>(); 
      let idCounter = 1;
      
      const emittedNodes = new Set<string>();
      const emittedEdges = new Set<string>();
      const pendingEdges: { id: string, source: string, target: string }[] = [];

      for (const step of finalObject.workflow) {
        const typesToProcess = [];
        if (step.source && step.source !== 'none') typesToProcess.push(step.source);
        if (step.node_name && step.node_name !== 'none') typesToProcess.push(step.node_name);
        if (step.target && step.target !== 'none') typesToProcess.push(step.target);

        for (const type of typesToProcess) {
          if (!nodeInstances.has(type)) {
            nodeInstances.set(type, `${type}_${idCounter++}`);
          }
        }

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

        for (const type of typesToProcess) {
          const typeKey = type as keyof typeof NODE_TYPES;
          if (!NODE_TYPES[typeKey]) continue; 

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
            
            // Restored the Node emission log
            console.log(`[Architect] Emitted Node: ${nodeId}`);
            
            await new Promise(r => setTimeout(r, 600)); 

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
                  
                  // Restored the Edge emission log
                  console.log(`[Architect] Emitted Edge: ${edge.source} -> ${edge.target}`);
                  
                  await new Promise(r => setTimeout(r, 400)); 
                }
                pendingEdges.splice(i, 1); 
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
      
      // Restored the connection close log
      console.log(`[Architect] Connection closed.`);
    }

    console.log('-------------------------------------\n');
    
    return Response.json({ 
      text: 'Workflow created successfully.',
      workflow: finalObject.workflow // Sent back to append to the assistant's memory
    });
  } catch (error: any) {
    console.error('AI Workflow Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}