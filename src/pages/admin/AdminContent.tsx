import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Plus, Edit, Trash2, Workflow, History, Activity, BookOpen, Upload, MoreVertical, Search, Download } from 'lucide-react';
import HadithImportPanel from '@/components/admin/HadithImportPanel';
import HadithSeoGeneratorPanel from '@/components/admin/HadithSeoGeneratorPanel';
import DuaSeoGeneratorPanel from '@/components/admin/DuaSeoGeneratorPanel';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MobileTableWrapper } from '@/components/admin/MobileTableWrapper';
import { NameBulkImportDialog } from '@/components/admin/NameBulkImportDialog';
import { DuaBulkImportDialog } from '@/components/admin/DuaBulkImportDialog';
import { JustImportedActionBar } from '@/components/admin/JustImportedActionBar';
import { ContentTypeSelector } from '@/components/admin/content/ContentTypeSelector';
import type { AdminContentType } from '@/components/admin/content/contentTypes';
import { adminContentTypeLabel } from '@/components/admin/content/contentTypes';
import { AlphabetBar } from '@/components/admin/content/AlphabetBar';
import {
  BulkContentActionBar,
  type BulkContentAction,
  type BulkStatusBreakdown,
} from '@/components/admin/BulkContentActionBar';

interface AdminContentRow {
  id: string;
  content_type: string;
  title: string;
  title_arabic: string | null;
  title_en: string | null;
  title_hi: string | null;
  title_ur: string | null;
  content: string | null;
  content_arabic: string | null;
  content_en: string | null;
  content_hi: string | null;
  content_ur: string | null;
  content_pronunciation: string | null;
  category: string | null;
  metadata: any | null;
  is_published: boolean | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  approval_required: boolean;
  approved_by: string | null;
  approved_at: string | null;
  current_version_id: string | null;
  created_at: string | null;
}

interface ContentVersionRow {
  id: string;
  content_id: string;
  version_number: number;
  title: string;
  title_arabic: string | null;
  content: string | null;
  content_arabic: string | null;
  change_summary: string | null;
  created_at: string;
  created_by: string;
}

interface AuditLogRow {
  id: string;
  action: string;
  actor_id: string;
  resource_id: string | null;
  resource_type: string | null;
  metadata: any | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  in_review: 'outline',
  scheduled: 'outline',
  published: 'default',
  archived: 'destructive',
};

const DUA_CATEGORY_PRESETS = [
  'Morning',
  'Evening',
  'Salah',
  'Travel',
  'Food',
  'Protection',
  'Forgiveness',
  'Health',
  'Family',
  'Dhikr',
] as const;

type DuaCategoryPreset = (typeof DUA_CATEGORY_PRESETS)[number];

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const readMetaString = (meta: unknown, key: string) => {
  if (!meta || typeof meta !== 'object') return '';
  const obj = meta as Record<string, unknown>;
  return typeof obj[key] === 'string' ? (obj[key] as string) : '';
};

const buildNameMetadata = (
  existing: unknown,
  patch: {
    bn_name?: string;
    pronunciation?: string;
    gender?: string;
    source?: string;
    origin?: string;
    reference?: string;
  }
) => {
  const base = existing && typeof existing === 'object' ? { ...(existing as any) } : {};
  const next: Record<string, any> = { ...base };

  const setOrDelete = (k: string, v?: string) => {
    const val = (v ?? '').trim();
    if (val) next[k] = val;
    else delete next[k];
  };

  setOrDelete('bn_name', patch.bn_name);
  setOrDelete('pronunciation', patch.pronunciation);
  setOrDelete('gender', patch.gender);
  setOrDelete('source', patch.source);
  setOrDelete('origin', patch.origin);
  setOrDelete('reference', patch.reference);

  return next;
};

export default function AdminContent() {
  const { user, roles, isAdmin, isSuperAdmin } = useAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'workflow' | 'versions' | 'audit'>('edit');
  const [isNameImportOpen, setIsNameImportOpen] = useState(false);
  const [isDuaImportOpen, setIsDuaImportOpen] = useState(false);

  const [justImported, setJustImported] = useState<{
    type: AdminContentType;
    ids: string[];
  } | null>(null);

  // Content-type driven context (mandatory)
  const [contentTypeContext, setContentTypeContext] = useState<AdminContentType | null>(null);

  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkContentAction | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkIsWorking, setBulkIsWorking] = useState(false);

  // Quick filters (mobile + desktop)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [duaCategoryFilter, setDuaCategoryFilter] = useState<string>('all');
  const [nameGenderFilter, setNameGenderFilter] = useState<string>('all');
  const [nameAlphaFilter, setNameAlphaFilter] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    content_type: 'dua',
    title: '',
    title_arabic: '',
    title_en: '',
    title_hi: '',
    title_ur: '',
    content: '',
    content_arabic: '',
    content_en: '',
    content_hi: '',
    content_ur: '',
    content_pronunciation: '',
    category: '',
    // Name-only metadata
    meta_bn_name: '',
    meta_pronunciation: '',
    meta_gender: '',
    meta_source: '',
    meta_origin: '',
    meta_reference: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<ContentVersionRow | null>(null);

  const effectiveType = (contentTypeContext ?? (editForm.content_type as AdminContentType)) as AdminContentType;

  // Keep the editor form in-sync with the selected context so fields switch instantly.
  useEffect(() => {
    if (!contentTypeContext) return;
    setSelectedId(null);
    setActiveTab('edit');
    setEditForm((prev) => ({ ...prev, content_type: contentTypeContext }));
    setJustImported(null);
  }, [contentTypeContext]);

  const applyJustImportedBulkAction = (action: BulkContentAction) => {
    if (!justImported?.ids?.length) return;
    setBulkSelectedIds(new Set(justImported.ids));
    requestBulkAction(action);
  };

  const canEdit = !!user && (roles.includes('editor') || isAdmin || isSuperAdmin);
  const canApprove = !!user && (isAdmin || isSuperAdmin);

  const { data: content, isLoading } = useQuery<AdminContentRow[]>({
    queryKey: ['admin-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_content')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AdminContentRow[];
    },
  });

  const selectedContent = useMemo(
    () => content?.find((item) => item.id === selectedId) ?? null,
    [content, selectedId]
  );

  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const item of content ?? []) set.add(item.content_type);
    return Array.from(set).sort();
  }, [content]);

  const duaCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of content ?? []) {
      const typeOk = !contentTypeContext || item.content_type === contentTypeContext;
      if (!typeOk) continue;

      // Category filter is intended for Dua, so we only count Dua items
      if (item.content_type !== 'dua') continue;

      const statusOk = statusFilter === 'all' || item.status === statusFilter;
      if (!statusOk) continue;

      const cat = (item.category ?? '').trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }

    return counts;
  }, [content, statusFilter, contentTypeContext]);

  const availableDuaCategories = useMemo(() => {
    const set = new Set<string>();

    for (const preset of DUA_CATEGORY_PRESETS) set.add(preset);

    for (const item of content ?? []) {
      if (item.content_type !== 'dua') continue;
      const cat = (item.category ?? '').trim();
      if (cat) set.add(cat);
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [content]);

  const filteredContent = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (content ?? []).filter((item) => {
      if (contentTypeContext && item.content_type !== contentTypeContext) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      if (duaCategoryFilter !== 'all') {
        // If a Dua category filter is active, only show Dua items for that category
        if (item.content_type !== 'dua') return false;
        if ((item.category ?? '').trim() !== duaCategoryFilter) return false;
      }

      // Name-only filters
      if (contentTypeContext === 'name') {
        if (nameGenderFilter !== 'all') {
          const g = readMetaString(item.metadata, 'gender');
          if ((g || 'unknown') !== nameGenderFilter) return false;
        }

        if (nameAlphaFilter) {
          const first = (item.title ?? '').trim().slice(0, 1).toUpperCase();
          if (first !== nameAlphaFilter) return false;
        }
      }

      if (!q) return true;

      const hay = [item.title, item.title_arabic, item.title_en, item.title_hi, item.title_ur]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  }, [
    content,
    searchQuery,
    statusFilter,
    duaCategoryFilter,
    contentTypeContext,
    nameGenderFilter,
    nameAlphaFilter,
  ]);

  const baseNameItemsForAlphabet = useMemo(() => {
    if (contentTypeContext !== 'name') return [] as AdminContentRow[];
    const q = searchQuery.trim().toLowerCase();
    return (content ?? []).filter((item) => {
      if (item.content_type !== 'name') return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (nameGenderFilter !== 'all') {
        const g = readMetaString(item.metadata, 'gender');
        if ((g || 'unknown') !== nameGenderFilter) return false;
      }
      if (!q) return true;
      const hay = [item.title, item.title_arabic, item.title_en, item.title_hi, item.title_ur]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [content, contentTypeContext, nameGenderFilter, searchQuery, statusFilter]);

  const nameAlphabetCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const item of baseNameItemsForAlphabet) {
      const first = (item.title ?? '').trim().slice(0, 1).toUpperCase();
      if (first >= 'A' && first <= 'Z') out[first] = (out[first] ?? 0) + 1;
    }
    return out;
  }, [baseNameItemsForAlphabet]);

  const bulkSelectedItems = useMemo(
    () => (content ?? []).filter((item) => bulkSelectedIds.has(item.id)),
    [content, bulkSelectedIds]
  );

  const bulkStatusBreakdown = useMemo<BulkStatusBreakdown>(() => {
    const base: BulkStatusBreakdown = { draft: 0, in_review: 0, published: 0, other: 0 };

    for (const item of bulkSelectedItems) {
      if (item.status === 'draft') base.draft += 1;
      else if (item.status === 'in_review') base.in_review += 1;
      else if (item.status === 'published') base.published += 1;
      else base.other += 1;
    }

    return base;
  }, [bulkSelectedItems]);

  const bulkSelectedCount = bulkSelectedIds.size;

  const toggleBulkSelected = (id: string, next: boolean) => {
    setBulkSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const clearBulkSelection = () => setBulkSelectedIds(new Set());

  const selectAllFiltered = () => {
    setBulkSelectedIds(new Set(filteredContent.map((i) => i.id)));
  };

  const requestBulkAction = (action: BulkContentAction) => {
    setBulkAction(action);
    setBulkConfirmOpen(true);
  };

  const runBulkAction = async () => {
    if (!user) {
      toast({ title: 'You must be logged in', variant: 'destructive' });
      return;
    }

    if (!bulkAction || bulkSelectedIds.size === 0) return;

    const ids = Array.from(bulkSelectedIds);

    if (bulkAction === 'submit_for_review' && !canEdit) {
      toast({ title: 'No permission', description: 'You cannot submit for review.', variant: 'destructive' });
      return;
    }
    if ((bulkAction === 'publish' || bulkAction === 'unpublish') && !canApprove) {
      toast({ title: 'No permission', description: 'You cannot publish/unpublish.', variant: 'destructive' });
      return;
    }

    setBulkIsWorking(true);
    try {
      const now = new Date().toISOString();
      let payload: Record<string, any> = {};

      if (bulkAction === 'submit_for_review') {
        payload = { status: 'in_review', is_published: false };
      }

      if (bulkAction === 'publish') {
        payload = {
          status: 'published',
          is_published: true,
          published_at: now,
          scheduled_at: null,
          approved_by: user.id,
          approved_at: now,
        };
      }

      if (bulkAction === 'unpublish') {
        payload = {
          status: 'draft',
          is_published: false,
          published_at: null,
          scheduled_at: null,
        };
      }

      const { error } = await supabase.from('admin_content').update(payload).in('id', ids);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['admin-content'] });
      clearBulkSelection();
      setBulkConfirmOpen(false);
      setBulkAction(null);

      toast({ title: 'Bulk update complete', description: `${ids.length} items updated.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bulk update failed';
      toast({ title: 'Bulk update failed', description: msg, variant: 'destructive' });
    } finally {
      setBulkIsWorking(false);
    }
  };

  const existingNameKeys = useMemo(() => {
    const keyOf = (title: string, titleArabic?: string | null) =>
      `${title.trim().toLowerCase()}||${(titleArabic ?? '').trim().toLowerCase()}`;

    const set = new Set<string>();
    for (const item of content ?? []) {
      if (item.content_type !== 'name') continue;
      set.add(keyOf(item.title, item.title_arabic));
    }
    return set;
  }, [content]);

  const existingDuaKeys = useMemo(() => {
    const keyOf = (title: string, titleArabic?: string | null) =>
      `${title.trim().toLowerCase()}||${(titleArabic ?? '').trim().toLowerCase()}`;

    const set = new Set<string>();
    for (const item of content ?? []) {
      if (item.content_type !== 'dua') continue;
      set.add(keyOf(item.title, item.title_arabic));
    }
    return set;
  }, [content]);

  // Load versions for selected content
  const { data: versions } = useQuery<ContentVersionRow[]>({
    queryKey: ['content-versions', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_versions')
        .select('*')
        .eq('content_id', selectedId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return data as ContentVersionRow[];
    },
  });

  // Load audit log for selected content
  const { data: auditLogs } = useQuery<AuditLogRow[]>({
    queryKey: ['admin-audit-log', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .eq('resource_type', 'content')
        .eq('resource_id', selectedId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AuditLogRow[];
    },
  });

  const logAudit = async (action: string, resourceId: string, metadata?: Record<string, any>) => {
    if (!user) return;

    const { error } = await supabase.from('admin_audit_log').insert({
      action,
      actor_id: user.id,
      resource_id: resourceId,
      resource_type: 'content',
      metadata: metadata ?? {},
    });

    if (error) {
      console.error('Failed to log audit event', error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['admin-audit-log', resourceId] });
    }
  };

  const resetEditForm = (item?: AdminContentRow | null) => {
    if (!item) {
      setEditForm({
        content_type: contentTypeContext || 'dua',
        title: '',
        title_arabic: '',
        title_en: '',
        title_hi: '',
        title_ur: '',
        content: '',
        content_arabic: '',
        content_en: '',
        content_hi: '',
        content_ur: '',
        content_pronunciation: '',
        category: '',
        meta_bn_name: '',
        meta_pronunciation: '',
        meta_gender: '',
        meta_source: '',
        meta_origin: '',
        meta_reference: '',
      });
      setSelectedId(null);
      return;
    }

    setEditForm({
      content_type: item.content_type,
      title: item.title,
      title_arabic: item.title_arabic ?? '',
      title_en: item.title_en ?? '',
      title_hi: item.title_hi ?? '',
      title_ur: item.title_ur ?? '',
      content: item.content ?? '',
      content_arabic: item.content_arabic ?? '',
      content_en: item.content_en ?? '',
      content_hi: item.content_hi ?? '',
      content_ur: item.content_ur ?? '',
      content_pronunciation: item.content_pronunciation ?? '',
      category: item.category ?? '',
      meta_bn_name: readMetaString(item.metadata, 'bn_name'),
      meta_pronunciation: readMetaString(item.metadata, 'pronunciation'),
      meta_gender: readMetaString(item.metadata, 'gender'),
      meta_source: readMetaString(item.metadata, 'source'),
      meta_origin: readMetaString(item.metadata, 'origin'),
      meta_reference: readMetaString(item.metadata, 'reference'),
    });
    setSelectedId(item.id);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_content').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-content'] });
      toast({ title: 'Content deleted' });
      if (selectedId) {
        setSelectedId(null);
      }
    },
    onError: () => {
      toast({ title: 'Failed to delete content', variant: 'destructive' });
    },
  });

  const handleSave = async () => {
    if (!user || !canEdit) {
      toast({ title: 'You do not have permission to edit content', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      let contentId = selectedId;
      const basePayload = {
        content_type: effectiveType,
        title: editForm.title,
        title_arabic: editForm.title_arabic || null,
        title_en: editForm.title_en || null,
        title_hi: editForm.title_hi || null,
        title_ur: editForm.title_ur || null,
        content: editForm.content || null,
        content_arabic: editForm.content_arabic || null,
        content_en: editForm.content_en || null,
        content_hi: editForm.content_hi || null,
        content_ur: editForm.content_ur || null,
        content_pronunciation: editForm.content_pronunciation || null,
        category: editForm.category || null,
        ...(effectiveType === 'name'
          ? {
              metadata: buildNameMetadata(selectedContent?.metadata, {
                bn_name: editForm.meta_bn_name,
                pronunciation: editForm.meta_pronunciation,
                gender: editForm.meta_gender,
                source: editForm.meta_source,
                origin: editForm.meta_origin,
                reference: editForm.meta_reference,
              }),
            }
          : {}),
      };

      if (!contentId) {
        // Create new content in draft status
        const { data, error } = await supabase
          .from('admin_content')
          .insert({
            ...basePayload,
            status: 'draft',
            is_published: false,
          })
          .select()
          .single();

        if (error) throw error;
        contentId = data.id as string;
        await logAudit('content.create', contentId, { title: basePayload.title });
      } else {
        const { error } = await supabase
          .from('admin_content')
          .update(basePayload)
          .eq('id', contentId);
        if (error) throw error;
        await logAudit('content.update', contentId, { title: basePayload.title });
      }

      // Create a new version on every save
      if (contentId) {
        const { data: existingVersions, error: versionError } = await supabase
          .from('content_versions')
          .select('version_number')
          .eq('content_id', contentId)
          .order('version_number', { ascending: false })
          .limit(1);

        if (versionError) throw versionError;

        const nextVersionNumber =
          existingVersions && existingVersions.length > 0
            ? (existingVersions[0].version_number as number) + 1
            : 1;

        const { data: newVersion, error: insertVersionError } = await supabase
          .from('content_versions')
          .insert({
            content_id: contentId,
            version_number: nextVersionNumber,
            title: basePayload.title,
            title_arabic: basePayload.title_arabic,
            content: basePayload.content,
            content_arabic: basePayload.content_arabic,
            created_by: user.id,
          })
          .select()
          .single();

        if (insertVersionError) throw insertVersionError;

        const { error: updateCurrentVersionError } = await supabase
          .from('admin_content')
          .update({ current_version_id: newVersion.id })
          .eq('id', contentId);

        if (updateCurrentVersionError) throw updateCurrentVersionError;
      }

      await queryClient.invalidateQueries({ queryKey: ['admin-content'] });
      if (contentId) {
        setSelectedId(contentId);
      }
      toast({ title: 'Content saved' });
    } catch (error) {
      console.error('Failed to save content', error);
      toast({ title: 'Failed to save content', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateStatus = async (status: string, extraFields: Record<string, any> = {}, auditAction?: string) => {
    if (!user || !selectedContent) return;
    if (!canApprove && (status === 'published' || status === 'scheduled' || status === 'archived')) {
      toast({ title: 'You do not have permission to change status', variant: 'destructive' });
      return;
    }

    const payload: Record<string, any> = {
      status,
      ...extraFields,
    };

    if (status === 'published') {
      payload.is_published = true;
      payload.published_at = new Date().toISOString();
    }
    if (status !== 'published') {
      payload.is_published = false;
    }

    try {
      const { error } = await supabase
        .from('admin_content')
        .update(payload)
        .eq('id', selectedContent.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['admin-content'] });
      await logAudit(auditAction || 'content.update', selectedContent.id, {
        from: selectedContent.status,
        to: status,
      });

      toast({ title: `Status updated to ${STATUS_LABELS[status] || status}` });
    } catch (error) {
      console.error('Failed to update status', error);
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleSubmitForReview = () => {
    if (!selectedContent) return;
    if (!canEdit) {
      toast({ title: 'You do not have permission to submit for review', variant: 'destructive' });
      return;
    }
    updateStatus('in_review', {}, 'content.update');
  };

  const handlePublishNow = () => {
    if (!selectedContent) return;
    updateStatus('published', { approved_by: user?.id, approved_at: new Date().toISOString() }, 'content.publish');
  };

  const handleArchive = () => {
    if (!selectedContent) return;
    updateStatus('archived', {}, 'content.update');
  };

  const rollbackMutation = useMutation({
    mutationFn: async (version: ContentVersionRow) => {
      if (!user || !selectedContent) return;

      const basePayload = {
        content_type: selectedContent.content_type,
        title: version.title,
        title_arabic: version.title_arabic,
        content: version.content,
        content_arabic: version.content_arabic,
        category: selectedContent.category,
      };

      const { error: updateContentError } = await supabase
        .from('admin_content')
        .update(basePayload)
        .eq('id', selectedContent.id);

      if (updateContentError) throw updateContentError;

      const { data: existingVersions, error: versionError } = await supabase
        .from('content_versions')
        .select('version_number')
        .eq('content_id', selectedContent.id)
        .order('version_number', { ascending: false })
        .limit(1);

      if (versionError) throw versionError;

      const nextVersionNumber =
        existingVersions && existingVersions.length > 0
          ? (existingVersions[0].version_number as number) + 1
          : 1;

      const { data: newVersion, error: insertVersionError } = await supabase
        .from('content_versions')
        .insert({
          content_id: selectedContent.id,
          version_number: nextVersionNumber,
          title: basePayload.title,
          title_arabic: basePayload.title_arabic,
          content: basePayload.content,
          content_arabic: basePayload.content_arabic,
          created_by: user.id,
          change_summary: `Rollback to version ${version.version_number}`,
        })
        .select()
        .single();

      if (insertVersionError) throw insertVersionError;

      const { error: updateCurrentVersionError } = await supabase
        .from('admin_content')
        .update({ current_version_id: newVersion.id })
        .eq('id', selectedContent.id);

      if (updateCurrentVersionError) throw updateCurrentVersionError;

      await logAudit('content.rollback', selectedContent.id, {
        from_version: version.version_number,
        new_version: nextVersionNumber,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-content'] });
      await queryClient.invalidateQueries({ queryKey: ['content-versions', selectedId] });
      toast({ title: 'Content rolled back successfully' });
      setRollbackVersion(null);
    },
    onError: () => {
      toast({ title: 'Failed to rollback content', variant: 'destructive' });
    },
  });

  const handleRollback = (version: ContentVersionRow) => {
    if (!canApprove) {
      toast({ title: 'You do not have permission to rollback', variant: 'destructive' });
      return;
    }
    setRollbackVersion(version);
  };

  const onConfirmRollback = () => {
    if (rollbackVersion) {
      rollbackMutation.mutate(rollbackVersion);
    }
  };

  const handleExport = async () => {
    if (contentTypeContext === 'hadith') {
      // Export from hadiths table
      const allRows: any[] = [];
      const batchSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await supabase
          .from('hadiths')
          .select('*')
          .eq('book_key', 'bukhari')
          .order('hadith_number', { ascending: true })
          .range(from, from + batchSize - 1);
        if (data && data.length > 0) {
          allRows.push(...data);
          from += batchSize;
          if (data.length < batchSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      if (allRows.length === 0) {
        toast({ title: 'No data', description: 'No hadith records found to export.', variant: 'destructive' });
        return;
      }
      const blob = new Blob([JSON.stringify(allRows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hadith-export.json';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!content) return;
    const filtered = contentTypeContext 
      ? content.filter(c => c.content_type === contentTypeContext)
      : content;
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${contentTypeContext || 'content'}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'submit_for_review'
                ? 'Submit for review (bulk)'
                : bulkAction === 'publish'
                  ? 'Publish now (bulk)'
                  : 'Unpublish (bulk)'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update <strong>{bulkSelectedCount}</strong> item(s).
              {bulkSelectedItems.length > 0 ? (
                <span>
                  {' '}
                  Examples: {bulkSelectedItems
                    .slice(0, 3)
                    .map((i) => i.title)
                    .join(', ')}
                  {bulkSelectedItems.length > 3 ? '…' : ''}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkIsWorking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runBulkAction();
              }}
              disabled={bulkIsWorking}
            >
              {bulkIsWorking ? 'Working…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminPageHeader
        title="Content Management"
        description="Manage Quran, Dua, Hadith and other content with workflow, versions, and audit."
        icon={BookOpen}
        actions={
          <div
            className="-mx-3 flex w-[calc(100%+1.5rem)] gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0"
            aria-label="Content actions"
          >
            <Button
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => {
                resetEditForm();
                if (contentTypeContext) {
                  setEditForm((prev) => ({ ...prev, content_type: contentTypeContext }));
                }
                setActiveTab('edit');
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Content
            </Button>

            {contentTypeContext === 'name' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 whitespace-nowrap"
                onClick={() => setIsNameImportOpen(true)}
                disabled={!canEdit}
                title={!canEdit ? 'No permission' : undefined}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Names (JSON)
              </Button>
            ) : null}

            {contentTypeContext === 'dua' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 whitespace-nowrap"
                onClick={() => setIsDuaImportOpen(true)}
                disabled={!canEdit}
                title={!canEdit ? 'No permission' : undefined}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Dua (JSON)
              </Button>
            ) : null}

            <Button variant="outline" size="sm" onClick={handleExport} className="shrink-0 whitespace-nowrap">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        }
      />

      <Card className="shadow-sm border-border/80">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <ContentTypeSelector
              value={contentTypeContext}
              onChange={(next) => {
                setContentTypeContext(next);
                // Reset contextual filters on switch
                setSearchQuery('');
                setStatusFilter('all');
                setDuaCategoryFilter('all');
                setNameGenderFilter('all');
                setNameAlphaFilter(null);
              }}
            />
            {contentTypeContext ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  Managing: {adminContentTypeLabel(contentTypeContext)}
                </Badge>
              </div>
            ) : null}
          </div>

          {!contentTypeContext ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Select a content type to start managing items.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <NameBulkImportDialog
        open={isNameImportOpen}
        onOpenChange={setIsNameImportOpen}
        canEdit={canEdit}
        existingKeys={existingNameKeys}
        onImported={(result) => {
          queryClient.invalidateQueries({ queryKey: ['admin-content'] });
          const ids = Array.from(new Set([...(result.insertedIds ?? [])]));
          if (ids.length) setJustImported({ type: 'name', ids });
        }}
      />

      <DuaBulkImportDialog
        open={isDuaImportOpen}
        onOpenChange={setIsDuaImportOpen}
        canEdit={canEdit}
        existingKeys={existingDuaKeys}
        onImported={(result) => {
          queryClient.invalidateQueries({ queryKey: ['admin-content'] });
          const ids = Array.from(new Set([...(result.insertedIds ?? []), ...(result.updatedIds ?? [])]));
          if (ids.length) setJustImported({ type: 'dua', ids });
        }}
      />

      {justImported && (
        <JustImportedActionBar
          count={justImported.ids.length}
          onPublish={() => applyJustImportedBulkAction('publish')}
          onSubmitForReview={() => applyJustImportedBulkAction('submit_for_review')}
          onDismiss={() => setJustImported(null)}
          disabledReview={!canEdit}
          disabledPublish={!canApprove}
        />
      )}

      {contentTypeContext === 'dua' && (
        <div className="mb-6">
          <DuaSeoGeneratorPanel />
        </div>
      )}

      {contentTypeContext === 'hadith' ? (
        <div className="space-y-6">
          <HadithSeoGeneratorPanel />
          <HadithImportPanel />
        </div>
      ) : contentTypeContext ? (
        <Card className="shadow-sm border-border/80">
          <CardContent className="pt-6">
            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search content..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {contentTypeContext === 'dua' && (
                <Select value={duaCategoryFilter} onValueChange={setDuaCategoryFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableDuaCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat} ({duaCategoryCounts.get(cat) ?? 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {contentTypeContext === 'name' && (
                <Select value={nameGenderFilter} onValueChange={setNameGenderFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="unisex">Unisex</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {contentTypeContext === 'name' && (
              <AlphabetBar
                value={nameAlphaFilter}
                onChange={setNameAlphaFilter}
                enabledCounts={nameAlphabetCounts}
              />
            )}

            {bulkSelectedCount > 0 && (
              <BulkContentActionBar
                selectedCount={bulkSelectedCount}
                filteredCount={filteredContent.length}
                statusBreakdown={bulkStatusBreakdown}
                canEdit={canEdit}
                canApprove={canApprove}
                onSelectAllFiltered={selectAllFiltered}
                onClearSelection={clearBulkSelection}
                onRequestAction={requestBulkAction}
              />
            )}

            {/* Editor/Workflow/Versions/Audit Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="mt-4">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="edit" className="shrink-0">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="workflow" className="shrink-0" disabled={!selectedContent}>
                  <Workflow className="mr-2 h-4 w-4" />
                  Workflow
                </TabsTrigger>
                <TabsTrigger value="versions" className="shrink-0" disabled={!selectedContent}>
                  <History className="mr-2 h-4 w-4" />
                  Versions
                </TabsTrigger>
                <TabsTrigger value="audit" className="shrink-0" disabled={!selectedContent}>
                  <Activity className="mr-2 h-4 w-4" />
                  Audit
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <Label>Content Type</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="secondary" className="rounded-full">
                          {adminContentTypeLabel(effectiveType)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Context-driven (switch from top selector)
                        </span>
                      </div>
                    </div>

                    <div>
                      <Label>
                        {effectiveType === 'name' ? 'Title (English / Transliteration)' : 'Title'}
                      </Label>
                      <Input
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder={effectiveType === 'name' ? 'যেমন: Abdullah / Aisha' : undefined}
                      />
                    </div>

                    <div>
                      <Label>
                        {effectiveType === 'name' ? 'Title (Arabic name)' : 'Title (Arabic)'}
                      </Label>
                      <Input
                        value={editForm.title_arabic}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, title_arabic: e.target.value }))
                        }
                        placeholder={effectiveType === 'name' ? 'যেমন: Abdullah / Aisha' : undefined}
                      />
                    </div>

                    <div>
                      <Label>Category</Label>

                      {effectiveType === 'dua' ? (
                        <Select
                          value={(editForm.category || '').trim() || 'none'}
                          onValueChange={(v) =>
                            setEditForm((prev) => ({
                              ...prev,
                              category: v === 'none' ? '' : v,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent className="z-50 bg-popover">
                            <SelectItem value="none">No category</SelectItem>
                            {availableDuaCategories.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, category: e.target.value }))
                          }
                        />
                      )}

                      {effectiveType === 'dua' && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {DUA_CATEGORY_PRESETS.map((p) => (
                            <Button
                              key={p}
                              type="button"
                              size="sm"
                              variant={(editForm.category ?? '') === p ? 'secondary' : 'outline'}
                              className="h-7 rounded-full px-3 text-[11px]"
                              onClick={() => setEditForm((prev) => ({ ...prev, category: p }))}
                            >
                              {p}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    {effectiveType === 'name' && (
                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3">
                        <div className="text-xs font-medium text-muted-foreground">Name metadata</div>

                        <div>
                          <Label>Title (Bangla name)</Label>
                          <Input
                            value={editForm.meta_bn_name}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, meta_bn_name: e.target.value }))
                            }
                            placeholder="যেমন: আব্দুল্লাহ / আয়েশা"
                          />
                        </div>

                        <div>
                          <Label>Pronunciation (Bangla)</Label>
                          <Input
                            value={editForm.meta_pronunciation}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, meta_pronunciation: e.target.value }))
                            }
                            placeholder="যেমন: আব্দুল্লাহ"
                          />
                        </div>

                        <div>
                          <Label>Gender</Label>
                          <Select
                            value={editForm.meta_gender || 'unknown'}
                            onValueChange={(v) =>
                              setEditForm((prev) => ({
                                ...prev,
                                meta_gender: v === 'unknown' ? '' : v,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unknown">Unspecified</SelectItem>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="unisex">Unisex</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Source</Label>
                          <Input
                            value={editForm.meta_source}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, meta_source: e.target.value }))
                            }
                            placeholder="যেমন: Quran/Hadith/Dictionary/Local"
                          />
                        </div>

                        <div>
                          <Label>Origin</Label>
                          <Input
                            value={editForm.meta_origin}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, meta_origin: e.target.value }))
                            }
                            placeholder="যেমন: Arabic, Persian, Turkish"
                          />
                        </div>

                        <div>
                          <Label>Reference</Label>
                          <Input
                            value={editForm.meta_reference}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, meta_reference: e.target.value }))
                            }
                            placeholder="লিংক/বইয়ের নাম/হাদিস নম্বর (optional)"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {effectiveType === 'name' ? (
                      <>
                        <div>
                          <Label>Meaning (Bangla)</Label>
                          <Textarea
                            value={editForm.content}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, content: e.target.value }))
                            }
                            rows={4}
                            placeholder="বাংলা অর্থ লিখুন..."
                          />
                        </div>

                        <div>
                          <Label>Meaning (English)</Label>
                          <Textarea
                            value={editForm.content_en}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, content_en: e.target.value }))
                            }
                            rows={3}
                            placeholder="English meaning লিখুন..."
                          />
                        </div>
                      </>
                    ) : (
                      <Tabs defaultValue="ar" className="w-full">
                        <TabsList className="w-full justify-start overflow-x-auto">
                          <TabsTrigger value="ar" className="shrink-0">Arabic</TabsTrigger>
                          <TabsTrigger value="bn" className="shrink-0">Bangla</TabsTrigger>
                          <TabsTrigger value="en" className="shrink-0">English</TabsTrigger>
                          <TabsTrigger value="hi" className="shrink-0">Hindi</TabsTrigger>
                          <TabsTrigger value="ur" className="shrink-0">Urdu</TabsTrigger>
                          <TabsTrigger value="pron" className="shrink-0">Pronunciation</TabsTrigger>
                        </TabsList>

                        <TabsContent value="ar" className="mt-3">
                          <Label>Arabic (Dua)</Label>
                          <Textarea
                            value={editForm.content_arabic}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, content_arabic: e.target.value }))
                            }
                            rows={6}
                            placeholder="আরবি দুয়া লিখুন..."
                          />
                        </TabsContent>

                        <TabsContent value="bn" className="mt-3">
                          <Label>Bangla Meaning</Label>
                          <Textarea
                            value={editForm.content}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, content: e.target.value }))
                            }
                            rows={5}
                            placeholder="বাংলা অর্থ লিখুন..."
                          />
                        </TabsContent>

                        <TabsContent value="en" className="mt-3">
                          <Label>English Meaning</Label>
                          <Textarea
                            value={editForm.content_en}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, content_en: e.target.value }))
                            }
                            rows={5}
                            placeholder="English meaning লিখুন..."
                          />
                        </TabsContent>

                        <TabsContent value="hi" className="mt-3">
                          <Label>Hindi Meaning</Label>
                          <Textarea
                            value={editForm.content_hi}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, content_hi: e.target.value }))
                            }
                            rows={5}
                            placeholder="Hindi meaning লিখুন..."
                          />
                        </TabsContent>

                        <TabsContent value="ur" className="mt-3">
                          <Label>Urdu Meaning</Label>
                          <Textarea
                            value={editForm.content_ur}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, content_ur: e.target.value }))
                            }
                            rows={5}
                            placeholder="Urdu meaning লিখুন..."
                          />
                        </TabsContent>

                        <TabsContent value="pron" className="mt-3">
                          <Label>Bangla Pronunciation</Label>
                          <Textarea
                            value={editForm.content_pronunciation}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, content_pronunciation: e.target.value }))
                            }
                            rows={3}
                            placeholder="বাংলা উচ্চারণ লিখুন..."
                          />
                        </TabsContent>
                      </Tabs>
                    )}
                  </div>
                </div>

                <div className="-mx-3 sticky bottom-20 z-40 mt-4 border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-4 sm:border-t sm:bg-transparent sm:px-0 sm:py-4 sm:backdrop-blur-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {selectedContent && (
                      <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Status:</span>
                          <Badge
                            variant={STATUS_VARIANTS[selectedContent.status] || 'secondary'}
                            className="rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {STATUS_LABELS[selectedContent.status] || selectedContent.status}
                          </Badge>
                        </div>
                        <div>Scheduled: {formatDateTime(selectedContent.scheduled_at)}</div>
                        <div>Published: {formatDateTime(selectedContent.published_at)}</div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                      <Button
                        variant="outline"
                        className="h-9 w-full"
                        onClick={() => selectedContent && resetEditForm(selectedContent)}
                        disabled={!selectedContent}
                      >
                        Reset
                      </Button>
                      <Button
                        className="h-9 w-full"
                        onClick={handleSave}
                        disabled={isSaving || !canEdit}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="workflow" className="pt-4 space-y-4">
                {selectedContent ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <Label>Current Status</Label>
                        <div className="mt-1">
                          <Badge
                            variant={STATUS_VARIANTS[selectedContent.status] || 'secondary'}
                            className="rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {STATUS_LABELS[selectedContent.status] || selectedContent.status}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <Label>Scheduled At</Label>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {formatDateTime(selectedContent.scheduled_at)}
                        </div>
                      </div>

                      <div>
                        <Label>Published At</Label>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {formatDateTime(selectedContent.published_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={handleSubmitForReview}
                        disabled={!canEdit || selectedContent.status !== 'draft'}
                      >
                        Submit for Review
                      </Button>
                      <Button
                        variant="default"
                        onClick={handlePublishNow}
                        disabled={!canApprove || selectedContent.status !== 'in_review'}
                      >
                        Publish Now
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleArchive}
                        disabled={!canApprove}
                      >
                        Archive
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a content item to manage its workflow.</p>
                )}
              </TabsContent>

              <TabsContent value="versions" className="pt-4 space-y-4">
                {selectedContent ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Version history for: <strong>{selectedContent.title}</strong>
                    </div>
                    {versions && versions.length > 0 ? (
                      <div className="space-y-2">
                        {versions.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between rounded-lg border border-border/70 p-3"
                          >
                            <div>
                              <div className="text-sm font-medium">Version {v.version_number}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(v.created_at).toLocaleString()}
                              </div>
                              {v.change_summary && (
                                <div className="text-xs text-muted-foreground mt-1">{v.change_summary}</div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <VersionPreviewDialog version={v} />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRollback(v)}
                                disabled={!canApprove}
                              >
                                Rollback
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No versions yet.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a content item to view its versions.</p>
                )}
              </TabsContent>

              <TabsContent value="audit" className="pt-4 space-y-4">
                {selectedContent ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Audit log for: <strong>{selectedContent.title}</strong>
                    </div>
                    {auditLogs && auditLogs.length > 0 ? (
                      <div className="space-y-2">
                        {auditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start justify-between rounded-lg border border-border/70 p-3"
                          >
                            <div>
                              <div className="text-sm font-medium">{log.action}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                              </div>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <pre className="mt-1 text-[10px] text-muted-foreground bg-muted/50 rounded p-1 overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No audit logs yet.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a content item to view its audit log.</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : null}

      {/* Content List */}
      {contentTypeContext ? (
        <Card className="shadow-sm border-border/80">
          <CardHeader>
            <CardTitle>Content List ({filteredContent.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredContent.length > 0 ? (
              <>
                {/* Mobile: cards */}
                <div className="space-y-3 sm:hidden">
                  {filteredContent.map((item) => {
                    const isSelected = selectedId === item.id;
                    const isChecked = bulkSelectedIds.has(item.id);

                    return (
                      <div
                        key={item.id}
                        className={
                          'flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background p-3 shadow-sm ' +
                          (isSelected ? 'ring-2 ring-ring/40' : '')
                        }
                      >
                        <div className="pt-1">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(v) => toggleBulkSelected(item.id, Boolean(v))}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Select row"
                          />
                        </div>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setSelectedId(item.id);
                            resetEditForm(item);
                            setActiveTab('edit');
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 truncate text-sm font-medium text-foreground">{item.title}</p>
                            {contentTypeContext === 'name' ? (
                              <span className="shrink-0 text-[11px] text-muted-foreground">{(item.title ?? '').trim().slice(0, 1).toUpperCase()}</span>
                            ) : null}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <Badge
                              variant={STATUS_VARIANTS[item.status] || 'secondary'}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {STATUS_LABELS[item.status] || item.status}
                            </Badge>
                            {contentTypeContext === 'dua' ? (
                              <span className="truncate">{item.category || '-'}</span>
                            ) : null}
                          </div>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 shrink-0 p-0"
                              aria-label="Row actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={6} className="z-50 w-44 bg-popover">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedId(item.id);
                                resetEditForm(item);
                                setActiveTab('workflow');
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Open workflow
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteMutation.mutate(item.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block">
                  <MobileTableWrapper>
                    <Table className={contentTypeContext === 'name' ? 'min-w-[860px] text-xs sm:text-sm' : 'min-w-[760px] text-xs sm:text-sm'}>
                      <TableHeader>
                        <TableRow className="h-9">
                          <TableHead className="w-[44px]">
                            <Checkbox
                              checked={
                                filteredContent.length > 0 &&
                                filteredContent.every((i) => bulkSelectedIds.has(i.id))
                              }
                              onCheckedChange={(v) => {
                                if (Boolean(v)) selectAllFiltered();
                                else clearBulkSelection();
                              }}
                              aria-label="Select all filtered"
                            />
                          </TableHead>
                          {contentTypeContext === 'name' ? (
                            <>
                              <TableHead className="whitespace-nowrap">English Name</TableHead>
                              <TableHead className="whitespace-nowrap">Arabic Name</TableHead>
                              <TableHead className="w-[120px] whitespace-nowrap">Gender</TableHead>
                              <TableHead className="w-[80px] whitespace-nowrap">A–Z</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="whitespace-nowrap">Title</TableHead>
                              <TableHead className="w-[160px] whitespace-nowrap">Category</TableHead>
                              <TableHead className="w-[160px] whitespace-nowrap">Languages</TableHead>
                            </>
                          )}
                          <TableHead className="w-[120px] whitespace-nowrap">Status</TableHead>
                          <TableHead className="w-[90px] text-right whitespace-nowrap">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContent.map((item) => (
                          <TableRow
                            key={item.id}
                            className={`h-9 ${
                              selectedId === item.id ? 'bg-muted/60 hover:bg-muted/70' : 'hover:bg-muted/40'
                            }`}
                          >
                            <TableCell className="align-middle">
                              <Checkbox
                                checked={bulkSelectedIds.has(item.id)}
                                onCheckedChange={(v) => toggleBulkSelected(item.id, Boolean(v))}
                                aria-label="Select row"
                              />
                            </TableCell>
                            <TableCell className="align-middle">
                              <div className="max-w-[260px] truncate align-middle text-xs sm:text-sm">{item.title}</div>
                            </TableCell>
                            {contentTypeContext === 'name' ? (
                              <>
                                <TableCell className="align-middle">
                                  <div className="max-w-[220px] truncate font-arabic text-sm" dir="rtl">
                                    {item.title_arabic || '—'}
                                  </div>
                                </TableCell>
                                <TableCell className="align-middle">
                                  {(() => {
                                    const g = readMetaString(item.metadata, 'gender') || 'unknown';
                                    return (
                                      <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
                                        {g}
                                      </Badge>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="align-middle text-[11px] text-muted-foreground">
                                  {(item.title ?? '').trim().slice(0, 1).toUpperCase() || '—'}
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-[11px] sm:text-xs text-muted-foreground align-middle">
                                  {item.category || '-'}
                                </TableCell>
                                <TableCell className="text-[11px] sm:text-xs text-muted-foreground align-middle">
                                  {[
                                    item.title_arabic ? 'AR' : null,
                                    item.title_en || item.content_en ? 'EN' : null,
                                    item.content ? 'BN' : null,
                                    item.title_hi || item.content_hi ? 'HI' : null,
                                    item.title_ur || item.content_ur ? 'UR' : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="align-middle">
                              <Badge
                                variant={STATUS_VARIANTS[item.status] || 'secondary'}
                                className="rounded-full px-2 py-0.5 text-[11px] font-medium flex items-center gap-1"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {STATUS_LABELS[item.status] || item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right align-middle">
                              <div className="inline-flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setSelectedId(item.id);
                                    resetEditForm(item);
                                    setActiveTab('workflow');
                                  }}
                                  aria-label="Open workflow"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  aria-label="Delete content"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </MobileTableWrapper>
                </div>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground">No content yet. Create your first item.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={!!rollbackVersion} onOpenChange={(open) => !open && setRollbackVersion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm rollback</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            You are about to rollback this content to version{' '}
            <span className="font-semibold">{rollbackVersion?.version_number}</span>. This
            will create a new version with the rolled back content and update the current
            version.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRollbackVersion(null)}>
              Cancel
            </Button>
            <Button onClick={onConfirmRollback}>
              Confirm Rollback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const VersionPreviewDialog = ({ version }: { version: ContentVersionRow }) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Preview
      </Button>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Version {version.version_number} – {version.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Title (Arabic)</Label>
            <p className="mt-1">{version.title_arabic || '-'}</p>
          </div>
          <div>
            <Label>Content</Label>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {version.content || '-'}
            </p>
          </div>
          <div>
            <Label>Content (Arabic)</Label>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {version.content_arabic || '-'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
