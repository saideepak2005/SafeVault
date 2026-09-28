'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (user) return null; // will redirect

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-4xl font-bold">Personal Vault</h1>
      <p className="text-gray-600 text-center max-w-md">
        Upload your documents, chat with them using AI, and keep track of
        important dates and tasks — all in one place.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
