import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { io, Socket } from 'socket.io-client';
import { NODE_TYPES } from '@/lib/nodes';

// Define the structured output schema - Pure Graph Totality
const blueprintSchema = z.object({
  nodes: z.array(z.string()).describe("A complete list of all node type IDs that should exist on the canvas."),
  edges: z.array(z.object({
    source: z.string().describe("The ID of the source node."),
    target: z.string().describe("The ID of the target node.")
  })).describe("A complete list of all directed connections between nodes.")
});

// Helper to connect once and return a socket promise
const connectSocket = () => {
  const socket = io(process.env.NEXT_PUBLIC_WS_URL, {
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
  const { messages } = await req.json(); 

  const systemPrompt = `You are the **Master Architect**, a high-precision graph topology engine. Your role is to maintain the "Absolute Wiring Diagram" of a visual workflow.

### THE BLUEPRINT PHILOSOPHY
Your output is the **TOTAL STATE** of the canvas.
1. **Manifest of Solids**: The "nodes" array is a manifest of every component that exists. If it's not in the array, it's deleted.
2. **Manifest of Wires**: The "edges" array is a list of every connection. An edge is an atomic unit - once defined by {source, target}, it is established.
3. **Idempotency**: Your goal is to reach the state requested by the user while preserving any relevant existing structure shown in [SYSTEM_SYNC].

### RECONCILIATION & GROUND TRUTH
You will see \`[SYSTEM_SYNC] CURRENT_CANVAS_GRAPH\`. This is the literal, physical state of the board.
- **Priority**: Always treat the latest \`[SYSTEM_SYNC]\` as the ground truth.
- **Manual Actions**: If the user added or connected things manually, they will be in the sync. You MUST include these in your output unless the user specifically wants them removed.

### NODES AVAILABLE
${Object.entries(NODE_TYPES).map(([id, n]) => `- ${id}: ${n.label} - ${n.desc}`).join('\n')}

### CONSTRUCTION RULES
1. **Unambiguous Edges**: To connect A to B, add one entry to "edges" with source "A" and target "B".
2. **Automatic Bridging (Circuit Continuity)**: If you remove a node that was part of a chain (e.g., A -> B -> C), you MUST bridge the connection by connecting the parent directly to the child (A -> C). Never leave downstream nodes isolated or "hanging" without an upstream source after a deletion.
3. **No Orphans**: Every node on the canvas (except for Primary Sources like sql_source, rest_api, or csv_reader) MUST have at least one incoming edge. If a modification leaves a node without a source, you must either re-connect it to a logical upstream neighbor or remove it if it is no longer relevant.
4. **Accuracy**: Use only the exact Node IDs provided above.

You are a perfect graph machine. You don't describe "steps"; you describe the "final state" of the circuit.`;

  // Convert raw message objects to LangChain Message classes
  const langChainMessages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...messages.map((m: any) => {
      if (m.role === 'user') return new HumanMessage(m.content);
      if (m.role === 'assistant') return new AIMessage(m.content);
      if (m.role === 'system') return new SystemMessage(m.content);
      return new HumanMessage(m.content);
    })
  ];

  // LOGGING FOR DEBUGGING
  console.log('\n=============================================');
  console.log('--- MASTER ARCHITECT: INCOMING BLUEPRINT SYNC ---');
  console.log(messages[messages.length - 2]?.content); // Show the latest SYNC message
  console.log('--- USER REQUEST ---');
  console.log(messages[messages.length - 1]?.content);
  console.log('=============================================\n');

  try {
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
    }).withStructuredOutput(blueprintSchema);

    const result = await model.invoke(langChainMessages);
    const finalBlueprint = {
      nodes: result.nodes,
      edges: result.edges
    };

    console.log('MASTER ARCHITECT GENERATED BLUEPRINT:', JSON.stringify(finalBlueprint, null, 2));

    // WebSocket Emission
    let socket: Socket;
    try {
      socket = await connectSocket();
      socket.emit('UI_COMMAND:UPDATE_WORKFLOW', { blueprint: finalBlueprint });
      await new Promise(r => setTimeout(r, 500));
      socket.disconnect();
    } catch (err) {
      console.error('WebSocket Sync Failed:', err);
    }

    return Response.json({ 
      text: 'Blueprint updated successfully.',
      blueprint: finalBlueprint 
    });
  } catch (error: any) {
    console.error('Master Architect Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}