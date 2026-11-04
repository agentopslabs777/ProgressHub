import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck,
  Download, RefreshCw, Key, Settings, Check, X, ShieldAlert, Sparkles
} from 'lucide-react';
import { paymentsApi } from '@/services/api';
import { PageTitle, LoadingState, ErrorState, EmptyState, Modal } from '@/components/common/UIComponents';

export function PaymentManagementPage() {
  const queryClient = useQueryClient();
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isTestMode, setIsTestMode] = useState(true);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [saveErrorMsg, setSaveErrorMsg] = useState('');

  const { data: purchases = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin_all_purchases'],
    queryFn: paymentsApi.listAllAdmin
  });

  const { data: adminConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['admin_razorpay_config'],
    queryFn: paymentsApi.getAdminRazorpayConfig
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: any) => paymentsApi.updateAdminRazorpayConfig(data),
    onSuccess: (res: any) => {
      setSaveSuccessMsg('Razorpay credentials updated and connected successfully!');
      setSaveErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['admin_razorpay_config'] });
      queryClient.invalidateQueries({ queryKey: ['razorpay_config'] });
      setTimeout(() => {
        setSaveSuccessMsg('');
        setConnectModalOpen(false);
      }, 2000);
    },
    onError: (err: any) => {
      setSaveErrorMsg(err.message || 'Failed to save Razorpay configuration');
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: (data: any) => paymentsApi.testAdminRazorpayConnection(data),
    onSuccess: (res: any) => {
      setTestResult(res);
    },
    onError: (err: any) => {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    }
  });

  const handleOpenConnect = () => {
    if (adminConfig) {
      setKeyId(adminConfig.key_id || '');
      setKeySecret(''); // keep blank unless updating
      setWebhookSecret(adminConfig.webhook_secret || '');
      setIsTestMode(adminConfig.is_test_mode ?? true);
    }
    setTestResult(null);
    setSaveSuccessMsg('');
    setSaveErrorMsg('');
    setConnectModalOpen(true);
  };

  if (isLoading) return <LoadingState label="Loading all platform transactions..." />;
  if (isError) return <ErrorState retry={() => refetch()} />;

  const totalCollected = purchases
    .filter((p: any) => p.payment_status === 'paid')
    .reduce((sum: number, p: any) => sum + (p.final_amount || 0), 0);

  const totalPointsRedeemed = purchases
    .filter((p: any) => p.payment_status === 'paid')
    .reduce((sum: number, p: any) => sum + (p.points_redeemed || 0), 0);

  const paidCount = purchases.filter((p: any) => p.payment_status === 'paid').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5ebe5] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#285d4b]">
            PAYMENT RECONCILIATION & GATEWAY
          </span>
          <h1 className="text-2xl font-black text-[#1e293b]">
            Razorpay Payments & Program Purchases
          </h1>
          <p className="text-xs text-[#64748b] mt-0.5 font-medium">
            Audit transactions, reward points deductions, and connect your Razorpay merchant account directly
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenConnect}
            className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm font-bold"
          >
            <Key size={14} /> Connect Razorpay Account
          </button>
          <button
            onClick={() => refetch()}
            className="btn btn-soft text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Gateway Connection Banner */}
      <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 shadow-sm ${
        adminConfig?.is_connected
          ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]'
          : 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
            adminConfig?.is_connected ? 'bg-[#059669] text-white shadow-xs' : 'bg-[#d97706] text-white shadow-xs'
          }`}>
            <CreditCard size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm">
                {adminConfig?.is_connected ? 'Razorpay Account Connected' : 'Razorpay Not Connected Yet'}
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                adminConfig?.is_connected ? 'bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0]' : 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]'
              }`}>
                {adminConfig?.is_test_mode ? 'Test Mode' : 'Live Mode'}
              </span>
            </div>
            <p className="text-xs mt-0.5 font-medium opacity-90">
              {adminConfig?.is_connected
                ? `Key ID: ${adminConfig.key_id} · Direct checkout active`
                : 'Connect your Razorpay Key ID and Secret to accept credit cards, UPI, and netbanking.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenConnect}
          className={`text-xs font-bold py-1.5 px-3.5 rounded-xl border transition cursor-pointer ${
            adminConfig?.is_connected
              ? 'bg-white text-[#065f46] border-[#a7f3d0] hover:bg-[#d1fae5]'
              : 'bg-[#d97706] text-white border-[#d97706] hover:bg-[#b45309]'
          }`}
        >
          {adminConfig?.is_connected ? 'Change Account / Keys' : 'Connect Account Now'}
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="panel p-4 bg-white border border-[#e1e8e1] rounded-2xl">
          <div className="text-[10px] uppercase font-bold text-[#718279]">Total Revenue Collected</div>
          <div className="text-2xl font-black text-[#1c5d3b] mt-1">
            ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-[#718279] mt-0.5 font-semibold">{paidCount} successful payments</div>
        </div>

        <div className="panel p-4 bg-white border border-[#e1e8e1] rounded-2xl">
          <div className="text-[10px] uppercase font-bold text-[#718279]">Total Points Redeemed</div>
          <div className="text-2xl font-black text-[#23352d] mt-1">
            {Math.round(totalPointsRedeemed).toLocaleString()} <span className="text-xs font-bold text-[#718279]">pts</span>
          </div>
          <div className="text-[10px] text-[#059669] mt-0.5 font-semibold">₹{Math.round(totalPointsRedeemed)} INR discount</div>
        </div>

        <div className="panel p-4 bg-white border border-[#e1e8e1] rounded-2xl">
          <div className="text-[10px] uppercase font-bold text-[#718279]">Gateway Status</div>
          <div className="text-sm font-black text-[#23352d] mt-1 flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${adminConfig?.is_connected ? 'bg-[#10b981]' : 'bg-[#f59e0b]'}`} />
            {adminConfig?.is_connected ? 'Active & Ready' : 'Setup Required'}
          </div>
          <div className="text-[10px] text-[#718279] mt-0.5 font-mono truncate">
            {adminConfig?.key_id ? adminConfig.key_id : 'No Key'}
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e1e8e1] rounded-2xl">
          <div className="text-[10px] uppercase font-bold text-[#718279]">Total Orders</div>
          <div className="text-2xl font-black text-[#23352d] mt-1">
            {purchases.length}
          </div>
          <div className="text-[10px] text-[#718279] mt-0.5 font-semibold">Orders initialized</div>
        </div>
      </div>

      {/* Purchases Table */}
      {purchases.length === 0 ? (
        <EmptyState
          title="No Transactions Recorded"
          detail="When students purchase programs using Razorpay or redeem reward points, orders will appear here in real-time."
          icon={CreditCard}
        />
      ) : (
        <div className="panel p-5 bg-white border border-[#e1e8e1] rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#edf0ea] text-[#697972] text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Program</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Points Redeemed</th>
                  <th className="py-2.5 px-3">Paid (INR)</th>
                  <th className="py-2.5 px-3">Razorpay Order & Payment</th>
                  <th className="py-2.5 px-3">Referral</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f1]">
                {purchases.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#fafbfa] transition">
                    <td className="py-3 px-3 text-[#52635a] font-mono text-[11px]">
                      {p.paid_at ? new Date(p.paid_at).toLocaleString() : new Date(p.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#23352d] block">{p.student_name}</span>
                      <span className="text-[10px] text-[#718279]">{p.student_email}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#23352d]">
                      {p.program_name}
                      <span className="block text-[10px] text-[#718279] font-mono">{p.program_code}</span>
                    </td>
                    <td className="py-3 px-3 text-[#52635a]">
                      ₹{p.original_price?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#059669]">
                      {p.points_redeemed > 0 ? `-${Math.round(p.points_redeemed)} pts (₹${p.discount_amount})` : '—'}
                    </td>
                    <td className="py-3 px-3 font-black text-[#1e293b]">
                      ₹{p.final_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-[#52635a]">
                      <div>{p.razorpay_order_id || 'Free (Points)'}</div>
                      {p.razorpay_payment_id && (
                        <div className="text-[#059669] font-bold">{p.razorpay_payment_id}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[11px]">
                      {p.referral_code_used ? (
                        <div>
                          <span className="font-bold text-[#9333ea]">{p.referral_code_used}</span>
                          {p.referrer_name && (
                            <span className="block text-[10px] text-[#718279]">by {p.referrer_name}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#94a3b8]">Direct</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        p.payment_status === 'paid'
                          ? 'bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0]'
                          : p.payment_status === 'failed'
                          ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]'
                          : 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]'
                      }`}>
                        {p.payment_status === 'paid' && <CheckCircle2 size={11} />}
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Connect Razorpay Account Modal */}
      {connectModalOpen && (
        <Modal
          title="Connect Razorpay Merchant Account"
          open={connectModalOpen}
          onClose={() => setConnectModalOpen(false)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-[#475569] leading-relaxed">
              Enter your Razorpay API Key ID and Key Secret from your <a href="https://dashboard.razorpay.com/#/app/keys" target="_blank" rel="noopener noreferrer" className="text-[#059669] font-bold underline">Razorpay Dashboard ↗</a>.
            </p>

            {saveSuccessMsg && (
              <div className="p-3 bg-[#d1fae5] border border-[#a7f3d0] text-[#065f46] rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} /> {saveSuccessMsg}
              </div>
            )}

            {saveErrorMsg && (
              <div className="p-3 bg-[#fee2e2] border border-[#fecaca] text-[#991b1b] rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} /> {saveErrorMsg}
              </div>
            )}

            {testResult && (
              <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                testResult.success
                  ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]'
                  : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              }`}>
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{testResult.message}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateConfigMutation.mutate({
                  key_id: keyId.trim(),
                  key_secret: keySecret.trim() || undefined,
                  webhook_secret: webhookSecret.trim() || undefined,
                  is_test_mode: isTestMode
                });
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-xs font-bold text-[#1e293b] block mb-1">
                  Razorpay Key ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. rzp_test_xxxxxxxxxxxxxx or rzp_live_xxxxxxxxxxxxxx"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  className="field text-xs font-mono w-full"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1e293b] block mb-1">
                  Razorpay Key Secret <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required={!adminConfig?.has_secret}
                  placeholder={adminConfig?.has_secret ? '•••••••••••••••• (leave blank to keep current)' : 'Enter your Razorpay Key Secret'}
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  className="field text-xs font-mono w-full"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1e293b] block mb-1">
                  Webhook Secret <span className="text-[11px] font-normal text-[#64748b]">(Optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="Secret configured in your Razorpay Webhooks tab"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="field text-xs font-mono w-full"
                />
                <p className="text-[11px] text-[#64748b] mt-1 font-mono">
                  Webhook URL: <span className="font-semibold text-[#1e293b]">{typeof window !== 'undefined' ? `${window.location.origin}/api/v1/payments/webhook` : '/api/v1/payments/webhook'}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="testModeCheck"
                  checked={isTestMode}
                  onChange={(e) => setIsTestMode(e.target.checked)}
                  className="rounded text-[#059669] focus:ring-[#059669]"
                />
                <label htmlFor="testModeCheck" className="text-xs font-bold text-[#1e293b] cursor-pointer">
                  Test / Sandbox Mode (Uncheck for Live Production Mode)
                </label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#e2e8e2]">
                <button
                  type="button"
                  onClick={() => {
                    testConnectionMutation.mutate({
                      key_id: keyId.trim(),
                      key_secret: keySecret.trim() || undefined
                    });
                  }}
                  disabled={!keyId.trim() || testConnectionMutation.isPending}
                  className="btn btn-soft text-xs py-2 px-3 font-bold"
                >
                  {testConnectionMutation.isPending ? 'Testing…' : 'Test API Connection'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConnectModalOpen(false)}
                    className="btn btn-soft text-xs py-2 px-3"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateConfigMutation.isPending || !keyId.trim()}
                    className="btn btn-primary text-xs py-2 px-4 font-bold shadow-sm"
                  >
                    {updateConfigMutation.isPending ? 'Saving…' : 'Save & Connect Account'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PaymentManagementPage;
