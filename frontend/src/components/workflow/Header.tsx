import React from 'react';
import { Box, Workflow as WorkflowIcon, Sparkles, Save } from 'lucide-react';

interface HeaderProps {
  workflowId: string | null;
  onClearCanvas: () => void;
  handleSaveWorkflow: () => void;
  nodesLength: number;
  isSaving: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  workflowId,
  onClearCanvas,
  handleSaveWorkflow,
  nodesLength,
  isSaving
}) => {
  return (
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
          onClick={onClearCanvas}
          className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
        >
          Clear Canvas
        </button>
        <button 
          onClick={handleSaveWorkflow}
          disabled={nodesLength === 0 || isSaving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-900/20 flex items-center gap-2 transition-all active:scale-95 disabled:grayscale disabled:opacity-50"
        >
          {isSaving ? <Sparkles className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Architecture
        </button>
      </div>
    </header>
  );
};
