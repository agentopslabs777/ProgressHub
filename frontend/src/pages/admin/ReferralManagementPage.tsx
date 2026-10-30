import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gift, Settings, CheckCircle2, Clock, Check, X,
  DollarSign, Users, Award, RefreshCw, AlertCircle, Link as LinkIcon,
  ShieldCheck, Edit, Sparkles, ExternalLink
} from 'lucide-react';
import { referralsApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState, Modal } from '@/components/common/UIComponents';

export function ReferralManagementPage() {
  const queryClient = useQueryClient();
  
  // Active top tab: 'approvals' | 'user_links'
  const [activeTab, setActiveTab] = useState<'approvals' | 'user_links'>('approvals');

  // Filters for Referrals table
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Filters for User Links table
  const [linkRoleFilter, setLinkRoleFilter] = useState('');
  const [linkSearch, setLinkSearch] = useState('');

  // Modals
  const [editCampaignModal, setEditCampaignModal] = useState(false);
  const [assignLinkModal, setAssignLinkModal] = useState<any | null>(null);

  // Form states for Campaign settings
  const [headline, setHeadline] = useState('');
  const [baseReward, setBaseReward] = useState<number>(999);
  const [tierReward, setTierReward] = useState<number>(799.20);
  const [vipPrice, setVipPrice] = useState<number>(999);
  const [instructions, setInstructions] = useState('');

  // Form states for Assigning User Link
  const [assignCode, setAssignCode] = useState('');
  const [assignLink, setAssignLink] = useState('');
  const [assignApproved, setAssignApproved] = useState(true);

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['admin_campaigns'],
    queryFn: referralsApi.listCampaigns
  });

  const activeCampaign = campaigns[0] || null;

  // Fetch all referrals
  const { data: referrals = [], isLoading: referralsLoading, refetch: refetchReferrals } = useQuery({
    queryKey: ['admin_all_referrals', statusFilter, roleFilter],
    queryFn: () => referralsApi.listAll(statusFilter || undefined, roleFilter || undefined)
  });

  // Fetch all user links
  const { data: userLinks = [], isLoading: linksLoading, refetch: refetchUserLinks } = useQuery({
    queryKey: ['admin_user_links', linkRoleFilter, linkSearch],
    queryFn: () => referralsApi.listUserLinks({ role_filter: linkRoleFilter || undefined, search: linkSearch || undefined })
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, amount }: { id: string; status: string; amount?: number }) =>
      referralsApi.reviewReward(id, { reward_status: status, reward_amount: amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_all_referrals'] });
      queryClient.invalidateQueries({ queryKey: ['referrals_leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin_user_links'] });
    }
  });

  const assignLinkMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: any }) =>
      referralsApi.assignUserLink(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_user_links'] });
      queryClient.invalidateQueries({ queryKey: ['my_referrals'] });
      setAssignLinkModal(null);
    }
  });

  const updateCampaignMutation = useMutation({
    mutationFn: (data: any) => referralsApi.updateCampaign(activeCampaign.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_campaigns'] });
      setEditCampaignModal(false);
    }
  });

  const openEditModal = () => {
    if (activeCampaign) {
      setHeadline(activeCampaign.headline || 'INVITE AND EARN');
      setBaseReward(activeCampaign.base_reward_amount || 999);
      setTierReward(activeCampaign.tier_reward_amount || 799.20);
      setVipPrice(activeCampaign.vip_price || 999);
      setInstructions(activeCampaign.instructions || '');
      setEditCampaignModal(true);
    }
  };

  const openAssignModal = (u: any) => {
    setAssignLinkModal(u);
    setAssignCode(u.referral_code || '');
    setAssignLink(u.referral_link || `http://localhost:5173/login?ref=${u.referral_code}`);
    setAssignApproved(u.referral_link_approved ?? true);
  };

  const pendingCount = referrals.filter((r: any) => r.reward_status === 'pending').length;
  const approvedCount = referrals.filter((r: any) => r.reward_status === 'approved').length;
  const paidCount = referrals.filter((r: any) => r.reward_status === 'paid').length;

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Growth & Incentives"
        title="Referral Campaign & Approvals Management"
        description="Provide official referral links to students and employees, configure tier bonus pricing, and review/approve referral cash rewards."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchReferrals();
                refetchUserLinks();
              }}
              className="btn btn-soft text-xs"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={openEditModal}
              disabled={!activeCampaign}
              className="btn btn-primary text-xs"
            >
              <Settings size={13} /> Campaign Settings
            </button>
          </div>
        }
      />

      {/* Campaign Summary & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Base Reward (1st Friend)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#225741]">
              ₹{activeCampaign?.base_reward_amount ?? 999}
            </span>
            <span className="text-xs text-[#2e624c] font-semibold">100% to referrer</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Tier Reward (Subsequent)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#24362e]">
              ₹{activeCampaign?.tier_reward_amount ?? 799.20}
            </span>
            <span className="text-xs text-[#708077] font-medium">80% per invite</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Pending Admin Approvals</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#a9601d]">{pendingCount}</span>
            <span className="text-xs text-[#9c6a34]">Awaiting review</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Approved & Paid Rewards</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#1d5c3d]">{paidCount}</span>
            <span className="text-xs text-[#5f7467] font-medium">{approvedCount} approved</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#e1e7e2] gap-4">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'approvals'
              ? 'border-[#235841] text-[#21352d]'
              : 'border-transparent text-[#64756e] hover:text-[#21352d]'
          }`}
        >
          <Gift size={14} /> Referral Rewards & Approvals
          {pendingCount > 0 && (
            <span className="h-5 px-1.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10px] font-black grid place-items-center">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('user_links')}
          className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
            activeTab === 'user_links'
              ? 'border-[#235841] text-[#21352d]'
              : 'border-transparent text-[#64756e] hover:text-[#21352d]'
          }`}
        >
          <LinkIcon size={14} /> Assign Official Referral Links (Given by Admin)
        </button>
      </div>

      {/* Tab 1: Referrals Review & Approvals */}
      {activeTab === 'approvals' && (
        <div className="panel bg-white border border-[#e4ebe4] overflow-hidden">
          <div className="p-4 border-b border-[#edf1ee] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#23352e]">
                All Referrals ({referrals.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="field text-xs py-1.5"
              >
                <option value="">All Referrer Roles</option>
                <option value="student">Students (5 Limit)</option>
                <option value="employee">Employees (No Limit)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="field text-xs py-1.5"
              >
                <option value="">All Reward Statuses</option>
                <option value="pending">Pending Admin Approval</option>
                <option value="approved">Approved by Admin</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {referralsLoading ? (
            <div className="p-12">
              <LoadingState label="Loading referral claims and bonus payouts" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState
                title="No referrals found"
                detail="When students or employees invite candidates using their official link, the referral funnel and rewards will appear here."
                icon={Gift}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f7faf8] text-[#55675e] text-[11px] border-b border-[#e6ede8]">
                  <tr>
                    <th className="py-3 px-4 font-bold">Referrer (Student / Employee)</th>
                    <th className="py-3 px-4 font-bold">Referred Guest</th>
                    <th className="py-3 px-4 font-bold">Official Code</th>
                    <th className="py-3 px-4 font-bold">Funnel Stage</th>
                    <th className="py-3 px-4 font-bold">Bonus Amount</th>
                    <th className="py-3 px-4 font-bold">Admin Status</th>
                    <th className="py-3 px-4 font-bold text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ed]">
                  {referrals.map((r: any) => (
                    <tr key={r.id} className="hover:bg-[#fafbf9]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#22352d]">{r.referrer_name}</span>
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              r.referrer_role === 'employee'
                                ? 'bg-[#ede9fe] text-[#6d28d9] border border-[#ddd6fe]'
                                : 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                            }`}
                          >
                            {r.referrer_role === 'employee' ? 'Employee (No Limit)' : 'Student (5 Max)'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#718179] mt-0.5">{r.referrer_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#253730]">{r.referred_name || 'Friend'}</div>
                        <div className="text-[11px] text-[#718179]">{r.referred_email || r.referred_phone || 'Direct Link Clicker'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#265340]">{r.referral_code}</td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-black px-2 py-0.5 rounded-full bg-[#eef4f0] text-[#245842] border border-[#d6e4dc]">
                          {r.funnel_stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-[#215740]">
                        ₹{Number(r.reward_amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.reward_status === 'paid'
                              ? 'bg-[#e2f4ea] text-[#20603f] border border-[#bce5cd]'
                              : r.reward_status === 'approved'
                              ? 'bg-[#e6f1fc] text-[#24588e] border border-[#c4dcfa]'
                              : r.reward_status === 'rejected'
                              ? 'bg-[#faecea] text-[#a4453a] border border-[#f5c7c2]'
                              : 'bg-[#fff5e5] text-[#8e601c] border border-[#f5dfbc]'
                          }`}
                        >
                          {r.reward_status === 'approved'
                            ? 'Approved by Admin ✅'
                            : r.reward_status === 'paid'
                            ? 'Paid 💰'
                            : r.reward_status === 'rejected'
                            ? 'Rejected ❌'
                            : 'Pending Admin Approval ⏳'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {r.reward_status === 'pending' && (
                            <button
                              onClick={() => reviewMutation.mutate({ id: r.id, status: 'approved' })}
                              className="btn btn-primary py-1 px-2.5 text-[11px] bg-[#225741] hover:bg-[#1a4433] flex items-center gap-1"
                            >
                              <Check size={12} /> Approve Referral
                            </button>
                          )}
                          {r.reward_status === 'approved' && (
                            <button
                              onClick={() => reviewMutation.mutate({ id: r.id, status: 'paid' })}
                              className="btn btn-soft py-1 px-2.5 text-[11px] font-bold text-[#1d5c3e] border-[#b9e0cb] bg-[#eef8f2]"
                            >
                              Mark Paid
                            </button>
                          )}
                          {r.reward_status !== 'rejected' && r.reward_status !== 'paid' && (
                            <button
                              onClick={() => reviewMutation.mutate({ id: r.id, status: 'rejected' })}
                              className="btn btn-soft py-1 px-2 text-[11px] text-[#a44439] hover:bg-[#faecea]"
                              title="Reject reward"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: User Referral Links Given by Admin */}
      {activeTab === 'user_links' && (
        <div className="panel bg-white border border-[#e4ebe4] overflow-hidden">
          <div className="p-4 border-b border-[#edf1ee] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-[#23352e]">Official Referral Invite Links Given by Admin</h3>
              <p className="text-[11px] text-[#718079]">
                Provide and approve official invite links for Students (5 friend limit) and Employees (no limit).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search user name or email…"
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="field text-xs py-1.5 w-48"
              />
              <select
                value={linkRoleFilter}
                onChange={(e) => setLinkRoleFilter(e.target.value)}
                className="field text-xs py-1.5"
              >
                <option value="">All Roles</option>
                <option value="student">Students (5 Max)</option>
                <option value="employee">Employees (Unlimited)</option>
              </select>
            </div>
          </div>

          {linksLoading ? (
            <div className="p-12">
              <LoadingState label="Loading user referral links" />
            </div>
          ) : userLinks.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState
                title="No users found"
                detail="No student or employee records matched the filter criteria."
                icon={Users}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f7faf8] text-[#55675e] text-[11px] border-b border-[#e6ede8]">
                  <tr>
                    <th className="py-3 px-4 font-bold">User Name & Email</th>
                    <th className="py-3 px-4 font-bold">Role & Policy Limit</th>
                    <th className="py-3 px-4 font-bold">Official Code</th>
                    <th className="py-3 px-4 font-bold">Official Invite Link</th>
                    <th className="py-3 px-4 font-bold">Link Admin Status</th>
                    <th className="py-3 px-4 font-bold">Invites</th>
                    <th className="py-3 px-4 font-bold text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1ed]">
                  {userLinks.map((u: any) => (
                    <tr key={u.id} className="hover:bg-[#fafbf9]">
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#22352d]">{u.name}</div>
                        <div className="text-[11px] text-[#718179]">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            u.role === 'employee'
                              ? 'bg-[#ede9fe] text-[#6d28d9] border border-[#ddd6fe]'
                              : 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                          }`}
                        >
                          {u.role === 'employee' ? 'Employee (No Limit)' : 'Student (5 Max)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#235841]">
                        {u.referral_code}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#506359] max-w-xs truncate" title={u.referral_link}>
                        {u.referral_link}
                      </td>
                      <td className="py-3 px-4">
                        {u.referral_link_approved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1e6140] bg-[#e3f4ea] px-2.5 py-0.5 rounded-full border border-[#bce4cc]">
                            <ShieldCheck size={11} /> Approved by Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#854d0e] bg-[#fef3c7] px-2.5 py-0.5 rounded-full border border-[#fde68a]">
                            <Clock size={11} /> Pending Assignment
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#273a32]">
                        {u.total_invites} invited ({u.approved_count} approved)
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openAssignModal(u)}
                            className="btn btn-soft py-1 px-2.5 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Edit size={12} /> Assign / Edit Link
                          </button>
                          {!u.referral_link_approved && (
                            <button
                              onClick={() => assignLinkMutation.mutate({
                                userId: u.id,
                                data: { referral_code: u.referral_code, referral_link: u.referral_link, approved: true }
                              })}
                              className="btn btn-primary py-1 px-2 text-[11px] bg-[#225741]"
                              title="Approve link directly"
                            >
                              <Check size={12} /> Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Assign / Give Official Link Modal */}
      {assignLinkModal && (
        <Modal
          title={`Assign Official Referral Link to ${assignLinkModal.name}`}
          onClose={() => setAssignLinkModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              assignLinkMutation.mutate({
                userId: assignLinkModal.id,
                data: {
                  referral_code: assignCode.trim().toUpperCase(),
                  referral_link: assignLink.trim(),
                  approved: assignApproved
                }
              });
            }}
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-[#f8faf8] rounded-xl border border-[#e1e9e3] flex items-center justify-between">
              <div>
                <span className="font-bold text-[#23352e] block">{assignLinkModal.name}</span>
                <span className="text-[11px] text-[#697972]">{assignLinkModal.email}</span>
              </div>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                assignLinkModal.role === 'employee' ? 'bg-[#ede9fe] text-[#6d28d9]' : 'bg-[#e0f2fe] text-[#0369a1]'
              }`}>
                {assignLinkModal.role === 'employee' ? 'Employee (No Limit)' : 'Student (5 Friends Max)'}
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Official Referral Code</label>
              <input
                type="text"
                required
                value={assignCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setAssignCode(val);
                  setAssignLink(`http://localhost:5173/login?ref=${val}`);
                }}
                placeholder="e.g. EMP-RAHUL-2026"
                className="field text-xs font-mono font-bold"
              />
              <span className="text-[10px] text-[#76867f] block mt-1">
                Unique identifier assigned by Admin for tracking this user's referrals.
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Official Referral Invite Link Given by Admin</label>
              <input
                type="text"
                required
                value={assignLink}
                onChange={(e) => setAssignLink(e.target.value)}
                placeholder="http://localhost:5173/login?ref=..."
                className="field text-xs font-mono"
              />
              <span className="text-[10px] text-[#76867f] block mt-1">
                The student or employee will use this exact link in their dashboard to invite candidates.
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="approveCheck"
                checked={assignApproved}
                onChange={(e) => setAssignApproved(e.target.checked)}
                className="rounded border-[#c9d5cb] text-[#245841] focus:ring-0"
              />
              <label htmlFor="approveCheck" className="text-xs font-semibold text-[#25372f]">
                Mark link as Approved & Given by Admin (activates immediately in user portal)
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-[#edf0ea]">
              <button
                type="button"
                className="btn btn-soft text-xs"
                onClick={() => setAssignLinkModal(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assignLinkMutation.isPending || !assignCode.trim() || !assignLink.trim()}
                className="btn btn-primary text-xs"
              >
                {assignLinkMutation.isPending ? 'Saving Link…' : 'Save & Give Official Link'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Campaign Modal */}
      {editCampaignModal && (
        <Modal title="Configure Referral Campaign Settings" onClose={() => setEditCampaignModal(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateCampaignMutation.mutate({
                headline,
                base_reward_amount: Number(baseReward),
                tier_reward_amount: Number(tierReward),
                vip_price: Number(vipPrice),
                instructions
              });
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Campaign Headline</label>
              <input
                type="text"
                required
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="field text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-[#485850]">VIP Price (₹)</label>
                <input
                  type="number"
                  required
                  value={vipPrice}
                  onChange={(e) => setVipPrice(Number(e.target.value))}
                  className="field text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-[#485850]">1st Friend Reward (₹)</label>
                <input
                  type="number"
                  required
                  value={baseReward}
                  onChange={(e) => setBaseReward(Number(e.target.value))}
                  className="field text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-[#485850]">Subsequent (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={tierReward}
                  onChange={(e) => setTierReward(Number(e.target.value))}
                  className="field text-xs"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Referral Instructions</label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="field text-xs"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button
                type="button"
                className="btn btn-soft text-xs"
                onClick={() => setEditCampaignModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateCampaignMutation.isPending}
                className="btn btn-primary text-xs"
              >
                {updateCampaignMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export default ReferralManagementPage;
