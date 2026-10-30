import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, ShieldAlert, CheckCircle, Edit, Eye, UserX, UserCheck, ClipboardCheck, CheckCircle2, Clock, BookOpen } from 'lucide-react';
import { studentsApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState, Modal, ConfirmModal } from '@/components/common/UIComponents';

export function StudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [confirmBlock, setConfirmBlock] = useState<{ id: string; name: string; action: 'block' | 'unblock' } | null>(null);

  // Student Report Modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStudentId, setReportStudentId] = useState('');

  const { data: studentReport, isLoading: isReportLoading } = useQuery({
    queryKey: ['student_report', reportStudentId],
    queryFn: () => studentsApi.get(reportStudentId),
    enabled: !!reportStudentId && reportOpen
  });

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: students = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['students', search, statusFilter],
    queryFn: () => studentsApi.list(search || undefined, statusFilter || undefined)
  });

  const totalStudents = students.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const paginatedStudents = students.slice((page - 1) * pageSize, page * pageSize);

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

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setIdentifier('');
    setContactNumber('');
    setFormError('');
  };

  const handleOpenEdit = (st: any) => {
    setSelectedStudent(st);
    setFullName(st.fullName || st.full_name);
    setEmail(st.email);
    setIdentifier(st.identifier || '');
    setContactNumber(st.contact_number || '');
    setEditStatus(st.status || 'active');
    setNewPassword('');
    setFormError('');
    setEditOpen(true);
  };

  return (
    <div>
      <PageTitle
        eyebrow="People Management"
        title="Students"
        description="Manage enrolled students, program participation, and account access."
        action={
          <button className="btn btn-primary text-xs" onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus size={14} /> Add Student
          </button>
        }
      />

      <div className="panel overflow-hidden bg-white">
        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 border-b border-[#edf0ea] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b9991]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, identifier…"
              className="field pl-9 text-xs"
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
                    <th className="px-5 py-3.5 min-w-[110px]">Attendance</th>
                    <th className="px-5 py-3.5 min-w-[100px]">Status</th>
                    <th className="px-5 py-3.5 min-w-[100px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ea]">
                  {paginatedStudents.map((st: any) => (
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
                      <td className="px-5 py-3.5 font-medium text-[#485951]">
                        {st.attendance}%
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination & Scroll indicator */}
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

      {/* Create Student Modal */}
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
              createMutation.mutate({ fullName, email, password, identifier, contactNumber });
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
                className="field text-xs"
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
                className="field text-xs"
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
                className="field text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Student Identifier (Optional)</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="field text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Contact Number</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="field text-xs"
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
                status: editStatus
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
                className="field text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Contact Number</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="field text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="field text-xs"
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
                className="field text-xs"
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

      {/* Student Checklist & Progress Report Modal */}
      {reportOpen && (
        <Modal
          title={
            studentReport?.student
              ? `Learning Progress & Checklist Report · ${studentReport.student.fullName || studentReport.student.full_name}`
              : 'Student Learning Report'
          }
          onClose={() => { setReportOpen(false); setReportStudentId(''); }}
          maxWidth="max-w-3xl"
        >
          {isReportLoading ? (
            <LoadingState label="Loading student checklist report..." />
          ) : !studentReport ? (
            <div className="p-4 text-xs text-[#788880]">Failed to load student report.</div>
          ) : (
            <div className="space-y-5">
              {/* Profile Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f5f8f5] p-3.5 border border-[#e0e8e1]">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2b5d49] text-white font-bold text-xs">
                    {(studentReport.student.fullName || studentReport.student.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#24352e]">{studentReport.student.fullName || studentReport.student.full_name}</div>
                    <div className="text-[11px] text-[#6b7b73]">{studentReport.student.email} · ID: {studentReport.student.identifier || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={studentReport.student.status} />
                  <span className="rounded-lg bg-white border border-[#dce3dc] px-2.5 py-1 text-xs font-semibold text-[#30453c]">
                    Attendance: {studentReport.student.attendance || 0}%
                  </span>
                </div>
              </div>

              {/* Programs Enrollments Overview */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#798a82] mb-2">Program Enrollments</h4>
                {studentReport.enrollments && studentReport.enrollments.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {studentReport.enrollments.map((enr: any) => (
                      <div key={enr.id} className="rounded-xl border border-[#e5ebe5] bg-white p-3 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-[#23352e]">{enr.program_name}</span>
                          <span className="font-mono text-[10px] text-[#718178]">{enr.program_code}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-[#e8eee8] overflow-hidden">
                            <div className="h-full bg-[#326753] rounded-full" style={{ width: `${enr.progress}%` }} />
                          </div>
                          <span className="font-bold text-[11px] text-[#2c5b48]">{enr.progress}%</span>
                        </div>
                        <div className="mt-1 text-[10px] text-[#788880]">
                          Supporting Teacher: {enr.employee_name || 'Unassigned'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#d8ded8] p-4 text-center text-xs text-[#809088]">
                    Student is not currently enrolled in any training programs.
                  </div>
                )}
              </div>

              {/* Checklist Tracking Detailed Report */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#798a82]">
                    Daily Checklist Tracking Report
                  </h4>
                  <span className="text-[11px] text-[#6b7b73]">
                    Audit of completed checklist tick-marks & day milestones
                  </span>
                </div>

                {studentReport.checklist_report && studentReport.checklist_report.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {studentReport.checklist_report.map((dayRep: any) => (
                      <div key={dayRep.day_id} className="rounded-xl border border-[#e2e8e2] bg-[#fbfcfb] p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#22352e]">
                              Day {dayRep.day_number}: {dayRep.day_title}
                            </span>
                            <span className="text-[10px] text-[#6d7e76] bg-[#edf2ee] px-2 py-0.5 rounded">
                              {dayRep.track_name}
                            </span>
                          </div>
                          {dayRep.is_day_completed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#276449] bg-[#e3f4ea] px-2 py-0.5 rounded-full border border-[#bde2ce]">
                              <CheckCircle2 size={12} /> Day Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8b6b2b] bg-[#fcf5e3] px-2 py-0.5 rounded-full border border-[#f5e3b5]">
                              <Clock size={12} /> In Progress ({dayRep.completed_items}/{dayRep.total_items})
                            </span>
                          )}
                        </div>

                        {/* Items audit list */}
                        {dayRep.items && dayRep.items.length > 0 ? (
                          <div className="space-y-1.5 pl-2 border-l-2 border-[#dbe4dc]">
                            {dayRep.items.map((it: any) => (
                              <div
                                key={it.id}
                                className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                                  it.completed
                                    ? 'bg-[#f0f7f2] text-[#224838] border border-[#d2e8d8]'
                                    : 'bg-white text-[#52635a] border border-[#e8ece7]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`grid h-4 w-4 place-items-center rounded text-[10px] font-bold ${
                                      it.completed ? 'bg-[#2d5d4a] text-white' : 'border border-[#bcc7bf] text-transparent'
                                    }`}
                                  >
                                    ✓
                                  </span>
                                  <span className={it.completed ? 'font-semibold' : ''}>{it.title}</span>
                                  {it.is_required && (
                                    <span className="text-[9px] font-bold text-[#b4483c] bg-[#faecea] px-1.5 py-0.5 rounded">
                                      Mandatory
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-[#718178]">
                                  {it.completed ? 'Completed / Ticked' : 'Pending Tick Mark'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#86968e] italic pl-2">
                            No checklist items configured for this day.
                          </div>
                        )}
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
