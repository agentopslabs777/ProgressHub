import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Plus, BookOpen, ChevronRight, Layers, CheckCircle, Edit,
  Sparkles, Gift, Coins, Tag, RefreshCw
} from 'lucide-react';
import { programsApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState, Modal } from '@/components/common/UIComponents';

export function ProgramsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(2000);
  const [allowRedemption, setAllowRedemption] = useState<boolean>(true);
  const [maxRedemptionPercent, setMaxRedemptionPercent] = useState<number>(100);
  const [referralBonusPoints, setReferralBonusPoints] = useState<number>(500);
  const [status, setStatus] = useState<string>('published');
  const [formError, setFormError] = useState('');

  const { data: programs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['programs'],
    queryFn: programsApi.list
  });

  const createMutation = useMutation({
    mutationFn: programsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['purchasable_programs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create program')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => programsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['purchasable_programs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditOpen(false);
      setSelectedProgram(null);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to update program')
  });

  const resetForm = () => {
    setName('');
    setCode('');
    setDescription('');
    setPrice(2000);
    setAllowRedemption(true);
    setMaxRedemptionPercent(100);
    setReferralBonusPoints(500);
    setStatus('published');
    setFormError('');
  };

  const handleOpenEdit = (p: any) => {
    setSelectedProgram(p);
    setName(p.name || '');
    setCode(p.code || '');
    setDescription(p.description || '');
    setPrice(p.price ?? 2000);
    setAllowRedemption(p.allow_redemption ?? true);
    setMaxRedemptionPercent(p.max_redemption_percent ?? 100);
    setReferralBonusPoints(p.referral_bonus_points ?? 500);
    setStatus(p.status || 'published');
    setFormError('');
    setEditOpen(true);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PageTitle
        eyebrow="Curriculum Architecture & Pricing"
        title="Training Programs & Course Management"
        description="Design multi-track modular training programs. Manage pricing, reward points redemption allowances, and referral bonus points. All courses linked seamlessly to Explore & Purchase and Enrollments."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="btn btn-soft text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              className="btn btn-primary text-xs flex items-center gap-1.5 font-bold shadow-sm"
              onClick={() => { resetForm(); setCreateOpen(true); }}
            >
              <Plus size={14} /> Add New Course
            </button>
          </div>
        }
      />

      <div className="panel overflow-hidden bg-white border border-[#e2e8e2] rounded-2xl shadow-sm">
        {isLoading ? (
          <LoadingState label="Loading training programs..." />
        ) : isError ? (
          <div className="p-4"><ErrorState retry={() => refetch()} /></div>
        ) : programs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No training programs designed yet"
              detail="Create a program (e.g. Full Stack Web Development or Python AI) with custom price, tracks, and sequential learning days."
              icon={BookOpen}
              action={
                <button className="btn btn-primary text-xs" onClick={() => { resetForm(); setCreateOpen(true); }}>
                  <Plus size={14} /> Create First Program
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fafbf9] text-[10px] font-bold uppercase tracking-wider text-[#798981] border-b border-[#edf0ea]">
                <tr>
                  <th className="px-5 py-3.5">Course Program</th>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Amount / Price</th>
                  <th className="px-5 py-3.5">Points Policy</th>
                  <th className="px-5 py-3.5">Referral Bonus</th>
                  <th className="px-5 py-3.5">Learners</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ea]">
                {programs.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#fafbf9] transition">
                    <td className="px-5 py-3.5">
                      <Link href={`/programs/${p.id}`} className="font-bold text-[#275947] hover:underline text-xs">
                        {p.name}
                      </Link>
                      <div className="text-[11px] text-[#708078] line-clamp-1 max-w-xs mt-0.5">
                        {p.description || 'No description provided.'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#52645c] font-bold">
                      {p.code}
                    </td>
                    <td className="px-5 py-3.5 font-black text-[#1e293b] text-sm">
                      ₹{Number(p.price || 2000).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5">
                      {p.allow_redemption ? (
                        <span className="text-[10px] font-bold text-[#059669] bg-[#ecfdf5] px-2 py-0.5 rounded-full border border-[#a7f3d0] inline-block">
                          Redeem up to {p.max_redemption_percent || 100}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#94a3b8] bg-[#f1f5f9] px-2 py-0.5 rounded-full">
                          No Redemption
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[#9333ea] text-xs">
                      +{p.referral_bonus_points || 500} pts
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[#44564e]">
                      {p.enrollmentCount} {p.enrollmentCount === 1 ? 'learner' : 'learners'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1e293b] hover:text-[#059669] px-2 py-1 rounded bg-[#f1f5f9] hover:bg-[#e2e8f0] transition"
                        title="Edit Course Amount & Settings"
                      >
                        <Edit size={12} /> Edit Amount
                      </button>
                      <Link
                        href={`/programs/${p.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#295c4a] hover:underline"
                      >
                        Curriculum <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE PROGRAM MODAL */}
      {createOpen && (
        <Modal title="Add New Course & Program" onClose={() => setCreateOpen(false)} maxWidth="max-w-lg">
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium border border-[#f5c6cb]">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              createMutation.mutate({
                name: name.trim(),
                code: code.trim().toUpperCase(),
                description: description.trim(),
                price: Number(price),
                allow_redemption: allowRedemption,
                max_redemption_percent: Number(maxRedemptionPercent),
                referral_bonus_points: Number(referralBonusPoints),
                status
              });
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="mb-1 block text-xs font-bold text-[#334155]">Course Program Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AI & Machine Learning Career Track"
                className="field text-xs w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Program Code <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AIML-2026"
                  className="field text-xs font-mono w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Course Amount / Price (₹ INR) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="field text-xs font-bold text-[#0f172a] w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Referral Bonus Points</label>
                <input
                  type="number"
                  min={0}
                  value={referralBonusPoints}
                  onChange={(e) => setReferralBonusPoints(Number(e.target.value))}
                  className="field text-xs font-bold text-[#9333ea] w-full"
                />
                <span className="text-[10px] text-[#64748b]">Credited to referring student</span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Max Points Redemption %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={maxRedemptionPercent}
                  onChange={(e) => setMaxRedemptionPercent(Number(e.target.value))}
                  className="field text-xs font-bold text-[#059669] w-full"
                />
                <span className="text-[10px] text-[#64748b]">Max discount allowable (100% = full)</span>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-[#334155] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowRedemption}
                  onChange={(e) => setAllowRedemption(e.target.checked)}
                  className="rounded text-[#059669]"
                />
                Allow Students to Redeem Reward Points
              </label>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="field text-xs py-1"
              >
                <option value="published">Published (Available in Explore)</option>
                <option value="draft">Draft (Hidden)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#334155]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Overview of the learning objectives, daily curriculum, and skills covered…"
                rows={2}
                className="field text-xs w-full"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={createMutation.isPending} className="btn btn-primary text-xs font-bold">
                {createMutation.isPending ? 'Creating…' : 'Create & Publish Course'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT COURSE & AMOUNT MODAL */}
      {editOpen && selectedProgram && (
        <Modal title={`Edit Course Amount & Settings · ${selectedProgram.name}`} onClose={() => setEditOpen(false)} maxWidth="max-w-lg">
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium border border-[#f5c6cb]">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              updateMutation.mutate({
                id: selectedProgram.id,
                data: {
                  name: name.trim(),
                  code: code.trim().toUpperCase(),
                  description: description.trim(),
                  price: Number(price),
                  allow_redemption: allowRedemption,
                  max_redemption_percent: Number(maxRedemptionPercent),
                  referral_bonus_points: Number(referralBonusPoints),
                  status
                }
              });
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="mb-1 block text-xs font-bold text-[#334155]">Course Program Title</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field text-xs w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Program Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="field text-xs font-mono w-full"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Course Amount / Price (₹ INR)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="field text-xs font-black text-[#0f172a] w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Referral Bonus Points</label>
                <input
                  type="number"
                  min={0}
                  value={referralBonusPoints}
                  onChange={(e) => setReferralBonusPoints(Number(e.target.value))}
                  className="field text-xs font-bold text-[#9333ea] w-full"
                />
                <span className="text-[10px] text-[#64748b]">Credited on friend purchase</span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#334155]">Max Points Redemption %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={maxRedemptionPercent}
                  onChange={(e) => setMaxRedemptionPercent(Number(e.target.value))}
                  className="field text-xs font-bold text-[#059669] w-full"
                />
                <span className="text-[10px] text-[#64748b]">Max discount allowable</span>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs font-bold text-[#334155] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowRedemption}
                  onChange={(e) => setAllowRedemption(e.target.checked)}
                  className="rounded text-[#059669]"
                />
                Allow Points Redemption
              </label>

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="field text-xs py-1"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#334155]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="field text-xs w-full"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={updateMutation.isPending} className="btn btn-primary text-xs font-bold">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default ProgramsPage;
