'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/upload', label: 'Upload' },
  { href: '/chat', label: 'Chat' },
];

export default function Nav() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-bold text-lg text-blue-600">
          Vault
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm hover:text-blue-600 transition ${
              pathname === l.href
                ? 'text-blue-600 font-medium'
                : 'text-gray-600'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <button
        onClick={signOut}
        className="text-sm text-gray-500 hover:text-red-600 transition"
      >
        Sign out
      </button>
    </nav>
  );
}
