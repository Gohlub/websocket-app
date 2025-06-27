// Invite modal component

import React, { useState } from 'react';
import { useEditorStore } from '../store/editor';
import './InviteModal.css';

export function InviteModal() {
  const [targetNode, setTargetNode] = useState('');
  const {
    showInviteModal,
    currentDocument,
    isLoading,
    error,
    sendInvite,
    setShowInviteModal,
    clearError,
  } = useEditorStore();
  
  if (!showInviteModal || !currentDocument) {
    return null;
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNode.trim()) return;
    
    await sendInvite(targetNode.trim());
    if (!error) {
      setTargetNode('');
    }
  };
  
  const handleClose = () => {
    setShowInviteModal(false);
    setTargetNode('');
    clearError();
  };
  
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Invite to Document</h3>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p>Invite another user to collaborate on "{currentDocument.title}"</p>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="target-node">User HNS ID</label>
              <input
                id="target-node"
                type="text"
                value={targetNode}
                onChange={(e) => setTargetNode(e.target.value)}
                placeholder="e.g., alice.os or bob.hypr"
                disabled={isLoading}
                autoFocus
              />
              <small>Enter the HNS ID of the user you want to invite</small>
            </div>
            
            <div className="modal-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !targetNode.trim()}
              >
                {isLoading ? 'Sending...' : 'Send Invite'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}