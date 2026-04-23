import React, { useEffect, useRef } from 'react';
import { Command, ArrowRight, User, Bot, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MemoryMessage } from '@/lib/memory';

interface ChatBarProps {
  messages: MemoryMessage[];
  command: string;
  setCommand: (cmd: string) => void;
  handleSendCommand: (e: React.FormEvent) => void;
  isArchitectThinking: boolean;
  pendingReviews: {id: string, text: string, uuid: string}[];
}

export const ChatBar: React.FC<ChatBarProps> = ({
  messages,
  command,
  setCommand,
  handleSendCommand,
  isArchitectThinking,
  pendingReviews
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages to show only relevant conversational ones
  // We hide system syncs and internal logs from the user view
  const displayMessages = messages.filter(m => 
    !m.content.includes('[CURRENT_SYNC]') && 
    !m.content.includes('[PAST_SYNC]') &&
    !m.content.includes('[SYSTEM_LOG]') &&
    !m.content.includes('[SYSTEM_SYNC]')
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages, isArchitectThinking]);

  return (
    <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl relative z-30">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">Architect Assistant</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide"
      >
        <AnimatePresence initial={false}>
          {displayMessages.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-300">How can I help you today?</p>
                <p className="text-xs text-slate-500 mt-1">Start by describing a workflow or just say hello!</p>
              </div>
            </motion.div>
          )}

          {displayMessages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex items-start gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center mt-1 ${
                  msg.role === 'user' ? 'bg-slate-700' : 'bg-indigo-600/20 text-indigo-400'
                }`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-slate-300" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-slate-800 text-slate-200 rounded-tr-none' 
                    : 'bg-indigo-600/10 text-slate-300 border border-indigo-500/10 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            </motion.div>
          ))}

          {isArchitectThinking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2"
            >
              <div className="w-6 h-6 rounded-md bg-indigo-600/20 flex items-center justify-center mt-1">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/10 rounded-tl-none">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md">
        {/* Pending Reviews Queue UI */}
        {pendingReviews.length > 0 && (
          <div className="flex flex-col gap-1 px-1 mb-3">
             {pendingReviews.map(pr => (
               <div key={pr.uuid} className="text-[10px] text-slate-500 font-medium flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                  <span>Review for node <span className="font-bold text-indigo-400 uppercase">{pr.id}</span></span>
               </div>
             ))}
          </div>
        )}

        <form onSubmit={handleSendCommand} className="relative group/input">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none z-10">
            <Command className="w-4 h-4 text-slate-600 group-focus-within/input:text-indigo-400 transition-colors" />
          </div>
          <input 
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Type a command or chat..."
            disabled={isArchitectThinking}
            className="w-full bg-slate-800 border-none rounded-xl py-3 pl-10 pr-12 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-white placeholder:text-slate-600 disabled:opacity-60"
          />
          <button 
            type="submit"
            disabled={!command.trim() || isArchitectThinking}
            className="absolute inset-y-1.5 right-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all disabled:opacity-0 disabled:scale-95 flex items-center justify-center shadow-lg shadow-indigo-900/40"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
           {['Add Source', 'Help', 'Clear'].map(s => (
             <button 
               key={s}
               type="button"
               onClick={() => setCommand(s)} 
               className="text-[9px] font-bold text-slate-600 hover:text-indigo-400 transition-colors uppercase tracking-widest bg-slate-800/50 px-2 py-1 rounded-md"
             >
               {s}
             </button>
           ))}
        </div>
      </div>
    </div>
  );
};
