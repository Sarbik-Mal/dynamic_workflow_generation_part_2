import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage, AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
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
2. **workflow_data**: The TOTAL STATE of the canvas. This field is required but can be null. YOU MUST provide the full object if you are making changes to the graph, proposing an alternative design, or if you are describing a workflow layout in your message. Never talk about nodes and connections without returning the data structure. If you are ONLY chatting and no visual graph is needed, return null.

### THE BLUEPRINT PHILOSOPHY (within workflow_data)
1. **Manifest of Solids**: The "nodes" array is a manifest of every component that exists. If it's not in the array, it's deleted.
2. **Manifest of Wires**: The "edges" array is a list of every connection. An edge is an atomic unit - once defined by {source, target}, it is established.
3. **Idempotency**: Your goal is to reach the state requested by the user while preserving any relevant existing structure.
### THE SNAPSHOT SYSTEM
- \`[CURRENT_SYNC]\`: The absolute status of the live board.
- \`[PROPOSAL_SYNC]\`: The draft you just suggested. If the user critiquies this, use it as your baseline for the next fix.
- \`[PAST_SYNC]\`: Historical states for reversion.

### KNOWLEDGE RETRIEVAL
- **Nodes Library**: You MUST call \`get_node_info\` to verify node IDs and descriptions. 
- **Efficiency**: Call \`get_node_info\` only ONCE per turn. It returns the COMPLETE catalog of all available nodes in a single response.

### CRITICAL WIRING RULES
1. **NO ORPHAN NODES**: Every node you list in "nodes" (except primary sources) MUST have an incoming edge from another node. If a node is mentioned in "nodes" but has no incoming edges, IT IS AN ERROR.
2. **AUTOMATIC BRIDGING**: If you remove a middle node (A -> B -> C), you MUST manually create the bridge (A -> C) in your "edges" list. Never leave "C" disconnected.
3. **MANDATORY SYNC ALIGNMENT**: Your "workflow_data" MUST be 100% consistent with your "message". If you say "I connected Slack", the "edges" array MUST contain that connection. 
4. **ABSOLUTE TOTALITY**: You always provide the ENTIRE graph. Any node or edge missing from your response will be PERMANENTLY DELETED.
5. **NODES ARE REQUIRED**: If you define an edge from A to B, both 'A' and 'B' MUST be present in your 'nodes' array. NEVER return an empty 'nodes' list if your graph has logic.

### KNOWLEDGE RETRIEVAL
- **Nodes Library**: You DO NOT have a list of available nodes in your immediate memory. 
- **Requirement**: Whenever you need to know which node types are available to build or update a workflow, you MUST call the \`get_node_info\` tool. Do not guess or assume node IDs.

### CONSTRUCTION RULES (within workflow_data)
1. **Unambiguous Edges**: To connect A to B, add one entry to "edges" with source "A" and target "B".
2. **Automatic Bridging**: If you remove a node that was part of a chain (e.g., A -> B -> C), bridge the connection (A -> C).
3. **No Orphans**: Every node (except Primary Sources) MUST have an incoming edge.
4. **Strict Memory Protocol**: You have a perfect log of the graph's evolution through \`[PAST_SYNC]\` messages. When asked to "go back to the 1st workflow", scroll to the very first \`[CURRENT_SYNC]\` or \`[PAST_SYNC]\` that contained nodes and replicate it perfectly. 
5. **Handling Rejection**: If you see a \`[SYSTEM_LOG]\` indicating a rejection, be proactive. Apologize for the mismatch and suggest 2-3 specific alternative changes (different nodes, consolidated logic, or extra security/logging) that might better serve the user's intent.
6. **No Spontaneous Creation**: NEVER add nodes from the "NODES AVAILABLE" list unless the user explicitly names them or their function in the current request. Do not "fill in the blanks" during a reversion.
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
    });

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "get_node_info",
          description: "Returns a detailed manifest of all available node types that can be used in the workflow. Use this tool whenever you need to know which nodes are available.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      }
    ];

    const modelWithTools = model.bindTools(tools);
    let currentMessages = [...langChainMessages];
    let toolCallsCount = 0;
    const MAX_TOOL_CALLS = 3;

    // Loop to handle tool calling for get_node_info
    while (toolCallsCount < MAX_TOOL_CALLS) {
      const response = await modelWithTools.invoke(currentMessages);
      
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`[API] AI requested ${response.tool_calls.length} tool calls...`);
        currentMessages.push(response);

        for (const toolCall of response.tool_calls) {
          if (toolCall.name === 'get_node_info') {
            console.log(`[API] Providing node info for call ${toolCall.id}...`);
            currentMessages.push(new ToolMessage({
              content: JSON.stringify(NODE_TYPES, null, 2),
              tool_call_id: toolCall.id!
            }));
          } else {
            // Handle unknown tools just in case
            currentMessages.push(new ToolMessage({
              content: "Error: Tool not found.",
              tool_call_id: toolCall.id!
            }));
          }
        }
        toolCallsCount++;
        continue;
      }
      break; 
    }

    // Final call with structured output forcing
    const structuredModel = model.withStructuredOutput(blueprintSchema);
    const result = await structuredModel.invoke(currentMessages);
    
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