'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Edge,
  Node,
  Background,
  Controls,
  ConnectionLineType,
} from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { getLayoutedElements } from '@/lib/layout';
import { NODE_TYPES } from '@/lib/nodes';
import { memoryManager, type MemoryMessage } from '@/lib/memory';

import { WorkflowNode } from '@/components/workflow/WorkflowNode';
import { Sidebar } from '@/components/workflow/Sidebar';
import { Header } from '@/components/workflow/Header';
import { ChatBar } from '@/components/workflow/ChatBar';

const nodeTypes = {
  workflowNode: WorkflowNode,
};

export default function WorkflowVisualizer() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [command, setCommand] = useState('');
  const [isArchitectThinking, setIsArchitectThinking] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'library'>('library');
  const [incomingQueue, setIncomingQueue] = useState<{ type: 'node' | 'edge' | 'remove_node' | 'remove_edge', data: any }[]>([]);
  const [messages, setMessages] = useState<MemoryMessage[]>([]);
  const [pendingReviews, setPendingReviews] = useState<{id: string, text: string, uuid: string}[]>([]);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  
  // Split View / AI Preview States
  const [isSplitView, setIsSplitView] = useState(false);
  const [proposedNodes, setProposedNodes, onProposedNodesChange] = useNodesState<Node>([]);
  const [proposedEdges, setProposedEdges, onProposedEdgesChange] = useEdgesState<Edge>([]);
  const [assistantMessage, setAssistantMessage] = useState<MemoryMessage | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const reconcileRef = useRef<any>(null);
  const submitCommandRef = useRef<any>(null);

  useEffect(() => {
    submitCommandRef.current = submitCommand;
  });

  // Initialize WebSocket
  useEffect(() => {
    socketRef.current = io(process.env.NEXT_PUBLIC_WS_URL || '');

    socketRef.current.on('connect', () => setIsConnected(true));
    socketRef.current.on('disconnect', () => setIsConnected(false));

    socketRef.current.on('UI_COMMAND:ADD_NODE', (data: any) => {
      console.log('[SOCKET] Node Recv:', data.id);
      setIncomingQueue((prev) => [...prev, { type: 'node', data }]);
    });

    socketRef.current.on('UI_COMMAND:ADD_EDGE', (data: any) => {
      console.log('[SOCKET] Edge Recv:', data.source, '->', data.target);
      setIncomingQueue((prev) => [...prev, { type: 'edge', data }]);
    });

    socketRef.current.on('UI_COMMAND:REMOVE_NODE', (data: any) => {
      console.log('[SOCKET] Remove Node Recv:', data.id);
      setIncomingQueue((prev) => [...prev, { type: 'remove_node', data }]);
    });

    socketRef.current.on('UI_COMMAND:REMOVE_EDGE', (data: any) => {
      console.log('[SOCKET] Remove Edge Recv:', data.id);
      setIncomingQueue((prev) => [...prev, { type: 'remove_edge', data }]);
    });

    socketRef.current.on('UI_COMMAND:UPDATE_WORKFLOW', (data: any) => {
      console.log('[SOCKET] Update Blueprint Recv:', data.blueprint);
      reconcileRef.current?.(data.blueprint);
    });

    // Listen for manual actions from custom components
    const handleManualRemoveNode = (e: any) => {
      const { id } = e.detail;
      
      // Update memory before emitting/deleting
      setNodes((prevNodes) => {
        const targetNode = prevNodes.find(n => n.id === id);
        if (targetNode) {
          setMessages(prev => memoryManager.logAction(prev, memoryManager.formatRemoveNode(id as string, targetNode.data.label as string)));
        }
        return prevNodes;
      });

      socketRef.current?.emit('UI_COMMAND:REMOVE_NODE', { id });
    };

    const handleManualSubmitReview = (e: any) => {
      const { id, feedback } = e.detail;
      const uuid = window.crypto.randomUUID();
      
      setNodes((prevNodes) => prevNodes.map(node => {
        if (node.id === id) {
          const reviews = (node.data?.reviews || []) as any[];
          return {
            ...node,
            data: { ...node.data, reviews: [...reviews, { text: feedback, uuid }] }
          };
        }
        return node;
      }));

      // Add to pending reviews queue instead of immediate submit
      setPendingReviews(prev => [...prev, { id, text: feedback, uuid }]);
    };

    const handleEditNodeReview = (e: any) => {
      const { id, uuid, newText } = e.detail;
      setPendingReviews(prev => prev.map(p => p.uuid === uuid ? { ...p, text: newText } : p));
      setNodes(prev => prev.map(n => {
        if (n.id === id) {
          return {
            ...n,
            data: { ...n.data, reviews: ((n.data.reviews || []) as any[]).map((r:any) => r.uuid === uuid ? { ...r, text: newText } : r) }
          };
        }
        return n;
      }));
    };

    const handleDeleteNodeReview = (e: any) => {
      const { id, uuid } = e.detail;
      setPendingReviews(prev => prev.filter(p => p.uuid !== uuid));
      setNodes(prev => prev.map(n => {
        if (n.id === id) {
          return {
            ...n,
            data: { ...n.data, reviews: ((n.data.reviews || []) as any[]).filter((r:any) => r.uuid !== uuid) }
          };
        }
        return n;
      }));
    };

    window.addEventListener('UI_ACTION:REMOVE_NODE' as any, handleManualRemoveNode);
    window.addEventListener('UI_ACTION:SUBMIT_NODE_REVIEW' as any, handleManualSubmitReview);
    window.addEventListener('UI_ACTION:EDIT_NODE_REVIEW' as any, handleEditNodeReview);
    window.addEventListener('UI_ACTION:DELETE_NODE_REVIEW' as any, handleDeleteNodeReview);

    return () => {
      socketRef.current?.disconnect();
      window.removeEventListener('UI_ACTION:REMOVE_NODE' as any, handleManualRemoveNode);
      window.removeEventListener('UI_ACTION:SUBMIT_NODE_REVIEW' as any, handleManualSubmitReview);
      window.removeEventListener('UI_ACTION:EDIT_NODE_REVIEW' as any, handleEditNodeReview);
      window.removeEventListener('UI_ACTION:DELETE_NODE_REVIEW' as any, handleDeleteNodeReview);
    };
  }, []);

  // Fetch saved workflows
  const fetchSavedWorkflows = async () => {
    try {
      const res = await fetch('/api/buildings'); // Reuse same endpoint but it uses Workflow model now
      const data = await res.json();
      setSavedWorkflows(data.data || []);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    }
  };

  useEffect(() => {
    fetchSavedWorkflows();
  }, []);

  // Process the incoming queue with a 1-second delay
  useEffect(() => {
    if (incomingQueue.length === 0) return;

    const processItem = async () => {
      const item = incomingQueue[0];
      
      if (item.type === 'node') {
        const newNode: Node = {
          ...item.data,
          position: { x: Math.random() * 400, y: Math.random() * 400 }, // Initial temp position
          type: 'workflowNode',
          // Removed the opacity: 0 that was hiding nodes until layout
        };
        
        setNodes((nds) => [...nds, newNode]);
      } else if (item.type === 'edge') {
        const newEdge: Edge = {
          ...item.data,
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 3, stroke: '#818cf8', opacity: 1 },
        };
        // Add to state using functional update to ensure we don't drop edges
        setEdges((eds) => {
          // Prevent duplicates
          if (eds.find(e => e.id === newEdge.id)) return eds;
          return [...eds, newEdge];
        });
      } else if (item.type === 'remove_node') {
        const nodeId = item.data.id;
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      } else if (item.type === 'remove_edge') {
        const edgeId = item.data.id;
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      }
      
      setIncomingQueue((prev) => prev.slice(1));
    };

    const timer = setTimeout(processItem, 800);
    return () => clearTimeout(timer);
  }, [incomingQueue, setNodes, setEdges]);

  // ELK Auto-layout whenever nodes or edges update
  useEffect(() => {
    // Run layout as soon as nodes exist, even while building
    if (nodes.length === 0) return;
    
    let isMounted = true;
    const timer = setTimeout(async () => {
      // Use current nodes and edges from state
      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(nodes, edges);
      
      if (!isMounted) return;

      // Only update if changes are significant (e.g. any node moved > 2px)
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
    }, 300); // Faster debounce for "living" feel

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [nodes.length, edges.length]);

  const ensureWorkflowId = useCallback(() => {
    if (!workflowId) {
      const newId = window.crypto.randomUUID();
      setWorkflowId(newId);
      return newId;
    }
    return workflowId;
  }, [workflowId]);

  const onConnect = useCallback(
    (params: any) => {
      console.log('[Execution] Entering onConnect', params);
      ensureWorkflowId();
      
      const newEdge: Edge = {
        ...params,
        id: `e-${params.source}-${params.target}`,
        type: 'smoothstep',
        animated: true,
        data: { manual: true }, // Mark as manual to protect from AI pruning
        style: { strokeWidth: 3, stroke: '#818cf8', opacity: 1 },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      
      // Update Socket
      socketRef.current?.emit('UI_COMMAND:ADD_EDGE', newEdge);
      
      // Update Memory
      setMessages(prev => memoryManager.logAction(prev, memoryManager.formatAddEdge(params.source, params.target)));
    },
    [setEdges, ensureWorkflowId]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      console.log('[Execution] Entering onEdgesDelete', deletedEdges.length);
      deletedEdges.forEach((edge) => {
        socketRef.current?.emit('UI_COMMAND:REMOVE_EDGE', { id: edge.id });
        setMessages(prev => memoryManager.logAction(prev, memoryManager.formatRemoveEdge(edge.source, edge.target)));
      });
    },
    []
  );

  const reconcileWorkflow = useCallback(async (blueprint: { nodes: string[], edges: {source: string, target: string}[] }) => {
    // Basic guard
    if (!blueprint || !blueprint.nodes) {
      console.error('[Architect] Received invalid blueprint:', blueprint);
      setIsArchitectThinking(false);
      return;
    }

    setIsArchitectThinking(true);
    ensureWorkflowId();
    
    try {
      // 1. Build the Node Library from the blueprint manifest
      const nodeLibrary = new Map<string, Node>();
      
      // We need current nodes to preserve reviews
      let currentNodes: Node[] = [];
      setNodes(prev => { currentNodes = prev; return prev; });

      blueprint.nodes.forEach(type => {
        const nodeInfo = NODE_TYPES[type as keyof typeof NODE_TYPES];
        if (!nodeInfo) return;

        // PRESERVE REVIEWS if the node already exists
        const existingNode = currentNodes.find(n => n.id === type);
        const existingReviews = (existingNode?.data?.reviews || []) as any[];

        nodeLibrary.set(type, {
          id: type,
          type: 'workflowNode',
          position: { x: Math.random() * 400, y: Math.random() * 400 }, // Initial fallback
          data: {
            label: nodeInfo.label,
            description: nodeInfo.desc,
            icon: nodeInfo.icon,
            color: nodeInfo.color,
            reviews: existingReviews
          }
        });
      });

      const validatedNodeIds = new Set(Array.from(nodeLibrary.keys()));
      const targetEdgeIds = new Set(blueprint.edges.map(e => `e-${e.source}-${e.target}`));

      // 2. Initial Cleanup
      setNodes(prev => prev.filter(n => validatedNodeIds.has(n.id)));
      setEdges(prev => prev.filter(e => {
        const isInBlueprint = targetEdgeIds.has(e.id);
        const isStillValidManual = e.data?.manual === true && validatedNodeIds.has(e.source) && validatedNodeIds.has(e.target);
        return isInBlueprint || isStillValidManual;
      }));
      
      await new Promise(r => setTimeout(r, 400));

      // 3. Sequential Build
      for (const id of Array.from(validatedNodeIds)) {
        const nodeObj = nodeLibrary.get(id);
        if (nodeObj) {
          setNodes(prev => {
            const existing = prev.find(n => n.id === nodeObj.id);
            if (existing) return prev;
            return [...prev, nodeObj];
          });
        }
      }
      
      await new Promise(r => setTimeout(r, 400));

      for (const edge of blueprint.edges) {
        const edgeId = `e-${edge.source}-${edge.target}`;
        const newEdge: Edge = {
          id: edgeId,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 3, stroke: '#818cf8', opacity: 1 }
        };

        setEdges(prev => {
          if (prev.find(e => e.id === edgeId)) return prev;
          return [...prev, newEdge];
        });
        
        await new Promise(r => setTimeout(r, 500));
      }

      await new Promise(r => setTimeout(r, 800));
    } catch (error) {
      console.error('[Architect] Reconciliation failed:', error);
    } finally {
      setIsArchitectThinking(false);
    }
  }, [setEdges, setNodes, ensureWorkflowId]); 

  const reconcilePreviewWorkflow = useCallback(async (blueprint: { nodes: string[], edges: {source: string, target: string}[] }) => {
    if (!blueprint || !blueprint.nodes) return;

    try {
      const nodeLibrary = new Map<string, Node>();
      
      blueprint.nodes.forEach(type => {
        const nodeInfo = NODE_TYPES[type as keyof typeof NODE_TYPES];
        if (!nodeInfo) return;

        // Preserve any pending reviews for this node
        const nodeReviews = pendingReviews.filter(r => r.id === type);

        nodeLibrary.set(type, {
          id: type,
          type: 'workflowNode',
          position: { x: Math.random() * 400, y: Math.random() * 400 },
          data: {
            label: nodeInfo.label,
            description: nodeInfo.desc,
            icon: nodeInfo.icon,
            color: nodeInfo.color,
            reviews: nodeReviews
          }
        });
      });

      const validatedNodeIds = new Set(Array.from(nodeLibrary.keys()));
      
      // Update proposed nodes and edges
      setProposedNodes(Array.from(nodeLibrary.values()));
      
      const newEdges: Edge[] = blueprint.edges.map(edge => ({
        id: `e-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: true,
        style: { strokeWidth: 3, stroke: '#818cf8', opacity: 1 }
      }));

      setProposedEdges(newEdges);

      // Trigger auto-layout for proposed elements
      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
        Array.from(nodeLibrary.values()), 
        newEdges
      );
      setProposedNodes(layoutedNodes);
      setProposedEdges(layoutedEdges);

    } catch (error) {
      console.error('[Preview] Reconciliation failed:', error);
    }
  }, [pendingReviews]);

  const handleAccept = () => {
    // Clear all temporary review notes when accepting the version
    const cleanNodes = proposedNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        reviews: []
      }
    }));

    setNodes(cleanNodes);
    setEdges(proposedEdges);
    
    if (assistantMessage) {
      setMessages(prev => [...prev, assistantMessage]);
    }
    setIsSplitView(false);
    setAssistantMessage(null);
  };

  const handleReject = () => {
    setIsSplitView(false);
    if (assistantMessage) {
      // 1. Permanently record the AI's proposal and the fact it was rejected (for AI memory)
      // 2. Add a proactive follow-up for the user to see immediately
      setMessages(prev => {
        const rejectedLog = memoryManager.logAction([assistantMessage], memoryManager.formatRejectAction());
        return [
          ...prev, 
          ...rejectedLog,
          { 
            role: 'assistant', 
            content: 'Understood. Let\'s pivot. Would you like me to suggest a more simplified approach, or should we refine the data-processing steps? I can also focus on adding more robust error handling if that\'s a priority.' 
          }
        ];
      });
    }
    setProposedNodes([]);
    setProposedEdges([]);
    setAssistantMessage(null);
  };

  // Sync reconcileWorkflow to ref for socket listener
  useEffect(() => {
    reconcileRef.current = reconcileWorkflow;
  }, [reconcileWorkflow]);

  const submitCommand = async (text: string) => {
    if ((!text.trim() && pendingReviews.length === 0) || isArchitectThinking) return;

    setIsArchitectThinking(true);
    ensureWorkflowId();
    
    // Aggregating pending reviews into one text block
    let aggregatedPrompt = "";
    pendingReviews.forEach(pr => {
      aggregatedPrompt += `[NODE_REVISION_REQUEST: ${pr.id}] "${pr.text}"\n`;
    });
    
    if (text.trim()) {
       aggregatedPrompt += `\nUser request:\n${text}`;
    }

    // SYNC: Inject the absolute source of truth (current JSON Blueprint) 
    // Prepare state sync
    const currentBlueprint = isSplitView ? {
      nodes: proposedNodes.map(n => ({ id: n.id, reviews: n.data.reviews || [] })),
      edges: proposedEdges.map(e => ({ source: e.source, target: e.target }))
    } : {
      nodes: nodes.map(n => ({ id: n.id, reviews: n.data.reviews || [] })),
      edges: edges.map(e => ({ source: e.source, target: e.target }))
    };
    
    // 1. Sync state (not shown in UI)
    // We replace the default [SYSTEM_SYNC] with a specific tag for clarity
    const syncData = memoryManager.formatCurrentState(currentBlueprint).replace('[SYSTEM_SYNC]', isSplitView ? '[PROPOSAL_SYNC]' : '[CURRENT_SYNC]');
    const messagesWithSync = memoryManager.logAction(messages, syncData);

    // 2. Add User Message to UI History
    const userMsg: MemoryMessage = { role: 'user', content: aggregatedPrompt.trim() };
    setMessages(prev => [...prev, userMsg]);

    // 3. Prepare full payload for AI
    const apiMessages = [...messagesWithSync, userMsg];

    // Clear UI state for next input
    setPendingReviews([]);
    setNodes(prev => prev.map(n => ({ ...n, data: { ...n.data, reviews: [] } })));

    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: apiMessages 
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const aiMessage: MemoryMessage = { 
          role: 'assistant', 
          content: data.message 
        };

        if (data.blueprint && data.blueprint.nodes && data.blueprint.nodes.length > 0) {
          setAssistantMessage(aiMessage);
          setIsSplitView(true);
          reconcilePreviewWorkflow(data.blueprint);
        } else {
          setMessages(prev => [...prev, aiMessage]);
          setAssistantMessage(null);
        }
      }
    } catch (error) {
      console.error('Failed to send command:', error);
    } finally {
      setIsArchitectThinking(false);
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() && pendingReviews.length === 0) return;
    const currentCommand = command;
    setCommand('');
    await submitCommand(currentCommand);
  };

  const handleSaveWorkflow = async () => {
    if (nodes.length === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workflowId,
          nodes, 
          edges, 
          name: `Workflow ${new Date().toLocaleTimeString()}` 
        }),
      });
      if (res.ok) {
        setNodes([]);
        setEdges([]);
        setWorkflowId(null);
        fetchSavedWorkflows();
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadWorkflow = (wf: any) => {
    setNodes(wf.nodes || []);
    setEdges(wf.edges || []);
    setWorkflowId(wf.workflowId || null);
  };

  const handleManualAddNode = (type: string) => {
    ensureWorkflowId();
    const nodeInfo = NODE_TYPES[type as keyof typeof NODE_TYPES];
    
    // Harmonize: Use the type-name as the ID (e.g. 'sql_source') 
    // so the AI can reconcile with it later. 
    // For uniqueness, we only add a suffix if it already exists.
    const existingCount = nodes.filter(n => n.id.startsWith(type)).length;
    const id = existingCount > 0 ? `${type}_${existingCount + 1}` : type;
    
    // Update memory for manual addition
    setMessages(prev => memoryManager.logAction(prev, memoryManager.formatAddNode(type, nodeInfo.label)));

    setIncomingQueue((prev) => [...prev, { 
      type: 'node', 
      data: {
        id,
        type: 'workflowNode',
        data: {
          label: nodeInfo.label,
          description: nodeInfo.desc,
          icon: nodeInfo.icon,
          color: nodeInfo.color // Restore color in manual addition
        }
      }
    }]);
  };

  const [rfInstance, setRfInstance] = useState<any>(null);

  // Trigger fitView only when the build is complete
  useEffect(() => {
    if (rfInstance && incomingQueue.length === 0 && (nodes.length > 0)) {
      const timer = setTimeout(() => {
        rfInstance.fitView({ padding: 0.5, duration: 800 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [incomingQueue.length, rfInstance, nodes.length]);

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200 antialiased font-sans">
      
      {/* Sidebar: Workflow History */}
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        savedWorkflows={savedWorkflows}
        isConnected={isConnected}
        loadWorkflow={loadWorkflow}
        handleManualAddNode={handleManualAddNode}
      />

      {/* Main Workspace: React Flow Canvas */}
      <main className="flex-1 flex flex-row relative min-w-0">
        
        <div className="flex-1 flex flex-col relative min-w-0">
          {/* Header/Controls */}
          <Header 
            workflowId={workflowId}
            onClearCanvas={() => { 
              setNodes([]); 
              setEdges([]); 
              setMessages([]); // Reset memory when the board is cleared
              setWorkflowId(null);
            }}
            handleSaveWorkflow={handleSaveWorkflow}
            nodesLength={nodes.length}
            isSaving={isSaving}
          />

          {/* The Graph Canvas */}
          <div className={`flex-1 relative bg-slate-950 flex ${isSplitView ? 'flex-col' : 'flex-col'}`}>
            <div className={`relative ${isSplitView ? 'flex-1 border-b border-slate-800' : 'h-full w-full'}`}>
              {isSplitView && (
                <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-slate-900/80 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-800">
                  Current Version
                </div>
              )}
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgesDelete={onEdgesDelete}
                nodeTypes={nodeTypes}
                connectionLineType={ConnectionLineType.SmoothStep}
                onInit={setRfInstance}
                minZoom={0.2}
                maxZoom={1.5}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#1e293b" gap={24} size={1} />
                <Controls className="!bg-slate-900 !shadow-2xl !border-slate-800 !rounded-xl overflow-hidden !fill-white" />
                
                {!isSplitView && (
                  <Panel position="top-right" className="bg-slate-900/80 backdrop-blur p-2 rounded-xl border border-slate-800 shadow-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto-Layout: ELK Layered</span>
                      </div>
                  </Panel>
                )}
              </ReactFlow>
            </div>

            {isSplitView && (
              <div className="relative flex-1 bg-slate-900/10">
                  <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-indigo-600/80 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest border border-indigo-500">
                    Proposed Version
                  </div>
                  <ReactFlow
                    nodes={proposedNodes}
                    edges={proposedEdges}
                    onNodesChange={onProposedNodesChange}
                    onEdgesChange={onProposedEdgesChange}
                    nodeTypes={nodeTypes}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    minZoom={0.2}
                    maxZoom={1.5}
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background color="#1e293b" gap={24} size={1} />
                    <Controls className="!bg-slate-900 !shadow-2xl !border-slate-800 !rounded-xl overflow-hidden !fill-white" />
                  </ReactFlow>

                  {/* Accept/Reject Overlay */}
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-col gap-1 mr-4">
                      <span className="text-xs font-bold text-slate-200">Review AI changes?</span>
                      <span className="text-[10px] text-slate-500">Approving will update the live workspace.</span>
                    </div>
                    <button 
                      onClick={handleReject}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-slate-700"
                    >
                      Discard Changes
                    </button>
                    <button 
                      onClick={handleAccept}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Apply Updates
                    </button>
                  </div>
              </div>
            )}

            {/* AI Status Overlay - Show when items are in queue OR we are in split view preview */}
            <AnimatePresence>
              {(isSplitView || incomingQueue.filter(i => i.type !== 'node' || !i.data.id?.includes('manual')).length > 0) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-2xl shadow-indigo-900/40"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span className="tracking-wide">
                    {isSplitView ? 'Architect has proposed updates...' : 'Architect is designing workflow...'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Sidebar: Chat Interface */}
        <ChatBar 
          messages={messages}
          command={command}
          setCommand={setCommand}
          handleSendCommand={handleSendCommand}
          isArchitectThinking={isArchitectThinking}
          pendingReviews={pendingReviews}
          assistantMessage={assistantMessage}
        />
      </main>
    </div>
  );
}
