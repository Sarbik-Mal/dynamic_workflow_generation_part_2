import React from 'react';
import { 
  Database,
  FileText,
  Code,
  Filter,
  Leaf,
  Cloud,
  Globe,
  MessageSquare,
  AlertTriangle,
  Zap
} from 'lucide-react';

export const IconMap: Record<string, React.ReactNode> = {
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
