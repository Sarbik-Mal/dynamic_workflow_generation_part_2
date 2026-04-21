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
    return [
      ...messages,
      { role: 'user', content: `[SYSTEM_SYNC] ${action}` }
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
   * Formats the entire current workflow JSON for memory syncing
   */
  formatCurrentState: (workflow: any[]): string => {
    return `Current logical workflow state: ${JSON.stringify(workflow)}. Use this as your source of truth.`;
  }
};
