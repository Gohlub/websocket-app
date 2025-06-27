// Document list component

import React, { useState } from 'react';
import { useEditorStore } from '../store/editor';
import './DocumentList.css';

export function DocumentList() {
  const [newDocTitle, setNewDocTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const {
    documents,
    currentDocument,
    isLoading,
    createDocument,
    openDocument,
    fetchDocuments,
  } = useEditorStore();
  
  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    
    await createDocument(newDocTitle.trim());
    setNewDocTitle('');
    setIsCreating(false);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  return (
    <div className="document-list">
      <div className="document-list-header">
        <h3>Documents</h3>
        <button
          className="btn-refresh"
          onClick={fetchDocuments}
          disabled={isLoading}
          title="Refresh documents"
        >
          ↻
        </button>
      </div>
      
      <div className="document-list-actions">
        {isCreating ? (
          <form onSubmit={handleCreateDocument} className="create-form">
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Document title..."
              autoFocus
              disabled={isLoading}
            />
            <div className="create-form-buttons">
              <button type="submit" disabled={isLoading || !newDocTitle.trim()}>
                Create
              </button>
              <button type="button" onClick={() => setIsCreating(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            className="btn-create"
            onClick={() => setIsCreating(true)}
            disabled={isLoading}
          >
            + New Document
          </button>
        )}
      </div>
      
      <div className="document-list-items">
        {documents.length === 0 ? (
          <div className="no-documents">
            <p>No documents yet</p>
            <p className="hint">Create your first document to get started</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className={`document-item ${currentDocument?.id === doc.id ? 'active' : ''}`}
              onClick={() => openDocument(doc.id)}
            >
              <div className="document-title">{doc.title}</div>
              <div className="document-meta">
                <span className="document-host">
                  {doc.host === useEditorStore.getState().nodeId ? 'You' : doc.host}
                </span>
                <span className="document-date">
                  {formatDate(doc.updated_at)}
                </span>
              </div>
              <div className="document-participants">
                {doc.participants.length} participant{doc.participants.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}