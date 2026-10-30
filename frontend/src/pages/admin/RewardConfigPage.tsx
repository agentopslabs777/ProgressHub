import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Save, CheckCircle2, AlertCircle, Coins, ShieldCheck, UserCheck, Plus, RefreshCw } from 'lucide-react';
import { rewardsApi, studentsApi } from '@/services/api';
import { PageTitle, LoadingState, ErrorState, Modal } from '@/components/common/UIComponents';

export function RewardConfigPage() {
  const queryClient = useQueryClient();

  const { data: config, isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards_config'],
    queryFn: rewardsApi.getConfig
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentsApi.list()
  });

  const [formState, setFormState] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Admin adjustment modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSuccess, setAdjustSuccess] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Synchronize state when data loads
  React.useEffect(() => {
    if (config) {
      setFormState({
        point_to_rupee_ratio: config.point_to_rupee_ratio ?? 1.0,
        default_submission_points: config.default_submission_points ?? 20.0,
        award_timing: config.award_timing ?? 'immediate',
        max_employee_points_per_review: config.max_employee_points_per_review ?? 50.0,
        allow_redemption: config.allow_redemption ?? true,
        max_redemption_percent: config.max_redemption_percent ?? 100.0,
        qualify_rejected: config.qualify_rejected ?? false
      });
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: rewardsApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards_config'] });
      setSaveSuccess(true);
      setSaveError('');
      setTimeout(() => setSaveSuccess(false), 4000);
    },
    onError: (err: any) => setSaveError(err.message || 'Failed to update reward configuration.')
  });

  const adjustMutation = useMutation({
    mutationFn: rewardsApi.adminAdjust,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards_wallet'] });
      setAdjustSuccess(true);
      setAdjustError('');
      setTimeout(() => {
        setAdjustSuccess(false);
        setAdjustModalOpen(false);
        setAdjustReason('');
      }, 2000);
    },
    onError: (err: any) => setAdjustError(err.message || 'Failed to record adjustment.')
  });

  if (isLoading || !formState) return <LoadingState label="Loading reward points policy configuration" />;
  if (isError) return <ErrorState retry={() => refetch()} />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formState);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setAdjustError('Please select a student.');
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError('Please provide an audit justification reason.');
      return;
    }
    adjustMutation.mutate({
      student_id: selectedStudentId,
      amount: Number(adjustAmount),
      reason: adjustReason.trim()
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5ebe5] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#285d4b]">
            SYSTEM POLICY & VALUATION
          </span>
          <h1 className="display text-2xl font-extrabold text-[#20342c]">
            Reward Points System Configuration
          </h1>
          <p className="text-xs text-[#6e7e76] mt-0.5">
            Configure base submission points, employee review award ceilings, redemption caps, and conversion ratios
          </p>
        </div>

        <button
          onClick={() => setAdjustModalOpen(true)}
          className="btn btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5"
        >
          <Plus size={13} /> Adjust Student Points (Admin)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Conversion Rule */}
        <div className="panel p-6 bg-white border border-[#e1e8e1] rounded-2xl space-y-4">
          <div className="border-b border-[#edf1ee] pb-3">
            <h2 className="text-sm font-bold text-[#23352d] flex items-center gap-2">
              <Coins size={16} className="text-[#c28416]" /> Monetary Conversion Valuation
            </h2>
            <p className="text-xs text-[#6e7e76]">
              Default rule: 1 reward point = ₹1 INR. Change only if modifying company reward exchange policy.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#35483f] mb-1">
                Point to Rupee Ratio (₹ per Point)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formState.point_to_rupee_ratio}
                onChange={(e) => setFormState({ ...formState, point_to_rupee_ratio: Number(e.target.value) })}
                className="field text-xs"
              />
              <span className="text-[10px] text-[#71837a] mt-0.5 block">
                Default: 1.0 (meaning 20 points = ₹20, 500 points = ₹500)
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#35483f] mb-1">
                Base Points per Day Assignment
              </label>
              <input
                type="number"
                step="1"
                min="0"
                required
                value={formState.default_submission_points}
                onChange={(e) => setFormState({ ...formState, default_submission_points: Number(e.target.value) })}
                className="field text-xs"
              />
              <span className="text-[10px] text-[#71837a] mt-0.5 block">
                Standard base points student earns on completing Day 1–5 assignment submissions.
              </span>
            </div>
          </div>
        </div>

        {/* Employee Review Awards & Award Timing */}
        <div className="panel p-6 bg-white border border-[#e1e8e1] rounded-2xl space-y-4">
          <div className="border-b border-[#edf1ee] pb-3">
            <h2 className="text-sm font-bold text-[#23352d] flex items-center gap-2">
              <Award size={16} className="text-[#255f46]" /> Faculty Review Points & Credit Policy
            </h2>
            <p className="text-xs text-[#6e7e76]">
              Control employee additional point limits and when base rewards become active in student wallets
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#35483f] mb-1">
                Max Employee Bonus Points per Review
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="500"
                required
                value={formState.max_employee_points_per_review}
                onChange={(e) => setFormState({ ...formState, max_employee_points_per_review: Number(e.target.value) })}
                className="field text-xs"
              />
              <span className="text-[10px] text-[#71837a] mt-0.5 block">
                Upper limit an employee can award during review (e.g. 50 points).
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#35483f] mb-1">
                Base Points Credit Timing
              </label>
              <select
                value={formState.award_timing}
                onChange={(e) => setFormState({ ...formState, award_timing: e.target.value })}
                className="field text-xs"
              >
                <option value="immediate">Immediate (credited upon submission)</option>
                <option value="on_approval">On Approval (credited after faculty approves assignment)</option>
              </select>
              <span className="text-[10px] text-[#71837a] mt-0.5 block">
                Immediate provides instant gratification; On Approval requires faculty sign-off.
              </span>
            </div>
          </div>
        </div>

        {/* Redemption Policy */}
        <div className="panel p-6 bg-white border border-[#e1e8e1] rounded-2xl space-y-4">
          <div className="border-b border-[#edf1ee] pb-3">
            <h2 className="text-sm font-bold text-[#23352d] flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#255f46]" /> Program Purchase Redemption Cap
            </h2>
            <p className="text-xs text-[#6e7e76]">
              Govern whether points can offset course prices at checkout
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="allowRedemption"
                checked={formState.allow_redemption}
                onChange={(e) => setFormState({ ...formState, allow_redemption: e.target.checked })}
                className="h-4 w-4 rounded text-[#285d4b] border-[#a9bcae]"
              />
              <label htmlFor="allowRedemption" className="text-xs font-bold text-[#35483f] cursor-pointer">
                Allow Reward Points Redemption on Purchases
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#35483f] mb-1">
                Max Redemption Percentage (%)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                required
                value={formState.max_redemption_percent}
                onChange={(e) => setFormState({ ...formState, max_redemption_percent: Number(e.target.value) })}
                className="field text-xs"
              />
              <span className="text-[10px] text-[#71837a] mt-0.5 block">
                100% allows full payment with points when balance suffices.
              </span>
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-3 rounded-xl bg-[#e1f5ea] border border-[#bce4cc] text-xs font-bold text-[#1b5f3d] flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Reward system policies saved and live immediately across all programs!</span>
          </div>
        )}

        {saveError && (
          <div className="p-3 rounded-xl bg-[#faecea] border border-[#f5c3bd] text-xs font-medium text-[#b33e33] flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{saveError}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="btn btn-primary text-xs py-2.5 px-6 flex items-center gap-1.5 shadow-sm font-bold"
          >
            <Save size={14} /> {updateMutation.isPending ? 'Saving Policies…' : 'Save Reward Configuration'}
          </button>
        </div>
      </form>

      {/* Admin Manual Adjustment Modal */}
      {adjustModalOpen && (
        <Modal
          title="Manual Reward Points Adjustment"
          open={adjustModalOpen}
          onClose={() => setAdjustModalOpen(false)}
        >
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#35483f] mb-1">
                Select Student *
              </label>
              <select
                required
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="field text-xs"
              >
                <option value="">Select a student…</option>
                {students.map((st: any) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName || st.full_name} ({st.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#35483f] mb-1">
                Points Adjustment Amount (+ credit, - debit) *
              </label>
              <input
                type="number"
                step="1"
                required
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                className="field text-xs"
              />
              <span className="text-[10px] text-[#71837a] mt-0.5 block">
                Enter positive number to grant points, negative to deduct.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#35483f] mb-1">
                Audit Justification / Reason *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Audit explanation (e.g. Compensation for hackathon win, discretionary award)…"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="field text-xs"
              />
            </div>

            {adjustSuccess && (
              <div className="p-3 rounded-xl bg-[#e1f5ea] border border-[#bce4cc] text-xs font-bold text-[#1b5f3d]">
                ✓ Points adjustment recorded in immutable ledger!
              </div>
            )}

            {adjustError && (
              <div className="p-3 rounded-xl bg-[#faecea] border border-[#f5c3bd] text-xs font-medium text-[#b33e33]">
                {adjustError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="btn btn-outline text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjustMutation.isPending}
                className="btn btn-primary text-xs py-2 px-5 font-bold"
              >
                {adjustMutation.isPending ? 'Recording…' : 'Record Adjustment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default RewardConfigPage;
