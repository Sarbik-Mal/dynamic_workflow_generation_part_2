# MCP Server & WebSocket Server: Complete Technical Guide

> **A comprehensive guide to understanding the backend server that powers the Dynamic Workflow Builder.**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [Server Components](#3-server-components)
4. [WebSocket Communication](#4-websocket-communication)
5. [MCP Tools](#5-mcp-tools)
6. [Node Type Definitions](#6-node-type-definitions)
7. [Data Flow & Communication](#7-data-flow--communication)
8. [Integration with Frontend](#8-integration-with-frontend)

---

## 1. Introduction

This document explains how the **MCP Server** and **WebSocket Server** work together to power the Dynamic Workflow Builder. The server handles real-time communication between clients and provides AI tools through the Model Context Protocol (MCP).

The server provides:
- **WebSocket Server** - Real-time bidirectional communication
- **MCP Server** - AI-powered tools for workflow generation
- **Node Type Registry** - Available workflow node types

---

## 2. Architecture Overview

### Server Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                             │
│                  (Model Context Protocol)                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ get_node_info   │  │ generate_workflow│                 │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
                    Stdio (stdin/stdout)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket Server                         │
│                    (Socket.io + HTTP)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Real-time Event Broadcasting            │  │
│  │  UI_COMMAND:ADD_NODE, ADD_EDGE, REMOVE_NODE, etc.   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    Port (configurable)
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Client                        │
│                   (React + React Flow)                      │
└─────────────────────────────────────────────────────────────┘
```

### Port Configuration

The server reads the port from environment variables:
```javascript
const PORT = process.env.PORT;
```

---

## 3. Server Components

### 3.1 HTTP & WebSocket Server Setup

The server creates an HTTP server and attaches Socket.io for real-time communication:

```javascript
// filepath: mcp-server/server.js
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this to your frontend URL
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT;
httpServer.listen(PORT, () => {
  console.error(`WebSocket server listening on port ${PORT}`);
});
```

**Key Points:**
- Uses `createServer` from Node's `http` module
- Socket.io handles WebSocket connections with CORS enabled
- Server listens on the configured PORT from environment variables

### 3.2 MCP Server Initialization

The MCP Server is initialized with the `McpServer` class from the SDK:

```javascript
const server = new McpServer({
  name: "WorkflowArchitect",
  version: "1.2.0",
});
```

**Key Points:**
- Name: `WorkflowArchitect` - Identifies the server to AI clients
- Version: `1.2.0` - Current version of the MCP implementation

---

## 4. WebSocket Communication

### 4.1 Connection Handling

The server listens for client connections and broadcasts events to all connected clients:

```javascript
io.on("connection", (socket) => {
  console.error("Client connected to WebSocket");
  
  // ... event handlers ...
  
  socket.on("disconnect", () => {
    console.error("Client disconnected from WebSocket");
  });
});
```

### 4.2 Event Types

The server handles and broadcasts the following event types:

| Event Name | Direction | Description |
|------------|-----------|-------------|
| `UI_COMMAND:ADD_NODE` | Client → Server → All Clients | User added a new node |
| `UI_COMMAND:ADD_EDGE` | Client → Server → All Clients | User connected two nodes |
| `UI_COMMAND:REMOVE_NODE` | Client → Server → All Clients | User deleted a node |
| `UI_COMMAND:REMOVE_EDGE` | Client → Server → All Clients | User deleted a connection |
| `UI_COMMAND:UPDATE_WORKFLOW` | Client → Server → All Clients | Workflow was updated |

### 4.3 Event Handler Examples

**Adding a Node:**
```javascript
socket.on("UI_COMMAND:ADD_NODE", (data) => {
  console.error(`[WS] ADD_NODE: ${data.id}`);
  io.emit("UI_COMMAND:ADD_NODE", data);
});
```

**Updating Workflow:**
```javascript
socket.on("UI_COMMAND:UPDATE_WORKFLOW", (data) => {
  if (data.blueprint) {
    console.error(`[WS] UPDATE_WORKFLOW (Blueprint): ${data.blueprint.nodes?.length || 0} nodes, ${data.blueprint.edges?.length || 0} edges`);
  } else if (data.workflow) {
    console.error(`[WS] UPDATE_WORKFLOW (Legacy): ${data.workflow.length || 0} items`);
  }
  io.emit("UI_COMMAND:UPDATE_WORKFLOW", data);
});
```

---

## 5. MCP Tools

### 5.1 get_node_info

**Purpose:** Returns a detailed manifest of all available node types that can be used in the workflow.

**Parameters:** None

**Returns:** JSON string containing all node types with their metadata

**Usage:** Use this tool whenever you need to know which nodes are available for workflow construction.

```javascript
server.tool(
  "get_node_info",
  "Returns a detailed manifest of all available node types that can be used in the workflow. Use this tool whenever you need to know which nodes are available.",
  {},
  async () => {
    console.error("[MCP] get_node_info called by AI");
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify(NODE_TYPES, null, 2) 
      }],
    };
  }
);
```

### 5.2 generate_workflow

**Purpose:** Updates the entire workflow topology declaratively. Supports both Legacy and Blueprint formats.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `blueprint` | object | No | New blueprint format with nodes array and edges array |
| `workflow` | array | No | Legacy format with node objects |

**Blueprint Format:**
```javascript
{
  blueprint: {
    nodes: ["node_id_1", "node_id_2", ...],
    edges: [{ source: "node_a", target: "node_b" }, ...]
  }
}
```

**Legacy Format:**
```javascript
{
  workflow: [
    { node_name: "csv_reader", source: "input", target: "output" },
    ...
  ]
}
```

**Returns:** Success message

```javascript
server.tool(
  "generate_workflow",
  "Updates the entire workflow topology declaratively (Supports both Legacy and Blueprint formats)",
  {
    blueprint: z.object({
      nodes: z.array(z.string()),
      edges: z.array(z.object({ source: z.string(), target: z.string() }))
    }).optional(),
    workflow: z.array(z.object({
      node_name: z.string(),
      source: z.string(),
      target: z.string()
    })).optional()
  },
  async (payload) => {
    console.error(`[WS] UPDATE_WORKFLOW received from tool`);
    io.emit("UI_COMMAND:UPDATE_WORKFLOW", payload);

    return {
      content: [{ type: "text", text: `Workflow updated successfully.` }],
    };
  }
);
```

---

## 6. Node Type Definitions

The server defines a registry of available node types that can be used in workflows:

```javascript
const NODE_TYPES = {
  csv_reader: { 
    label: 'CSV Reader', 
    icon: 'FileText', 
    color: 'red', 
    desc: 'Reads data from CSV files' 
  },
  json_transformer: { 
    label: 'JSON Transformer', 
    icon: 'Code', 
    color: 'orange', 
    desc: 'Converts data formats to JSON' 
  },
  data_filter: { 
    label: 'Data Filter', 
    icon: 'Filter', 
    color: 'yellow', 
    desc: 'Filters incoming data streams' 
  },
  sql_source: { 
    label: 'SQL Source', 
    icon: 'Database', 
    color: 'green', 
    desc: 'Queries relational databases' 
  },
  mongodb_sink: { 
    label: 'MongoDB Sink', 
    icon: 'Database', 
    color: 'blue', 
    desc: 'Persists data to MongoDB' 
  },
  postgres_sink: { 
    label: 'Postgres Sink', 
    icon: 'Database', 
    color: 'indigo', 
    desc: 'Persists data to PostgreSQL' 
  },
  s3_storage: { 
    label: 'S3 Storage', 
    icon: 'Cloud', 
    color: 'violet', 
    desc: 'Uploads files to Amazon S3' 
  },
  rest_api: { 
    label: 'REST API', 
    icon: 'Globe', 
    color: 'slate-400', 
    desc: 'Interacts with external Web APIs' 
  },
  slack_alert: { 
    label: 'Slack Alert', 
    icon: 'MessageSquare', 
    color: 'slate-600', 
    desc: 'Sends notifications to Slack' 
  },
  error_handler: { 
    label: 'Error Handler', 
    icon: 'AlertTriangle', 
    color: 'slate-800', 
    desc: 'Manages workflow errors' 
  },
};
```

### Node Type Properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | Display name for the node |
| `icon` | string | Icon identifier (matches icon component) |
| `color` | string | Color code for visual representation |
| `desc` | string | Brief description of the node's function |

---

## 7. Data Flow & Communication

### 7.1 Frontend to Server Communication

```
User Action (Click, Type, Drag)
        ↓
Frontend UI Components
        ↓
Socket Emit (e.g., socket.emit('UI_COMMAND:ADD_NODE', data))
        ↓
WebSocket Server receives event
        ↓
Broadcasts to all connected clients
        ↓
Frontend updates React state
```

### 7.2 AI to Server Communication

```
AI Agent decides to modify workflow
        ↓
Calls MCP tool (e.g., generate_workflow)
        ↓
MCP Server processes tool call
        ↓
Emits WebSocket event to all clients
        ↓
Frontend receives and applies changes
```

### 7.3 Server Startup Flow

```javascript
// 1. Load environment variables
dotenv.config();

// 2. Create HTTP server
const httpServer = createServer();

// 3. Attach Socket.io
const io = new Server(httpServer, { cors: {...} });

// 4. Start listening
httpServer.listen(PORT, () => {
  console.error(`WebSocket server listening on port ${PORT}`);
});

// 5. Initialize MCP Server
const server = new McpServer({ name: "WorkflowArchitect", version: "1.2.0" });

// 6. Register tools
server.tool("get_node_info", ...);
server.tool("generate_workflow", ...);

// 7. Connect to stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 8. Integration with Frontend

### 8.1 WebSocket Connection

The frontend connects to the WebSocket server using Socket.io client:

```javascript
// filepath: frontend/src/lib/memory.ts (or similar)
import { io } from "socket.io-client";

export const socket = io("http://localhost:PORT");
```

### 8.2 Event Listeners

The frontend listens for server events to keep the UI in sync:

```javascript
socket.on("UI_COMMAND:UPDATE_WORKFLOW", (data) => {
  // Update React state with new workflow data
  setNodes(data.blueprint?.nodes || []);
  setEdges(data.blueprint?.edges || []);
});
```

### 8.3 Sending Commands

The frontend emits events when users interact with the workflow:

```javascript
// Adding a node
socket.emit("UI_COMMAND:ADD_NODE", { id: "node_1", type: "csv_reader" });

// Removing a node
socket.emit("UI_COMMAND:REMOVE_NODE", { id: "node_1" });

// Updating workflow
socket.emit("UI_COMMAND:UPDATE_WORKFLOW", { 
  blueprint: { 
    nodes: ["node_1", "node_2"], 
    edges: [{ source: "node_1", target: "node_2" }] 
  } 
});
```

---

## Summary

The MCP Server and WebSocket Server work together to provide:

1. **Real-time Communication** - WebSocket enables instant updates across all connected clients
2. **AI Integration** - MCP tools allow AI agents to read node info and generate workflows
3. **Node Registry** - Centralized definition of available workflow node types
4. **Event Broadcasting** - All clients stay in sync when any client makes changes

The server is designed to be stateless - it doesn't store workflow data permanently. Instead, it acts as a message broker that broadcasts changes to all connected clients, allowing the frontend to maintain the authoritative state.