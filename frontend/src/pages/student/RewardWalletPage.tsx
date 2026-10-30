import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Wallet, Award, TrendingUp, Gift, ShoppingBag, ArrowUpRight,
  ArrowDownLeft, History, Clock, CheckCircle2, AlertCircle, Sparkles, Coins
} from 'lucide-react';
import { rewardsApi } from '@/services/api';
import { PageTitle, LoadingState, ErrorState, EmptyState } from '@/components/common/UIComponents';

export function RewardWalletPage() {
  const { data: walletData, isLoading, isError, refetch } = useQuery({
    queryKey: ['rewards_wallet'],
    queryFn: rewardsApi.getWallet
  });

  if (isLoading) return <LoadingState label="Loading your reward points wallet..." />;
  if (isError) return <ErrorState retry={() => refetch()} />;

  const wallet = {
    balance: walletData?.balance ?? walletData?.wallet?.balance ?? 0,
    total_earned: walletData?.total_earned ?? walletData?.wallet?.total_earned ?? 0,
    total_redeemed: walletData?.total_redeemed ?? walletData?.wallet?.total_redeemed ?? 0
  };
  const ratio = walletData?.point_to_rupee_ratio ?? walletData?.config?.point_to_rupee_ratio ?? 1.0;
  const inrValue = walletData?.equivalent_inr ?? walletData?.monetary_value_inr ?? (wallet.balance * ratio);
  const breakdown = walletData?.breakdown || {
    submission_base_points: 0,
    employee_review_points: 0,
    referral_bonus_points: 0,
    redeemed_points: 0
  };
  const transactions = walletData?.transactions || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e2e8e2] pb-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#059669] flex items-center gap-1.5">
            <Coins size={14} className="text-[#10b981]" /> CENTRALIZED REWARDS WALLET
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0f172a] tracking-tight">
            Reward Points Wallet
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5 font-medium">
            Accumulate points across assignments & referrals · Redeem 1:1 on course purchases
          </p>
        </div>

        <Link
          href="/explore-programs"
          className="bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-md transition"
        >
          <ShoppingBag size={15} /> Redeem on New Programs
        </Link>
      </div>

      {/* Main Balance & Conversion Card (Vibrant, high-contrast, crystal-clear) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Main Wallet Hero Card */}
        <div className="p-7 bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#065f46] text-white rounded-3xl md:col-span-2 shadow-xl border border-[#34d399]/30 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#10b981]/20 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#a7f3d0] flex items-center gap-2 uppercase tracking-wider bg-black/20 px-3 py-1 rounded-full border border-white/10">
                <Wallet size={15} className="text-[#34d399]" /> Available Wallet Balance
              </span>
              <span className="text-xs bg-[#fef08a] text-[#854d0e] font-extrabold px-3 py-1 rounded-full shadow-sm border border-[#fef08a]">
                ⚡ 1 Point = ₹{ratio} INR
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-5xl sm:text-6xl font-black text-white tracking-tight drop-shadow-sm">
                {Math.round(wallet.balance).toLocaleString()}
              </span>
              <span className="text-base sm:text-lg font-bold text-[#6ee7b7] uppercase tracking-wide">
                Points
              </span>
            </div>

            <div className="mt-2 inline-flex items-center gap-1.5 bg-black/30 text-white font-bold text-sm sm:text-base px-3.5 py-1.5 rounded-xl border border-white/15">
              <span>Equivalent Rupee Value:</span>
              <span className="text-[#fef08a] font-black text-lg">
                ₹{inrValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-[#a7f3d0] font-medium">INR</span>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-white/20 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#a7f3d0] font-semibold">Total Earned to Date:</span>
              <span className="bg-white/20 text-white font-extrabold px-2.5 py-0.5 rounded-lg text-xs">
                +{Math.round(wallet.total_earned).toLocaleString()} pts
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#a7f3d0] font-semibold">Total Points Redeemed:</span>
              <span className="bg-white/20 text-white font-extrabold px-2.5 py-0.5 rounded-lg text-xs">
                -{Math.round(wallet.total_redeemed).toLocaleString()} pts
              </span>
            </div>
          </div>
        </div>

        {/* 1:1 Instant Conversion Card */}
        <div className="p-6 bg-white border-2 border-[#10b981]/30 rounded-3xl shadow-md flex flex-col justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#047857] bg-[#ecfdf5] px-3 py-1 rounded-full border border-[#a7f3d0]">
              <Sparkles size={14} className="text-[#059669]" /> Guaranteed 1:1 Value
            </div>

            <h3 className="text-base font-extrabold text-[#0f172a] leading-snug">
              Every point equals ₹1 off any course checkout
            </h3>

            <p className="text-xs text-[#475569] leading-relaxed font-medium">
              Accumulate points from daily Word document assignments, instructor reviews, and friend referrals. When enrolling in a new course, redeem your balance to deduct up to 100% of the price!
            </p>
          </div>

          <div className="mt-5 p-3.5 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] text-[11px] text-[#166534] font-semibold space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#16a34a] shrink-0" />
              <span>Direct ₹1 deduction on course payment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#16a34a] shrink-0" />
              <span>Full points restoration on cancelled orders</span>
            </div>
          </div>
        </div>
      </div>

      {/* Points Breakdown Grid (Vivid & clearly differentiated) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Base Submissions */}
        <div className="p-5 rounded-2xl bg-[#ecfdf5] border-2 border-[#a7f3d0] shadow-sm">
          <div className="text-[11px] uppercase font-black text-[#065f46] flex items-center gap-1.5">
            <Award size={14} className="text-[#059669]" /> Assignment Tasks
          </div>
          <div className="text-2xl font-black text-[#064e3b] mt-2">
            {Math.round(breakdown.submission_base_points || 0).toLocaleString()}
            <span className="text-xs font-bold text-[#059669] ml-1">pts</span>
          </div>
          <div className="text-[11px] text-[#047857] font-medium mt-1">
            +20 pts base per day submission
          </div>
        </div>

        {/* Teacher Bonus */}
        <div className="p-5 rounded-2xl bg-[#eff6ff] border-2 border-[#bfdbfe] shadow-sm">
          <div className="text-[11px] uppercase font-black text-[#1e40af] flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[#2563eb]" /> Teacher Reviews
          </div>
          <div className="text-2xl font-black text-[#1e3a8a] mt-2">
            {Math.round(breakdown.employee_review_points || 0).toLocaleString()}
            <span className="text-xs font-bold text-[#2563eb] ml-1">pts</span>
          </div>
          <div className="text-[11px] text-[#1d4ed8] font-medium mt-1">
            Up to +50 pts bonus per review
          </div>
        </div>

        {/* Referral Rewards */}
        <div className="p-5 rounded-2xl bg-[#faf5ff] border-2 border-[#e9d5ff] shadow-sm">
          <div className="text-[11px] uppercase font-black text-[#6b21a8] flex items-center gap-1.5">
            <Gift size={14} className="text-[#9333ea]" /> Referral Rewards
          </div>
          <div className="text-2xl font-black text-[#581c87] mt-2">
            {Math.round(breakdown.referral_bonus_points || 0).toLocaleString()}
            <span className="text-xs font-bold text-[#9333ea] ml-1">pts</span>
          </div>
          <div className="text-[11px] text-[#7e22ce] font-medium mt-1">
            Friend joins & podium prizes
          </div>
        </div>

        {/* Redeemed Savings */}
        <div className="p-5 rounded-2xl bg-[#fff7ed] border-2 border-[#fed7aa] shadow-sm">
          <div className="text-[11px] uppercase font-black text-[#9a3412] flex items-center gap-1.5">
            <ShoppingBag size={14} className="text-[#ea580c]" /> Points Redeemed
          </div>
          <div className="text-2xl font-black text-[#7c2d12] mt-2">
            {Math.round(breakdown.redeemed_points || 0).toLocaleString()}
            <span className="text-xs font-bold text-[#ea580c] ml-1">pts</span>
          </div>
          <div className="text-[11px] text-[#c2410c] font-medium mt-1">
            Saved on course purchases
          </div>
        </div>
      </div>

      {/* Immutable Transaction Ledger Table */}
      <div className="p-6 bg-white border border-[#e2e8e2] rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#edf1ee] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#059669]/10 text-[#059669] flex items-center justify-center font-bold">
              <History size={16} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0f172a]">Points Transaction Ledger</h2>
              <p className="text-xs text-[#64748b]">Complete verified audit log of all points credited and debited</p>
            </div>
          </div>

          <span className="text-xs font-bold text-[#059669] bg-[#ecfdf5] px-3 py-1 rounded-full border border-[#a7f3d0]">
            {transactions.length} Total Events
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              title="No points transactions recorded yet"
              detail="Complete your first day learning checklist and submit evidence Word doc to earn +20 base reward points immediately!"
              icon={Coins}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8e2] bg-[#f8fafc] text-[#475569] text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description / Qualifying Event</th>
                  <th className="py-3 px-4 text-right">Points Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {transactions.map((tx: any) => {
                  const isCredit = (tx.points_delta > 0);
                  return (
                    <tr key={tx.id} className="hover:bg-[#f8fafc] transition">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#64748b]">
                        {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1e293b]">
                        <span className="capitalize">{tx.transaction_type.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-3.5 px-4 text-[#334155] font-medium max-w-md">
                        {tx.reason || 'Reward transaction'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black">
                        {isCredit ? (
                          <span className="inline-flex items-center gap-1 text-[#059669] bg-[#ecfdf5] px-2.5 py-1 rounded-lg border border-[#a7f3d0]">
                            +{Math.round(tx.points_delta)} pts (₹{Math.round(tx.points_delta * ratio)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#dc2626] bg-[#fef2f2] px-2.5 py-1 rounded-lg border border-[#fecaca]">
                            {Math.round(tx.points_delta)} pts (-₹{Math.round(Math.abs(tx.points_delta) * ratio)})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default RewardWalletPage;
