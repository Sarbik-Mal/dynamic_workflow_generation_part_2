import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { io, Socket } from 'socket.io-client';
import { NODE_TYPES } from '@/lib/nodes';

// Define the structured output schema - Pure Graph Totality
const blueprintSchema = z.object({
  message: z.string().describe("A conversational message to the user explaining the changes or just chatting."),
  workflow_data: z.object({
    nodes: z.array(z.string()).describe("A complete list of all node type IDs that should exist on the canvas."),
    edges: z.array(z.object({
      source: z.string().describe("The ID of the source node."),
      target: z.string().describe("The ID of the target node.")
    })).describe("A complete list of all directed connections between nodes.")
  }).nullable().describe("The structured workflow data. Only include if there are changes to the workflow or if the user asks for a workflow. Otherwise return null.")
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

  const systemPrompt = `You are the **Master Architect**, a high-precision graph topology engine and conversational partner. Your role is to maintain the "Absolute Wiring Diagram" of a visual workflow while engaging with the user about their plans.

### THE RESPONSE STRUCTURE
Your output consists of two main parts:
1. **message**: A conversational message to the user explaining your logic, thoughts, or just chatting. This is your primary way of communicating with the human.
2. **workflow_data**: The TOTAL STATE of the canvas. This field is required but can be null. Only provide the full object if you are making changes to the graph, reverting to a state, or if the user explicitly asks for a workflow. If no changes are needed, return null.

### THE BLUEPRINT PHILOSOPHY (within workflow_data)
1. **Manifest of Solids**: The "nodes" array is a manifest of every component that exists. If it's not in the array, it's deleted.
2. **Manifest of Wires**: The "edges" array is a list of every connection. An edge is an atomic unit - once defined by {source, target}, it is established.
3. **Idempotency**: Your goal is to reach the state requested by the user while preserving any relevant existing structure.
4. **Temporal Reversion (ANTI-HALLUCINATION)**: If the user asks to "revert", "go back", or "undo", you MUST locate the specific historical state in the conversation history (marked as \`[PAST_SYNC]\`) that corresponds to their request. Copy that state exactly into "workflow_data". **DO NOT invent new nodes or include nodes from the current state that were not present in the historical snapshot.**

### THE SNAPSHOT SYSTEM
- \`[CURRENT_SYNC]\`: The literal, physical state of the board right now.
- \`[PAST_SYNC]\`: Historical snapshots of what the board looked like at previous steps.
- **Priority**: Use \`[PAST_SYNC]\` as the source of truth for all "revert" or "undo" requests. Use \`[CURRENT_SYNC]\` for all "add/modify" requests.

### NODES AVAILABLE
${Object.entries(NODE_TYPES).map(([id, n]) => `- ${id}: ${n.label} - ${n.desc}`).join('\n')}

### CONSTRUCTION RULES (within workflow_data)
1. **Unambiguous Edges**: To connect A to B, add one entry to "edges" with source "A" and target "B".
2. **Automatic Bridging**: If you remove a node that was part of a chain (e.g., A -> B -> C), bridge the connection (A -> C).
3. **No Orphans**: Every node (except Primary Sources) MUST have an incoming edge.
4. **Strict Memory Protocol**: You have a perfect log of the graph's evolution through \`[PAST_SYNC]\` messages. When asked to "go back to the 1st workflow", scroll to the very first \`[CURRENT_SYNC]\` or \`[PAST_SYNC]\` that contained nodes and replicate it perfectly. 
5. **No Spontaneous Creation**: NEVER add nodes from the "NODES AVAILABLE" list unless the user explicitly names them or their function in the current request. Do not "fill in the blanks" during a reversion.
6. **Accuracy**: Use only the exact Node IDs provided above.

You are a perfect graph machine and a helpful assistant. Talk to the user in the "message" field and build the circuit in the "workflow_data" field.`;

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
    
    console.log('MASTER ARCHITECT GENERATED RESPONSE:', JSON.stringify(result, null, 2));

    return Response.json({ 
      message: result.message,
      blueprint: result.workflow_data || null
    });
  } catch (error: any) {
    console.error('Master Architect Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}