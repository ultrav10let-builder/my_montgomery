import React from 'react';
import { FileText, ChevronRight, RefreshCw, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FullDigest } from '../types';
import { format } from 'date-fns';
import { safeFormat } from '../utils/dateUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CivicDigestProps {
  digest: FullDigest | null;
  loading: boolean;
  onRefresh: (token: string) => void;
}

export function CivicDigest({ digest, loading, onRefresh }: CivicDigestProps) {
  const handleAdminRefresh = () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      const input = prompt("Enter Admin Token:");
      if (input) {
        localStorage.setItem('admin_token', input);
        onRefresh(input);
      }
    } else {
      onRefresh(token);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-civic-red" />
          <h2 className="font-semibold">Today in Montgomery</h2>
        </div>
        <button 
          onClick={handleAdminRefresh}
          className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-civic-blue"
          title="Refresh Digest (Admin)"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>
      
      {digest && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            Last Updated: {safeFormat(digest.createdAt, 'MMM d, h:mm a')}
          </span>
          <div className="flex gap-2">
            {digest.sources.slice(0, 3).map((s, i) => (
              <a key={i} href={s} target="_blank" rel="noopener noreferrer" className="text-[10px] text-civic-blue hover:underline flex items-center gap-0.5">
                Source {i+1} <ExternalLink className="w-2 h-2" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode='popLayout'>
          {loading && !digest ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                <div className="h-3 bg-slate-50 rounded w-full"></div>
                <div className="h-3 bg-slate-50 rounded w-1/2"></div>
              </div>
            ))
          ) : (
            digest?.items.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-civic-red opacity-70">{item.source}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.summary}</p>
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-[10px] font-bold text-slate-400 hover:text-civic-blue transition-colors"
                >
                  VIEW SOURCE <ChevronRight className="w-3 h-3 ml-1" />
                </a>
                {idx < digest.items.length - 1 && <div className="h-px bg-slate-100 mt-4" />}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
