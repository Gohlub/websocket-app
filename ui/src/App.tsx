// Main App component for Collaborative Editor
import { useEffect } from 'react';
import './App.css';
import { useEditorStore } from './store/editor';
import { DocumentList } from './components/DocumentList';
import { TextEditor } from './components/TextEditor';
import { ParticipantsList } from './components/ParticipantsList';
import { InviteModal } from './components/InviteModal';

function App() {
  const {
    nodeId,
    isConnected,
    currentDocument,
    error,
    pendingInvites,
    initialize,
    clearError,
    closeDocument,
  } = useEditorStore();

  // Initialize on mount
  useEffect(() => {
    initialize();
    
    // Cleanup on unmount
    return () => {
      closeDocument();
      useEditorStore.getState().disconnectWebSocket();
    };
  }, []);
  
  // Show pending invites notification
  useEffect(() => {
    if (pendingInvites.length > 0) {
      console.log(`You have ${pendingInvites.length} pending document invite(s)`);
    }
  }, [pendingInvites]);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-title">📝 Collaborative Editor</h1>
        <div className="node-info">
          {isConnected ? (
            <>
              Connected as <span className="node-id">{nodeId}</span>
              {pendingInvites.length > 0 && (
                <span className="pending-invites">
                  {pendingInvites.length} invite{pendingInvites.length !== 1 ? 's' : ''}
                </span>
              )}
            </>
          ) : (
            <span className="not-connected">Not connected to Hyperware</span>
          )}
        </div>
      </header>

      {/* Error display */}
      {error && (
        <div className="error error-banner">
          {error}
          <button onClick={clearError} className="error-dismiss">
            ×
          </button>
        </div>
      )}

      {/* Main content */}
      {isConnected ? (
        <div className="app-content">
          <aside className="sidebar">
            <DocumentList />
          </aside>
          
          <main className="main-content">
            {currentDocument ? (
              <div className="editor-layout">
                <div className="editor-panel">
                  <TextEditor />
                </div>
                <div className="participants-panel">
                  <ParticipantsList />
                </div>
              </div>
            ) : (
              <div className="welcome-screen">
                <h2>Welcome to Collaborative Editor</h2>
                <p>Create a new document or select an existing one to start editing.</p>
                <p>You can invite other users to collaborate in real-time!</p>
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="connection-error">
          <p>Unable to connect to Hyperware</p>
          <p>Please ensure you're running this app within a Hyperware node.</p>
        </div>
      )}
      
      {/* Modals */}
      <InviteModal />
    </div>
  );
}

export default App;