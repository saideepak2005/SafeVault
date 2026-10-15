'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  UploadCloud,
  MessageSquare,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload', icon: UploadCloud },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
];

export default function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group transition"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-semibold text-base sm:text-lg tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
              Vault
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'text-indigo-600 font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span>{link.label}</span>

                  {isActive && (
                    <motion.div
                      layoutId="active-nav-pill"
                      className="absolute inset-0 bg-indigo-50/80 border border-indigo-100 rounded-lg -z-10 shadow-xs"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 32,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User & Sign Out */}
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="hidden md:inline-block text-xs text-slate-500 font-mono bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/60 max-w-[200px] truncate">
              {user.email}
            </span>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-rose-600 px-2.5 py-1.5 rounded-lg hover:bg-rose-50/80 border border-transparent hover:border-rose-100 transition-colors cursor-pointer"
            title="Sign out of account"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
