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
  /**
   * Appends an action log to the history.
   * If the action is a CURRENT_CANVAS_GRAPH update, it removes all previous 
   * instances to prevent memory bloat and keep the history clean.
   */
  logAction: (messages: MemoryMessage[], action: string): MemoryMessage[] => {
    const isGraphSync = action.includes('CURRENT_CANVAS_GRAPH');
    
    // If we are providing a new state sync, remove old ones to save tokens and avoid confusion
    const filteredMessages = isGraphSync 
      ? messages.filter(m => !m.content.includes('CURRENT_CANVAS_GRAPH'))
      : messages;

    // Avoid double prefixing if the action already contains [SYSTEM_SYNC]
    const content = action.startsWith('[SYSTEM_SYNC]') ? action : `[SYSTEM_SYNC] ${action}`;

    return [
      ...filteredMessages,
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
   * Formats the entire current workflow JSON for memory syncing
   */
  formatCurrentState: (workflow: any[]): string => {
    return `[SYSTEM_SYNC] CURRENT_CANVAS_GRAPH: ${JSON.stringify(workflow)}. This is the absolute ground truth of what is currently visible to the user.`;
  }
};
