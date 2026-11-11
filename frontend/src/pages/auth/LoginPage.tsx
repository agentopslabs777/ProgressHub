import React, { useState, FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Layers, Lock, ArrowRight, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/services/api';

export function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await authApi.login(email, password);
      queryClient.setQueryData(['current_user'], session.user);
      setLocation('/dashboard');
    } catch (err: any) {
      if (err?.status === 401 || err?.message?.toLowerCase().includes('invalid') || err?.message?.toLowerCase().includes('credential')) {
        setError('Invalid email or password. Please verify your credentials and try again.');
      } else {
        setError(err.message || 'Unable to connect to the platform. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f5ee] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#285d4b] text-white shadow-md mb-3">
            <Layers size={24} strokeWidth={2.3} />
          </div>
          <h1 className="display text-2xl font-extrabold text-[#21352e]">ProgressHub</h1>
          <p className="mt-1 text-xs text-[#718178]">
            Training Management & Learning Progression Platform
          </p>
        </div>

        {/* Card */}
        <div className="panel p-7 sm:p-8 shadow-xl bg-white">
          <div className="mb-6">
            <h2 className="display text-xl font-bold text-[#23372f]">Sign in to your portal</h2>
            <p className="mt-1 text-xs text-[#798780]">
              Access your training dashboard, classes, and progress.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-3 text-xs text-[#b8483d] font-medium border border-[#f7c5c0]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485951]">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
                className="field text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#485951]">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-[#6d7e75] hover:text-[#275d4a] flex items-center gap-1"
                >
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="field text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#ccd2ca] text-[#2c6552] focus:ring-[#2c6552]"
                />
                <span className="text-xs text-[#6e7e76]">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-2.5 text-xs font-bold shadow-sm"
            >
              {loading ? 'Authenticating…' : 'Sign in to portal'} <ArrowRight size={14} />
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-[#7e8e86]">
            First time initializing platform?{' '}
            <Link href="/setup" className="font-semibold text-[#285d4b] hover:underline">
              Setup Administrator
            </Link>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#86968d]">
          <ShieldCheck size={14} className="text-[#3c6f5a]" />
          <span>Secured with Argon2id hashing & JWT token rotation</span>
        </div>
      </div>
    </main>
  );
}
