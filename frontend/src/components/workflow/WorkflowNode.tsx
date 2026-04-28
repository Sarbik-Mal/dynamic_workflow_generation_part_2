import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, MessageSquare, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconMap } from './icons';

export const WorkflowNode = ({ data, id }: any) => {
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;
    
    window.dispatchEvent(new CustomEvent('UI_ACTION:SUBMIT_NODE_REVIEW', { 
      detail: { id, feedback: reviewText.trim(), isProposed: !!data.isProposed } 
    }));
    
    setReviewText('');
    setIsReviewing(false);
  };

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
      
      {/* Review Labels (Always Shown) */}
      <div className="absolute -top-4 left-0 w-full flex flex-col-reverse gap-1 items-start pointer-events-none nodrag mb-2 -translate-y-full">
        <AnimatePresence>
          {data.reviews?.map((review: any, idx: number) => {
            const isEditing = editingReviewId === review.uuid;
            return (
              <motion.div
                key={`${id}-review-${review.uuid || idx}`}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingReviewId(review.uuid);
                }}
                className={cn(
                  "backdrop-blur-md text-white px-2 py-1.5 rounded-lg shadow-lg pointer-events-auto flex items-center gap-2 w-[280px]",
                  isEditing ? "bg-slate-800 border-2 border-indigo-500/80" : "bg-indigo-900/95 border border-indigo-400/50"
                )}
              >
                <Sparkles className="w-3 h-3 shrink-0 text-indigo-300" />
                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={review.text}
                    onChange={(e) => {
                      window.dispatchEvent(new CustomEvent('UI_ACTION:EDIT_NODE_REVIEW', { 
                        detail: { id, uuid: review.uuid, newText: e.target.value, isProposed: !!data.isProposed } 
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingReviewId(null);
                      }
                    }}
                    onBlur={() => setEditingReviewId(null)}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-400 flex-1 min-w-0 nodrag shadow-inner"
                  />
                ) : (
                  <span className="text-[10px] font-bold flex-1 min-w-0 truncate select-none nodrag cursor-text">
                    {review.text}
                  </span>
                )}
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('UI_ACTION:DELETE_NODE_REVIEW', { detail: { id, uuid: review.uuid, isProposed: !!data.isProposed } }));
                  }}
                  className="hover:text-red-400 text-slate-400 transition-colors shrink-0 ml-1 p-0.5 nodrag bg-slate-800/50 rounded-md"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Action Buttons (Hover) */}
      <div className="absolute -top-2 -right-2 flex gap-1 z-50 opacity-0 group-hover:opacity-100 transition-all nodrag">
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsReviewing(!isReviewing);
          }}
          className={cn(
            "w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center transition-all shadow-xl",
            isReviewing ? "text-indigo-400 border-indigo-500/50 bg-slate-700" : "text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50"
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('UI_ACTION:REMOVE_NODE', { detail: { id } }));
          }}
          className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-red-400 hover:border-red-500/50 transition-all shadow-xl"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Review Input Box */}
      <AnimatePresence>
        {isReviewing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute inset-x-0 -top-[2.5rem] bg-slate-800 border border-indigo-500/30 rounded-xl p-2 shadow-2xl z-[60] nodrag"
          >
            <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); handleSubmitReview(e); }} className="flex gap-2">
              <input 
                autoFocus
                type="text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="What to modify? (Press Enter)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-indigo-500 nodrag"
              />
            </form>
          </motion.div>
        )}
      </AnimatePresence>

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
