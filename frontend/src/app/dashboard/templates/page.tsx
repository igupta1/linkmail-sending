'use client';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile, UserProfile } from '@/hooks/useUserProfile';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X, Save, Trash2, Edit3 } from 'lucide-react';

type TemplateItem = {
  icon?: string;
  title: string;
  body: string;
  fileUrl?: string | null;
  strict_template?: boolean;
};

export default function TemplatesPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { profile, isLoading: profileLoading, updateProfile, fetchProfile } = useUserProfile();
  const router = useRouter();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  const templates: TemplateItem[] = useMemo(() => {
    const raw = (profile?.templates as any[]) || [];
    return raw.map((t: any) => ({
      icon: t?.icon || '📝',
      title: t?.title || 'Untitled',
      body: t?.body || '',
      fileUrl: t?.fileUrl ?? null,
      strict_template: typeof t?.strict_template === 'boolean' ? t.strict_template : false,
    }));
  }, [profile?.templates]);

  const openEditor = (index: number | null) => {
    setSelectedIndex(index);
    if (index === null) {
      setDraft({ icon: '📝', title: '', body: '', fileUrl: null, strict_template: false });
    } else {
      setDraft({ ...templates[index] });
    }
  };

  const closeEditor = () => {
    setSelectedIndex(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const nextTemplates = [...templates];
      if (selectedIndex === null) {
        nextTemplates.push(draft);
      } else if (selectedIndex >= 0 && selectedIndex < nextTemplates.length) {
        nextTemplates[selectedIndex] = draft;
      }

      const result = await updateProfile({ templates: nextTemplates } as Partial<UserProfile>);
      if (!result.success) {
        alert('Failed to save template');
      } else {
        await fetchProfile();
        closeEditor();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (index: number) => {
    const ok = confirm('Delete this template?');
    if (!ok) return;
    const next = templates.filter((_, i) => i !== index);
    const result = await updateProfile({ templates: next } as Partial<UserProfile>);
    if (!result.success) alert('Failed to delete');
    await fetchProfile();
    if (selectedIndex === index) closeEditor();
  };

  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-6 mt-[100px]">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-newsreader-500 text-primary">Your Templates</h1>
          <p className="mt-2 text-[15px] max-w-xl text-stone-500">Save and reuse outreach drafts for different purposes. Linkmail will base responses off of these templates.</p>
        </div>
        <button
          onClick={() => openEditor(null)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-transparent border border-black/10 rounded-2xl p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">📝</div>
          <h3 className="text-lg font-medium text-primary mb-2">No templates yet</h3>
          <p className="text-sm text-gray-600 mb-4">Create your first template to speed up outreach.</p>
          <button
            onClick={() => openEditor(null)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t, i) => (
            <div key={i} className="group bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => openEditor(i)}>
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl leading-none">{t.icon || '📝'}</div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(i); }}
                  className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                  aria-label="Delete template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mb-2 font-medium text-gray-900 line-clamp-1">{t.title || 'Untitled'}</div>
              <div className="text-sm text-gray-600 line-clamp-4 whitespace-pre-wrap">{t.body}</div>
              {t.fileUrl && (
                <a
                  href={t.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs mt-3 text-blue-700 hover:underline"
                >
                  Attachment
                  <Edit3 className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {draft && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={closeEditor} />
            <motion.div
              className="relative bg-white w-full max-w-2xl mx-4 rounded-2xl shadow-xl border border-gray-200"
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.98, y: 6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-primary">{selectedIndex === null ? 'New Template' : 'Edit Template'}</h3>
                    <p className="text-sm text-gray-500 mt-1">Use placeholders like [Recipient Name].</p>
                  </div>
                  <button onClick={closeEditor} className="p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Icon</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={draft.icon || ''}
                      onChange={(e) => setDraft({ ...(draft as TemplateItem), icon: e.target.value })}
                      placeholder="e.g. 🔎"
                      className="w-24 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Title</label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...(draft as TemplateItem), title: e.target.value })}
                      placeholder="Short Reach Out"
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Body</label>
                    <textarea
                      rows={10}
                      value={draft.body}
                      onChange={(e) => setDraft({ ...(draft as TemplateItem), body: e.target.value })}
                      placeholder={'Hi [Recipient Name], I\'m a 3rd year Computer Science student at UCLA...'}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap"
                    />
                  </div>

                  {/* Optional attachment URL field; file uploads can be added later */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Attachment URL (optional)</label>
                    <input
                      type="url"
                      value={draft.fileUrl || ''}
                      onChange={(e) => setDraft({ ...(draft as TemplateItem), fileUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between my-8">
                  <label htmlFor="strict-template-toggle" className="text-sm text-gray-700">
                    <span className="font-medium">Precise Mode</span>
                    <span className="block my-2 text-gray-500 font-light">Strictly use the template as written and don’t modify or try to improve the message.</span>
                  </label>
                  <button
                    id="strict-template-toggle"
                    type="button"
                    role="switch"
                    aria-checked={!!draft.strict_template}
                    onClick={() => setDraft({ ...(draft as TemplateItem), strict_template: !draft?.strict_template })}
                    className={`${draft?.strict_template ? 'bg-blue-600' : 'bg-gray-300'} relative inline-flex h-7 w-11 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                  >
                    <span className="sr-only">Toggle strict template</span>
                    <span
                      className={`${draft?.strict_template ? 'translate-x-5' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-200 ease-out shadow`}
                    />
                  </button>
                </div>
                

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={closeEditor}
                    className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 cursor-pointer"
                  >
                    <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


