import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Users, GraduationCap, BookOpen, ClipboardList, Activity,
  CheckCircle2, Clock, ArrowRight, BarChart3, AlertCircle, Plus, Sparkles,
  Award, Wallet, ShoppingBag, HelpCircle, ExternalLink, Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { User, dashboardApi } from '@/services/api';
import { PageTitle, LoadingState, ErrorState, EmptyState, Modal } from '@/components/common/UIComponents';

export function DashboardPage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpUrlInput, setHelpUrlInput] = useState('');
  const [helpError, setHelpError] = useState('');
  const [helpSuccess, setHelpSuccess] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', user.role],
    queryFn: dashboardApi.getStats
  });

  const { data: helpData } = useQuery({
    queryKey: ['help_link'],
    queryFn: dashboardApi.getHelpLink,
    staleTime: 30000
  });

  const activeHelpUrl = helpData?.help_url ?? data?.help_url ?? null;

  useEffect(() => {
    if (activeHelpUrl) {
      setHelpUrlInput(activeHelpUrl);
    }
  }, [activeHelpUrl]);

  const saveHelpMutation = useMutation({
    mutationFn: (url: string) => dashboardApi.updateHelpLink(url),
    onSuccess: () => {
      setHelpSuccess('Help link saved successfully!');
      setHelpError('');
      queryClient.invalidateQueries({ queryKey: ['help_link'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTimeout(() => {
        setHelpSuccess('');
        setHelpModalOpen(false);
      }, 1200);
    },
    onError: (err: any) => {
      setHelpError(err?.message || 'Failed to save help link');
    }
  });

  const deleteHelpMutation = useMutation({
    mutationFn: () => dashboardApi.deleteHelpLink(),
    onSuccess: () => {
      setHelpSuccess('Help link removed successfully.');
      setHelpError('');
      setHelpUrlInput('');
      queryClient.invalidateQueries({ queryKey: ['help_link'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTimeout(() => {
        setHelpSuccess('');
        setHelpModalOpen(false);
      }, 1200);
    },
    onError: (err: any) => {
      setHelpError(err?.message || 'Failed to remove help link');
    }
  });

  const handleOpenHelp = () => {
    const link = activeHelpUrl;
    if (link && link.trim()) {
      let href = link.trim();
      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        href = `https://${href}`;
      }
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      alert('Help & Support link has not been configured by the administrator yet.');
    }
  };

  if (isLoading) return <LoadingState label="Loading overview metrics" />;
  if (isError || !data) return <ErrorState retry={() => refetch()} />;

  const isAdmin = user.role === 'admin';
  const isEmployee = user.role === 'employee';

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Workspace Overview"
        title={
          isAdmin
            ? 'Platform Operations & Metrics'
            : isEmployee
            ? 'Teacher Guidance & Reviews'
            : 'Your Learning Journey'
        }
        description={
          isAdmin
            ? 'Real-time overview of training programs, enrollments, reward wallet transactions, and curriculum progression.'
            : isEmployee
            ? 'Track assigned student progress, evaluate daily submissions, and guide curriculum milestones.'
            : 'Continue your sequential learning progression day by day and earn reward points.'
        }
        action={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setHelpUrlInput(activeHelpUrl || '');
                  setHelpError('');
                  setHelpSuccess('');
                  setHelpModalOpen(true);
                }}
                className="btn btn-soft text-xs flex items-center gap-1.5 font-bold"
                title="Configure Help & Support link for students and employees"
              >
                <HelpCircle size={14} className="text-[#2b6d53]" /> Help Link
              </button>
              <Link href="/programs" className="btn btn-primary text-xs">
                <Plus size={14} /> New Program
              </Link>
              <Link href="/students" className="btn btn-soft text-xs">
                <Plus size={14} /> Add Student
              </Link>
            </div>
          ) : isEmployee ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOpenHelp}
                className="btn btn-primary text-xs flex items-center gap-1.5 font-bold shadow-xs"
                title="Open Help & Support"
              >
                <HelpCircle size={14} /> Help
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleOpenHelp}
                className="btn btn-soft text-xs flex items-center gap-1.5 font-bold"
                title="Open Help & Support"
              >
                <HelpCircle size={14} /> Help
              </button>
              <Link href="/my-programs" className="btn btn-primary text-xs">
                Continue Learning <ArrowRight size={14} />
              </Link>
            </div>
          )
        }
      />

      {/* Student Course Access Validity Alert Banner (Displays only if not lifetime) */}
      {!isAdmin && !isEmployee && data.access_duration && data.access_duration !== 'lifetime' && data.days_left !== undefined && data.days_left !== null && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
          data.days_left <= 5
            ? 'bg-[#fef7f5] border-[#f8c9c0] text-[#7f261e]'
            : 'bg-[#f1f8f4] border-[#b8dfcb] text-[#1c4d3b]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              data.days_left <= 5 ? 'bg-[#fae0db] text-[#b43224]' : 'bg-[#d8eedf] text-[#22674b]'
            }`}>
              <Clock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#1b2b24]">
                  Course Access Validity:
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                  data.days_left <= 5 ? 'bg-[#fbd3ca] text-[#93271d]' : 'bg-[#c3e8d4] text-[#1a513b]'
                }`}>
                  {data.days_left} {data.days_left === 1 ? 'day' : 'days'} left
                </span>
              </div>
              <p className="text-xs text-[#556961] mt-0.5">
                Plan: <span className="font-semibold text-[#253931]">
                  {data.access_duration === '1_month'
                    ? '1 Month (30 Days)'
                    : data.access_duration === '6_months'
                    ? '6 Months (180 Days)'
                    : data.access_duration === '1_year'
                    ? '1 Year (365 Days)'
                    : data.access_duration}
                </span>
                {data.access_expires_at && (
                  <span> · Expires on {new Date(data.access_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
              </p>
            </div>
          </div>
          {data.days_left <= 7 ? (
            <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#fae0db] text-[#93271d] w-fit">
              Expiring soon — contact administrator to extend access
            </div>
          ) : (
            <div className="text-xs font-medium text-[#4c665a] hidden sm:block">
              Auto-blocks when duration finishes
            </div>
          )}
        </div>
      )}

      {/* Top 4 Metrics Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {isAdmin ? (
          <>
            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Active Students</span>
                <GraduationCap size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.activeStudents}</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">{data.students} registered in total</div>
            </div>

            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Active Employees</span>
                <Users size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.activeEmployees}</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">{data.employees} instructors in total</div>
            </div>

            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Programs</span>
                <BookOpen size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.programs}</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">{data.enrollments} active enrollments</div>
            </div>

            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Average Progress</span>
                <BarChart3 size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.averageProgress}%</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">{data.pendingSubmissions} pending evaluations</div>
            </div>
          </>
        ) : isEmployee ? (
          <>
            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Assigned Students</span>
                <GraduationCap size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.assignedStudents}</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">Direct student guidance</div>
            </div>

            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Submissions to Review</span>
                <ClipboardList size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.pendingSubmissions}</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">Awaiting scoring & bonus points</div>
            </div>

            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Assigned Programs</span>
                <BookOpen size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.assignedPrograms}</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">Active curriculum tracks</div>
            </div>

            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Student Progress</span>
                <BarChart3 size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.averageProgress}%</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">Curriculum completion average</div>
            </div>
          </>
        ) : (
          <>
            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Enrolled Programs</span>
                <BookOpen size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.assignedPrograms}</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">Active courses</div>
            </div>

            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Completed Days</span>
                <CheckCircle2 size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.completedDays}</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">Milestones achieved</div>
            </div>

            <div className="panel p-4.5 bg-white">
              <div className="flex items-center justify-between text-[#73837b]">
                <span className="text-xs font-semibold">Overall Progress</span>
                <BarChart3 size={17} className="text-[#3c705c]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-[#243730]">{data.averageProgress}%</div>
              <div className="mt-1 text-[11px] text-[#7d8d85]">Calculated from real tasks</div>
            </div>

            {/* Centralized Reward Points Wallet Widget */}
            <div className="panel p-4.5 bg-gradient-to-br from-[#1d4f3b] to-[#2b6d53] text-white">
              <div className="flex items-center justify-between text-[#a5d8c1]">
                <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <Wallet size={14} /> Reward Wallet
                </span>
                <Award size={16} className="text-[#facc15]" />
              </div>
              <div className="display mt-3 text-2xl font-extrabold text-white">
                {Math.round(data.walletBalance ?? 0)} <span className="text-xs font-bold text-[#bce7d2]">pts</span>
              </div>
              <div className="mt-1 text-[11px] text-[#d4f2e3] flex items-center justify-between">
                <span>≈ ₹{data.walletValueInr ?? 0} INR value</span>
                <Link href="/wallet" className="underline font-bold text-white hover:text-[#d4f2e3]">
                  View Wallet →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className="space-y-6">
        {isAdmin ? (
          <div className="panel p-5 bg-white">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="display text-base font-bold text-[#23362f]">Program Enrollments</h3>
                <p className="text-xs text-[#718079]">Distribution of active learners across programs</p>
              </div>
            </div>
            {data.enrollmentChart && data.enrollmentChart.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.enrollmentChart}>
                    <XAxis dataKey="name" stroke="#889890" fontSize={11} tickLine={false} />
                    <YAxis stroke="#889890" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="students" fill="#326c57" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="No programs or enrollments yet"
                description="Create your first program in the Programs portal and enroll students to see real analytics here."
              />
            )}
          </div>
        ) : isEmployee ? (
          <div className="panel p-5 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="display text-base font-bold text-[#23362f]">Teacher Actions & Quick Overview</h3>
                <p className="mt-1 text-xs text-[#718079]">
                  Review student task submissions directly within daily learning programs and evaluate performance.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenHelp}
                className="btn btn-soft text-xs flex items-center gap-1.5 font-bold"
                title="Open Help & Support page"
              >
                <HelpCircle size={14} className="text-[#285d47]" /> Help
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/student-reviews" className="panel p-4 bg-[#f8faf8] hover:bg-[#f2f7f3] transition group block">
                <div className="text-xs font-bold text-[#284f3e] flex items-center justify-between">
                  <span>Student Reviews & Progress</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-[#23352e]">{data.pendingSubmissions}</div>
                <div className="mt-1 text-[11px] text-[#6d7e75]">Pending student submissions</div>
              </Link>
              <Link href="/my-students" className="panel p-4 bg-[#f8faf8] hover:bg-[#f2f7f3] transition group block">
                <div className="text-xs font-bold text-[#284f3e] flex items-center justify-between">
                  <span>My Students</span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-[#23352e]">{data.assignedStudents}</div>
                <div className="mt-1 text-[11px] text-[#6d7e75]">Assigned learner profiles</div>
              </Link>
              <button
                type="button"
                onClick={handleOpenHelp}
                className="panel p-4 bg-[#f8faf8] hover:bg-[#f2f7f3] transition group block text-left w-full cursor-pointer"
              >
                <div className="text-xs font-bold text-[#284f3e] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle size={14} /> Help & Support
                  </span>
                  <ExternalLink size={14} className="group-hover:translate-x-0.5 transition" />
                </div>
                <div className="mt-2 text-sm font-extrabold text-[#23352e]">Resource Center</div>
                <div className="mt-1 text-[11px] text-[#6d7e75]">Redirect to official support page</div>
              </button>
            </div>
          </div>
        ) : (
          <div className="panel p-5 bg-white space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="display text-base font-bold text-[#23362f]">Sequential Progress Engine</h3>
                <p className="mt-1 text-xs text-[#718079]">
                  Each daily session contains 5 comprehensive sections: Summary, Learning Videos, Learning Resources, Tasks & Checklist, and Section 5 Assignment Submission.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleOpenHelp}
                  className="btn btn-soft text-xs flex items-center gap-1.5 font-bold"
                  title="Open Help & Support page"
                >
                  <HelpCircle size={14} className="text-[#285d47]" /> Help & Support
                </button>
                <Link href="/my-programs" className="btn btn-primary text-xs">
                  Open Learning Tracks <ArrowRight size={14} />
                </Link>
                <Link href="/explore-programs" className="btn btn-soft text-xs">
                  <ShoppingBag size={14} /> Explore Programs
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADMIN HELP LINK CONFIGURATION MODAL */}
      {helpModalOpen && isAdmin && (
        <Modal
          title="Help & Support Link Configuration"
          onClose={() => setHelpModalOpen(false)}
          maxWidth="max-w-md"
        >
          {helpError && (
            <div className="mb-3 rounded-lg bg-[#faecea] p-2.5 text-xs font-medium text-[#b8483d] border border-[#f5c4be]">
              {helpError}
            </div>
          )}
          {helpSuccess && (
            <div className="mb-3 rounded-lg bg-[#eaf6ee] p-2.5 text-xs font-medium text-[#216e43] border border-[#b8dfc5]">
              {helpSuccess}
            </div>
          )}

          <div className="space-y-4 text-xs">
            <p className="text-[#52645c] leading-relaxed">
              Configure the website or documentation link for the <strong>Help</strong> button on Student and Employee dashboards. Clicking Help will redirect them to this URL.
            </p>

            {activeHelpUrl ? (
              <div className="p-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#15803d]">
                  Currently Active Link
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-[#14532d] truncate">
                    {activeHelpUrl}
                  </span>
                  <a
                    href={activeHelpUrl.startsWith('http') ? activeHelpUrl : `https://${activeHelpUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-[11px] py-1 px-2 flex items-center gap-1 shrink-0 font-bold"
                  >
                    <span>Test</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#fafafa] border border-[#e5e7eb] text-[#6b7280]">
                No Help link is currently configured.
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setHelpError('');
                if (!helpUrlInput.trim()) {
                  setHelpError('Please enter a valid website URL or delete the existing link.');
                  return;
                }
                saveHelpMutation.mutate(helpUrlInput.trim());
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="mb-1 block font-semibold text-[#374940]">
                  Website URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://example.com/help or https://wa.me/..."
                  value={helpUrlInput}
                  onChange={(e) => setHelpUrlInput(e.target.value)}
                  className="field text-xs w-full"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#edf0ea]">
                {activeHelpUrl ? (
                  <button
                    type="button"
                    disabled={deleteHelpMutation.isPending || saveHelpMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete the Help link? Employees and students will no longer be redirected.')) {
                        deleteHelpMutation.mutate();
                      }
                    }}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> Delete Link
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-soft text-xs"
                    onClick={() => setHelpModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveHelpMutation.isPending || deleteHelpMutation.isPending}
                    className="btn btn-primary text-xs"
                  >
                    {saveHelpMutation.isPending ? 'Saving…' : activeHelpUrl ? 'Update Link' : 'Submit Link'}
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

export default DashboardPage;
