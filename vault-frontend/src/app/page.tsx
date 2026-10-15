'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CalendarCheck,
  Bot,
  Lock,
  Loader2,
} from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading SafeVault…</p>
      </div>
    );
  }

  if (user) return null; // will redirect

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-100/40 via-violet-50/20 to-transparent pointer-events-none -z-10" />

      {/* Navigation */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">
            SafeVault
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl transition"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-sm shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-12 sm:py-20 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 mb-6 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Intelligent Personal Document Vault</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] mb-6">
            Your personal documents,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600">
              indexed & actionable
            </span>{' '}
            with AI.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mb-10 leading-relaxed">
            Upload contracts, statements, invoices, and IDs. SafeVault organizes them,
            extracts upcoming renewal dates and action items, and lets you chat with your entire archive instantly.
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Start your free vault</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200/90 font-semibold text-sm rounded-xl shadow-2xs hover:-translate-y-0.5 transition-all duration-200"
            >
              Log in to account
            </Link>
          </div>
        </motion.div>

        {/* Feature Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 sm:mt-24 text-left w-full"
        >
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-4">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1.5">
              Automated Reminders
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dates, expiry notices, and milestones are automatically extracted into real-time alerts.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mb-4">
              <Bot className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1.5">
              Conversational RAG
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ask deep questions across all your files and receive answers with precise source citations.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.05)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1.5">
              Private & Secure
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Strict row-level security and isolated document vector storage guarantee your data stays yours.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200/60 py-6 text-center text-xs text-slate-400">
        SafeVault Document Intelligence &copy; 2026. All rights reserved.
      </footer>
    </div>
  );
}
