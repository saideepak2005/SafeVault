'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { uploadFile } from '@/lib/api';
import Nav from '@/components/nav';

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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Upload a file</h1>

        {/* Drop zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 p-12 border-2 border-dashed rounded-xl cursor-pointer transition
            ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        >
          <svg
            className="w-10 h-10 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-gray-600">
            {uploading ? 'Uploading…' : 'Drag & drop a file here, or click to select'}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={handleInputChange}
            disabled={uploading}
          />
        </label>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 bg-white p-6 rounded-xl shadow space-y-4">
            <h2 className="text-lg font-semibold">Upload successful</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500">File name</span>
              <span className="font-medium">{result.file.file_name}</span>

              <span className="text-gray-500">Category</span>
              <span className="font-medium">
                {result.file.category}
                {result.file.subcategory && ` / ${result.file.subcategory}`}
              </span>

              <span className="text-gray-500">Size</span>
              <span className="font-medium">
                {(result.file.file_size / 1024).toFixed(1)} KB
              </span>
            </div>

            {result.extractedEvents.length > 0 && (
              <>
                <h3 className="text-md font-semibold mt-4">
                  Extracted events
                </h3>
                <ul className="space-y-2">
                  {result.extractedEvents.map((evt, i) => (
                    <li
                      key={i}
                      className="text-sm p-2 bg-gray-50 rounded flex justify-between"
                    >
                      <span>
                        <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mr-2">
                          {evt.event_type}
                        </span>
                        {evt.description}
                      </span>
                      <span className="text-gray-500">
                        {evt.event_date || ''}
                        {evt.amount != null && ` • $${evt.amount}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
