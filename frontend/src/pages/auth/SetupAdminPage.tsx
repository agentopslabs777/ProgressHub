import React, { useState, FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Layers, ShieldCheck, ArrowRight } from 'lucide-react';
import { authApi } from '@/services/api';

export function SetupAdminPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await authApi.setupAdmin({ email, fullName, password });
      queryClient.setQueryData(['current_user'], session.user);
      setLocation('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Could not create administrator. An administrator account may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f5ee] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#285d4b] text-white shadow-md mb-3">
            <Layers size={24} strokeWidth={2.3} />
          </div>
          <h1 className="display text-2xl font-extrabold text-[#21352e]">ProgressHub</h1>
          <p className="mt-1 text-xs text-[#718178]">
            Initial Platform Administrator Setup
          </p>
        </div>

        <div className="panel p-7 sm:p-8 shadow-xl bg-white">
          <div className="mb-6">
            <h2 className="display text-xl font-bold text-[#23372f]">Create First Administrator</h2>
            <p className="mt-1 text-xs text-[#798780]">
              Initialize the root administrator to manage organizations, programs, and people.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-3 text-xs text-[#b8483d] font-medium border border-[#f7c5c0]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485951]">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="field text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485951]">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@organization.com"
                className="field text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485951]">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="field text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5 text-xs font-bold shadow-sm"
            >
              {loading ? 'Creating Administrator…' : 'Initialize Administrator'} <ArrowRight size={14} />
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-[#7e8e86]">
            Already initialized?{' '}
            <Link href="/login" className="font-semibold text-[#285d4b] hover:underline">
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
