import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "socket.io";
import { createServer } from "http";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Initialize HTTP and WebSocket server
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this to your frontend URL
    methods: ["GET", "POST"]
  }
});

// Use port 4000 as per previous setup
const PORT = 4000;
httpServer.listen(PORT, () => {
  console.error(`WebSocket server listening on port ${PORT}`);
});

io.on("connection", (socket) => {
  console.error("Client connected to WebSocket");
  
  // Broadcasters for the Architect AI
  socket.on("UI_COMMAND:ADD_NODE", (data) => {
    console.error(`[WS] ADD_NODE: ${data.id}`);
    io.emit("UI_COMMAND:ADD_NODE", data);
  });

  socket.on("UI_COMMAND:ADD_EDGE", (data) => {
    console.error(`[WS] ADD_EDGE: ${data.source} -> ${data.target}`);
    io.emit("UI_COMMAND:ADD_EDGE", data);
  });

  socket.on("UI_COMMAND:REMOVE_NODE", (data) => {
    console.error(`[WS] REMOVE_NODE: ${data.id}`);
    io.emit("UI_COMMAND:REMOVE_NODE", data);
  });

  socket.on("UI_COMMAND:REMOVE_EDGE", (data) => {
    console.error(`[WS] REMOVE_EDGE: ${data.id}`);
    io.emit("UI_COMMAND:REMOVE_EDGE", data);
  });

  socket.on("UI_COMMAND:UPDATE_WORKFLOW", (data) => {
    console.error(`[WS] UPDATE_WORKFLOW Relay: ${data.workflow.length} items`);
    io.emit("UI_COMMAND:UPDATE_WORKFLOW", data);
  });

  socket.on("disconnect", () => {
    console.error("Client disconnected from WebSocket");
  });
});

// Initialize MCP Server
const server = new McpServer({
  name: "WorkflowArchitect",
  version: "1.2.0",
});

/**
 * Define tools for the new Node Architecture
 * Restoration: Added colors back to the functional types
 */
const NODE_TYPES = {
  csv_reader: { label: 'CSV Reader', icon: 'FileText', color: 'red', desc: 'Reads data from CSV files' },
  json_transformer: { label: 'JSON Transformer', icon: 'Code', color: 'orange', desc: 'Converts data formats to JSON' },
  data_filter: { label: 'Data Filter', icon: 'Filter', color: 'yellow', desc: 'Filters incoming data streams' },
  sql_source: { label: 'SQL Source', icon: 'Database', color: 'green', desc: 'Queries relational databases' },
  mongodb_sink: { label: 'MongoDB Sink', icon: 'Database', color: 'blue', desc: 'Persists data to MongoDB' },
  postgres_sink: { label: 'Postgres Sink', icon: 'Database', color: 'indigo', desc: 'Persists data to PostgreSQL' },
  s3_storage: { label: 'S3 Storage', icon: 'Cloud', color: 'violet', desc: 'Uploads files to Amazon S3' },
  rest_api: { label: 'REST API', icon: 'Globe', color: 'slate-400', desc: 'Interacts with external Web APIs' },
  slack_alert: { label: 'Slack Alert', icon: 'MessageSquare', color: 'slate-600', desc: 'Sends notifications to Slack' },
  error_handler: { label: 'Error Handler', icon: 'AlertTriangle', color: 'slate-800', desc: 'Manages workflow errors' },
};

// Tool to generate/update the full workflow declaratively
server.tool(
  "generate_workflow",
  "Updates the entire workflow logic using a declarative list of connections",
  {
    workflow: z.array(z.object({
      node_name: z.string().describe("Type of the node (e.g. csv_reader, mongodb_sink)"),
      source: z.string().describe("Type of the source node, or 'none'"),
      target: z.string().describe("Type of the target node, or 'none'")
    })).describe("Full list of logical steps in the workflow")
  },
  async ({ workflow }) => {
    console.error(`[WS] UPDATE_WORKFLOW received from tool`);
    io.emit("UI_COMMAND:UPDATE_WORKFLOW", { workflow });

    return {
      content: [{ type: "text", text: `Workflow updated with ${workflow.length} logical steps.` }],
    };
  }
);

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("MCP WorkflowArchitect server started and connected to stdio.");
