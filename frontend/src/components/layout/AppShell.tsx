import React, { useState, useEffect, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, GraduationCap, Layers, BookOpen,
  ClipboardList, MessageSquare,
  ShieldAlert, Bell, LogOut, Menu, X, ChevronRight, Sparkles,
  FileSpreadsheet, Gift, Wallet, CreditCard, ShoppingBag, Receipt, Award
} from 'lucide-react';
import { User, authApi, notificationsApi } from '@/services/api';

interface AppShellProps {
  user: User;
  children: ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 15000
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSignOut = async () => {
    await authApi.logout();
    setLocation('/login');
  };

  const adminNav = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Program Management', href: '/programs', icon: BookOpen },
    { label: 'Student Reviews', href: '/student-reviews', icon: FileSpreadsheet },
    { label: 'Students', href: '/students', icon: GraduationCap },
    { label: 'Employees', href: '/employees', icon: Users },
    { label: 'Teams', href: '/teams', icon: Layers },
    { label: 'Enrollments', href: '/enrollments', icon: ClipboardList },
    { label: 'Referral Campaigns', href: '/referral-management', icon: Gift },
    { label: 'Razorpay Payments', href: '/payments', icon: CreditCard },
    { label: 'Reward Points Policy', href: '/reward-config', icon: Award },
    { label: 'Messages / Chat', href: '/chat', icon: MessageSquare },
    { label: 'Audit Logs', href: '/audit-logs', icon: ShieldAlert },
  ];

  const employeeNav = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Students', href: '/my-students', icon: GraduationCap },
    { label: 'Student Progress', href: '/student-reviews', icon: FileSpreadsheet },
    { label: 'Invite & Earn', href: '/referrals', icon: Gift },
    { label: 'Messages / Chat', href: '/chat', icon: MessageSquare },
  ];

  const studentNav = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Programs', href: '/my-programs', icon: BookOpen },
    { label: 'Explore & Purchase Programs', href: '/explore-programs', icon: ShoppingBag },
    { label: 'Reward Points Wallet', href: '/wallet', icon: Wallet },
    { label: 'Referral Program', href: '/referrals', icon: Gift },
    { label: 'Messages / Chat', href: '/chat', icon: MessageSquare },
    { label: 'Payment History', href: '/payment-history', icon: Receipt },
  ];

  const navItems = user.role === 'admin' ? adminNav : user.role === 'employee' ? employeeNav : studentNav;

  const initials = (user.fullName || user.email)
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8f8f4] md:flex">
      {/* Desktop Sidebar */}
      <aside className="desktop-nav fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-[#e4e7e1] bg-[#f2f4ee] px-4 py-5">
        {/* Brand */}
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#285d4b] text-white shadow-sm">
            <Layers size={17} strokeWidth={2.2} />
          </div>
          <div>
            <div className="display text-sm font-extrabold text-[#22362f]">ProgressHub</div>
            <div className="text-[10px] font-semibold tracking-wider text-[#73827a] uppercase">
              {user.role} workspace
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mb-2 px-2 text-[10px] font-bold tracking-wider text-[#8b9891] uppercase">
          Menu
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href || (item.href !== '/dashboard' && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link text-xs ${active ? 'active' : ''}`}
              >
                <Icon size={16} strokeWidth={1.9} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="mt-auto border-t border-[#dfede2] pt-4">
          <div className="flex items-center justify-between rounded-xl bg-[#e5ece5]/60 p-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d7e6da] text-xs font-bold text-[#2d5c49]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-[#253932]">{user.fullName}</div>
                <div className="text-[10px] text-[#718079] capitalize">{user.role}</div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-[#708077] hover:bg-[#d8e2d8] hover:text-[#21352e]"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 md:ml-[240px]">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-[#e5e9e2] bg-[#fafaf7]/95 px-5 backdrop-blur-md md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-1.5 text-[#51635a] md:hidden hover:bg-[#edf0ea]"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle Navigation"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="hidden text-xs text-[#7d8c84] sm:block">
              Training Platform <span className="mx-1.5 text-[#b0bbb4]">/</span>
              <span className="font-semibold text-[#30443c] capitalize">
                {location.split('/').filter(Boolean).pop()?.replace('-', ' ') || 'Overview'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                className="relative rounded-lg p-2 text-[#5a6b63] hover:bg-[#edf0eb]"
                onClick={() => setNotifsOpen(!notifsOpen)}
                aria-label="Notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#bd483b] text-[9px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifsOpen && (
                <div className="panel absolute right-0 mt-2 w-80 p-3 shadow-xl z-50">
                  <div className="mb-2 flex items-center justify-between border-b border-[#edf0ea] pb-2">
                    <span className="text-xs font-bold text-[#2d4038]">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        className="text-[11px] font-semibold text-[#376954] hover:underline"
                        onClick={() => markAllMutation.mutate()}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#828f87]">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-lg p-2 text-xs transition ${n.is_read ? 'text-[#74827a]' : 'bg-[#edf4ee] font-medium text-[#20342d]'}`}
                        >
                          <div className="font-semibold">{n.title}</div>
                          <div className="text-[11px] text-[#6b7b73]">{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className="hidden items-center gap-1.5 rounded-full border border-[#d9e2d7] bg-white px-3 py-1 text-[11px] font-semibold text-[#546b5e] sm:flex">
              <span className="h-2 w-2 rounded-full bg-[#4ba373]" />
              {user.status === 'active' ? 'Active' : user.status}
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="border-b border-[#e5e9e2] bg-[#f2f4ee] p-3 md:hidden">
            <nav className="grid grid-cols-2 gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`nav-link text-xs ${active ? 'active' : ''}`}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {/* Page Content View */}
        <main className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-8">
          <div className="enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
