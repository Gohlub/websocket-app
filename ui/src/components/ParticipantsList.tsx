// Participants list component

import { useEditorStore } from '../store/editor';
import './ParticipantsList.css';

export function ParticipantsList() {
  const {
    currentDocument,
    participants,
    cursors,
    nodeId,
    setShowInviteModal,
  } = useEditorStore();
  
  if (!currentDocument) {
    return null;
  }
  
  const isHost = currentDocument.host === nodeId;
  
  return (
    <div className="participants-list">
      <div className="participants-header">
        <h3>Participants</h3>
        {isHost && (
          <button
            className="btn-invite"
            onClick={() => setShowInviteModal(true)}
            title="Invite user"
          >
            +
          </button>
        )}
      </div>
      
      <div className="participants-items">
        {/* Current user (always first) */}
        <div className="participant-item">
          <div 
            className="participant-color"
            style={{ backgroundColor: '#007bff' }}
          />
          <div className="participant-info">
            <div className="participant-name">
              {nodeId} (You)
              {currentDocument.host === nodeId && (
                <span className="participant-host">Host</span>
              )}
            </div>
            <div className="participant-status">Active</div>
          </div>
        </div>
        
        {/* Other participants */}
        {Array.from(participants.entries()).map(([userId, info]) => {
          const cursor = cursors.get(userId);
          const isActive = cursor !== undefined;
          
          return (
            <div key={userId} className="participant-item">
              <div 
                className="participant-color"
                style={{ backgroundColor: info.color }}
              />
              <div className="participant-info">
                <div className="participant-name">
                  {userId}
                  {currentDocument.host === userId && (
                    <span className="participant-host">Host</span>
                  )}
                </div>
                <div className="participant-status">
                  {isActive ? 'Active' : 'Idle'}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Show other participants from document who aren't connected */}
        {currentDocument.participants
          .filter(p => p !== nodeId && !participants.has(p))
          .map(userId => (
            <div key={userId} className="participant-item offline">
              <div 
                className="participant-color"
                style={{ backgroundColor: '#ccc' }}
              />
              <div className="participant-info">
                <div className="participant-name">
                  {userId}
                  {currentDocument.host === userId && (
                    <span className="participant-host">Host</span>
                  )}
                </div>
                <div className="participant-status">Offline</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}