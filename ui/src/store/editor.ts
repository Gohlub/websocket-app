// Zustand store for collaborative editor

import { create } from 'zustand';
import type { EditorState, WSMessage } from '../types/editor';
import { getNodeId } from '../types/global';
import * as api from '../utils/api';
import { EditorWebSocket } from '../utils/websocket';

interface EditorStore extends EditorState {
  // WebSocket instance
  ws: EditorWebSocket;
  
  // Actions
  initialize: () => void;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
  
  // Document actions
  fetchDocuments: () => Promise<void>;
  createDocument: (title: string) => Promise<void>;
  openDocument: (documentId: string) => Promise<void>;
  closeDocument: () => void;
  
  // Editor actions
  handleTextChange: (position: number, deleteCount: number, insert: string) => void;
  handleCursorMove: (position: number) => void;
  
  // Invite actions
  sendInvite: (targetNode: string) => Promise<void>;
  fetchInvites: () => Promise<void>;
  
  // UI actions
  setError: (error: string | null) => void;
  clearError: () => void;
  setShowInviteModal: (show: boolean) => void;
  
  // WebSocket message handler
  handleWSMessage: (message: WSMessage) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Initial state
  nodeId: null,
  isConnected: false,
  wsConnected: false,
  documents: [],
  currentDocument: null,
  cursors: new Map(),
  participants: new Map(),
  isLoading: false,
  error: null,
  showInviteModal: false,
  pendingInvites: [],
  
  // WebSocket instance
  ws: new EditorWebSocket(),
  
  // Initialize the store
  initialize: () => {
    const nodeId = getNodeId();
    set({
      nodeId,
      isConnected: nodeId !== null,
    });
    
    if (nodeId) {
      get().fetchDocuments();
      get().fetchInvites();
      get().connectWebSocket();
    }
  },
  
  // WebSocket connection
  connectWebSocket: async () => {
    try {
      await get().ws.connect(get().handleWSMessage);
      set({ wsConnected: true });
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      set({ wsConnected: false });
    }
  },
  
  disconnectWebSocket: () => {
    get().ws.disconnect();
    set({ wsConnected: false });
  },
  
  // Fetch all documents
  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const documents = await api.api.getDocuments();
      set({ documents, isLoading: false });
    } catch (error) {
      set({
        error: api.getErrorMessage(error),
        isLoading: false,
      });
    }
  },
  
  // Create new document
  createDocument: async (title: string) => {
    set({ isLoading: true, error: null });
    try {
      const document = await api.api.createDocument(title);
      set(state => ({
        documents: [...state.documents, document],
        isLoading: false,
      }));
      
      // Open the new document
      await get().openDocument(document.id);
    } catch (error) {
      set({
        error: api.getErrorMessage(error),
        isLoading: false,
      });
    }
  },
  
  // Open document
  openDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      const document = await api.api.getDocument(documentId);
      set({
        currentDocument: document,
        cursors: new Map(),
        participants: new Map(),
        isLoading: false,
      });
      
      // Join document via WebSocket
      if (get().wsConnected) {
        get().ws.joinDocument(documentId);
      }
    } catch (error) {
      set({
        error: api.getErrorMessage(error),
        isLoading: false,
      });
    }
  },
  
  // Close document
  closeDocument: () => {
    const currentDoc = get().currentDocument;
    if (currentDoc && get().wsConnected) {
      get().ws.leaveDocument(currentDoc.id);
    }
    
    set({
      currentDocument: null,
      cursors: new Map(),
      participants: new Map(),
    });
  },
  
  // Handle text changes
  handleTextChange: (position: number, deleteCount: number, insert: string) => {
    const currentDoc = get().currentDocument;
    if (!currentDoc || !get().wsConnected) return;
    
    // Send change to server
    get().ws.sendTextChange(position, deleteCount, insert);
    
    // Optimistically update local content
    let content = currentDoc.content;
    const before = content.slice(0, position);
    const after = content.slice(position + deleteCount);
    content = before + insert + after;
    
    set(state => ({
      currentDocument: state.currentDocument ? {
        ...state.currentDocument,
        content,
      } : null,
    }));
  },
  
  // Handle cursor movement
  handleCursorMove: (position: number) => {
    if (!get().currentDocument || !get().wsConnected) return;
    get().ws.sendCursorMove(position);
  },
  
  // Send invite
  sendInvite: async (targetNode: string) => {
    const currentDoc = get().currentDocument;
    if (!currentDoc) return;
    
    set({ isLoading: true, error: null });
    try {
      await api.api.sendInvite(currentDoc.id, targetNode);
      set({ isLoading: false, showInviteModal: false });
      
      // Refresh document to get updated participants
      await get().openDocument(currentDoc.id);
    } catch (error) {
      set({
        error: api.getErrorMessage(error),
        isLoading: false,
      });
    }
  },
  
  // Fetch invites
  fetchInvites: async () => {
    try {
      const invites = await api.api.getInvites();
      set({ pendingInvites: invites });
    } catch (error) {
      console.error('Failed to fetch invites:', error);
    }
  },
  
  // Handle WebSocket messages
  handleWSMessage: (message: WSMessage) => {
    switch (message.type) {
      case 'DocumentState': {
        // Initial document state when joining
        const cursorsMap = new Map(Object.entries(message.cursors));
        set({
          currentDocument: message.document,
          cursors: cursorsMap,
        });
        break;
      }
      
      case 'UserJoined': {
        set(state => {
          const newParticipants = new Map(state.participants);
          newParticipants.set(message.user, { color: message.color });
          return { participants: newParticipants };
        });
        break;
      }
      
      case 'UserLeft': {
        set(state => {
          const newParticipants = new Map(state.participants);
          const newCursors = new Map(state.cursors);
          newParticipants.delete(message.user);
          newCursors.delete(message.user);
          return {
            participants: newParticipants,
            cursors: newCursors,
          };
        });
        break;
      }
      
      case 'TextUpdate': {
        // Apply text changes from other users
        set(state => {
          if (!state.currentDocument) return state;
          
          let content = state.currentDocument.content;
          const before = content.slice(0, message.position);
          const after = content.slice(message.position + message.delete);
          content = before + message.insert + after;
          
          return {
            currentDocument: {
              ...state.currentDocument,
              content,
            },
          };
        });
        break;
      }
      
      case 'CursorUpdate': {
        set(state => {
          const newCursors = new Map(state.cursors);
          const participant = state.participants.get(message.user);
          newCursors.set(message.user, {
            user: message.user,
            position: message.position,
            color: participant?.color || '#000000',
          });
          return { cursors: newCursors };
        });
        break;
      }
      
      case 'Error': {
        set({ error: message.message });
        break;
      }
    }
  },
  
  // UI actions
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setShowInviteModal: (show) => set({ showInviteModal: show }),
}));