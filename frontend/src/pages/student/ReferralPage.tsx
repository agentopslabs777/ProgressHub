import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Share2, Copy, Check, Users, Gift, Trophy, ArrowRight,
  Sparkles, ExternalLink, MessageCircle, Video, Mic, CheckCircle2,
  TrendingUp, Award, UserPlus, Send, Clock, ShieldCheck, AlertCircle
} from 'lucide-react';
import { User, referralsApi } from '@/services/api';
import { PageTitle, EmptyState, LoadingState, ErrorState } from '@/components/common/UIComponents';

export function ReferralPage({ user }: { user?: User }) {
  const queryClient = useQueryClient();

  // Active top tab: 'vip' | 'recordings'
  const [activeTab, setActiveTab] = useState<'vip' | 'recordings'>('vip');
  // Stepper count for referral calculator
  const [stepperFriends, setStepperFriends] = useState<number>(5);
  // Friend Personalizer tab: 'english' | 'hinglish'
  const [langTab, setLangTab] = useState<'english' | 'hinglish'>('english');
  // Copy state
  const [copied, setCopied] = useState(false);

  // Quick invite friend form
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Fetch student/employee referral data
  const { data: info, isLoading, isError, refetch } = useQuery({
    queryKey: ['my_referrals'],
    queryFn: referralsApi.getMyInfo
  });

  // Fetch real top inviters leaderboard
  const { data: leaderboard = [] } = useQuery({
    queryKey: ['referrals_leaderboard'],
    queryFn: referralsApi.getLeaderboard
  });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => referralsApi.inviteFriend(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_referrals'] });
      queryClient.invalidateQueries({ queryKey: ['referrals_leaderboard'] });
      setFriendName('');
      setFriendEmail('');
      setFriendPhone('');
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 4000);
    }
  });

  if (isLoading) return <LoadingState label="Loading referral program and reward calculator" />;
  if (isError || !info) return <ErrorState retry={() => refetch()} />;

  const isEmployee = user?.role === 'employee' || info.is_employee || info.user_role === 'employee';
  const campaign = info.campaign || {};
  const stats = info.stats || { total_invites: 0, claimed_count: 0, bought_count: 0, earned_so_far: 0, pending_rewards: 0 };
  const guests = info.guests || [];
  const referralCode = info.referral_code || '';
  const referralLink = info.referral_link || `http://localhost:5173/login?ref=${referralCode}`;
  const isLinkGivenByAdmin = info.is_link_assigned_by_admin !== false && Boolean(info.referral_link_approved);

  // Parse rungs configuration (Capped at 5 for students; unlimited tiers for employees)
  let rungs = isEmployee ? [
    { count: 1, title: 'Starter Partner', reward: 999 },
    { count: 3, title: 'Growth Contributor', reward: 2597.4 },
    { count: 5, title: 'Team Builder', reward: 4195.8 },
    { count: 10, title: 'Campus Ambassador', reward: 8193.0 },
    { count: 20, title: 'Master Partner', reward: 16187.0 }
  ] : [
    { count: 1, title: 'Door opener', reward: 999 },
    { count: 2, title: 'Study Buddy', reward: 1798.2 },
    { count: 3, title: 'Table of three', reward: 2597.4 },
    { count: 4, title: 'Squad Leader', reward: 3396.6 },
    { count: 5, title: 'Full table (Max 5)', reward: 4195.8 }
  ];
  if (campaign.rungs_config) {
    try {
      const parsed = JSON.parse(campaign.rungs_config);
      rungs = isEmployee ? parsed : parsed.slice(0, 5);
    } catch (e) {
      // keep fallback
    }
  }

  // Calculate potential earnings based on stepper (Capped at 5 for students; unlimited for employees)
  const baseReward = campaign.base_reward_amount || 999.0;
  const tierReward = campaign.tier_reward_amount || 799.20;
  const effectiveFriends = isEmployee ? Math.max(1, stepperFriends) : Math.min(5, Math.max(1, stepperFriends));
  const calculatedEarnings = effectiveFriends <= 0 ? 0 : Math.round(baseReward + (effectiveFriends - 1) * tierReward);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = async (friendNameParam?: string, friendPhoneParam?: string) => {
    try {
      await referralsApi.logWhatsAppShare({
        friend_name: friendNameParam || friendName.trim() || undefined,
        friend_phone: friendPhoneParam || friendPhone.trim() || undefined
      });
      queryClient.invalidateQueries({ queryKey: ['my_referral_info'] });
      queryClient.invalidateQueries({ queryKey: ['referral_leaderboard'] });
    } catch (e) {
      console.error('Error logging WhatsApp share', e);
    }
    const targetName = friendNameParam || friendName.trim();
    const text = encodeURIComponent(
      targetName
        ? `Hey ${targetName}! Join me on this Training Platform with an official VIP invitation. Claim your seat here: ${referralLink}`
        : `Hey! Join me on this Training Platform with an official VIP invitation. Claim your seat here: ${referralLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const whatsappText = encodeURIComponent(
    `Hey! Join me on this Training Platform with an official VIP invitation. Claim your seat here: ${referralLink}`
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${whatsappText}`;

  // Personalized message templates
  const previewMessageEnglish = isEmployee
    ? `Hey ${friendName.trim() || 'there'}! As a partner with this training program, I'm inviting you with an official VIP access link given by admin. You can access classes & materials here: ${referralLink}`
    : `Hey ${friendName.trim() || 'there'}! I'm attending this exclusive program. I've got 5 free seats to give to friends, and I reserved one for you! You can access the daily classes, summaries, and materials here: ${referralLink}`;
  const previewMessageHinglish = isEmployee
    ? `Hello ${friendName.trim() || ''}, training program ke official VIP partner link se aapko direct access mil raha hai. Classes aur learning materials ke liye yahan se join karein: ${referralLink}`
    : `Bhai ${friendName.trim() || ''}, main yeh training program attend kar raha hoon. Mere paas 5 free passes hain, ek tumhare liye reserve kiya hai. Yahan se join kar lo: ${referralLink}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header / Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e1e8e2] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#2e624e]">Referral & Growth</span>
          <h1 className="text-2xl font-black text-[#21342c]">{campaign.headline || 'INVITE AND EARN'}</h1>
        </div>

        {/* Tab pill matching Screenshot 1 */}
        <div className="inline-flex rounded-xl bg-[#e9eee9] p-1 border border-[#d6dfd7]">
          <button
            onClick={() => setActiveTab('vip')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
              activeTab === 'vip' ? 'bg-white text-[#21352d] shadow-sm' : 'text-[#62736b] hover:text-[#21352d]'
            }`}
          >
            VIP
          </button>
          <button
            onClick={() => setActiveTab('recordings')}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
              activeTab === 'recordings' ? 'bg-white text-[#21352d] shadow-sm' : 'text-[#62736b] hover:text-[#21352d]'
            }`}
          >
            Recordings
          </button>
        </div>
      </div>

      {/* Hero Banner with Earnings & Pricing Rules (Matching Screenshot 2) */}
      <div
        className="p-6 rounded-2xl shadow-lg border border-[#1b4333] text-white"
        style={{ background: 'linear-gradient(135deg, #1b3d2f 0%, #0f271d 100%)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-block text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                isEmployee
                  ? 'bg-[#3b82f633] text-[#93c5fd] border-[#93c5fd40]'
                  : 'bg-[#ffffff1f] text-[#86efac] border-[#86efac40]'
              }`}>
                {isEmployee ? '★ Employee Partner Program • Unlimited Referrals (No Limit)' : 'Exclusive Student VIP Benefit • Max 5 Friends'}
              </span>

              {isLinkGivenByAdmin ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#15803d40] text-[#86efac] px-2.5 py-0.5 rounded-full border border-[#86efac33]">
                  <ShieldCheck size={12} /> Official Link Given & Approved by Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#b4530940] text-[#fde047] px-2.5 py-0.5 rounded-full border border-[#fde04733]">
                  <Clock size={12} /> Referral Invite Link will be provided by Admin
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black text-white">
                {campaign.currency || '₹'}{stats.earned_so_far.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-[#a7f3d0]">earned so far (Approved by Admin)</span>
              {(stats.pending_rewards || 0) > 0 && (
                <span className="text-xs text-[#fde047] font-semibold bg-[#854d0e33] px-2 py-0.5 rounded border border-[#fde04733]">
                  + ₹{stats.pending_rewards.toLocaleString()} pending admin review
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#e2e8f0] leading-relaxed font-medium">
              Earn <strong className="text-white underline decoration-[#86efac] underline-offset-4 font-bold">{campaign.currency || '₹'}{baseReward} (100% to you)</strong> on your first invite, then <strong className="text-[#86efac] font-bold">{campaign.currency || '₹'}{tierReward}</strong> for every friend who joins! {isEmployee ? 'No limit on employee referrals.' : 'Students can refer up to 5 friends.'}
            </p>

            {/* Link & WhatsApp CTA buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => handleWhatsAppShare()}
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1faa53] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
              >
                <MessageCircle size={16} /> WhatsApp Share
              </button>

              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 bg-white text-[#0f271d] hover:bg-[#f1f5f2] px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition border border-white cursor-pointer"
              >
                {copied ? <Check size={14} className="text-[#15803d]" /> : <Copy size={14} />}
                {copied ? 'Link Copied!' : 'Copy Official Invite Link'}
              </button>
            </div>
          </div>

          {/* Code display card */}
          <div className="bg-[#0b1c15] p-5 rounded-2xl border border-[#2a5540] space-y-2 text-center shadow-inner">
            <span className="text-[10px] uppercase font-black tracking-wider text-[#86efac] block">
              Official Referral Code
            </span>
            <span className="text-xl font-black tracking-wider text-white bg-[#163829] px-4 py-2 rounded-lg inline-block font-mono border border-[#3b755b]">
              {referralCode}
            </span>
            <p className="text-[11px] text-[#cbd5e1]">Given by Admin for official tracking & rewards.</p>
          </div>
        </div>

        {/* Funnel Pipeline Row (Matching Screenshot 2) */}
        <div className="mt-6 pt-5 border-t border-[#ffffff20] grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-[#0b1c15]/70 border border-[#264e3a]">
            <span className="text-xl font-black text-white block">{stats.total_invites}</span>
            <span className="text-[11px] font-bold text-[#86efac] block mt-0.5">Sent</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0b1c15]/70 border border-[#264e3a]">
            <span className="text-xl font-black text-white block">{stats.total_invites}</span>
            <span className="text-[11px] font-bold text-[#86efac] block mt-0.5">Opened</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0b1c15]/70 border border-[#264e3a]">
            <span className="text-xl font-black text-white block">{stats.claimed_count}</span>
            <span className="text-[11px] font-bold text-[#86efac] block mt-0.5">Claimed</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0b1c15]/70 border border-[#264e3a]">
            <span className="text-xl font-black text-white block">{stats.claimed_count}</span>
            <span className="text-[11px] font-bold text-[#86efac] block mt-0.5">Came</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0b1c15]/70 border border-[#264e3a]">
            <span className="text-xl font-black text-white block">{stats.claimed_count}</span>
            <span className="text-[11px] font-bold text-[#86efac] block mt-0.5">Took a seat</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#0b1c15]/70 border border-[#264e3a]">
            <span className="text-xl font-black text-white block">{stats.bought_count}</span>
            <span className="text-[11px] font-bold text-[#86efac] block mt-0.5">Bought</span>
          </div>
        </div>
      </div>

      {/* Interactive Referral Bonus Calculator (Matching Screenshot 1) */}
      <div className="panel p-5 bg-white border border-[#e4ece4] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#23352e] flex items-center gap-1.5">
              <Sparkles size={16} className="text-[#306852]" /> Referral Earnings Calculator
            </h3>
            <p className="text-[11px] text-[#718079]">
              {isEmployee
                ? 'Employees have no limit on referrals. Calculate unlimited potential cash rewards!'
                : 'Adjust the friends stepper to simulate potential cash earnings (up to 5 friends max).'}
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 bg-[#f3f7f4] px-3.5 py-2 rounded-xl border border-[#dce6df]">
            <span className="text-xs font-semibold text-[#4e5f57]">if</span>
            <div className="inline-flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-[#d6dfd7]">
              <button
                type="button"
                onClick={() => setStepperFriends(Math.max(1, stepperFriends - 1))}
                className="h-5 w-5 grid place-items-center rounded bg-[#edf3ef] text-[#24372f] hover:bg-[#e0ece3] text-xs font-bold"
              >
                -
              </button>
              <span className="w-6 text-center text-xs font-black text-[#21352d]">{stepperFriends}</span>
              <button
                type="button"
                disabled={!isEmployee && stepperFriends >= 5}
                onClick={() => setStepperFriends(isEmployee ? stepperFriends + 1 : Math.min(5, stepperFriends + 1))}
                className={`h-5 w-5 grid place-items-center rounded bg-[#edf3ef] text-[#24372f] hover:bg-[#e0ece3] text-xs font-bold ${
                  !isEmployee && stepperFriends >= 5 ? 'opacity-30 cursor-not-allowed' : ''
                }`}
                title={!isEmployee && stepperFriends >= 5 ? 'Maximum 5 friends limit for students' : 'Add friend'}
              >
                +
              </button>
            </div>
            <span className="text-xs font-semibold text-[#4e5f57]">friends take VIP →</span>
            <span className="text-sm font-black text-[#225742]">{campaign.currency || '₹'}{calculatedEarnings.toLocaleString()}</span>
          </div>
        </div>

        {/* Your Rungs Progression Milestones (Matching Screenshot 1) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block mb-2">
            Your Rungs ({isEmployee ? 'Unlimited Milestone Progression' : 'Milestone Progression - 5 Friends Max'})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            {rungs.map((rung: any, idx: number) => {
              const isAchieved = stats.total_invites >= rung.count;
              const isCurrentSimulated = stepperFriends >= rung.count;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition ${
                    isAchieved
                      ? 'bg-[#e7f5ed] border-[#b7dfc8] text-[#1e4a36]'
                      : isCurrentSimulated
                      ? 'bg-[#f4f8f5] border-[#cfe2d6] text-[#2c3d35]'
                      : 'bg-[#fafafa] border-[#e8ece8] text-[#7d8d85]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span>{rung.count} {rung.count === 1 ? 'friend' : 'friends'}</span>
                    {isAchieved ? (
                      <CheckCircle2 size={13} className="text-[#256f48]" />
                    ) : (
                      <span className="text-[10px] text-[#93a299]">Level {idx + 1}</span>
                    )}
                  </div>
                  <div className="font-bold text-xs text-[#20322b] truncate">{rung.title}</div>
                  <div className="text-[11px] font-semibold text-[#285e48] mt-1">
                    {campaign.currency || '₹'}{Number(rung.reward).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Friend Personalizer & Leaderboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Friend Personalizer & Quick Invite Form */}
        <div className="panel p-5 bg-white border border-[#e4ece4] space-y-4">
          <div className="flex items-center justify-between border-b border-[#edf1ee] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#23352e] flex items-center gap-1.5">
                <Gift size={15} className="text-[#2b604b]" /> {isEmployee ? 'Invite Candidates / Students (Unlimited)' : '5 Free VIP Seats (5 Friends Max)'}
              </h3>
              <p className="text-[11px] text-[#718079]">
                {isEmployee
                  ? `Employees have unlimited referral capacity (${guests.length} candidates invited so far)`
                  : `VIP referral is limited to 5 friends only (${Math.min(5, guests.length)}/5 referred)`}
              </p>
            </div>

            {/* Language toggle: English / Hinglish */}
            <div className="inline-flex rounded-lg bg-[#f0f4f1] p-0.5 border border-[#d9e2db]">
              <button
                onClick={() => setLangTab('english')}
                className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
                  langTab === 'english' ? 'bg-white text-[#21352d] shadow-xs' : 'text-[#64746d]'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLangTab('hinglish')}
                className={`rounded px-2.5 py-1 text-[11px] font-bold transition ${
                  langTab === 'hinglish' ? 'bg-white text-[#21352d] shadow-xs' : 'text-[#64746d]'
                }`}
              >
                Hinglish
              </button>
            </div>
          </div>

          {/* Quick Invite Friend Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!friendName.trim()) return;
              if (!isEmployee && (guests.length >= 5 || stats.total_invites >= 5)) return;
              inviteMutation.mutate({
                referred_name: friendName,
                referred_email: friendEmail || undefined,
                referred_phone: friendPhone || undefined,
                referral_code: referralCode,
                funnel_stage: 'invited'
              });
            }}
            className="space-y-3"
          >
            {!isEmployee && (guests.length >= 5 || stats.total_invites >= 5) ? (
              <div className="rounded-xl bg-[#fff7ed] p-3 text-xs text-[#9a3412] border border-[#fed7aa] space-y-1">
                <span className="font-bold text-[11px] uppercase tracking-wider block">Maximum 5 Friends Cap Reached</span>
                <p>You have referred 5 friends (the maximum allowed for students under the VIP Referral Program). Thank you for sharing!</p>
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485850]">Candidate / Friend Full Name</label>
              <input
                type="text"
                required
                disabled={!isEmployee && (guests.length >= 5 || stats.total_invites >= 5)}
                placeholder="e.g. Rahul Sharma"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                className="field text-xs py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#485850]">Email (Optional)</label>
                <input
                  type="email"
                  disabled={!isEmployee && (guests.length >= 5 || stats.total_invites >= 5)}
                  placeholder="rahul@example.com"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  className="field text-xs py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#485850]">Phone / WhatsApp</label>
                <input
                  type="text"
                  disabled={!isEmployee && (guests.length >= 5 || stats.total_invites >= 5)}
                  placeholder="+91 98765 43210"
                  value={friendPhone}
                  onChange={(e) => setFriendPhone(e.target.value)}
                  className="field text-xs py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Personalized Message Preview Box */}
            <div className="rounded-xl border border-[#dde6df] bg-[#f8faf8] p-3 text-xs text-[#35463f] space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#798a81] block">
                Message Preview
              </span>
              <p className="text-[11px] text-[#42544c] leading-relaxed italic">
                "{langTab === 'english' ? previewMessageEnglish : previewMessageHinglish}"
              </p>
            </div>

            {inviteSuccess && (
              <div className="rounded-lg bg-[#e2f4ea] p-2 text-xs font-medium text-[#205b3e] border border-[#bce4cc]">
                ✓ Invitation recorded! Sent to admin queue for approval.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={inviteMutation.isPending || !friendName.trim() || (!isEmployee && (guests.length >= 5 || stats.total_invites >= 5))}
                className="btn btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
              >
                <Send size={13} /> {inviteMutation.isPending ? 'Logging Invite…' : (!isEmployee && (guests.length >= 5 || stats.total_invites >= 5)) ? 'Max 5 Friends Reached' : isEmployee ? 'Record Invite' : 'Log VIP Invite'}
              </button>

              <button
                type="button"
                onClick={() => handleWhatsAppShare(friendName, friendPhone)}
                disabled={!friendName.trim() || (!isEmployee && (guests.length >= 5 || stats.total_invites >= 5))}
                className="w-full bg-[#25D366] hover:bg-[#1faa53] text-white text-xs py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <MessageCircle size={14} /> Send on WhatsApp
              </button>
            </div>
          </form>
        </div>

        {/* Real Top Inviters Leaderboard (Matching Screenshot 1) */}
        <div className="panel p-5 bg-white border border-[#e4ece4] space-y-4">
          <div className="flex items-center justify-between border-b border-[#edf1ee] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#23352e] flex items-center gap-1.5">
                <Trophy size={15} className="text-[#a8741a]" /> Top Inviters This Week
              </h3>
              <p className="text-[11px] text-[#718079]">Real student & employee ranking from platform activity</p>
            </div>
            <span className="text-[10px] font-bold text-[#2d5f4c] bg-[#e7f1ea] px-2 py-0.5 rounded-full border border-[#d1e2d6]">
              Real Database
            </span>
          </div>

          {/* Podium Extra Rewards Banner */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#fefce8] to-[#fef9c3] border border-[#fef08a] text-xs space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#854d0e] flex items-center gap-1">
              <Sparkles size={13} className="text-[#ca8a04]" /> Podium Extra Reward Prizes:
            </span>
            <div className="grid grid-cols-3 gap-1 text-[11px] text-[#713f12] font-semibold text-center pt-1">
              <span className="bg-white/70 py-1 rounded-lg border border-[#fde047]">🥇 1st: +500 pts</span>
              <span className="bg-white/70 py-1 rounded-lg border border-[#fde047]">🥈 2nd: +300 pts</span>
              <span className="bg-white/70 py-1 rounded-lg border border-[#fde047]">🥉 3rd: +150 pts</span>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                title="No referrals yet this week"
                detail="Be the first to invite candidates and take the #1 spot on the leaderboard podium!"
                icon={Trophy}
              />
            </div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {leaderboard.map((item: any, idx: number) => {
                const isPodium = idx < 3;
                const podiumColor =
                  idx === 0
                    ? 'bg-[#fff8e7] border-[#f2d89b] text-[#8e6216]'
                    : idx === 1
                    ? 'bg-[#f4f7f5] border-[#d4ded8] text-[#54675e]'
                    : 'bg-[#faf6f0] border-[#ecdcc7] text-[#8a5b28]';

                return (
                  <div
                    key={item.user_id || idx}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                      isPodium ? podiumColor : 'bg-[#fafafa] border-[#edf0ed] text-[#33463e]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-6 w-6 grid place-items-center rounded-full bg-white font-black text-[11px] shadow-xs">
                        #{item.rank || idx + 1}
                      </span>
                      <div>
                        <span className="font-bold block">{item.name}</span>
                        {item.bonus_label && (
                          <span className="text-[10px] font-black text-[#854d0e] bg-white/80 px-1.5 py-0.5 rounded border border-[#eab308] inline-block mt-0.5">
                            {item.bonus_label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-[#5a6c63] block">
                        {item.total_referrals} {item.total_referrals === 1 ? 'invite' : 'invites'}
                      </span>
                      <span className="font-bold text-[#245741] text-xs">
                        {campaign.currency || '₹'}{Number(item.total_earned || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Your Guests Real Tracking List (Matching Screenshot 3) */}
      <div className="panel p-5 bg-white border border-[#e4ece4] space-y-3">
        <div className="flex items-center justify-between border-b border-[#edf1ee] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#23352e] flex items-center gap-1.5">
              <Users size={15} className="text-[#295e4a]" /> Your Guests & Referral Approvals
            </h3>
            <p className="text-[11px] text-[#718079]">
              Track the exact progress and Admin approval status of everyone you invited.
            </p>
          </div>
          <span className="text-xs text-[#5f7068] font-semibold">
            {guests.length} guest(s) logged
          </span>
        </div>

        {guests.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              title="No guests yet"
              detail="Invite candidates or friends to give them access and track their Admin approval status here."
              icon={Users}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#edf0ea] text-[#63746c] text-[11px]">
                  <th className="py-2.5 px-3 font-semibold">Guest Name</th>
                  <th className="py-2.5 px-3 font-semibold">Contact / Email</th>
                  <th className="py-2.5 px-3 font-semibold">Funnel Stage</th>
                  <th className="py-2.5 px-3 font-semibold">Admin Approval Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Bonus Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f1]">
                {guests.map((g: any) => (
                  <tr key={g.id} className="hover:bg-[#fafbf9]">
                    <td className="py-2.5 px-3 font-bold text-[#21352d]">{g.name}</td>
                    <td className="py-2.5 px-3 text-[#52645c]">{g.email || g.phone || 'Direct Link Clicker'}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block uppercase text-[10px] font-black px-2 py-0.5 rounded-full bg-[#edf4ef] text-[#295c47] border border-[#d2e2d8]">
                        {g.funnel_stage}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          g.reward_status === 'paid'
                            ? 'bg-[#e2f4ea] text-[#20603f] border border-[#bce5cd]'
                            : g.reward_status === 'approved'
                            ? 'bg-[#e6f1fc] text-[#24588e] border border-[#c4dcfa]'
                            : g.reward_status === 'rejected'
                            ? 'bg-[#faecea] text-[#a44439] border border-[#f5c7c2]'
                            : 'bg-[#fff5e5] text-[#8e601c] border border-[#f5dfbc]'
                        }`}
                      >
                        {g.reward_status === 'approved'
                          ? 'Approved by Admin ✅'
                          : g.reward_status === 'paid'
                          ? 'Reward Paid 💰'
                          : g.reward_status === 'rejected'
                          ? 'Rejected ❌'
                          : 'Pending Admin Approval ⏳'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-[#225741]">
                      {campaign.currency || '₹'}{Number(g.reward_amount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
export default ReferralPage;
