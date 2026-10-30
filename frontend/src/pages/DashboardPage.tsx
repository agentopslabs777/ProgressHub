import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Users, GraduationCap, BookOpen, ClipboardList, Activity,
  CheckCircle2, Clock, ArrowRight, BarChart3, AlertCircle, Plus, Sparkles,
  Award, Wallet, ShoppingBag
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { User, dashboardApi } from '@/services/api';
import { PageTitle, LoadingState, ErrorState, EmptyState } from '@/components/common/UIComponents';

export function DashboardPage({ user }: { user: User }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', user.role],
    queryFn: dashboardApi.getStats
  });

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
            <div className="flex gap-2">
              <Link href="/programs" className="btn btn-primary text-xs">
                <Plus size={14} /> New Program
              </Link>
              <Link href="/students" className="btn btn-soft text-xs">
                <Plus size={14} /> Add Student
              </Link>
            </div>
          ) : !isAdmin && !isEmployee ? (
            <Link href="/my-programs" className="btn btn-primary text-xs">
              Continue Learning <ArrowRight size={14} />
            </Link>
          ) : null
        }
      />

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
            <h3 className="display text-base font-bold text-[#23362f]">Teacher Actions & Quick Overview</h3>
            <p className="mt-1 text-xs text-[#718079]">
              Review student task submissions directly within daily learning programs and evaluate performance.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
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
    </div>
  );
}

export default DashboardPage;
