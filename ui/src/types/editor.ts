// Types for the collaborative editor

export interface Document {
  id: string;
  title: string;
  content: string;
  host: string;
  participants: string[];
  created_at: string;
  updated_at: string;
}

export interface CursorPosition {
  user: string;
  position: number;
  color: string;
}

export interface EditorState {
  // Connection
  nodeId: string | null;
  isConnected: boolean;
  wsConnected: boolean;
  
  // Documents
  documents: Document[];
  currentDocument: Document | null;
  
  // Editor state
  cursors: Map<string, CursorPosition>;
  participants: Map<string, { color: string }>;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  showInviteModal: boolean;
  pendingInvites: string[];
}

// WebSocket message types
export type WSMessage = 
  | { type: 'JoinDocument'; document_id: string }
  | { type: 'LeaveDocument'; document_id: string }
  | { type: 'TextChange'; position: number; delete: number; insert: string }
  | { type: 'CursorMove'; position: number }
  | { type: 'DocumentState'; document: Document; cursors: Record<string, CursorPosition> }
  | { type: 'UserJoined'; user: string; color: string }
  | { type: 'UserLeft'; user: string }
  | { type: 'TextUpdate'; user: string; position: number; delete: number; insert: string }
  | { type: 'CursorUpdate'; user: string; position: number }
  | { type: 'Error'; message: string };

// API types
export interface CreateDocumentRequest {
  title: string;
}

export interface SendInviteRequest {
  document_id: string;
  target_node: string;
}