import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, UserCheck, ShieldX, UserCog, ClipboardList, Search,
  Filter, CheckCircle2, AlertCircle, X, Users, BookOpen
} from 'lucide-react';
import { enrollmentsApi, studentsApi, programsApi, employeesApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState, Modal, ConfirmModal } from '@/components/common/UIComponents';

export function EnrollmentsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<any>(null);

  const [studentId, setStudentId] = useState('');
  const [programId, setProgramId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [formError, setFormError] = useState('');

  // Filtering states
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: enrollments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['enrollments'],
    queryFn: enrollmentsApi.list
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentsApi.list()
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['programs'],
    queryFn: programsApi.list
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list()
  });

  const createMutation = useMutation({
    mutationFn: enrollmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create enrollment')
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => enrollmentsApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirmRevoke(null);
    }
  });

  const assignMutation = useMutation({
    mutationFn: ({ enrollmentId, empId }: { enrollmentId: string; empId: string | null }) =>
      enrollmentsApi.assignEmployee(enrollmentId, empId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setAssignOpen(false);
      setSelectedEnrollment(null);
    }
  });

  const resetForm = () => {
    setStudentId('');
    setProgramId('');
    setEmployeeId('');
    setFormError('');
  };

  // Filtered enrollments
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e: any) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (programFilter && e.programId !== programFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const studentMatch = e.studentName?.toLowerCase().includes(q) || e.studentEmail?.toLowerCase().includes(q);
        const progMatch = e.programName?.toLowerCase().includes(q) || e.programCode?.toLowerCase().includes(q);
        const empMatch = e.employeeName?.toLowerCase().includes(q);
        if (!studentMatch && !progMatch && !empMatch) return false;
      }
      return true;
    });
  }, [enrollments, search, programFilter, statusFilter]);

  // Overall statistics
  const activeCount = enrollments.filter((e: any) => e.status === 'active').length;
  const revokedCount = enrollments.filter((e: any) => e.status === 'revoked').length;
  const avgProg = enrollments.length > 0
    ? Math.round(enrollments.reduce((acc: number, curr: any) => acc + (curr.progress || 0), 0) / enrollments.length)
    : 0;

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Access Control"
        title="Program Enrollments"
        description="Grant students access to curriculum tracks and assign dedicated supporting teachers."
        action={
          <button
            className="btn btn-primary text-xs"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus size={14} /> Enroll Student
          </button>
        }
      />

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Total Enrollments</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#21342c]">{enrollments.length}</span>
            <span className="text-xs text-[#52655c] font-medium">{activeCount} active</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Active Access</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#285d47]">{activeCount}</span>
            <span className="text-xs text-[#73847c]">Curriculum learners</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Average Progress</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#2f5e82]">{avgProg}%</span>
            <span className="text-xs text-[#5f7480]">Overall cohort</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Revoked / Inactive</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#b5583b]">{revokedCount}</span>
            <span className="text-xs text-[#9c693a] font-medium">Access paused</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="panel p-4 bg-white border border-[#e4ebe4]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[#93a29a]" />
              <input
                type="text"
                placeholder="Search student, program, or teacher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field pl-8 pr-7 text-xs py-1.5 w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-[#93a29a] hover:text-[#333]"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Program Filter */}
            <div className="min-w-[180px]">
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="field text-xs py-1.5 w-full font-medium"
              >
                <option value="">All Programs</option>
                {programs.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="min-w-[130px]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="field text-xs py-1.5 w-full font-medium"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </div>

          <span className="text-xs text-[#6e7e76] font-medium">
            Showing <strong className="text-[#23352e]">{filteredEnrollments.length}</strong> of {enrollments.length} enrollment(s)
          </span>
        </div>
      </div>

      {/* Main Enrollments Table */}
      <div className="panel overflow-hidden bg-white border border-[#e4ebe4]">
        {isLoading ? (
          <div className="p-8">
            <LoadingState label="Loading enrollments list" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState retry={() => refetch()} />
          </div>
        ) : filteredEnrollments.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={search || programFilter || statusFilter ? "No matching enrollments found" : "No program enrollments created"}
              detail={search || programFilter || statusFilter ? "Try adjusting your search terms or filters." : "Enroll students into published programs to give them access to learning days and tasks."}
              icon={ClipboardList}
              action={
                <button
                  className="btn btn-primary text-xs"
                  onClick={() => {
                    resetForm();
                    setCreateOpen(true);
                  }}
                >
                  <Plus size={14} /> Enroll Student
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="bg-[#f5f8f5] text-[10px] font-bold uppercase tracking-wider text-[#63776d] border-b border-[#e1eae2]">
                <tr>
                  <th className="px-5 py-3.5 min-w-[190px]">Student</th>
                  <th className="px-5 py-3.5 min-w-[190px]">Program</th>
                  <th className="px-5 py-3.5 min-w-[160px]">Supporting Teacher</th>
                  <th className="px-5 py-3.5 min-w-[140px]">Progress</th>
                  <th className="px-5 py-3.5 min-w-[110px]">Enrolled Date</th>
                  <th className="px-5 py-3.5 min-w-[90px]">Status</th>
                  <th className="px-5 py-3.5 min-w-[90px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ea]">
                {filteredEnrollments.map((e: any) => (
                  <tr key={e.id} className="hover:bg-[#f8fbf9] transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[#23352e]">{e.studentName}</div>
                      <div className="text-[11px] text-[#718079]">{e.studentEmail}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#2b5947]">{e.programName}</div>
                      <div className="font-mono text-[10px] text-[#718079]">{e.programCode}</div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-[#46574f]">
                      {e.employeeName || (
                        <span className="italic text-[#929e97]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-[#e5ece5] overflow-hidden">
                          <div className="h-full bg-[#3c765f] rounded-full transition-all duration-300" style={{ width: `${e.progress}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-[#3a5246]">{e.progress}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-[#718079]">
                      {e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1">
                      <button
                        onClick={() => {
                          setSelectedEnrollment(e);
                          setEmployeeId(e.employeeId || '');
                          setAssignOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-[#51645b] hover:bg-[#edf1eb] transition cursor-pointer"
                        title="Assign or Change Supporting Teacher"
                      >
                        <UserCog size={15} />
                      </button>
                      {e.status === 'active' && (
                        <button
                          onClick={() => setConfirmRevoke(e)}
                          className="rounded-lg p-1.5 text-[#b04337] hover:bg-[#fcedeb] transition cursor-pointer"
                          title="Revoke Program Access"
                        >
                          <ShieldX size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enroll Student Modal Panel */}
      {createOpen && (
        <Modal
          title="Enroll Student in Program"
          onClose={() => setCreateOpen(false)}
          maxWidth="max-w-md"
        >
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-3 text-xs text-[#b8483d] font-medium border border-[#f5c6cb]">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              createMutation.mutate({
                student_id: studentId,
                program_id: programId,
                employee_id: employeeId || null
              });
            }}
            className="space-y-4 pt-1"
          >
            <div>
              <label className="mb-1 block text-xs font-bold text-[#374c41]">
                Select Student <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="field text-xs py-2"
              >
                <option value="">Choose a student…</option>
                {(students || []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName || s.full_name} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#374c41]">
                Select Program <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="field text-xs py-2"
              >
                <option value="">Choose a program…</option>
                {(programs || []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) · {p.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#374c41]">
                Assign Supporting Teacher <span className="text-red-500">* (Compulsory)</span>
              </label>
              <select
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="field text-xs py-2 border-[#8db59d] bg-[#f9fcf9] font-medium"
              >
                <option value="">Choose an assigned supporting teacher (Required)…</option>
                {(employees || []).map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName || emp.full_name} ({emp.designation || 'Instructor'})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[#55695f]">
                Every student enrollment must have a dedicated supporting teacher assigned to verify assignments and award points.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-[#edf0ea]">
              <button
                type="button"
                className="btn btn-soft text-xs"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !studentId || !programId}
                className="btn btn-primary text-xs"
              >
                {createMutation.isPending ? 'Enrolling…' : 'Enroll Student'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Teacher Modal Panel */}
      {assignOpen && selectedEnrollment && (
        <Modal
          title="Assign Supporting Teacher"
          onClose={() => setAssignOpen(false)}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-1">
            <div className="rounded-lg bg-[#f0f7f3] p-3 text-xs text-[#2b4c3c] border border-[#c3dfce]">
              Assigning a supporting teacher to <strong>{selectedEnrollment.studentName}</strong> for program <strong>{selectedEnrollment.programName}</strong>.
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#374c41]">
                Select Employee / Teacher
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="field text-xs py-2"
              >
                <option value="">Unassigned (None)</option>
                {(employees || []).map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName || emp.full_name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-[#edf0ea]">
              <button
                type="button"
                className="btn btn-soft text-xs"
                onClick={() => setAssignOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assignMutation.isPending}
                onClick={() =>
                  assignMutation.mutate({
                    enrollmentId: selectedEnrollment.id,
                    empId: employeeId || null
                  })
                }
                className="btn btn-primary text-xs"
              >
                {assignMutation.isPending ? 'Saving…' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Revoke Confirmation Modal Panel */}
      {confirmRevoke && (
        <ConfirmModal
          title="Revoke Program Access"
          detail={`Are you sure you want to revoke program access for ${confirmRevoke.studentName} in ${confirmRevoke.programName}? The student will no longer be able to access the course content, while their historical submissions and attendance records remain preserved.`}
          destructive
          confirmLabel="Revoke Access"
          pending={revokeMutation.isPending}
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={() => revokeMutation.mutate(confirmRevoke.id)}
        />
      )}
    </div>
  );
}

export default EnrollmentsPage;
