'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { uploadFile } from '@/lib/api';
import Nav from '@/components/nav';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileCheck2,
  FileText,
  FolderTree,
  HardDrive,
  Calendar,
  AlertTriangle,
  Loader2,
  ArrowRight,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof uploadFile>> | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setResult(null);
    setUploading(true);
    try {
      const data = await uploadFile(file);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  if (authLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading upload…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      <Nav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Upload Document
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              <Sparkles className="w-3 h-3 mr-1 text-indigo-500" />
              AI Extraction
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Upload statements, agreements, policies, or receipts. SafeVault extracts key dates and facts into your vault.
          </p>
        </div>

        {/* Drop zone */}
        <motion.label
          whileHover={{ scale: 1.005 }}
          whileTap={{ scale: 0.995 }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center gap-3 p-10 sm:p-14 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-200 bg-white ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50/40 shadow-lg shadow-indigo-500/5 ring-4 ring-indigo-500/10'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50 shadow-sm'
          }`}
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
              dragActive || uploading
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div className="text-center">
            <p className="text-sm sm:text-base font-semibold text-slate-800">
              {uploading
                ? 'Analyzing and storing document…'
                : dragActive
                ? 'Drop your file now'
                : 'Click to select or drag and drop a document'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports PDF, PNG, JPG, TXT up to 10MB
            </p>
          </div>

          <input
            type="file"
            className="hidden"
            onChange={handleInputChange}
            disabled={uploading}
          />
        </motion.label>

        {/* Error notification */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-6 p-4 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-800 text-sm flex items-center gap-3 shadow-xs"
            >
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="flex-1 font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Success Card */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="mt-8 bg-white border border-slate-200/80 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Processing Complete
                    </h2>
                    <p className="text-xs text-slate-400">
                      Document successfully parsed and indexed in knowledge base
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/chat"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                  >
                    <span>Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* File Metadata Grid */}
              <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                  <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400">File Name</p>
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {result.file.file_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                  <FolderTree className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400">Classification</p>
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {result.file.category}
                      {result.file.subcategory && ` / ${result.file.subcategory}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                  <HardDrive className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400">Size</p>
                    <p className="text-xs font-semibold text-slate-800">
                      {(result.file.file_size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              </div>

              {/* Extracted Events */}
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <span>Extracted Calendar Events & Alerts</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {result.extractedEvents.length}
                    </span>
                  </h3>
                </div>

                {result.extractedEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">
                    No explicit dates or events were found in this document.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {result.extractedEvents.map((evt, i) => (
                      <li
                        key={i}
                        className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl flex items-start justify-between gap-3 text-sm"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium uppercase tracking-wider bg-indigo-100/80 text-indigo-800 border border-indigo-200/60">
                            {evt.event_type}
                          </span>
                          <span className="font-medium text-slate-700 truncate">
                            {evt.description}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500 font-medium">
                          {evt.event_date && (
                            <span className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200/60">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {evt.event_date}
                            </span>
                          )}
                          {evt.amount != null && (
                            <span className="font-semibold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200/60">
                              ${evt.amount}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
