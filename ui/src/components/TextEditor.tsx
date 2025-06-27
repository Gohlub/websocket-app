// Text editor component with cursor tracking

import React, { useRef, useState } from 'react';
import { useEditorStore } from '../store/editor';
import './TextEditor.css';


export function TextEditor() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionPosition, setSelectionPosition] = useState(0);
  const [lastSentPosition, setLastSentPosition] = useState(0);
  
  const {
    currentDocument,
    cursors,
    wsConnected,
    handleTextChange,
    handleCursorMove,
  } = useEditorStore();
  
  if (!currentDocument) {
    return (
      <div className="editor-placeholder">
        <p>Select a document to start editing</p>
      </div>
    );
  }
  
  // Handle text input
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    const newValue = textarea.value;
    const oldValue = currentDocument.content;
    
    // Find the change position
    let position = 0;
    let deleteCount = 0;
    let insertText = '';
    
    // Simple diff algorithm
    for (let i = 0; i < Math.min(oldValue.length, newValue.length); i++) {
      if (oldValue[i] !== newValue[i]) {
        position = i;
        break;
      }
      position = i + 1;
    }
    
    if (newValue.length < oldValue.length) {
      // Text was deleted
      deleteCount = oldValue.length - newValue.length;
    } else if (newValue.length > oldValue.length) {
      // Text was inserted
      insertText = newValue.slice(position, position + (newValue.length - oldValue.length));
    }
    
    handleTextChange(position, deleteCount, insertText);
  };
  
  // Handle selection change (cursor movement)
  const handleSelectionChange = () => {
    if (!textareaRef.current) return;
    
    const position = textareaRef.current.selectionStart;
    setSelectionPosition(position);
    
    // Debounce cursor updates
    if (Math.abs(position - lastSentPosition) > 5 || Date.now() - lastSentPosition > 100) {
      handleCursorMove(position);
      setLastSentPosition(position);
    }
  };
  
  // Convert position to x,y coordinates for cursor rendering
  const getPositionCoordinates = (position: number): { x: number; y: number } => {
    if (!textareaRef.current) return { x: 0, y: 0 };
    
    const text = currentDocument.content;
    const lines = text.slice(0, position).split('\n');
    const currentLine = lines.length - 1;
    const currentColumn = lines[lines.length - 1].length;
    
    // Approximate character dimensions (adjust based on font)
    const charWidth = 8;
    const lineHeight = 20;
    
    return {
      x: currentColumn * charWidth + 10, // +10 for padding
      y: currentLine * lineHeight + 10,
    };
  };
  
  return (
    <div className="editor-container">
      <div className="editor-header">
        <h2>{currentDocument.title}</h2>
        <div className="editor-status">
          {wsConnected ? (
            <span className="status-connected">● Connected</span>
          ) : (
            <span className="status-disconnected">● Disconnected</span>
          )}
        </div>
      </div>
      
      <div className="editor-wrapper">
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={currentDocument.content}
          onChange={handleInput}
          onSelect={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          onMouseUp={handleSelectionChange}
          placeholder="Start typing..."
        />
        
        {/* Remote cursors */}
        <div className="cursors-layer">
          {Array.from(cursors.values()).map((cursor) => {
            const pos = getPositionCoordinates(cursor.position);
            return (
              <div
                key={cursor.user}
                className="remote-cursor"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  backgroundColor: cursor.color,
                }}
              >
                <span className="cursor-label" style={{ backgroundColor: cursor.color }}>
                  {cursor.user}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="editor-footer">
        <span>Position: {selectionPosition}</span>
        <span>Length: {currentDocument.content.length}</span>
        <span>Participants: {cursors.size + 1}</span>
      </div>
    </div>
  );
}