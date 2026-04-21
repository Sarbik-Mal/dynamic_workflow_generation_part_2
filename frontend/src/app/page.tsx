'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  Background,
  Controls,
  ConnectionLineType,
  BaseEdge,
  getBezierPath,
  EdgeProps,
} from '@xyflow/react';
import { 
  Database,
  History,
  Box,
  CheckCircle2,
  TowerControl as Tower,
  ChevronRight,
  Sparkles,
  Command,
  Send,
  Workflow as WorkflowIcon,
  Zap,
  ArrowRight,
  Save,
  Plus,
  FileText,
  Code,
  Filter,
  Leaf,
  Cloud,
  Globe,
  MessageSquare,
  AlertTriangle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { io, Socket } from 'socket.io-client';
import { getLayoutedElements } from '@/lib/layout';
import { NODE_TYPES } from '@/lib/nodes';
import { memoryManager } from '@/lib/memory';

/**
 * UTILITIES
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * CUSTOM COMPONENTS
 */

// Mapping icon names to Lucide components
const IconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-4 h-4" />,
  Code: <Code className="w-4 h-4" />,
  Filter: <Filter className="w-4 h-4" />,
  Database: <Database className="w-4 h-4" />,
  Leaf: <Leaf className="w-4 h-4" />,
  Cloud: <Cloud className="w-4 h-4" />,
  Globe: <Globe className="w-4 h-4" />,
  MessageSquare: <MessageSquare className="w-4 h-4" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
};

// Custom Node Component to preserve the premium 3D aesthetic
const WorkflowNode = ({ data, id }: any) => {
  return (
    <div className={cn(
      "group relative p-4 rounded-xl border-b-4 w-60 shadow-2xl transition-all hover:-translate-y-1 bg-slate-900/90 backdrop-blur-xl border-slate-800",
      data.color === 'red' && "border-red-500/50 shadow-red-500/10",
      data.color === 'orange' && "border-orange-500/50 shadow-orange-500/10",
      data.color === 'yellow' && "border-amber-500/50 shadow-amber-500/10",
      data.color === 'green' && "border-emerald-500/50 shadow-emerald-500/10",
      data.color === 'blue' && "border-blue-500/50 shadow-blue-500/10",
      data.color === 'indigo' && "border-indigo-500/50 shadow-indigo-500/10",
      data.color === 'violet' && "border-violet-500/50 shadow-violet-500/10",
      data.color?.startsWith('slate') && "border-slate-600/50 shadow-slate-600/10"
    )}>
      {/* Delete Button */}
      <button 
        onClick={() => {
          window.dispatchEvent(new CustomEvent('UI_ACTION:REMOVE_NODE', { detail: { id } }));
        }}
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 items-center justify-center text-slate-500 hover:text-red-400 hover:border-red-500/50 transition-all opacity-0 group-hover:opacity-100 z-50 flex shadow-xl"
      >
        <X className="w-3 h-3" />
      </button>

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2"
      >
        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-400 !border-none" />
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg",
              data.color === 'red' && "bg-red-500 shadow-red-500/20",
              data.color === 'orange' && "bg-orange-500 shadow-orange-500/20",
              data.color === 'yellow' && "bg-amber-400 shadow-amber-400/20",
              data.color === 'green' && "bg-emerald-500 shadow-emerald-500/20",
              data.color === 'blue' && "bg-blue-500 shadow-blue-500/20",
              data.color === 'indigo' && "bg-indigo-500 shadow-indigo-500/20",
              data.color === 'violet' && "bg-violet-600 shadow-violet-600/20",
              data.color?.startsWith('slate') && "bg-slate-600 shadow-slate-600/20"
            )}>
              {IconMap[data.icon] || <Zap className="w-4 h-4" />}
            </div>
            <div className="flex flex-col items-end">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mb-1" />
              <p className="text-[10px] font-black font-mono text-slate-600 tracking-tighter uppercase">ONLINE</p>
            </div>
          </div>
          
          <div>
            <h3 className="font-bold text-slate-100 text-sm leading-tight">{data.label}</h3>
            <p className="text-[10px] text-slate-400 font-medium leading-tight mt-1">{data.description}</p>
          </div>
        </div>

        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-400 !border-none" />
        
        {/* Glossy Overlay */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </motion.div>
    </div>
  );
};

const nodeTypes = {
  workflowNode: WorkflowNode,
};

/**
 * MAIN PAGE COMPONENT
 */
export default function WorkflowVisualizer() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [command, setCommand] = useState('');
  const [isArchitectThinking, setIsArchitectThinking] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'library'>('library');
  const [incomingQueue, setIncomingQueue] = useState<{ type: 'node' | 'edge' | 'remove_node' | 'remove_edge', data: any }[]>([]);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const reconcileRef = useRef<any>(null);

  // Initialize WebSocket
  useEffect(() => {
    socketRef.current = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000');

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
      console.log('[SOCKET] Update Workflow Recv:', data.workflow);
      reconcileRef.current?.(data.workflow);
    });

    // Listen for manual actions from custom components
    const handleManualRemoveNode = (e: any) => {
      const { id } = e.detail;
      
      // Update memory before emitting/deleting
      setNodes((prevNodes) => {
        const targetNode = prevNodes.find(n => n.id === id);
        if (targetNode) {
          setMessages(prev => memoryManager.logAction(prev, memoryManager.formatRemoveNode(id, targetNode.data.label)));
        }
        return prevNodes;
      });

      socketRef.current?.emit('UI_COMMAND:REMOVE_NODE', { id });
    };

    window.addEventListener('UI_ACTION:REMOVE_NODE' as any, handleManualRemoveNode);

    return () => {
      socketRef.current?.disconnect();
      window.removeEventListener('UI_ACTION:REMOVE_NODE' as any, handleManualRemoveNode);
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

  const reconcileWorkflow = useCallback(async (logicalWorkflow: any[]) => {
    setIsArchitectThinking(true);
    ensureWorkflowId();
    
    // 1. Identify all unique nodes and build their configurations
    const nodeTypesFound = new Set<string>();
    logicalWorkflow.forEach(step => {
      if (step.node_name && step.node_name !== 'none') nodeTypesFound.add(step.node_name);
      if (step.source && step.source !== 'none') nodeTypesFound.add(step.source);
      if (step.target && step.target !== 'none') nodeTypesFound.add(step.target);
    });

    const nodeLibrary = new Map<string, Node>();
    nodeTypesFound.forEach(type => {
      // STRICT VALIDATION: Only render nodes that exist in our actual library
      const nodeInfo = NODE_TYPES[type as keyof typeof NODE_TYPES];
      if (!nodeInfo) {
        console.warn(`[Architect] Skipping invalid node type: ${type}`);
        return;
      }

      const existingNode = nodes.find(n => n.id === type);
      nodeLibrary.set(type, {
        id: type,
        type: 'workflowNode',
        position: existingNode?.position || { x: Math.random() * 400, y: Math.random() * 400 },
        data: {
          label: nodeInfo.label,
          description: nodeInfo.desc,
          icon: nodeInfo.icon,
          color: nodeInfo.color
        }
      });
    });

    // Re-calculate nodesFound based on successfully created library entries
    const validatedNodeIds = new Set(Array.from(nodeLibrary.keys()));

    // 2. Identify all target edges for cleanup
    const targetEdgeIds = new Set<string>();
    logicalWorkflow.forEach(step => {
      if (step.source && step.source !== 'none' && step.node_name && step.node_name !== 'none') {
        targetEdgeIds.add(`e-${step.source}-${step.node_name}`);
      }
      if (step.target && step.target !== 'none' && step.node_name && step.node_name !== 'none') {
        targetEdgeIds.add(`e-${step.node_name}-${step.target}`);
      }
    });

    // 3. Initial Cleanup (Remove obsolete elements first)
    setNodes(prev => prev.filter(n => validatedNodeIds.has(n.id)));
    setEdges(prev => prev.filter(e => targetEdgeIds.has(e.id)));
    
    await new Promise(r => setTimeout(r, 400));

    // 4. Sequential Build (Process each logical step)
    for (const step of logicalWorkflow) {
      const stepNodeTypes = [];
      if (step.source && step.source !== 'none') stepNodeTypes.push(step.source);
      if (step.node_name && step.node_name !== 'none') stepNodeTypes.push(step.node_name);
      if (step.target && step.target !== 'none') stepNodeTypes.push(step.target);

      // Add nodes involved in this specific step
      for (const type of stepNodeTypes) {
        const nodeObj = nodeLibrary.get(type);
        if (nodeObj) {
          setNodes(prev => {
            if (prev.find(n => n.id === nodeObj.id)) return prev;
            return [...prev, nodeObj];
          });
        }
      }
      
      await new Promise(r => setTimeout(r, 400)); // Visual pause for nodes

      // Add connections for this specific step
      const stepEdges: Edge[] = [];
      if (step.source && step.source !== 'none' && step.node_name && step.node_name !== 'none') {
        stepEdges.push({
          id: `e-${step.source}-${step.node_name}`,
          source: step.source,
          target: step.node_name,
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 3, stroke: '#818cf8', opacity: 1 }
        });
      }
      if (step.target && step.target !== 'none' && step.node_name && step.node_name !== 'none') {
        stepEdges.push({
          id: `e-${step.node_name}-${step.target}`,
          source: step.node_name,
          target: step.target,
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 3, stroke: '#818cf8', opacity: 1 }
        });
      }

      if (stepEdges.length > 0) {
        setEdges(prev => {
          const newEdges = [...prev];
          stepEdges.forEach(se => {
            if (!newEdges.find(e => e.id === se.id)) newEdges.push(se);
          });
          return newEdges;
        });
        await new Promise(r => setTimeout(r, 600)); // Visual pause for edges & layout
      }
    }

    setIsArchitectThinking(false);
  }, [nodes, edges]);

  // Sync reconcileWorkflow to ref for socket listener
  useEffect(() => {
    reconcileRef.current = reconcileWorkflow;
  }, [reconcileWorkflow]);

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isArchitectThinking) return;

    const currentCommand = command;
    setCommand('');
    setIsArchitectThinking(true);
    
    ensureWorkflowId();

    // Optimistically append the user message
    const newMessages = [...messages, { role: 'user', content: currentCommand }];
    setMessages(newMessages);

    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages // PASSING PROPER HISTORY TO AI
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Save the AI's actions to memory so it knows what it did in future turns
        setMessages(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            content: `I executed the following workflow actions: ${JSON.stringify(data.workflow)}`
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to send command:', error);
    } finally {
      setIsArchitectThinking(false);
    }
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
    const id = `${type}-${Date.now()}`;
    
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
  }, [incomingQueue.length, rfInstance]);

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-200 antialiased font-sans">
      
      {/* Sidebar: Workflow History */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-10">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
              <WorkflowIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight text-white leading-none">Architect</h1>
              <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Workflow Engine</p>
            </div>
          </div>
          
          <div className="flex mt-6 p-1 bg-slate-800 rounded-xl">
            <button 
              onClick={() => setActiveTab('library')}
              className={cn(
                "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                activeTab === 'library' ? "bg-slate-700 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Library
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                activeTab === 'history' ? "bg-slate-700 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
              )}
            >
              Archives
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {activeTab === 'library' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                <span className="flex items-center gap-2">Built-in Modules</span>
              </div>
              <div className="grid gap-2">
                {Object.entries(NODE_TYPES).map(([id, info]) => (
                  <button
                    key={id}
                    onClick={() => handleManualAddNode(id)}
                    className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-900/30 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all group flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      {IconMap[info.icon] || <Zap className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-200 text-[11px] leading-tight">{info.label}</p>
                      <p className="text-[9px] text-slate-500 font-medium truncate w-40">{info.desc}</p>
                    </div>
                    <Plus className="w-3 h-3 text-slate-600 ml-auto group-hover:text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 mb-4">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <History className="w-3 h-3" />
                  Saved Archives
                </h2>
                <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{savedWorkflows.length}</span>
              </div>
              
              {savedWorkflows.map((wf) => (
                <button
                  key={wf._id}
                  onClick={() => loadWorkflow(wf)}
                  className="w-full text-left p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all group relative overflow-hidden bg-slate-900/50 shadow-sm"
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <p className="font-bold text-slate-200 text-sm truncate w-48">{wf.name || 'Legacy workflow'}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        {new Date(wf.createdAt).toLocaleDateString()} at {new Date(wf.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-900/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150" />
                </button>
              ))}
              
              {savedWorkflows.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 opacity-30 px-6 text-center">
                  <Database className="w-12 h-12 mb-4 text-slate-400" />
                  <p className="text-xs font-bold uppercase tracking-widest">No workflows stored</p>
                  <p className="text-[10px] mt-2 font-medium">Build and save your first process architecture.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            )} />
            <p className="text-[11px] font-bold text-slate-400">
              {isConnected ? "Engine Hot (Syncing)" : "Engine Cold (Disconnected)"}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Workspace: React Flow Canvas */}
      <main className="flex-1 flex flex-col relative">
        
        {/* Header/Controls */}
        <header className="h-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-6">
            <div className="px-3 py-1.5 bg-slate-800 rounded-lg flex items-center gap-2 border border-slate-700">
              <Box className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-300">Canvas Node: v4.2</span>
            </div>
            
            {workflowId && (
              <div className="px-3 py-1.5 bg-indigo-900/30 rounded-lg flex items-center gap-2 border border-indigo-500/30">
                <WorkflowIcon className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-mono text-indigo-300">ID: {workflowId.slice(0, 8)}...</span>
              </div>
            )}
            
            <div className="h-6 w-px bg-slate-800" />
            
            <nav className="flex items-center gap-4">
               {['Nodes', 'Edges', 'Layout'].map(tab => (
                 <button key={tab} className="text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest">
                   {tab}
                 </button>
               ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => { 
                setNodes([]); 
                setEdges([]); 
                setMessages([]); // Reset memory when the board is cleared
                setWorkflowId(null);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
            >
              Clear Canvas
            </button>
            <button 
              onClick={handleSaveWorkflow}
              disabled={nodes.length === 0 || isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-900/20 flex items-center gap-2 transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
            >
              {isSaving ? <Sparkles className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Architecture
            </button>
          </div>
        </header>

        {/* The Graph Canvas */}
        <div className="flex-1 relative bg-slate-950">
           <ReactFlow
             nodes={nodes}
             edges={edges}
             onNodesChange={onNodesChange}
             onEdgesChange={onEdgesChange}
             nodeTypes={nodeTypes}
             connectionLineType={ConnectionLineType.SmoothStep}
             onInit={setRfInstance}
             minZoom={0.2}
             maxZoom={1.5}
             proOptions={{ hideAttribution: true }}
           >
             <Background color="#1e293b" gap={24} size={1} />
             <Controls className="!bg-slate-900 !shadow-2xl !border-slate-800 !rounded-xl overflow-hidden !fill-white" />
             
             <Panel position="top-right" className="bg-slate-900/80 backdrop-blur p-2 rounded-xl border border-slate-800 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auto-Layout: ELK Layered</span>
                </div>
             </Panel>
           </ReactFlow>

           {/* AI Status Overlay */}
           <AnimatePresence>
             {isArchitectThinking && (
               <motion.div 
                 initial={{ opacity: 0, scale: 0.9 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.9 }}
                 className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-2xl shadow-indigo-900/40"
               >
                 <Sparkles className="w-4 h-4 animate-pulse" />
                 <span className="tracking-wide">Architect is designing workflow...</span>
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Command Bar Interface */}
        <div className="p-8 bg-slate-900 border-t border-slate-800 z-20">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSendCommand} className="relative group/input shadow-3xl rounded-2xl overflow-hidden bg-slate-800 p-1">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none z-10">
                <Command className="w-5 h-5 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
              </div>
              <input 
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Describe your workflow (e.g. 'Read CSV then convert to JSON and save to Mongo')..."
                disabled={isArchitectThinking}
                className="w-full bg-slate-900 border-none rounded-xl py-5 pl-16 pr-16 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-white placeholder:text-slate-600 disabled:opacity-60"
              />
              <button 
                type="submit"
                disabled={!command.trim() || isArchitectThinking}
                className="absolute inset-y-3 right-3 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-0 disabled:scale-95 flex items-center justify-center shadow-lg shadow-indigo-900/40"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
            
            <div className="mt-4 flex items-center justify-center gap-6 opacity-40">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Suggestions:</p>
               {['CSV to SQL', 'API to Slack', 'Mongo to S3'].map(s => (
                 <button 
                   key={s}
                   onClick={() => setCommand(s)} 
                   className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                 >
                   {s}
                 </button>
               ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
