import React from 'react';
import { Command, ArrowRight } from 'lucide-react';

interface CommandBarProps {
  command: string;
  setCommand: (cmd: string) => void;
  handleSendCommand: (e: React.FormEvent) => void;
  isArchitectThinking: boolean;
  pendingReviews: {id: string, text: string, uuid: string}[];
}

export const CommandBar: React.FC<CommandBarProps> = ({
  command,
  setCommand,
  handleSendCommand,
  isArchitectThinking,
  pendingReviews
}) => {
  return (
    <div className="p-8 bg-slate-900 border-t border-slate-800 z-20">
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        
        {/* Pending Reviews Queue UI */}
        {pendingReviews.length > 0 && (
          <div className="flex flex-col gap-1 px-4 pointer-events-none mb-2">
             {pendingReviews.map(pr => (
               <div key={pr.uuid} className="text-[11px] text-slate-400 font-medium">
                  Added review for node <span className="font-bold text-indigo-400 uppercase">{pr.id}</span>
               </div>
             ))}
          </div>
        )}

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
  );
};
