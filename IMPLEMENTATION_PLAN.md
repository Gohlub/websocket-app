# Implementation Plan: Collaborative Plaintext Document Editor

## Overview
Transform the skeleton app into a real-time collaborative plaintext editor using WebSocket connections. The editor will support multiple users editing a document simultaneously with visible cursors and real-time text synchronization.

## Core Features
1. **Document Hosting**: Users can create and host documents
2. **Invite System**: Hosts can invite other users via HNS ID (username.os, nickname.hypr, etc.)
3. **Real-time Cursor Tracking**: All users see each other's cursor positions
4. **Real-time Text Synchronization**: Text changes propagate instantly to all participants

## Architecture

### Backend (lib.rs)
1. **State Structure**
   ```rust
   pub struct AppState {
       documents: HashMap<String, Document>,
       active_connections: HashMap<u32, ConnectionInfo>, // channel_id -> connection info
   }
   
   pub struct Document {
       id: String,
       content: String,
       host: String,
       participants: Vec<String>, // HNS IDs
       cursors: HashMap<String, CursorPosition>,
   }
   
   pub struct CursorPosition {
       user: String,
       position: usize,
       color: String,
   }
   
   pub struct ConnectionInfo {
       node_id: String,
       document_id: Option<String>,
   }
   ```

2. **Endpoints**
   - HTTP endpoints for document management
   - WebSocket endpoint for real-time collaboration
   - Remote endpoints for P2P invitations

### Frontend (React/TypeScript)
1. **Components**
   - `Editor`: Main text editor with cursor display
   - `ParticipantList`: Shows active users and their cursor colors
   - `InviteModal`: Interface for inviting users by HNS ID
   - `DocumentList`: List of available documents

2. **WebSocket Communication**
   - Connect to `/ws` endpoint
   - Handle text changes, cursor movements, user join/leave events

## Implementation Steps

### Phase 1: Basic Document Management
1. **Backend**
   - Add document CRUD operations (create, read, update, delete)
   - Implement document state persistence
   - Add HTTP endpoints for document operations

2. **Frontend**
   - Create document list UI
   - Add create/open document functionality
   - Basic text editor component

### Phase 2: WebSocket Integration
1. **Backend**
   - Implement WebSocket handler with message types:
     - `join_document`: User joins a document session
     - `leave_document`: User leaves a document
     - `text_change`: Text content changes
     - `cursor_move`: Cursor position updates
   - Track active connections per document

2. **Frontend**
   - Establish WebSocket connection
   - Handle connection lifecycle
   - Send/receive messages

### Phase 3: Real-time Collaboration
1. **Text Synchronization**
   - Implement operational transform (OT) or CRDT for conflict resolution
   - Use simple last-write-wins for MVP
   - Track document versions

2. **Cursor Tracking**
   - Assign unique colors to users
   - Broadcast cursor position on selection change
   - Render remote cursors in editor

### Phase 4: P2P Invite System
1. **Backend**
   - Add remote endpoint for receiving invitations
   - Implement invite acceptance flow
   - Store pending invites

2. **Frontend**
   - Invite UI with HNS ID input
   - Show pending invites
   - Accept/reject functionality

## Technical Considerations

### WebSocket Message Format
```typescript
interface WSMessage {
  type: 'join' | 'leave' | 'text_change' | 'cursor_move' | 'user_joined' | 'user_left';
  documentId: string;
  userId: string;
  data?: any;
}

interface TextChange {
  position: number;
  delete: number;
  insert: string;
}

interface CursorMove {
  position: number;
}
```

### Conflict Resolution
For MVP, use simple strategies:
- Last-write-wins for simultaneous edits
- Position adjustment for concurrent insertions
- Consider implementing OT or CRDT in future iterations

### Security
- Validate all incoming WebSocket messages
- Only allow invited users to join documents
- Sanitize text input to prevent XSS

### Performance
- Debounce cursor position updates (100ms)
- Batch text changes when possible
- Limit document size (e.g., 1MB)

## UI/UX Design
1. **Editor Layout**
   - Clean, minimalist design
   - Focus on text content
   - Subtle cursor indicators

2. **Color Scheme**
   - Assign colors from predefined palette
   - Ensure good contrast for accessibility
   - Show user color in participant list

3. **Responsive Design**
   - Works on desktop and tablet
   - Mobile support as stretch goal

## Testing Strategy
1. **Unit Tests**
   - Document operations
   - Message handling
   - Conflict resolution

2. **Integration Tests**
   - Multi-user scenarios
   - Connection handling
   - P2P communication

3. **Manual Testing**
   - Test with multiple nodes (kit s --fake-node)
   - Simulate network delays
   - Test edge cases (simultaneous edits, disconnections)

## MVP Deliverables
1. Create/open documents
2. Real-time text editing
3. Visible cursors for all users
4. Invite system via HNS ID
5. Basic participant list
6. Simple conflict resolution

## Future Enhancements
- Rich text formatting
- Document permissions (read-only viewers)
- Version history
- Export functionality
- Offline support with sync
- Advanced CRDT implementation