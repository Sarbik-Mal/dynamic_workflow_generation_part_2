import React from 'react';
import { 
  Workflow as WorkflowIcon, 
  Plus, 
  ChevronRight, 
  Database, 
  History, 
  Zap 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NODE_TYPES } from '@/lib/nodes';
import { IconMap } from './icons';

interface SidebarProps {
  activeTab: 'history' | 'library';
  setActiveTab: (tab: 'history' | 'library') => void;
  savedWorkflows: any[];
  isConnected: boolean;
  loadWorkflow: (wf: any) => void;
  handleManualAddNode: (type: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  savedWorkflows,
  isConnected,
  loadWorkflow,
  handleManualAddNode
}) => {
  return (
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
  );
};
