import React, { createContext, useContext, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttachmentModule = 'invoice' | 'expense' | 'journal' | 'booking' | 'purchase' | 'inbox';

export interface AttachmentNote {
  id: string;
  text: string;
  createdAt: string;
  createdBy: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  ocrText?: string;          // OCR extracted text
  uploadedAt: string;
  uploadedBy: string;
  source: 'upload' | 'email-in' | 'generated';
  module: AttachmentModule;
  documentId: string;        // e.g. invoice id, expense id, journal entry id
  notes: AttachmentNote[];
  tags: string[];
  version: number;
}

export interface EmailInRoute {
  id: string;
  address: string;
  name: string;
  routeTo: AttachmentModule;
  autoLink: boolean;
  enabled: boolean;
}

interface AttachmentsContextType {
  attachments: Attachment[];
  emailRoutes: EmailInRoute[];
  // CRUD
  addAttachment: (att: Omit<Attachment, 'id' | 'uploadedAt' | 'notes' | 'version'>) => Attachment;
  removeAttachment: (id: string) => void;
  updateAttachment: (id: string, patch: Partial<Attachment>) => void;
  // Notes
  addNote: (attachmentId: string, text: string) => void;
  removeNote: (attachmentId: string, noteId: string) => void;
  // Tags
  addTag: (attachmentId: string, tag: string) => void;
  removeTag: (attachmentId: string, tag: string) => void;
  // Query
  getByDocument: (module: AttachmentModule, documentId: string) => Attachment[];
  // Email routes
  upsertEmailRoute: (route: EmailInRoute) => void;
  deleteEmailRoute: (id: string) => void;
  simulateEmailIn: (routeId: string, module: AttachmentModule, documentId: string) => Attachment | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AttachmentsContext = createContext<AttachmentsContextType | null>(null);

export function useAttachments() {
  const ctx = useContext(AttachmentsContext);
  if (!ctx) throw new Error('useAttachments must be used inside AttachmentsProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const LS_ATTS   = 'accountspro.v2.attachments';
const LS_ROUTES = 'accountspro.v2.emailRoutes';
const CURRENT_USER = 'Admin User';

function uid() { return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function nid() { return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const DEFAULT_ROUTES: EmailInRoute[] = [
  { id: 'r-invoices', address: 'invoices@inbox.accountspro.app',  name: 'Invoices Inbox',  routeTo: 'invoice',  autoLink: true,  enabled: true },
  { id: 'r-expenses', address: 'expenses@inbox.accountspro.app',  name: 'Expenses Inbox',  routeTo: 'expense',  autoLink: true,  enabled: true },
  { id: 'r-journal',  address: 'journal@inbox.accountspro.app',   name: 'Journal Inbox',   routeTo: 'journal',  autoLink: false, enabled: true },
];

export const AttachmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_ATTS) || '[]'); } catch { return []; }
  });
  const [emailRoutes, setEmailRoutes] = useState<EmailInRoute[]>(() => {
    try {
      const raw = localStorage.getItem(LS_ROUTES);
      return raw ? JSON.parse(raw) : DEFAULT_ROUTES;
    } catch { return DEFAULT_ROUTES; }
  });

  useEffect(() => { localStorage.setItem(LS_ATTS,   JSON.stringify(attachments));  }, [attachments]);
  useEffect(() => { localStorage.setItem(LS_ROUTES, JSON.stringify(emailRoutes));  }, [emailRoutes]);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const addAttachment: AttachmentsContextType['addAttachment'] = (att) => {
    const full: Attachment = {
      ...att,
      id: uid(),
      uploadedAt: new Date().toISOString(),
      notes: [],
      version: 1,
    };
    setAttachments(prev => [full, ...prev]);
    return full;
  };

  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id));

  const updateAttachment = (id: string, patch: Partial<Attachment>) =>
    setAttachments(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));

  // ── Notes ─────────────────────────────────────────────────────────────────
  const addNote = (attachmentId: string, text: string) => {
    const note: AttachmentNote = { id: nid(), text, createdAt: new Date().toISOString(), createdBy: CURRENT_USER };
    setAttachments(prev => prev.map(a => a.id === attachmentId ? { ...a, notes: [...a.notes, note] } : a));
  };

  const removeNote = (attachmentId: string, noteId: string) =>
    setAttachments(prev => prev.map(a => a.id === attachmentId ? { ...a, notes: a.notes.filter(n => n.id !== noteId) } : a));

  // ── Tags ──────────────────────────────────────────────────────────────────
  const addTag = (attachmentId: string, tag: string) =>
    setAttachments(prev => prev.map(a => a.id === attachmentId && !a.tags.includes(tag) ? { ...a, tags: [...a.tags, tag] } : a));

  const removeTag = (attachmentId: string, tag: string) =>
    setAttachments(prev => prev.map(a => a.id === attachmentId ? { ...a, tags: a.tags.filter(t => t !== tag) } : a));

  // ── Query ─────────────────────────────────────────────────────────────────
  const getByDocument = (module: AttachmentModule, documentId: string) =>
    attachments.filter(a => a.module === module && a.documentId === documentId);

  // ── Email routes ──────────────────────────────────────────────────────────
  const upsertEmailRoute = (route: EmailInRoute) =>
    setEmailRoutes(prev => prev.some(r => r.id === route.id) ? prev.map(r => r.id === route.id ? route : r) : [...prev, route]);

  const deleteEmailRoute = (id: string) => setEmailRoutes(prev => prev.filter(r => r.id !== id));

  const simulateEmailIn = (routeId: string, module: AttachmentModule, documentId: string): Attachment | null => {
    const route = emailRoutes.find(r => r.id === routeId);
    if (!route || !route.enabled) return null;
    const att = addAttachment({
      fileName: `emailed-document-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      size: Math.floor(Math.random() * 500_000) + 50_000,
      dataUrl: undefined,
      ocrText: 'Simulated OCR: Invoice #1234, Amount AED 5,250.00, Date 2024-06-15',
      uploadedBy: `Email-In (${route.address})`,
      source: 'email-in',
      module,
      documentId,
      tags: ['email-in', route.name],
    });
    return att;
  };

  return (
    <AttachmentsContext.Provider value={{
      attachments, emailRoutes,
      addAttachment, removeAttachment, updateAttachment,
      addNote, removeNote,
      addTag, removeTag,
      getByDocument,
      upsertEmailRoute, deleteEmailRoute, simulateEmailIn,
    }}>
      {children}
    </AttachmentsContext.Provider>
  );
};
