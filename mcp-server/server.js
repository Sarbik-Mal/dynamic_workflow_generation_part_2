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

// Tool to add a specific node
server.tool(
  "add_workflow_node",
  "Adds a functional processing node to the canvas",
  {
    type: z.enum(Object.keys(NODE_TYPES)),
    id: z.string().describe("Unique ID for the node")
  },
  async ({ type, id }) => {
    const nodeInfo = NODE_TYPES[type];
    io.emit("UI_COMMAND:ADD_NODE", { 
      id, 
      type: 'workflowNode', 
      data: { 
        label: nodeInfo.label, 
        description: nodeInfo.desc,
        icon: nodeInfo.icon,
        color: nodeInfo.color // RESTORED COLOR FIELD
      } 
    });

    return {
      content: [{ type: "text", text: `Added ${nodeInfo.label} node with ID: ${id}` }],
    };
  }
);

// Tool to connect two nodes
server.tool(
  "connect_nodes",
  "Creates a connection (edge) between two existing nodes",
  {
    source: z.string().describe("ID of the source node"),
    target: z.string().describe("ID of the target node")
  },
  async ({ source, target }) => {
    io.emit("UI_COMMAND:ADD_EDGE", { 
      id: `e-${source}-${target}`, 
      source, 
      target,
      animated: true 
    });

    return {
      content: [{ type: "text", text: `Connected ${source} to ${target}` }],
    };
  }
);

// Tool to remove a node
server.tool(
  "remove_workflow_node",
  "Removes a processing node from the canvas by its ID",
  {
    id: z.string().describe("ID of the node to remove")
  },
  async ({ id }) => {
    io.emit("UI_COMMAND:REMOVE_NODE", { id });

    return {
      content: [{ type: "text", text: `Removed node with ID: ${id}` }],
    };
  }
);

// Tool to remove an edge
server.tool(
  "remove_edge",
  "Removes a connection between two nodes",
  {
    id: z.string().describe("ID of the edge to remove (usually in format e-source-target)")
  },
  async ({ id }) => {
    io.emit("UI_COMMAND:REMOVE_EDGE", { id });

    return {
      content: [{ type: "text", text: `Removed edge with ID: ${id}` }],
    };
  }
);

// Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("MCP WorkflowArchitect server started and connected to stdio.");
