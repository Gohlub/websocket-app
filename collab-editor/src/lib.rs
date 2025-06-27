// HYPERWARE COLLABORATIVE PLAINTEXT EDITOR
// Real-time collaborative document editing with WebSocket support

// CRITICAL IMPORTS - DO NOT MODIFY THESE
use hyperprocess_macro::*;

// HYPERWARE PROCESS LIB IMPORTS
use hyperware_process_lib::{
    our,
    LazyLoadBlob,
    Address,
    ProcessId,
    Request,
    homepage::add_to_homepage,
};
use hyperware_process_lib::http::server::{send_ws_push, WsMessageType};

// Standard imports
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// DOCUMENT STRUCTURES
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub host: String,
    pub participants: Vec<String>, // HNS IDs
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub user: String,
    pub position: usize,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub node_id: String,
    pub document_id: Option<String>,
    pub color: String,
}

// WEBSOCKET MESSAGE TYPES
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WSMessage {
    // Client -> Server
    JoinDocument { document_id: String },
    LeaveDocument { document_id: String },
    TextChange { position: usize, delete: usize, insert: String },
    CursorMove { position: usize },
    
    // Server -> Client
    DocumentState { document: Document, cursors: HashMap<String, CursorPosition> },
    UserJoined { user: String, color: String },
    UserLeft { user: String },
    TextUpdate { user: String, position: usize, delete: usize, insert: String },
    CursorUpdate { user: String, position: usize },
    Error { message: String },
}

// APP STATE
#[derive(Default, Serialize, Deserialize)]
pub struct AppState {
    documents: HashMap<String, Document>,
    active_connections: HashMap<u32, ConnectionInfo>, // channel_id -> connection info
    document_cursors: HashMap<String, HashMap<String, CursorPosition>>, // doc_id -> (user -> cursor)
    pending_invites: HashMap<String, Vec<String>>, // node_id -> [document_ids]
}

// Color palette for users
const USER_COLORS: &[&str] = &[
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FECA57", 
    "#FF9FF3", "#54A0FF", "#48DBFB", "#A29BFE", "#FD79A8"
];

impl AppState {
    fn get_user_color(&self, index: usize) -> String {
        USER_COLORS[index % USER_COLORS.len()].to_string()
    }
    
    fn broadcast_to_document(&self, document_id: &str, message: WSMessage, exclude_channel: Option<u32>) {
        let message_str = serde_json::to_string(&message).unwrap();
        let blob = LazyLoadBlob {
            mime: Some("application/json".to_string()),
            bytes: message_str.into_bytes(),
        };
        
        for (channel_id, conn_info) in &self.active_connections {
            if let Some(doc_id) = &conn_info.document_id {
                if doc_id == document_id && Some(*channel_id) != exclude_channel {
                    send_ws_push(*channel_id, WsMessageType::Text, blob.clone());
                }
            }
        }
    }
}

// HYPERAPP IMPLEMENTATION
#[hyperprocess(
    name = "Collaborative Editor",
    ui = Some(HttpBindingConfig::default()),
    endpoints = vec![
        Binding::Http { 
            path: "/api", 
            config: HttpBindingConfig::new(false, false, false, None) 
        },
        Binding::Ws {
            path: "/ws",
            config: WsBindingConfig::new(false, false, false),
        }
    ],
    save_config = SaveOptions::EveryMessage,
    wit_world = "collab-editor-dot-os-v0"
)]
impl AppState {
    // INITIALIZATION
    #[init]
    async fn initialize(&mut self) {
        add_to_homepage("Collaborative Editor", Some("📝"), Some("/"), None);
        
        let our_node = our().node.clone();
        println!("Collaborative Editor initialized on node: {}", our_node);
    }
    
    // HTTP ENDPOINTS
    
    // Create a new document
    #[http]
    async fn create_document(&mut self, request_body: String) -> Result<String, String> {
        #[derive(Deserialize)]
        struct CreateRequest {
            title: String,
        }
        
        let req: CreateRequest = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid request: {}", e))?;
        
        let doc_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        let document = Document {
            id: doc_id.clone(),
            title: req.title,
            content: String::new(),
            host: our().node.clone(),
            participants: vec![our().node.clone()],
            created_at: now.clone(),
            updated_at: now,
        };
        
        self.documents.insert(doc_id.clone(), document.clone());
        self.document_cursors.insert(doc_id.clone(), HashMap::new());
        
        Ok(serde_json::to_string(&document).unwrap())
    }
    
    // Get all documents where user is host or participant
    #[http]
    async fn get_documents(&self, _request_body: String) -> String {
        let our_node = our().node.clone();
        let user_docs: Vec<&Document> = self.documents.values()
            .filter(|doc| doc.host == our_node || doc.participants.contains(&our_node))
            .collect();
        
        serde_json::to_string(&user_docs).unwrap_or_else(|_| "[]".to_string())
    }
    
    // Get specific document
    #[http]
    async fn get_document(&self, request_body: String) -> Result<String, String> {
        let doc_id: String = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid request: {}", e))?;
        
        let document = self.documents.get(&doc_id)
            .ok_or_else(|| "Document not found".to_string())?;
        
        // Check if user has access
        let our_node = our().node.clone();
        if document.host != our_node && !document.participants.contains(&our_node) {
            return Err("Access denied".to_string());
        }
        
        Ok(serde_json::to_string(document).unwrap())
    }
    
    // Send invite to another node
    #[http]
    async fn send_invite(&mut self, request_body: String) -> Result<String, String> {
        #[derive(Deserialize)]
        struct InviteRequest {
            document_id: String,
            target_node: String,
        }
        
        let req: InviteRequest = serde_json::from_str(&request_body)
            .map_err(|e| format!("Invalid request: {}", e))?;
        
        // Verify document exists and user is host
        let document = self.documents.get_mut(&req.document_id)
            .ok_or_else(|| "Document not found".to_string())?;
        
        if document.host != our().node {
            return Err("Only the host can send invites".to_string());
        }
        
        // Add to participants
        if !document.participants.contains(&req.target_node) {
            document.participants.push(req.target_node.clone());
        }
        
        // Send remote invite
        let target_process_id = "collab-editor:collab-editor:collab.os"
            .parse::<ProcessId>()
            .map_err(|e| format!("Invalid process ID: {}", e))?;
        
        let target_address = Address::new(req.target_node.clone(), target_process_id);
        
        let invite_data = serde_json::json!({
            "document_id": req.document_id,
            "document_title": document.title.clone(),
            "from": our().node,
        });
        
        let request_wrapper = serde_json::json!({
            "ReceiveInvite": serde_json::to_string(&invite_data).unwrap()
        });
        
        let result = Request::new()
            .target(target_address)
            .body(serde_json::to_vec(&request_wrapper).unwrap())
            .expects_response(10)
            .send_and_await_response(10);
        
        match result {
            Ok(_) => Ok("Invite sent successfully".to_string()),
            Err(e) => Err(format!("Failed to send invite: {:?}", e))
        }
    }
    
    // Get pending invites
    #[http]
    async fn get_invites(&self, _request_body: String) -> String {
        let our_node = our().node.clone();
        let invites = self.pending_invites.get(&our_node)
            .cloned()
            .unwrap_or_default();
        
        serde_json::to_string(&invites).unwrap_or_else(|_| "[]".to_string())
    }
    
    // REMOTE ENDPOINTS
    
    // Receive invite from another node
    #[remote]
    async fn receive_invite(&mut self, invite_json: String) -> Result<String, String> {
        #[derive(Deserialize)]
        struct InviteData {
            document_id: String,
            document_title: String,
            from: String,
        }
        
        let invite: InviteData = serde_json::from_str(&invite_json)
            .map_err(|e| format!("Invalid invite: {}", e))?;
        
        // Store pending invite
        let our_node = our().node.clone();
        self.pending_invites.entry(our_node)
            .or_insert_with(Vec::new)
            .push(invite.document_id);
        
        Ok("Invite received".to_string())
    }
    
    // WEBSOCKET HANDLER
    #[ws]
    fn websocket(&mut self, channel_id: u32, message_type: WsMessageType, blob: LazyLoadBlob) {
        match message_type {
            WsMessageType::Text => {
                if let Ok(message) = String::from_utf8(blob.bytes.clone()) {
                    if let Ok(ws_msg) = serde_json::from_str::<WSMessage>(&message) {
                        self.handle_ws_message(channel_id, ws_msg);
                    }
                }
            }
            WsMessageType::Close => {
                // Handle disconnection
                if let Some(conn_info) = self.active_connections.remove(&channel_id) {
                    if let Some(doc_id) = &conn_info.document_id {
                        // Remove cursor
                        if let Some(cursors) = self.document_cursors.get_mut(doc_id) {
                            cursors.remove(&conn_info.node_id);
                        }
                        
                        // Notify other users
                        self.broadcast_to_document(
                            doc_id,
                            WSMessage::UserLeft { user: conn_info.node_id.clone() },
                            Some(channel_id)
                        );
                    }
                }
            }
            _ => {}
        }
    }
}

// WebSocket message handling helper (outside of impl block to avoid macro issues)
impl AppState {
    fn handle_ws_message(&mut self, channel_id: u32, message: WSMessage) {
        match message {
            WSMessage::JoinDocument { document_id } => {
                // Get or create connection info
                let our_node = our().node.clone();
                let color_index = self.active_connections.len();
                let color = self.get_user_color(color_index);
                
                let conn_info = ConnectionInfo {
                    node_id: our_node.clone(),
                    document_id: Some(document_id.clone()),
                    color: color.clone(),
                };
                
                self.active_connections.insert(channel_id, conn_info);
                
                // Get document and verify access
                if let Some(document) = self.documents.get(&document_id) {
                    if document.host == our_node || document.participants.contains(&our_node) {
                        // Get current cursors
                        let cursors = self.document_cursors.get(&document_id)
                            .cloned()
                            .unwrap_or_default();
                        
                        // Send document state to new user
                        let state_msg = WSMessage::DocumentState {
                            document: document.clone(),
                            cursors,
                        };
                        
                        let response = serde_json::to_string(&state_msg).unwrap();
                        let blob = LazyLoadBlob {
                            mime: Some("application/json".to_string()),
                            bytes: response.into_bytes(),
                        };
                        send_ws_push(channel_id, WsMessageType::Text, blob);
                        
                        // Notify others of new user
                        self.broadcast_to_document(
                            &document_id,
                            WSMessage::UserJoined { user: our_node.clone(), color },
                            Some(channel_id)
                        );
                    }
                }
            }
            
            WSMessage::TextChange { position, delete, insert } => {
                if let Some(conn_info) = self.active_connections.get(&channel_id) {
                    if let Some(doc_id) = &conn_info.document_id {
                        // Update document content
                        if let Some(document) = self.documents.get_mut(doc_id) {
                            // Apply text change
                            let mut content = document.content.clone();
                            
                            // Delete characters
                            if delete > 0 && position <= content.len() {
                                let end = (position + delete).min(content.len());
                                content.drain(position..end);
                            }
                            
                            // Insert new text
                            if !insert.is_empty() && position <= content.len() {
                                content.insert_str(position, &insert);
                            }
                            
                            document.content = content;
                            document.updated_at = chrono::Utc::now().to_rfc3339();
                            
                            // Broadcast change to others
                            self.broadcast_to_document(
                                doc_id,
                                WSMessage::TextUpdate {
                                    user: conn_info.node_id.clone(),
                                    position,
                                    delete,
                                    insert,
                                },
                                Some(channel_id)
                            );
                        }
                    }
                }
            }
            
            WSMessage::CursorMove { position } => {
                if let Some(conn_info) = self.active_connections.get(&channel_id) {
                    if let Some(doc_id) = &conn_info.document_id {
                        // Update cursor position
                        let cursor = CursorPosition {
                            user: conn_info.node_id.clone(),
                            position,
                            color: conn_info.color.clone(),
                        };
                        
                        self.document_cursors
                            .entry(doc_id.clone())
                            .or_insert_with(HashMap::new)
                            .insert(conn_info.node_id.clone(), cursor);
                        
                        // Broadcast cursor update
                        self.broadcast_to_document(
                            doc_id,
                            WSMessage::CursorUpdate {
                                user: conn_info.node_id.clone(),
                                position,
                            },
                            Some(channel_id)
                        );
                    }
                }
            }
            
            WSMessage::LeaveDocument { document_id } => {
                // Handle leave - similar to disconnect
                if let Some(conn_info) = self.active_connections.get_mut(&channel_id) {
                    let node_id = conn_info.node_id.clone(); // Extract the node_id first
                    conn_info.document_id = None;
                    
                    // Remove cursor
                    if let Some(cursors) = self.document_cursors.get_mut(&document_id) {
                        cursors.remove(&node_id);
                    }
                    
                    // Notify others
                    self.broadcast_to_document(
                        &document_id,
                        WSMessage::UserLeft { user: node_id },
                        Some(channel_id)
                    );
                }
            }
            
            _ => {} // Other message types are server->client only
        }
    }
}

const ICON: &str = "";