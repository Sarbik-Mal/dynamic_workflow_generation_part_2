# Dynamic Workflow Builder: End-to-End Flow Architecture

> **A comprehensive guide explaining how data flows through the entire system - from user interactions to AI suggestions and real-time synchronization.**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture](#2-system-architecture)
3. [User Interaction Flow](#3-user-interaction-flow)
4. [AI Communication Flow](#4-ai-communication-flow)
5. [Real-Time Synchronization Flow](#5-real-time-synchronization-flow)
6. [Complete Data Journey](#6-complete-data-journey)
7. [State Management](#7-state-management)
8. [Error Handling & Edge Cases](#8-error-handling--edge-cases)
9. [Sequence Diagrams](#9-sequence-diagrams)

---

## 1. Introduction

This document provides a holistic view of how the Dynamic Workflow Builder works across all its components. It connects the frontend UI (documented in `workflow_builder.md`) with the backend server (documented in `server_side.md`) to show the complete data journey.

By the end of this document, you will understand:
- How user actions propagate through the system
- How AI suggestions are generated and applied
- How all clients stay synchronized in real-time
- How the two data formats (Blueprint vs Legacy) work

---

## 2. System Architecture

### 2.1 High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Frontend)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                         React Application                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │   Sidebar   │  │  ChatBar   │  │   Canvas   │  │   Memory Mgr   │  │  │
│  │  │  (Node      │  │  (AI       │  │  (React    │  │  (Conversation │  │  │
│  │  │   Palette)  │  │   Chat)    │  │   Flow)    │  │    History)    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  │         │                │                │                  │          │  │
│  │         └────────────────┴────────────────┴──────────────────┘          │  │
│  │                                    │                                       │  │
│  │                          ┌─────────▼─────────┐                            │  │
│  │                          │   Socket.io      │                            │  │
│  │                          │   Client         │                            │  │
│  │                          └─────────┬─────────┘                            │  │
│  └────────────────────────────────────┼────────────────────────────────────┘  │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         │
                                         │ WebSocket (ws://)
                                         │ + MCP Tool Calls
                                         ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SERVER (Backend)                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    WebSocket Server (Socket.io)                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    Event Broadcasters                             │ │  │
│  │  │  ADD_NODE │ ADD_EDGE │ REMOVE_NODE │ UPDATE_WORKFLOW │ ...       │ │  │
│  │  └─────────────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    MCP Server (Model Context Protocol)                 │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────────────────────┐  │  │
│  │  │   get_node_info    │  │         generate_workflow              │  │  │
│  │  │   (Node Registry)  │  │   (AI Workflow Generation)              │  │  │
│  │  └─────────────────────┘  └─────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| UI Framework | React 18 | Component-based UI |
| Canvas | React Flow | Visual workflow editor |
| State Management | React useState | Local component state |
| Real-time Comm | Socket.io | WebSocket client/server |
| AI Protocol | MCP (SDK) | AI tool interface |
| Server Runtime | Node.js | JavaScript runtime |
| Protocol | HTTP + WS | Network communication |

---

## 3. User Interaction Flow

### 3.1 Adding a Node

```
User drags node from sidebar
         ↓
Sidebar.onDragStart sets drag data
         ↓
Canvas.onDrop creates new node
         ↓
setNodes updates React state
         ↓
socket.emit('UI_COMMAND:ADD_NODE', nodeData)
         ↓
Server broadcasts to all clients
         ↓
All clients update their state
```

**Code Flow:**
```javascript
// 1. User drags from sidebar
const onDragStart = (event, nodeType) => {
  event.dataTransfer.setData('application/reactflow', nodeType);
};

// 2. Canvas handles drop
const onDrop = (event) => {
  const nodeType = event.dataTransfer.getData('application/reactflow');
  const newNode = createNode(nodeType, position);
  setNodes((nds) => nds.concat(newNode));
};

// 3. Emit to server
socket.emit('UI_COMMAND:ADD_NODE', { id: newNode.id, type: nodeType });
```

### 3.2 Removing a Node

```
User clicks delete button on node
         ↓
Node dispatches custom window event
         ↓
Parent component listens for event
         ↓
handleManualRemoveNode processes it
         ↓
setNodes removes the node
         ↓
memoryManager logs the action
         ↓
socket.emit('UI_COMMAND:REMOVE_NODE', { id })
         ↓
Server broadcasts to all clients
```

### 3.3 Connecting Nodes (Adding Edge)

```
User drags from handle to handle
         ↓
React Flow detects connection attempt
         ↓
onConnect callback fires
         ↓
setEdges adds new edge
         ↓
socket.emit('UI_COMMAND:ADD_EDGE', edgeData)
         ↓
Server broadcasts to all clients
```

---

## 4. AI Communication Flow

### 4.1 Sending Message to AI

```
User types in ChatBar
         ↓
submitCommand is called
         ↓
Memory manager formats conversation
         ↓
API call to /api/command
         ↓
Backend processes command
         ↓
Returns AI response with proposed changes
         ↓
reconcilePreviewWorkflow applies preview
         ↓
User sees proposed workflow (highlighted)
```

### 4.2 AI Proposes Workflow Changes

```
AI analyzes current workflow
         ↓
AI calls generate_workflow MCP tool
         ↓
MCP tool emits UI_COMMAND:UPDATE_WORKFLOW
         ↓
Server broadcasts to all clients
         ↓
Frontend receives proposed workflow
         ↓
Propose state shows AI suggestion
         ↓
User reviews and accepts/rejects
```

### 4.3 Accepting AI Suggestion

```
User clicks "Accept" button
         ↓
handleAccept processes acceptance
         ↓
Proposed nodes/edges merge into main state
         ↓
Memory logs the acceptance
         ↓
socket.emit updates server
         ↓
All clients sync to new state
```

---

## 5. Real-Time Synchronization Flow

### 5.1 Multi-Client Scenario

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Client A    │     │  Client B    │     │  Client C    │
│  (User 1)    │     │  (User 2)    │     │  (AI Agent)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  ADD_NODE          │                    │
       ├───────────────────►│                    │
       │                    │  (broadcast)       │
       │                    ├───────────────────►│
       │                    │                    │
       │                    │         ADD_NODE   │
       │                    │◄───────────────────┤
       │                    │                    │
       ▼                    ▼                    ▼
```

### 5.2 Server Broadcasting

```javascript
// Server receives event from one client
socket.on("UI_COMMAND:ADD_NODE", (data) => {
  // Broadcasts to ALL connected clients (including sender)
  io.emit("UI_COMMAND:ADD_NODE", data);
});
```

**Key Points:**
- Server uses `io.emit()` to broadcast to all clients
- Even the sender receives the broadcast (for confirmation)
- This ensures all clients have identical state

---

## 6. Complete Data Journey

### 6.1 User Creates Workflow (Full Path)

```
1. User drags "CSV Reader" from Sidebar
   │
   ▼
2. Sidebar.onDragStart → event.dataTransfer.setData()
   │
   ▼
3. Canvas.onDrop → createNode() → setNodes()
   │
   ▼
4. React Flow renders node on canvas
   │
   ▼
5. socket.emit('UI_COMMAND:ADD_NODE', {...})
   │
   ▼
6. WebSocket sends to server
   │
   ▼
7. Server receives, logs, broadcasts
   │
   ▼
8. All clients receive broadcast
   │
   ▼
9. Each client updates local state
   │
   ▼
10. React Flow re-renders on all canvases
```

### 6.2 AI Modifies Workflow (Full Path)

```
1. User types: "Add error handling after the CSV reader"
   │
   ▼
2. ChatBar.submitCommand → memoryManager.formatMessage()
   │
   ▼
3. API call: POST /api/command with messages
   │
   ▼
4. Backend processes with AI (OpenAI Claude, etc.)
   │
   ▼
5. AI returns: { blueprint: { nodes: [...], edges: [...] } }
   │
   ▼
6. Frontend receives response
   │
   ▼
7. reconcilePreviewWorkflow() → setProposeState()
   │
   ▼
8. Preview nodes appear with different styling
   │
   ▼
9. User clicks "Accept" button
   │
   ▼
10. handleAccept() → merge propose → main state
   │
   ▼
11. socket.emit('UI_COMMAND:UPDATE_WORKFLOW', {...})
   │
   ▼
12. Server broadcasts to all clients
   │
   ▼
13. All clients sync to new workflow state
```

---

## 7. State Management

### 7.1 Frontend State Structure

```typescript
interface WorkflowState {
  // Main workflow (committed)
  nodes: Node[];
  edges: Edge[];
  
  // Proposed workflow (AI suggestion)
  proposeNodes: Node[];
  proposeEdges: Edge[];
  
  // Conversation history
  messages: Message[];
  
  // UI state
  isProcessing: boolean;
  selectedNode: string | null;
}
```

### 7.2 Two Data Formats

The system supports two workflow data formats:

**Format 1: Blueprint (New)**
```javascript
{
  blueprint: {
    nodes: ["csv_reader_1", "json_transformer_1", "mongodb_sink_1"],
    edges: [
      { source: "csv_reader_1", target: "json_transformer_1" },
      { source: "json_transformer_1", target: "mongodb_sink_1" }
    ]
  }
}
```

**Format 2: Legacy (Old)**
```javascript
{
  workflow: [
    { node_name: "csv_reader", source: "in", target: "transform" },
    { node_name: "json_transformer", source: "transform", target: "out" }
  ]
}
```

**Conversion:**
- Frontend converts between formats as needed
- Server accepts both and broadcasts as-is
- Blueprint format is preferred for new implementations

---

## 8. Error Handling & Edge Cases

### 8.1 Connection Loss

```
WebSocket disconnects
         ↓
Socket.io auto-reconnects
         ↓
On reconnect: fetch current state from server
         ↓
Or: User manually refreshes page
         ↓
State restored from localStorage or server
```

### 8.2 Conflicting Edits

```
Client A deletes node
         ↓
Client B adds edge to same node (stale data)
         ↓
Server broadcasts delete first
         ↓
Client B receives delete → removes node
         ↓
Client B's edge now points to deleted node
         ↓
Client B must clean up orphaned edges
```

### 8.3 AI Suggestion Conflicts

```
User has proposed changes pending
         ↓
User makes manual changes
         ↓
handleReject clears propose state
         ↓
Manual changes take precedence
         ↓
AI suggestion is discarded
```

---

## 9. Sequence Diagrams

### 9.1 User Adds Node Sequence

```
┌────────┐     ┌─────────┐     ┌───────┐     ┌────────┐     ┌────────┐
│ User   │     │Sidebar  │     │Canvas │     │ Socket │     │ Server │
└───┬────┘     └────┬────┘     └───┬───┘     └───┬────┘     └───┬────┘
    │               │              │            │              │
    │ Drag node     │              │            │              │
    │──────────────►│              │            │              │
    │               │              │            │              │
    │               │ onDragStart  │            │              │
    │               │─────────────►│            │              │
    │               │              │            │              │
    │               │              │ setNodes   │              │
    │               │              │───────    │              │
    │               │              │            │              │
    │               │              │ socket.emit│              │
    │               │              │───────────►│              │
    │               │              │            │              │
    │               │              │            │ WebSocket    │
    │               │              │            │─────────────►│
    │               │              │            │              │
    │               │              │            │    broadcast │
    │               │              │            │◄─────────────│
    │               │              │            │              │
    │               │              │  on('...') │              │
    │               │              │◄───────────┘              │
    │               │              │            │              │
    │               │              │ setNodes  │              │
    │               │              │◄──────────│              │
    │               │              │            │              │
```

### 9.2 AI Suggestion Sequence

```
┌────────┐     ┌───────┐     ┌───────┐     ┌────────┐     ┌────────┐
│ User   │     │ChatBar│     │ API   │     │ Server │     │   AI   │
└───┬────┘     └───┬───┘     └───┬───┘     └───┬────┘     └───┬────┘
    │               │              │            │              │
    │ Type message  │              │            │              │
    │──────────────►│              │            │              │
    │               │              │            │              │
    │               │ submitCommand│            │              │
    │               │─────────────►│            │              │
    │               │              │            │              │
    │               │              │ POST /cmd  │              │
    │               │              │───────────►│              │
    │               │              │            │              │
    │               │              │            │  Process     │
    │               │              │            │─────────────►│
    │               │              │            │              │
    │               │              │            │   Response   │
    │               │              │            │◄─────────────│
    │               │              │            │              │
    │               │              │   JSON     │              │
    │               │              │◄───────────┤              │
    │               │              │            │              │
    │               │ reconcile    │            │              │
    │               │◄─────────────┤            │              │
    │               │              │            │              │
    │               │ setPropose   │            │              │
    │               │◄─────────────┤            │              │
    │               │              │            │              │
    │  Preview      │              │            │              │
    │◄──────────────┘              │            │              │
    │               │              │            │              │
```

### 9.3 Real-Time Sync Sequence

```
┌────────┐     ┌────────┐     ┌────────┐
│Client A│     │ Server │     │Client B│
└───┬────┘     └───┬────┘     └───┬────┘
    │               │              │
    │ ADD_NODE     │              │
    │──────────────►│              │
    │               │              │
    │               │ broadcast    │
    │               │─────────────►│
    │               │              │
    │ on('ADD_NODE')              │
    │◄─────────────┘              │
    │               │              │
    │               │              │ on('ADD_NODE')
    │               │              │◄─────────────┘
    │               │              │
```

---

## Summary

### Key Takeaways

1. **User Actions Flow Down** - Drag/drop, clicks, and typing all flow through React state → Socket emit → Server broadcast

2. **AI Suggestions Flow Up** - Messages go to backend → AI processes → Returns workflow → User accepts → Broadcast

3. **Real-Time Sync is Bidirectional** - Any client change broadcasts to all clients via WebSocket

4. **Two Formats Coexist** - Blueprint (new) and Legacy (old) formats are both supported

5. **State is Client-Side** - No database; all state maintained in React state and memory

6. **Preview Before Commit** - AI suggestions show as preview until user accepts

### Architecture Benefits

| Benefit | How It's Achieved |
|---------|-------------------|
| Fast responsiveness | In-memory state, no DB round-trips |
| Real-time collaboration | WebSocket broadcasting |
| AI integration | MCP tools for workflow generation |
| Visual editing | React Flow canvas |
| Conversation context | Memory manager tracks history |

---

## Related Documentation

- [workflow_builder.md](workflow_builder.md) - Frontend UI implementation
- [server_side.md](server_side.md) - Backend server details