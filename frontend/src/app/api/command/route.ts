import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { io, Socket } from 'socket.io-client';
import { NODE_TYPES } from '@/lib/nodes';

// Define the structured output schema
const workflowSchema = z.object({
  workflow: z.array(z.object({
    node_name: z.string().describe("The name/ID of the node being connected."),
    source: z.string().describe("The node type it receives data from, or 'none'."),
    target: z.string().describe("The node type it sends data to, or 'none'.")
  })).describe("The complete list of all connections and nodes that should exist on the canvas.")
});

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
  const { messages } = await req.json(); 

  const systemPrompt = `You are the **Master Architect**, a high-precision graph state engine. Your role is to maintain the "Absolute Blueprint" of a visual workflow.

### THE BLUEPRINT PHILOSOPHY
Your output is the **FINAL DESIRED STATE** of the entire canvas.
1. **Durable State**: If you want a node or connection to persist, it MUST be in your output JSON.
2. **Declarative Deletion**: If you want to remove something, simply omit it from your output.
3. **Idempotency**: If the user asks for no changes, your output should exactly match the current state.

### RECONCILIATION & GROUND TRUTH
You will see messages prefixed with \`[SYSTEM_SYNC] CURRENT_CANVAS_GRAPH\`. This is the literal, physical state of the board.
- **Priority**: Always treat the latest \`[SYSTEM_SYNC]\` as the ground truth over any previous assistant messages.
- **Manual Actions**: If the user manually connected nodes, you will see it in the sync. You MUST include these manual links in your output unless asked to remove them.

### NODES AVAILABLE
${Object.entries(NODE_TYPES).map(([id, n]) => `- ${id}: ${n.label} - ${n.desc}`).join('\n')}

### CONSTRUCTION RULES
1. **Single Entry**: Each object in the "workflow" array represents one directed link or a standalone node.
2. **Many-to-One**: If a node has 3 sources, create 3 separate objects in the array.
3. **Accuracy**: Use only the exact Node IDs provided above.
4. **Logic**: Ensure a logical data flow from sources (start) to sinks (end). 

Your goal is to be a perfect state machine. If the user says "add X", you return the CURRENT state PLUS X. If they say "remove Y", you return the CURRENT state MINUS Y.`;

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
    }).withStructuredOutput(workflowSchema);

    const result = await model.invoke(langChainMessages);
    const finalWorkflow = result.workflow;

    console.log('MASTER ARCHITECT GENERATED BLUEPRINT:', JSON.stringify(finalWorkflow, null, 2));

    // WebSocket Emission
    let socket: Socket;
    try {
      socket = await connectSocket();
      socket.emit('UI_COMMAND:UPDATE_WORKFLOW', { workflow: finalWorkflow });
      await new Promise(r => setTimeout(r, 500));
      socket.disconnect();
    } catch (err) {
      console.error('WebSocket Sync Failed:', err);
    }

    return Response.json({ 
      text: 'Blueprint updated successfully.',
      workflow: finalWorkflow 
    });
  } catch (error: any) {
    console.error('Master Architect Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}