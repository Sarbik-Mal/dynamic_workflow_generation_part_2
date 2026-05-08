# Dynamic Workflow Builder: Complete Technical & User Guide

> **A comprehensive guide to understanding how the UI-level workflow builder works without any database connection.**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [High-Level Overview](#2-high-level-overview)
3. [Core Methods Explained](#3-core-methods-explained)
4. [Connected UseEffects](#4-connected-useeffects)
5. [The ELK Auto-Layout Engine](#5-the-elk-auto-layout-engine)
6. [Key Features](#6-key-features)
7. [Conclusion](#7-conclusion)

---

## 1. Introduction

This document explains how the **Dynamic Workflow Builder** works - a powerful UI tool that allows users to create, modify, and visualize workflows without needing a database connection. Everything happens in the browser's memory, making it fast, responsive, and easy to use.

The tool combines:
- A visual canvas (React Flow) for building workflows
- An AI assistant that suggests workflow improvements
- Real-time synchronization via WebSockets
- Automatic layout calculations using the ELK algorithm

---

## 2. High-Level Overview

### How It Works (Simplified)

Imagine you're building a flowchart on a whiteboard. This tool is like having:

1. **A Smart Canvas** - Where you drag and drop workflow steps (nodes) and connect them (edges)
2. **An AI Architect** - Watches what you do and can suggest improvements
3. **A Memory System** - Remembers every change you make so the AI understands the context
4. **Auto-Organization** - The canvas automatically arranges your flowchart neatly

### The Data Flow

```
User Actions (Click, Type, Drag)
        ↓
    UI Components (Buttons, Forms)
        ↓
    Event Listeners (handleManualRemoveNode, etc.)
        ↓
    State Management (nodes, edges, messages)
        ↓
    AI Communication (submitCommand → API)
        ↓
    Preview System (reconcilePreviewWorkflow)
        ↓
    User Approval (handleAccept / handleReject)
```

### No Database Required

All workflow data is stored in:
- **React State** (`nodes`, `edges`) - The current workflow
- **Proposed State** (`proposedNodes`, `proposedEdges`) - AI suggestions waiting for approval
- **Memory** (`messages`) - Conversation history for AI context

---

## 3. Core Methods Explained

### 3.1 handleManualRemoveNode

**What it does:** Removes a node when the user clicks the delete button on a workflow node.

When you click the "X" on a workflow step, this function handles the removal process:

1. **Finds the node** - It identifies which workflow step you want to remove by its unique ID
2. **Records the action** - It logs the deletion in the memory system so the AI understands what changed
3. **Updates the display** - The node is removed from the visual canvas
4. **Syncs with server** - It notifies the backend about the deletion via WebSocket

The function uses a custom window event (`UI_ACTION:REMOVE_NODE`) to communicate between the node component and the main application. It leverages React's `setNodes` functional update to safely find and remove the target node, then emits a socket event (`UI_COMMAND:REMOVE_NODE`) to keep the server in sync.

```typescript
const handleManualRemoveNode = (e: any) => {
  const { id } = e.detail;
  
  setNodes((prevNodes) => {
    const targetNode = prevNodes.find(n => n.id === id);
    if (targetNode) {
      setMessages(prev => memoryManager.logAction(prev, memoryManager.formatRemoveNode(id as string, targetNode.data.label as string)));
    }
    return prevNodes;
  });

  socketRef.current?.emit('UI_COMMAND:REMOVE_NODE', { id });
};
```

---

### 3.2 handleManualSubmitReview

**What it does:** Allows users to add feedback or revision requests to any workflow node.

When you want to suggest a change to a specific workflow step, this function handles the review submission process:

1. **Creates unique identifier** - It generates a unique UUID for each review using `window.crypto.randomUUID()` to track feedback
2. **Attaches to node** - The feedback is stored in the node's `data.reviews` array
3. **Queues for AI** - The review is added to `pendingReviews` state to be bundled with your next message to the AI
4. **Supports preview mode** - Works for both the main canvas and AI's proposed preview nodes via the `isProposed` flag

```typescript
const handleManualSubmitReview = (e: any) => {
  const { id, feedback, isProposed } = e.detail;
  const uuid = window.crypto.randomUUID();
  
  const updateNodes = (prevNodes: Node[]) => prevNodes.map(node => {
    if (node.id === id) {
      const reviews = (node.data?.reviews || []) as any[];
      return {
        ...node,
        data: { ...node.data, reviews: [...reviews, { text: feedback, uuid }] }
      };
    }
    return node;
  });

  if (isProposed) {
    setProposedNodes(updateNodes);
  } else {
    setNodes(updateNodes);
  }

  setPendingReviews(prev => [...prev, { id, text: feedback, uuid }]);
};
```

---

### 3.3 handleEditNodeReview

**What it does:** Allows users to modify their pending feedback before sending it to the AI.

If you wrote feedback but changed your mind, this function lets you edit it before the AI sees it. It updates both the `pendingReviews` state and the actual node's reviews array, using the UUID to match the specific review across states.

---

### 3.4 handleDeleteNodeReview

**What it does:** Removes a pending review entirely.

If you decide you don't want to send certain feedback after all, this function deletes it. It filters out the review from `pendingReviews` by UUID and also removes it from the node's reviews array.

---

### 3.5 onEdgesDelete

**What it does:** Handles the deletion of connections between workflow nodes.

When you select a connection line and press delete, this function:

1. **Removes the connection** - The edge is removed from the visual canvas
2. **Records the action** - It logs the deletion in the memory system so the AI understands what changed
3. **Notifies the server** - Emits a socket event to keep the backend in sync

This is a React Flow callback attached to the `onEdgesDelete` prop. It iterates through all deleted edges and emits socket events for each one.

```typescript
const onEdgesDelete = useCallback(
  (deletedEdges: Edge[]) => {
    deletedEdges.forEach((edge) => {
      socketRef.current?.emit('UI_COMMAND:REMOVE_EDGE', { id: edge.id });
      setMessages(prev => memoryManager.logAction(prev, memoryManager.formatRemoveEdge(edge.source, edge.target)));
    });
  },
  []
);
```

---

### 3.6 reconcileWorkflow

**What it does:** The main engine that builds or updates the workflow based on AI suggestions.

When the AI suggests a new workflow structure, this function handles the reconciliation process step by step:

1. **Validates the blueprint** - Checks that the AI's suggestion is valid before processing
2. **Builds node library** - Creates a Map of node types from `NODE_TYPES` configuration
3. **Preserves reviews** - Carries over existing feedback when updating nodes with the same ID
4. **Compares and cleans** - Uses `validatedNodeIds` and `targetEdgeIds` to determine what to keep or remove
5. **Sequential build** - Adds nodes and edges one by one with delays (400ms, 500ms) so you can watch the workflow being built
6. **Protects manual edges** - Preserves manually created edges marked with `data.manual: true`

```typescript
// 1. Build Node Library from blueprint
const nodeLibrary = new Map<string, Node>();
blueprint.nodes.forEach(type => {
  const nodeInfo = NODE_TYPES[type as keyof typeof NODE_TYPES];
  // PRESERVE REVIEWS if node exists
  const existingNode = currentNodes.find(n => n.id === type);
  const existingReviews = (existingNode?.data?.reviews || []) as any[];
  nodeLibrary.set(type, { ...nodeObj, data: { ...reviews: existingReviews } });
});

// 2. Initial Cleanup - remove invalid nodes/edges
setNodes(prev => prev.filter(n => validatedNodeIds.has(n.id)));
setEdges(prev => prev.filter(e => isInBlueprint || isStillValidManual));

// 3. Sequential Build with delays
for (const id of Array.from(validatedNodeIds)) {
  setNodes(prev => { /* add node */ });
  await new Promise(r => setTimeout(r, 400));
}
for (const edge of blueprint.edges) {
  setEdges(prev => { /* add edge */ });
  await new Promise(r => setTimeout(r, 500));
}
```

---

### 3.7 reconcilePreviewWorkflow

**What it does:** Similar to reconcileWorkflow but for the AI's proposed changes in the preview pane.

When the AI shows you a "preview" of changes, this function builds that preview separately from your current workflow:

1. **Separate state** - Targets `proposedNodes` and `proposedEdges` instead of the main workflow
2. **Includes reviews** - Adds any pending feedback to the preview nodes
3. **Marks as proposed** - Sets `isProposed: true` flag on all preview nodes
4. **Immediate layout** - Applies ELK layout right away so the preview looks organized

```typescript
const reconcilePreviewWorkflow = useCallback(async (blueprint, reviewsToPreserve) => {
  // Build node library with isProposed: true
  nodeLibrary.set(type, {
    id: type,
    type: 'workflowNode',
    data: { ...isProposed: true, reviews: nodeReviews }
  });
  
  // Apply ELK layout immediately
  const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
    Array.from(nodeLibrary.values()), 
    newEdges
  );
  setProposedNodes(layoutedNodes);
  setProposedEdges(layoutedEdges);
}, [pendingReviews]);
```

---

### 3.8 handleReject

**What it does:** Discards the AI's proposed changes when the user says "no thanks."

If you don't like the AI's suggestion, clicking "Discard Changes" triggers this function which:

1. **Closes preview** - Clears the `isSplitView` state
2. **Preserves original** - Your current workflow remains unchanged
3. **Logs rejection** - Records the rejection in memory so the AI understands you didn't accept the suggestion
4. **Adds follow-up** - The AI proactively suggests alternative approaches

```typescript
const handleReject = () => {
  setIsSplitView(false);
  if (assistantMessage) {
    setMessages(prev => {
      const rejectedLog = memoryManager.logAction([assistantMessage], memoryManager.formatRejectAction());
      return [
        ...prev, 
        ...rejectedLog,
        { role: 'assistant', content: 'Understood. Let\'s pivot...' }
      ];
    });
  }
  setProposedNodes([]);
  setProposedEdges([]);
  setAssistantMessage(null);
};
```

---

### 3.9 submitCommand

**What it does:** The main communication hub between the user and the AI architect.

When you type a message or send feedback, this function handles the entire communication process:

1. **Aggregates feedback** - Bundles all pending reviews into the prompt
2. **Syncs state** - Creates a snapshot of your current workflow as `[SYSTEM_SYNC]` or `[PROPOSAL_SYNC]`
3. **Sends to API** - POSTs the context to `/api/command` endpoint
4. **Handles response** - If the AI returns a blueprint, triggers split view and preview reconciliation

```typescript
const submitCommand = async (text: string) => {
  // 1. Aggregate pending reviews
  let aggregatedPrompt = "";
  pendingReviews.forEach(pr => {
    aggregatedPrompt += `[NODE_REVISION_REQUEST: ${pr.id}] "${pr.text}"\n`;
  });
  aggregatedPrompt += `\nUser request:\n${text}`;

  // 2. Sync current state
  const currentBlueprint = isSplitView ? {
    nodes: proposedNodes.map(n => ({ id: n.id, reviews: n.data.reviews || [] })),
    edges: proposedEdges.map(e => ({ source: e.source, target: e.target }))
  } : {
    nodes: nodes.map(n => ({ id: n.id, reviews: n.data.reviews || [] })),
    edges: edges.map(e => ({ source: e.source, target: e.target }))
  };
  
  const syncData = memoryManager.formatCurrentState(currentBlueprint)
    .replace('[SYSTEM_SYNC]', isSplitView ? '[PROPOSAL_SYNC]' : '[CURRENT_SYNC]');

  // 3. Send to API
  const res = await fetch('/api/command', {
    method: 'POST',
    body: JSON.stringify({ messages: [...messagesWithSync, userMsg] }),
  });

  // 4. Handle response
  if (data.blueprint && data.blueprint.nodes.length > 0) {
    setAssistantMessage(aiMessage);
    setIsSplitView(true);
    reconcilePreviewWorkflow(data.blueprint);
  }
};
```

---

### 3.10 handleSendCommand

**What it does:** The form submit handler that triggers the command submission.

When you press Enter or click Send, this function:

1. **Prevents default** - Stops the form from submitting traditionally
2. **Captures input** - Saves what you typed
3. **Clears input** - Empties the text box for better UX
4. **Delegates to submitCommand** - Calls the main command function asynchronously

```typescript
const handleSendCommand = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!command.trim() && pendingReviews.length === 0) return;
  const currentCommand = command;
  setCommand('');
  await submitCommand(currentCommand);
};
```

---

### 3.11 handleManualAddNode

**What it does:** Adds a new workflow node when the user clicks a button in the sidebar.

When you click a node type in the sidebar (like "SQL Source"), this function:

1. **Gets node config** - Uses `NODE_TYPES` to retrieve the node's configuration
2. **Generates unique ID** - Creates a unique identifier, adding a suffix if duplicates exist
3. **Logs action** - Records the addition in memory for AI context
4. **Queues for display** - Adds to `incomingQueue` for animated entry with delay

```typescript
const handleManualAddNode = (type: string) => {
  ensureWorkflowId();
  const nodeInfo = NODE_TYPES[type as keyof typeof NODE_TYPES];
  
  // Handle duplicates
  const existingCount = nodes.filter(n => n.id.startsWith(type)).length;
  const id = existingCount > 0 ? `${type}_${existingCount + 1}` : type;
  
  // Update memory
  setMessages(prev => memoryManager.logAction(prev, memoryManager.formatAddNode(type, nodeInfo.label)));

  // Add to queue for animated entry
  setIncomingQueue((prev) => [...prev, { 
    type: 'node', 
    data: { id, type: 'workflowNode', data: { ...nodeInfo, isProposed: false } }
  }]);
};
```

---

## 4. Connected UseEffects

### 4.1 WebSocket & Event Registry (Initialization)

**Purpose:** Sets up real-time communication and event listeners.

```typescript
useEffect(() => {
  // 1. Initialize WebSocket
  socketRef.current = io(process.env.NEXT_PUBLIC_WS_URL || '');
  
  socketRef.current.on('connect', () => setIsConnected(true));
  socketRef.current.on('disconnect', () => setIsConnected(false));

  // 2. Listen for AI commands from socket
  socketRef.current.on('UI_COMMAND:ADD_NODE', (data) => {
    setIncomingQueue((prev) => [...prev, { type: 'node', data }]);
  });
  
  socketRef.current.on('UI_COMMAND:ADD_EDGE', (data) => {
    setIncomingQueue((prev) => [...prev, { type: 'edge', data }]);
  });
  
  socketRef.current.on('UI_COMMAND:UPDATE_WORKFLOW', (data) => {
    reconcileRef.current?.(data.blueprint);
  });

  // 3. Register manual UI action handlers
  window.addEventListener('UI_ACTION:REMOVE_NODE' as any, handleManualRemoveNode);
  window.addEventListener('UI_ACTION:SUBMIT_NODE_REVIEW' as any, handleManualSubmitReview);
  window.addEventListener('UI_ACTION:EDIT_NODE_REVIEW' as any, handleEditNodeReview);
  window.addEventListener('UI_ACTION:DELETE_NODE_REVIEW' as any, handleDeleteNodeReview);

  return () => {
    socketRef.current?.disconnect();
    window.removeEventListener(...);
  };
}, []);
```

**What it does:**
- Connects to WebSocket server for real-time sync
- Listens for AI commands (add node, add edge, update workflow)
- Registers handlers for custom UI events from node components

---

### 4.2 Incoming Queue Processor

**Purpose:** Creates the "typewriter" effect for workflow building.

```typescript
useEffect(() => {
  if (incomingQueue.length === 0) return;

  const processItem = async () => {
    const item = incomingQueue[0];
    
    if (item.type === 'node') {
      setNodes((nds) => [...nds, newNode]);
    } else if (item.type === 'edge') {
      setEdges((eds) => [...eds, newEdge]);
    } else if (item.type === 'remove_node') {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    } else if (item.type === 'remove_edge') {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    }
    
    setIncomingQueue((prev) => prev.slice(1));
  };

  const timer = setTimeout(processItem, 800);
  return () => clearTimeout(timer);
}, [incomingQueue, setNodes, setEdges]);
```

**What it does:**
- Processes one item from the queue at a time
- Adds 800ms delay between items for visual effect
- Handles node, edge, and removal operations

---

### 4.3 ELK Auto-Layout Engine

**Purpose:** Automatically arranges nodes in an organized layout.

```typescript
useEffect(() => {
  if (nodes.length === 0) return;
  
  let isMounted = true;
  const timer = setTimeout(async () => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(nodes, edges);
    
    if (!isMounted) return;

    // Check if movement is significant (> 2px)
    const hasSignificantMove = layoutedNodes.some((newNode) => {
      const oldNode = nodes.find(n => n.id === newNode.id);
      if (!oldNode) return true;
      const dx = Math.abs(newNode.position.x - oldNode.position.x);
      const dy = Math.abs(newNode.position.y - oldNode.position.y);
      return dx > 2 || dy > 2;
    });

    if (hasSignificantMove) {
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, 300);

  return () => {
    isMounted = false;
    clearTimeout(timer);
  };
}, [nodes.length, edges.length]);
```

**What it does:**
- Watches for changes in node/edge count
- Applies ELK layout with 300ms debounce
- Only updates if movement is significant (> 2px) to prevent jitter

---

### 4.4 Fit-View Orchestrator

**Purpose:** Automatically centers and zooms the canvas.

```typescript
useEffect(() => {
  if (rfInstance && incomingQueue.length === 0 && (nodes.length > 0)) {
    const timer = setTimeout(() => {
      rfInstance.fitView({ padding: 0.5, duration: 800 });
    }, 200);
    return () => clearTimeout(timer);
  }
}, [incomingQueue.length, rfInstance, nodes.length]);
```

**What it does:**
- Triggers when queue is empty and nodes exist
- Centers the view with 0.5 padding
- Adds 200ms delay to ensure layout is complete

---

### 4.5 reconcileRef Sync

**Purpose:** Keeps the reconcile function accessible to socket listeners.

```typescript
useEffect(() => {
  reconcileRef.current = reconcileWorkflow;
}, [reconcileWorkflow]);
```

**What it does:**
- Updates the ref whenever reconcileWorkflow changes
- Allows socket listener to call reconciliation without dependency issues

---

## 5. The ELK Auto-Layout Engine

### What is ELK?

**ELK (Eclipse Layout Kernel)** is a powerful layout algorithm that automatically arranges graphs and diagrams. It's like having a professional graphic designer organize your flowchart instantly.

### How It's Configured in This Tool

```typescript
const elkOptions = {
  'elk.algorithm': 'layered',           // Layer-based arrangement
  'elk.direction': 'RIGHT',            // Flow from left to right
  'elk.layered.spacing.nodeNodeLayer': '160', // Space between layers
  'elk.spacing.nodeNode': '120',       // Space between nodes
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', // Optimal placement
  'elk.layered.layering.strategy': 'NETWORK_SIMPLEX', // Smart layering
  'elk.alignment': 'CENTER',           // Center alignment
  'elk.layered.crossingMinimizer.strategy': 'LAYER_SWEEP', // Minimize crossings
};
```

### The Layout Process

1. **Validation:** Filter out edges pointing to non-existent nodes (prevents crashes)
2. **Graph Building:** Create a virtual graph with node dimensions (260x140)
3. **ELK Calculation:** Let ELK compute optimal X, Y coordinates
4. **Mapping:** Apply calculated positions back to React Flow nodes

### Why This Matters

- **No Manual Arrangement:** Users don't need to drag nodes around
- **Consistent Look:** All workflows follow the same professional layout
- **Handles Complexity:** Works whether you have 3 nodes or 30

---

## 6. Key Features

### 6.1 Split View / Preview Mode

When the AI suggests changes, you see:
- **Current Version** (left/top) - Your existing workflow
- **Proposed Version** (right/bottom) - AI's suggestion

You can then Accept or Reject the changes.

### 6.2 Review System

Users can add feedback to any node:
- Click on a node to open its details
- Type revision requests
- Edit or delete before sending to AI

### 6.3 Memory Management

Every action is logged for AI context:
- Node additions/removals
- Edge creations/deletions
- Workflow snapshots
- Rejection actions

### 6.4 Real-Time Sync

WebSocket connection ensures:
- Multiple users can see changes (if server supports it)
- AI commands are received in real-time
- Manual actions are broadcast

### 6.5 No Database Required

All data stays in browser memory:
- Fast and responsive
- No server setup needed for UI testing
- Easy to save/load workflows via API when needed

### 6.6 Visual Feedback

- Animated node/edge additions
- Loading indicators during AI processing
- Clear accept/reject buttons for AI suggestions

---

## 7. Conclusion

The Dynamic Workflow Builder is a sophisticated but user-friendly tool that enables workflow creation and modification entirely in the browser. Key takeaways:

1. **Client-Side Only:** No database connection required; everything runs in React state
2. **AI-Powered:** The AI architect can suggest, modify, and improve workflows based on user input
3. **Preview System:** All AI suggestions are previewed before being applied
4. **Memory Aware:** Every action is logged so the AI understands the full context
5. **Auto-Layout:** ELK handles all the complex positioning automatically
6. **User Control:** Final approval always rests with the user via Accept/Reject

This architecture makes it perfect for:
- Rapid prototyping of workflows
- AI-assisted workflow design
- Teaching workflow concepts
- Building demos without backend complexity

---
