export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Standardizes how manual actions are logged into the AI's conversation history.
 * We use the 'user' role with a [SYSTEM] prefix because many AI clients 
 * handle subsequent system messages inconsistently.
 */
export const memoryManager = {
  /**
   * Appends an action log to the history
   */
  logAction: (messages: MemoryMessage[], action: string): MemoryMessage[] => {
    const isGraphSync = action.includes('CURRENT_CANVAS_GRAPH');
    
    // We will keep historical syncs but label them to save token focus for the current state.
    // Instead of filtering, we rename previous syncs to [PAST_SYNC].
    const updatedMessages = messages.map(m => {
      if (m.content.includes('CURRENT_CANVAS_GRAPH') && !m.content.includes('[CURRENT_SYNC]')) {
        return { 
          ...m, 
          content: m.content.replace('[SYSTEM_SYNC]', '[PAST_SYNC]') 
        };
      }
      return m;
    });

    const prefix = isGraphSync ? '[CURRENT_SYNC]' : '[SYSTEM_LOG]';
    const content = `${prefix} ${action.replace('[SYSTEM_SYNC] ', '')}`;

    return [
      ...updatedMessages,
      { role: 'user', content }
    ];
  },

  /**
   * Formats a node addition action
   */
  formatAddNode: (type: string, label: string): string => {
    return `User manually added a new node of type: "${type}" (Label: "${label}").`;
  },

  /**
   * Formats a node removal action
   */
  formatRemoveNode: (id: string, label: string): string => {
    return `User manually deleted the node: "${id}" (Label: "${label}").`;
  },

  /**
   * Formats an edge removal action
   */
  formatRemoveEdge: (sourceId: string, targetId: string): string => {
    return `User manually deleted the connection between "${sourceId}" and "${targetId}".`;
  },

  /**
   * Formats an edge addition action
   */
  formatAddEdge: (sourceId: string, targetId: string): string => {
    return `User manually created a connection from "${sourceId}" to "${targetId}".`;
  },

  /**
   * Formats the entire current workflow JSON for memory syncing (Blueprint format)
   */
  formatCurrentState: (blueprint: any): string => {
    return `[SYSTEM_SYNC] CURRENT_CANVAS_GRAPH: ${JSON.stringify(blueprint)}. This is the absolute ground truth of what is currently visible to the user.`;
  },
  /**
   * Formats a workflow rejection action
   */
  formatRejectAction: (): string => {
    return `User explicitly REJECTED and DISCARDED the last proposed workflow update. Please apologize and suggest alternative changes or a different approach to solve their request.`;
  }
};
