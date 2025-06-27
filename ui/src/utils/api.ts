// API utilities for the collaborative editor

import { BASE_URL } from '../types/global';
import type { Document } from '../types/editor';

// Generic API call function
export async function makeApiCall<TRequest, TResponse>(
  method: string,
  data?: TRequest
): Promise<TResponse> {
  const body = data !== undefined 
    ? { [method]: data }
    : { [method]: "" };

  const response = await fetch(`${BASE_URL}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Document API calls
export const api = {
  // Create a new document
  async createDocument(title: string): Promise<Document> {
    const request = JSON.stringify({ title });
    const response = await makeApiCall<string, string>('CreateDocument', request);
    return JSON.parse(response);
  },

  // Get all documents
  async getDocuments(): Promise<Document[]> {
    const response = await makeApiCall<string, string>('GetDocuments', "");
    return JSON.parse(response);
  },

  // Get specific document
  async getDocument(documentId: string): Promise<Document> {
    const response = await makeApiCall<string, string>('GetDocument', JSON.stringify(documentId));
    return JSON.parse(response);
  },

  // Send invite
  async sendInvite(documentId: string, targetNode: string): Promise<string> {
    const request = JSON.stringify({
      document_id: documentId,
      target_node: targetNode,
    });
    return makeApiCall<string, string>('SendInvite', request);
  },

  // Get pending invites
  async getInvites(): Promise<string[]> {
    const response = await makeApiCall<string, string>('GetInvites', "");
    return JSON.parse(response);
  },
};

// Error handling utilities
export function isApiError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  return 'An unknown error occurred';
}