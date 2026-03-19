import React, { createContext, useContext, useEffect, useState } from 'react';
import { catchAndReport } from '../lib/toast';
import {
  fetchAttachments as fetchAttachmentsDb,
  upsertAttachment as upsertAttachmentDb,
  deleteAttachmentDb,
  fetchEmailRoutes as fetchEmailRoutesDb,
  upsertEmailRoute as upsertEmailRouteDb,
  deleteEmailRouteDb,
} from '../lib/supabaseSync';

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
  ocrText?: string;
  uploadedAt: string;
  uploadedBy: string;
  source: 'upload' | 'email-in' | 'generated';
  module: AttachmentModule;
  documentId: string;
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
  loading: boolean;
  error: string | null;
  addAttachment: (att: Omit<Attachment, 'id' | 'uploadedAt' | 'notes' | 'version'>) => Attachment;
  removeAttachment: (id: string) => void;
  updateAttachment: (id: string, patch: Partial<Attachment>) => void;
  addNote: (attachmentId: string, text: string) => void;
  removeNote: (attachmentId: string, noteId: string) => void;
  addTag: (attachmentId: string, tag: string) => void;
  removeTag: (attachmentId: string, tag: string) => void;
  getByDocument: (module: AttachmentModule, documentId: string) => Attachment[];
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

const CURRENT_USER = 'Admin User';

function uid() { return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function nid() { return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

const DEFAULT_ROUTES: EmailInRoute[] = [
  { id: 'r-invoices', address: 'invoices@inbox.accountspro.app',  name: 'Invoices Inbox',  routeTo: 'invoice',  autoLink: true,  enabled: true },
  { id: 'r-expenses', address: 'expenses@inbox.accountspro.app',  name: 'Expenses Inbox',  routeTo: 'expense',  autoLink: true,  enabled: true },
  { id: 'r-journal',  address: 'journal@inbox.accountspro.app',   name: 'Journal Inbox',   routeTo: 'journal',  autoLink: false, enabled: true },
];

export const AttachmentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [emailRoutes, setEmailRoutes] = useState<EmailInRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load from Supabase on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [atts, routes] = await Promise.all([
          fetchAttachmentsDb(),
          fetchEmailRoutesDb(),
        ]);
        if (cancelled) return;
        if (atts !== null) setAttachments(atts);
        if (routes !== null && routes.length > 0) setEmailRoutes(routes);
        else setEmailRoutes(DEFAULT_ROUTES);
        setError(null);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load attachments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
    upsertAttachmentDb(full).catch(catchAndReport('Save attachment'));
    return full;
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
    deleteAttachmentDb(id).catch(catchAndReport('Delete attachment'));
  };

  const updateAttachment = (id: string, patch: Partial<Attachment>) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id === id ? { ...a, ...patch } : a);
      const changed = next.find(a => a.id === id);
      if (changed) upsertAttachmentDb(changed).catch(catchAndReport('Update attachment'));
      return next;
    });
  };

  // ── Notes ─────────────────────────────────────────────────────────────────
  const addNote = (attachmentId: string, text: string) => {
    const note: AttachmentNote = { id: nid(), text, createdAt: new Date().toISOString(), createdBy: CURRENT_USER };
    setAttachments(prev => {
      const next = prev.map(a => a.id === attachmentId ? { ...a, notes: [...a.notes, note] } : a);
      const changed = next.find(a => a.id === attachmentId);
      if (changed) upsertAttachmentDb(changed).catch(catchAndReport('Add attachment note'));
      return next;
    });
  };

  const removeNote = (attachmentId: string, noteId: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id === attachmentId ? { ...a, notes: a.notes.filter(n => n.id !== noteId) } : a);
      const changed = next.find(a => a.id === attachmentId);
      if (changed) upsertAttachmentDb(changed).catch(catchAndReport('Remove attachment note'));
      return next;
    });
  };

  // ── Tags ──────────────────────────────────────────────────────────────────
  const addTag = (attachmentId: string, tag: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id === attachmentId && !a.tags.includes(tag) ? { ...a, tags: [...a.tags, tag] } : a);
      const changed = next.find(a => a.id === attachmentId);
      if (changed) upsertAttachmentDb(changed).catch(catchAndReport('Add attachment tag'));
      return next;
    });
  };

  const removeTag = (attachmentId: string, tag: string) => {
    setAttachments(prev => {
      const next = prev.map(a => a.id === attachmentId ? { ...a, tags: a.tags.filter(t => t !== tag) } : a);
      const changed = next.find(a => a.id === attachmentId);
      if (changed) upsertAttachmentDb(changed).catch(catchAndReport('Remove attachment tag'));
      return next;
    });
  };

  // ── Query ─────────────────────────────────────────────────────────────────
  const getByDocument = (module: AttachmentModule, documentId: string) =>
    attachments.filter(a => a.module === module && a.documentId === documentId);

  // ── Email routes ──────────────────────────────────────────────────────────
  const upsertEmailRoute = (route: EmailInRoute) => {
    setEmailRoutes(prev => prev.some(r => r.id === route.id) ? prev.map(r => r.id === route.id ? route : r) : [...prev, route]);
    upsertEmailRouteDb(route).catch(catchAndReport('Save email route'));
  };

  const deleteEmailRoute = (id: string) => {
    setEmailRoutes(prev => prev.filter(r => r.id !== id));
    deleteEmailRouteDb(id).catch(catchAndReport('Delete email route'));
  };

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
      attachments, emailRoutes, loading, error,
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
