import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Filter, ShieldAlert, CheckCircle, Edit, Eye, UserX, UserCheck,
  ClipboardCheck, CheckCircle2, Clock, BookOpen, Link2, Copy, Check,
  ExternalLink, UserPlus, CreditCard, Award, GraduationCap, FileText,
  AlertCircle, X, CheckSquare, Sparkles, Send, RotateCw, Trash2
} from 'lucide-react';
import { studentsApi, programsApi, employeesApi } from '@/services/api';
import {
  PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState,
  Modal, ConfirmModal
} from '@/components/common/UIComponents';

export function StudentsPage() {
  const queryClient = useQueryClient();

  // Top Tabs: 'enrolled' | 'applications'
  const [activeTab, setActiveTab] = useState<'enrolled' | 'applications'>('enrolled');

  // Enrolled Students filter/search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Applications filter/search
  const [appSearch, setAppSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');

  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [confirmBlock, setConfirmBlock] = useState<{ id: string; name: string; action: 'block' | 'unblock' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  // Registration Form Link Modal
  const [formLinkOpen, setFormLinkOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Approval Modal state
  const [approveModalApp, setApproveModalApp] = useState<any>(null);
  const [approveProgramId, setApproveProgramId] = useState('');
  const [approveEmployeeId, setApproveEmployeeId] = useState('');
  const [approveAccessDuration, setApproveAccessDuration] = useState('1_month');
  const [approveError, setApproveError] = useState('');
  const [approvalToast, setApprovalToast] = useState('');

  // Reject Modal state
  const [rejectModalApp, setRejectModalApp] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Student Report Modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStudentId, setReportStudentId] = useState('');

  const { data: studentReport, isLoading: isReportLoading } = useQuery({
    queryKey: ['student_report', reportStudentId],
    queryFn: () => studentsApi.get(reportStudentId),
    enabled: !!reportStudentId && reportOpen
  });

  // Form states for manual create
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [accessDuration, setAccessDuration] = useState('1_month');
  const [editStatus, setEditStatus] = useState('active');
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState('');

  // Pagination state for Enrolled Students
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Enrolled Students Query
  const { data: students = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['students', search, statusFilter],
    queryFn: () => studentsApi.list(search || undefined, statusFilter || undefined)
  });

  // Student Applications Query (Auto-refetches every 3 seconds for instant updates)
  const { data: applications = [], isLoading: appsLoading, isError: appsError, refetch: refetchApps } = useQuery({
    queryKey: ['student_applications', appStatusFilter],
    queryFn: () => studentsApi.getApplications(appStatusFilter || undefined),
    refetchInterval: 3000,
    refetchOnWindowFocus: true
  });

  // Programs Query (for approval assignment & dropdowns)
  const { data: programs = [] } = useQuery({
    queryKey: ['all_programs'],
    queryFn: programsApi.list
  });

  // Employees Query (for Faculty assignment dropdown)
  const { data: employees = [] } = useQuery({
    queryKey: ['all_employees'],
    queryFn: () => employeesApi.list()
  });

  const totalStudents = students.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const paginatedStudents = students.slice((page - 1) * pageSize, page * pageSize);

  const pendingCount = applications.filter((a: any) => a.status === 'pending').length;

  const createMutation = useMutation({
    mutationFn: studentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create student')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => studentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setEditOpen(false);
      setSelectedStudent(null);
    },
    onError: (err: any) => setFormError(err.message || 'Failed to update student')
  });

  const blockMutation = useMutation({
    mutationFn: (id: string) => studentsApi.block(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirmBlock(null);
    }
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => studentsApi.unblock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirmBlock(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reviews_spreadsheet'] });
      setConfirmDelete(null);
    }
  });

  const approveMutation = useMutation({
    mutationFn: ({ appId, programId, employeeId, accessDuration }: { appId: string; programId?: string; employeeId?: string; accessDuration?: string }) =>
      studentsApi.approveApplication(appId, { program_id: programId, employee_id: employeeId, access_duration: accessDuration }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['student_applications'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['reviews_spreadsheet'] });
      setApproveModalApp(null);
      setApprovalToast(res.message || 'Application approved successfully!');
      setTimeout(() => setApprovalToast(''), 6000);
    },
    onError: (err: any) => {
      setApproveError(err.message || 'Failed to approve application.');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ appId, reason }: { appId: string; reason?: string }) =>
      studentsApi.rejectApplication(appId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_applications'] });
      setRejectModalApp(null);
      setRejectionReason('');
    }
  });

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setIdentifier('');
    setContactNumber('');
    setAccessDuration('1_month');
    setFormError('');
  };

  const handleOpenEdit = (st: any) => {
    setSelectedStudent(st);
    setFullName(st.fullName || st.full_name);
    setEmail(st.email);
    setIdentifier(st.identifier || '');
    setContactNumber(st.contact_number || '');
    setEditStatus(st.status || 'active');
    setAccessDuration(st.access_duration || st.accessDuration || 'lifetime');
    setNewPassword('');
    setFormError('');
    setEditOpen(true);
  };

  const registrationFormUrl = `${window.location.origin}/register`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationFormUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleOpenApproveModal = (app: any) => {
    setApproveModalApp(app);
    setApproveProgramId(app.program_id || (programs[0]?.id || ''));
    setApproveEmployeeId('');
    setApproveAccessDuration('1_month');
    setApproveError('');
  };

  const filteredApplications = applications.filter((app: any) => {
    if (!appSearch.trim()) return true;
    const q = appSearch.toLowerCase();
    return (
      app.full_name?.toLowerCase().includes(q) ||
      app.email?.toLowerCase().includes(q) ||
      app.payment_id?.toLowerCase().includes(q) ||
      app.contact_number?.toLowerCase().includes(q) ||
      app.program_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageTitle
        eyebrow="People Management"
        title="Students"
        description="Manage enrolled students, public admission forms, and automated course approvals."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFormLinkOpen(true)}
              className="btn btn-soft text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold border-[#b4d2c0] text-[#1c553d] bg-[#f0f8f3] hover:bg-[#e4f3ea] shadow-2xs"
              title="Copy public registration link to share with students"
            >
              <Link2 size={14} className="text-[#255e46]" />
              <span>Copy Form Link</span>
            </button>
            <button
              className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 font-bold shadow-xs"
              onClick={() => { resetForm(); setCreateOpen(true); }}
            >
              <Plus size={14} /> Add Student
            </button>
          </div>
        }
      />

      {/* Success Banner if Approval was completed */}
      {approvalToast && (
        <div className="mb-4 p-4 rounded-2xl bg-[#e2f5ea] border border-[#a2dfbc] text-xs font-bold text-[#14532d] flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-[#16a34a] shrink-0" />
            <span>{approvalToast}</span>
          </div>
          <button
            onClick={() => setApprovalToast('')}
            className="text-[#14532d] hover:opacity-70 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modern Session Switcher Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-[#e2e8e2] pb-2">
        <button
          onClick={() => setActiveTab('enrolled')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'enrolled'
              ? 'bg-[#255e46] text-white shadow-xs'
              : 'text-[#5a6d63] hover:text-[#21352d] hover:bg-[#edf3ef]'
          }`}
        >
          <GraduationCap size={16} />
          <span>Enrolled Students</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'enrolled' ? 'bg-white/20 text-white' : 'bg-[#e2ebe4] text-[#344d41]'
            }`}
          >
            {students.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('applications');
            refetchApps();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'applications'
              ? 'bg-[#255e46] text-white shadow-xs'
              : 'text-[#5a6d63] hover:text-[#21352d] hover:bg-[#edf3ef]'
          }`}
        >
          <FileText size={16} />
          <span>Student Submitted Forms</span>
          {pendingCount > 0 ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ef4444] text-white font-extrabold animate-pulse">
              {pendingCount} Pending
            </span>
          ) : (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'applications' ? 'bg-white/20 text-white' : 'bg-[#e2ebe4] text-[#344d41]'
              }`}
            >
              {applications.length}
            </span>
          )}
        </button>
      </div>

      {/* SESSION 1: ENROLLED STUDENTS */}
      {activeTab === 'enrolled' && (
        <div className="panel overflow-hidden bg-white border border-[#e4ebe4]">
          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 border-b border-[#edf0ea] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b9991]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, identifier…"
                className="field pl-9 text-xs py-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="field w-auto py-2 text-xs"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Content Table */}
          {isLoading ? (
            <LoadingState label="Loading students" />
          ) : isError ? (
            <div className="p-4"><ErrorState retry={() => refetch()} /></div>
          ) : students.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={search ? 'No matching students found' : 'No students added yet'}
                detail={search ? 'Try adjusting your search criteria.' : 'Create your first student account to begin tracking progress.'}
                action={
                  !search && (
                    <button className="btn btn-primary text-xs" onClick={() => { resetForm(); setCreateOpen(true); }}>
                      <Plus size={14} /> Add First Student
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead className="bg-[#fafbf9] text-[10px] font-bold uppercase tracking-wider text-[#798981] border-b border-[#edf0ea]">
                    <tr>
                      <th className="px-5 py-3.5 min-w-[200px]">Student</th>
                      <th className="px-5 py-3.5 min-w-[120px]">Identifier</th>
                      <th className="px-5 py-3.5 min-w-[120px]">Enrollments</th>
                      <th className="px-5 py-3.5 min-w-[140px]">Progress</th>
                      <th className="px-5 py-3.5 min-w-[140px]">Access Validity</th>
                      <th className="px-5 py-3.5 min-w-[100px]">Status</th>
                      <th className="px-5 py-3.5 min-w-[100px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0ea]">
                    {paginatedStudents.map((st: any) => {
                      const dur = st.access_duration || st.accessDuration || 'lifetime';
                      const days = st.days_left !== undefined && st.days_left !== null ? st.days_left : st.daysLeft;
                      const expiresAt = st.access_expires_at || st.accessExpiresAt;
                      const isLifetime = dur === 'lifetime' || (!expiresAt && dur !== '1_month' && dur !== '6_months' && dur !== '1_year');
                      const isExpired = !isLifetime && (days === 0 || st.status === 'blocked');

                      return (
                      <tr key={st.id} className="hover:bg-[#fafbf9] transition">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-[#273831]">{st.fullName || st.full_name}</div>
                          <div className="text-[11px] text-[#718079]">{st.email}</div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-[#55665f]">
                          {st.identifier || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-[#40524a]">
                          {st.enrollmentCount} {st.enrollmentCount === 1 ? 'program' : 'programs'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-[#e5ece5] overflow-hidden">
                              <div className="h-full bg-[#3c765f] rounded-full" style={{ width: `${st.progress}%` }} />
                            </div>
                            <span className="text-[11px] font-bold text-[#3a5246]">{st.progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {isLifetime ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eef3f0] text-[#345c4b]">
                              Lifetime Access
                            </span>
                          ) : isExpired ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fcedeb] text-[#a43b2e] w-fit">
                                <Clock size={11} /> Expired (0 days)
                              </span>
                              {expiresAt && (
                                <span className="text-[10px] text-[#82928a] mt-0.5">
                                  Ended {new Date(expiresAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold w-fit ${
                                days !== undefined && days <= 7
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-[#eaf5ef] text-[#246146]'
                              }`}>
                                <Clock size={11} /> {days} {days === 1 ? 'day' : 'days'} left
                              </span>
                              {expiresAt && (
                                <span className="text-[10px] text-[#82928a] mt-0.5">
                                  Until {new Date(expiresAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={st.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1">
                          <button
                            onClick={() => { setReportStudentId(st.id); setReportOpen(true); }}
                            className="rounded-lg p-1.5 text-[#2b644e] hover:bg-[#ebf4ef]"
                            title="View Checklist & Progress Report"
                          >
                            <ClipboardCheck size={14} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(st)}
                            className="rounded-lg p-1.5 text-[#63746c] hover:bg-[#edf1eb]"
                            title="Edit Student"
                          >
                            <Edit size={14} />
                          </button>
                          {st.status === 'blocked' ? (
                            <button
                              onClick={() => setConfirmBlock({ id: st.id, name: st.fullName || st.full_name, action: 'unblock' })}
                              className="rounded-lg p-1.5 text-[#326d55] hover:bg-[#ebf4ef]"
                              title="Unblock Student"
                            >
                              <UserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmBlock({ id: st.id, name: st.fullName || st.full_name, action: 'block' })}
                              className="rounded-lg p-1.5 text-[#b04337] hover:bg-[#fcedeb]"
                              title="Block Student"
                            >
                              <UserX size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmDelete({ id: st.id, name: st.fullName || st.full_name })}
                            className="rounded-lg p-1.5 text-[#b04337] hover:bg-[#fcedeb]"
                            title="Delete Student"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-t border-[#edf0ea] px-5 py-3 text-xs text-[#718078] gap-3 bg-[#fafbf9]">
                <div>
                  Showing <span className="font-semibold text-[#22352e]">{totalStudents === 0 ? 0 : (page - 1) * pageSize + 1}</span> to <span className="font-semibold text-[#22352e]">{Math.min(page * pageSize, totalStudents)}</span> of <span className="font-semibold text-[#22352e]">{totalStudents}</span> students
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-soft py-1 px-3 text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-semibold px-2 text-[#31453d]">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-soft py-1 px-3 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SESSION 2: STUDENT SUBMITTED FORMS & ONE-CLICK APPROVAL AUTOMATION */}
      {activeTab === 'applications' && (
        <div className="panel overflow-hidden bg-white border border-[#e4ebe4] space-y-0">
          {/* Header & Quick Action */}
          <div className="p-4 bg-[#f8faf8] border-b border-[#edf1ee] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#1f352b] flex items-center gap-2">
                <FileText size={16} className="text-[#255f46]" />
                Student Admission Applications
              </h3>
              <p className="text-xs text-[#6a7d73]">
                Applicants submitted via public form. Approve to automatically create account, enroll in course, and assign faculty.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFormLinkOpen(true)}
                className="btn btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold"
              >
                <Link2 size={13} /> Copy Form Link
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-3 border-b border-[#edf0ea] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b9991]" />
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search applicant, payment ID, course…"
                className="field pl-9 text-xs py-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
                className="field w-auto py-2 text-xs font-semibold"
              >
                <option value="">All Applications ({applications.length})</option>
                <option value="pending">Pending Approval ({pendingCount})</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <button
                type="button"
                onClick={() => refetchApps()}
                className="btn btn-soft text-xs py-2 px-3 flex items-center gap-1.5 font-bold border-[#c8d9ce] hover:bg-[#edf4f0]"
                title="Refresh applications list"
              >
                <RotateCw size={13} className={appsLoading ? 'animate-spin text-[#255f46]' : 'text-[#526a5e]'} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Applications Table */}
          {appsLoading ? (
            <LoadingState label="Loading student applications" />
          ) : appsError ? (
            <div className="p-4"><ErrorState retry={() => refetchApps()} /></div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState
                title={appSearch ? 'No matching applications found' : 'No student applications submitted yet'}
                detail={appSearch ? 'Try adjusting your search criteria.' : 'Share your Student Admission Form link with prospective students to start receiving applications.'}
                icon={FileText}
                action={
                  <button
                    onClick={() => setFormLinkOpen(true)}
                    className="btn btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5"
                  >
                    <Link2 size={13} /> Copy Admission Form Link
                  </button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-[#fafbf9] text-[10px] font-bold uppercase tracking-wider text-[#798981] border-b border-[#edf0ea]">
                  <tr>
                    <th className="px-5 py-3.5 min-w-[200px]">Applicant Details</th>
                    <th className="px-5 py-3.5 min-w-[180px]">Email Address</th>
                    <th className="px-5 py-3.5 min-w-[160px]">Requested Course</th>
                    <th className="px-5 py-3.5 min-w-[150px]">Payment ID / Ref</th>
                    <th className="px-5 py-3.5 min-w-[130px]">Submitted Date</th>
                    <th className="px-5 py-3.5 min-w-[110px]">Status</th>
                    <th className="px-5 py-3.5 min-w-[160px] text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ea]">
                  {filteredApplications.map((app: any) => (
                    <tr key={app.id} className="hover:bg-[#fafbf9] transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#24362e]">{app.full_name}</div>
                        {app.contact_number && (
                          <div className="text-[11px] text-[#6d7e75] flex items-center gap-1 mt-0.5">
                            <span>📞</span> {app.contact_number}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-medium text-[#3b4e45]">
                        {app.email}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-bold text-[#245842] bg-[#eef7f2] px-2.5 py-1 rounded-lg border border-[#cbe3d4] inline-block">
                          {app.program_name}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 font-mono">
                        {app.payment_id ? (
                          <span className="bg-[#f2f4f2] text-[#1c2e26] font-bold px-2 py-0.5 rounded border border-[#dce3dc] text-[11px]">
                            {app.payment_id}
                          </span>
                        ) : (
                          <span className="text-[#8e9f96] italic">None provided</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-[#63756c]">
                        {app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
                        <div className="text-[10px] text-[#86978e]">
                          {app.created_at ? new Date(app.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block ${
                            app.status === 'approved'
                              ? 'bg-[#e2f5ea] text-[#166534] border border-[#a7e5bf]'
                              : app.status === 'rejected'
                              ? 'bg-[#faecea] text-[#b8483d] border border-[#f5c4be]'
                              : 'bg-[#fff5e5] text-[#8e601c] border border-[#f5dfbc]'
                          }`}
                        >
                          {app.status === 'pending' ? 'Pending Approval' : app.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right space-x-2">
                        {app.status === 'pending' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenApproveModal(app)}
                              className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1 font-bold shadow-xs bg-[#16a34a] hover:bg-[#15803d]"
                              title="One-click create user account, enroll in course, and assign teacher"
                            >
                              <CheckCircle2 size={13} />
                              <span>Approve & Enroll</span>
                            </button>
                            <button
                              onClick={() => setRejectModalApp(app)}
                              className="btn btn-outline text-xs py-1.5 px-2.5 text-[#b8483d] border-[#f5c4be] hover:bg-[#faecea]"
                              title="Reject application"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : app.status === 'approved' ? (
                          <span className="text-xs font-bold text-[#166534] inline-flex items-center gap-1">
                            <CheckCircle2 size={13} /> Enrolled
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-[#8b9991]">
                            Declined
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: SHARE PUBLIC ADMISSION FORM LINK */}
      {formLinkOpen && (
        <Modal title="Student Admission & Registration Link" onClose={() => setFormLinkOpen(false)}>
          <div className="space-y-4">
            <div className="p-4 bg-[#f4faf6] rounded-2xl border border-[#bce4cc] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#194b34]">
                <Sparkles size={16} className="text-[#16a34a]" />
                <span>Automated Self-Registration Workflow</span>
              </div>
              <p className="text-xs text-[#2b5943] leading-relaxed">
                Copy and share this public link with new prospective students. They can enter their Name, Contact Number, Email, Password, and Payment Reference ID.
              </p>
              <p className="text-xs text-[#2b5943] leading-relaxed">
                Their details will automatically appear in your <strong>"Student Submitted Forms"</strong> tab, where you can approve, enroll, and assign their supporting teacher in <strong>1 click</strong> without manual data entry!
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#23382e] mb-1">
                Public Admission Form Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={registrationFormUrl}
                  className="field text-xs py-2 flex-1 font-mono bg-[#fbfdfb]"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`btn text-xs py-2 px-4 flex items-center gap-1.5 font-bold transition shadow-xs ${
                    copiedLink ? 'bg-[#16a34a] text-white' : 'btn-primary'
                  }`}
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#edf1ee]">
              <a
                href={registrationFormUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#255f46] hover:underline flex items-center gap-1"
              >
                <span>Test Form in New Tab</span>
                <ExternalLink size={12} />
              </a>

              <button
                type="button"
                onClick={() => setFormLinkOpen(false)}
                className="btn btn-soft text-xs py-2 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: ONE-CLICK APPROVE & ENROLL AUTOMATION */}
      {approveModalApp && (
        <Modal
          title={`Approve & Enroll: ${approveModalApp.full_name}`}
          onClose={() => setApproveModalApp(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setApproveError('');
              approveMutation.mutate({
                appId: approveModalApp.id,
                programId: approveProgramId,
                employeeId: approveEmployeeId,
                accessDuration: approveAccessDuration
              });
            }}
            className="space-y-4"
          >
            {approveError && (
              <div className="p-3 bg-[#faecea] border border-[#f5c4be] rounded-xl text-xs font-semibold text-[#b8483d]">
                {approveError}
              </div>
            )}

            {/* Applicant Summary Card */}
            <div className="p-4 bg-[#f7faf8] rounded-2xl border border-[#dbe6dc] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#687f73] block">
                Applicant Information
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#6d8276] block text-[11px]">Full Name:</span>
                  <strong className="text-[#1f3128]">{approveModalApp.full_name}</strong>
                </div>
                <div>
                  <span className="text-[#6d8276] block text-[11px]">Email Address:</span>
                  <strong className="text-[#1f3128]">{approveModalApp.email}</strong>
                </div>
                <div>
                  <span className="text-[#6d8276] block text-[11px]">Contact Number:</span>
                  <strong className="text-[#1f3128]">{approveModalApp.contact_number || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-[#6d8276] block text-[11px]">Payment Reference ID:</span>
                  <strong className="font-mono text-[#1a553a] bg-[#e3f4ea] px-2 py-0.5 rounded border border-[#b8e5cb]">
                    {approveModalApp.payment_id || 'Not specified'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Automation Selection 1: Course to Enroll */}
            <div>
              <label className="block text-xs font-bold text-[#23382e] mb-1">
                Course / Program to Enroll *
              </label>
              <select
                required
                value={approveProgramId}
                onChange={(e) => setApproveProgramId(e.target.value)}
                className="field text-xs py-2 w-full font-semibold"
              >
                <option value="">-- Choose Course to Enroll --</option>
                {programs.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#6d8276] mt-0.5 block">
                Student will be actively enrolled in this program immediately upon approval.
              </span>
            </div>

            {/* Automation Selection 2: Assign Faculty Teacher right here */}
            <div>
              <label className="block text-xs font-bold text-[#23382e] mb-1">
                Assign Faculty / Supporting Teacher (Optional)
              </label>
              <select
                value={approveEmployeeId}
                onChange={(e) => setApproveEmployeeId(e.target.value)}
                className="field text-xs py-2 w-full font-semibold"
              >
                <option value="">-- Leave Unassigned for Now --</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName || emp.full_name} ({emp.email}) — {emp.designation || 'Instructor'}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-[#6d8276] mt-0.5 block">
                Assigning a teacher links them to this student's enrollment with zero additional steps!
              </span>
            </div>

            {/* Automation Selection 3: Course Access Duration */}
            <div>
              <label className="block text-xs font-bold text-[#23382e] mb-1">
                Course Access Duration *
              </label>
              <select
                required
                value={approveAccessDuration}
                onChange={(e) => setApproveAccessDuration(e.target.value)}
                className="field text-xs py-2 w-full font-semibold bg-white"
              >
                <option value="1_month">1 Month (30 Days)</option>
                <option value="6_months">6 Months (180 Days)</option>
                <option value="1_year">1 Year (365 Days)</option>
                <option value="lifetime">Lifelong / Unlimited</option>
              </select>
              <span className="text-[10px] text-[#6d8276] mt-0.5 block">
                Access automatically blocks when duration is completed. Admin can extend at any time.
              </span>
            </div>

            <div className="p-3 bg-[#eef7f2] rounded-xl border border-[#bce4cc] text-xs text-[#1c553b] space-y-1">
              <strong className="font-bold flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#16a34a]" />
                Zero-Navigation Automation:
              </strong>
              <p className="text-[11px]">
                Confirming approval will instantly: (1) create the student login account with selected access duration, (2) activate course enrollment, (3) assign the selected faculty, and (4) mark the application as approved.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#edf1ee]">
              <button
                type="button"
                onClick={() => setApproveModalApp(null)}
                className="btn btn-soft text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={approveMutation.isPending || !approveProgramId}
                className="btn btn-primary text-xs py-2 px-5 font-bold flex items-center gap-1.5 shadow-xs bg-[#16a34a] hover:bg-[#15803d]"
              >
                <CheckCircle2 size={14} />
                <span>{approveMutation.isPending ? 'Approving…' : 'Confirm Approval & Create Account'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: REJECT APPLICATION */}
      {rejectModalApp && (
        <Modal
          title={`Reject Application: ${rejectModalApp.full_name}`}
          onClose={() => setRejectModalApp(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-[#4b5d53]">
              Are you sure you want to decline the admission application for <strong>{rejectModalApp.full_name}</strong> ({rejectModalApp.email})?
            </p>

            <div>
              <label className="block text-xs font-bold text-[#23382e] mb-1">
                Reason for Rejection (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Invalid payment reference or duplicate submission"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="field text-xs py-2 w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#edf1ee]">
              <button
                type="button"
                onClick={() => setRejectModalApp(null)}
                className="btn btn-soft text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ appId: rejectModalApp.id, reason: rejectionReason })}
                className="btn btn-outline text-xs py-2 px-4 text-[#b8483d] border-[#f5c4be] hover:bg-[#faecea] font-bold"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Student Modal (Manual) */}
      {createOpen && (
        <Modal title="Add New Student" onClose={() => setCreateOpen(false)}>
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              createMutation.mutate({ fullName, email, password, identifier, contactNumber, access_duration: accessDuration });
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                className="field text-xs py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@organization.com"
                className="field text-xs py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="field text-xs py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Course Access Duration Restriction</label>
              <select
                value={accessDuration}
                onChange={(e) => setAccessDuration(e.target.value)}
                className="field text-xs py-2 bg-white"
              >
                <option value="1_month">1 Month (30 Days)</option>
                <option value="6_months">6 Months (180 Days)</option>
                <option value="1_year">1 Year (365 Days)</option>
                <option value="lifetime">Lifelong / Unlimited</option>
              </select>
              <p className="mt-1 text-[11px] text-[#788880]">
                Student account automatically blocks when duration is completed.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Student Identifier (Optional)</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="field text-xs py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Contact Number</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="field text-xs py-2"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={createMutation.isPending} className="btn btn-primary text-xs">
                {createMutation.isPending ? 'Creating…' : 'Create Student'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Student Modal */}
      {editOpen && selectedStudent && (
        <Modal title="Edit Student Profile" onClose={() => setEditOpen(false)}>
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              const payload: any = { 
                full_name: fullName, 
                email, 
                contact_number: contactNumber,
                status: editStatus,
                access_duration: accessDuration
              };
              if (newPassword.trim()) {
                payload.password = newPassword.trim();
              }
              updateMutation.mutate({
                id: selectedStudent.id,
                data: payload
              });
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between rounded-lg bg-[#f4f7f4] p-3 text-xs border border-[#e2e8e2]">
              <div>
                <span className="text-[#64756d]">Student Identifier:</span>{' '}
                <span className="font-mono font-bold text-[#23352e]">{selectedStudent.identifier || '—'}</span>
              </div>
              <StatusBadge status={editStatus} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="field text-xs py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field text-xs py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Course Access Duration / Extend Access</label>
              <select
                value={accessDuration}
                onChange={(e) => setAccessDuration(e.target.value)}
                className="field text-xs py-2 bg-white"
              >
                <option value="1_month">1 Month (30 Days from today)</option>
                <option value="6_months">6 Months (180 Days from today)</option>
                <option value="1_year">1 Year (365 Days from today)</option>
                <option value="lifetime">Lifelong / Unlimited</option>
              </select>
              {selectedStudent.access_expires_at && selectedStudent.access_duration !== 'lifetime' && (
                <p className="mt-1 text-[11px] text-[#60726a]">
                  Current Expiry: {new Date(selectedStudent.access_expires_at).toLocaleDateString()}
                  {selectedStudent.days_left !== undefined && selectedStudent.days_left !== null
                    ? ` (${selectedStudent.days_left} days left)`
                    : ''}
                </p>
              )}
              <p className="mt-1 text-[11px] text-[#29684c]">
                Updating or extending access automatically reactivates blocked or expired student accounts.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Contact Number</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="field text-xs py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="field text-xs py-2"
                >
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">
                Reset Password <span className="text-[11px] font-normal text-[#809088]">(leave blank to keep current)</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password…"
                className="field text-xs py-2"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={updateMutation.isPending} className="btn btn-primary text-xs">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Block / Unblock Modal */}
      {confirmBlock && (
        <ConfirmModal
          title={`${confirmBlock.action === 'block' ? 'Block' : 'Unblock'} Student Account`}
          detail={
            confirmBlock.action === 'block'
              ? `Are you sure you want to block ${confirmBlock.name}? The student will be prevented from logging in and accessing classes, while historical submissions and attendance records remain safely preserved.`
              : `Are you sure you want to unblock ${confirmBlock.name}? Their portal access will be restored immediately.`
          }
          destructive={confirmBlock.action === 'block'}
          confirmLabel={confirmBlock.action === 'block' ? 'Block Account' : 'Unblock Account'}
          pending={blockMutation.isPending || unblockMutation.isPending}
          onCancel={() => setConfirmBlock(null)}
          onConfirm={() => {
            if (confirmBlock.action === 'block') {
              blockMutation.mutate(confirmBlock.id);
            } else {
              unblockMutation.mutate(confirmBlock.id);
            }
          }}
        />
      )}

      {/* Confirm Delete Student Modal */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Student Account"
          detail={`Are you sure you want to permanently delete ${confirmDelete.name}? This will remove their student account, program enrollments, progress, and submissions. This action cannot be undone.`}
          destructive={true}
          confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete Student'}
          pending={deleteMutation.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
        />
      )}

      {/* Student Checklist & Progress Report Modal */}
      {reportOpen && (
        <Modal
          title={
            studentReport?.student
              ? `Learning Progress & Checklist Report · ${studentReport.student.fullName || studentReport.student.full_name}`
              : 'Student Learning Report'
          }
          onClose={() => { setReportOpen(false); setReportStudentId(''); }}
          maxWidth="max-w-2xl"
        >
          {isReportLoading ? (
            <LoadingState label="Loading student comprehensive report" />
          ) : !studentReport ? (
            <div className="p-4 text-center text-xs text-[#718279]">No data available.</div>
          ) : (
            <div className="space-y-5">
              {/* Profile Card */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#f4f7f4] p-4 border border-[#e1eae2]">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#285d4b] text-white font-bold text-sm">
                    {(studentReport.student.fullName || studentReport.student.full_name || 'S').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1f3128]">{studentReport.student.fullName || studentReport.student.full_name}</h3>
                    <div className="text-xs text-[#6e7e77]">{studentReport.student.email}</div>
                    <div className="text-[11px] font-mono text-[#546b5e] mt-0.5">ID: {studentReport.student.identifier || '—'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-[#6e7e77]">Overall Attendance</div>
                  <div className="text-xl font-black text-[#285d4b]">{studentReport.attendance_percentage}%</div>
                </div>
              </div>

              {/* Active Programs Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#798a82] mb-2">
                  Active Enrollments ({studentReport.enrollments?.length || 0})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {studentReport.enrollments?.map((enr: any) => (
                    <div key={enr.id} className="rounded-xl border border-[#e3ebe3] p-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-[#24352e]">{enr.program_name}</span>
                        <StatusBadge status={enr.status} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-[#62736b]">
                        <span>Curriculum Progress</span>
                        <span className="font-bold text-[#2a5b48]">{enr.progress_percent}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#e8eee8] mt-1 overflow-hidden">
                        <div className="h-full bg-[#2a5b48] rounded-full" style={{ width: `${enr.progress_percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist Items Completed Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#798a82] mb-2 flex items-center justify-between">
                  <span>Daily Curriculum Checklist Progression</span>
                  <span className="text-[11px] text-[#285d4b] font-bold">
                    {studentReport.checklist_completions?.length || 0} items ticked
                  </span>
                </h4>

                {studentReport.checklist_completions && studentReport.checklist_completions.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {studentReport.checklist_completions.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg bg-[#f9fbf9] p-2.5 text-xs border border-[#e3ede5]">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-[#1b6b44] shrink-0" />
                          <span className="font-medium text-[#263830]">{item.title}</span>
                        </div>
                        <span className="text-[10px] text-[#718279] shrink-0 font-medium">
                          {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'Completed'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#d8ded8] p-4 text-center text-xs text-[#809088]">
                    No checklist progression recorded yet. Checklist tick marks will appear here once the student starts completing daily classes.
                  </div>
                )}
              </div>

              {/* Task Submissions Section */}
              {studentReport.submissions && studentReport.submissions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#798a82] mb-2">
                    Submitted Assignments ({studentReport.submissions.length})
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {studentReport.submissions.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between rounded-lg bg-white p-2.5 text-xs border border-[#e4ebe4]">
                        <div>
                          <div className="font-semibold text-[#24352e]">{sub.task_title}</div>
                          <div className="text-[10px] text-[#788880]">
                            Submitted: {new Date(sub.submitted_at).toLocaleDateString()}
                          </div>
                        </div>
                        <StatusBadge status={sub.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default StudentsPage;
