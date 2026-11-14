import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, UserX, UserCheck, Users, Briefcase, KeyRound } from 'lucide-react';
import { employeesApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState, Modal, ConfirmModal } from '@/components/common/UIComponents';

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [confirmBlock, setConfirmBlock] = useState<{ id: string; name: string; action: 'block' | 'unblock' } | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newEmpPassword, setNewEmpPassword] = useState('');
  const [confirmEmpPassword, setConfirmEmpPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [designation, setDesignation] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [formError, setFormError] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: employees = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['employees', search, statusFilter],
    queryFn: () => employeesApi.list(search || undefined, statusFilter || undefined)
  });

  const totalEmployees = employees.length;
  const totalPages = Math.max(1, Math.ceil(totalEmployees / pageSize));
  const paginatedEmployees = employees.slice((page - 1) * pageSize, page * pageSize);

  const createMutation = useMutation({
    mutationFn: employeesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create employee')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => employeesApi.update(id, data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (variables?.data?.password) {
        setPwSuccess(`Password updated for ${selectedEmployee?.fullName || selectedEmployee?.full_name || 'employee'}.`);
      }
      setEditOpen(false);
      setPwModalOpen(false);
      setNewEmpPassword('');
      setConfirmEmpPassword('');
      setSelectedEmployee(null);
    },
    onError: (err: any) => setFormError(err.message || 'Failed to update employee')
  });

  const blockMutation = useMutation({
    mutationFn: (id: string) => employeesApi.block(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirmBlock(null);
    }
  });

  const unblockMutation = useMutation({
    mutationFn: (id: string) => employeesApi.unblock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirmBlock(null);
    }
  });

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setIdentifier('');
    setDesignation('');
    setContactNumber('');
    setFormError('');
  };

  const handleOpenEdit = (emp: any) => {
    setSelectedEmployee(emp);
    setFullName(emp.fullName || emp.full_name);
    setEmail(emp.email);
    setDesignation(emp.designation || '');
    setContactNumber(emp.contact_number || '');
    setNewEmpPassword('');
    setFormError('');
    setEditOpen(true);
  };

  const handleOpenPasswordModal = (emp: any) => {
    setSelectedEmployee(emp);
    setNewEmpPassword('');
    setConfirmEmpPassword('');
    setPwSuccess('');
    setFormError('');
    setPwModalOpen(true);
  };

  return (
    <div>
      <PageTitle
        eyebrow="Staff & Trainers"
        title="Employees"
        description="Manage teachers, instructors, and training coordinators."
        action={
          <button className="btn btn-primary text-xs" onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus size={14} /> Add Employee
          </button>
        }
      />

      {pwSuccess && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#b8dfc5] bg-[#eaf6ee] px-4 py-2.5 text-xs font-medium text-[#216e43]">
          <span>{pwSuccess}</span>
          <button type="button" onClick={() => setPwSuccess('')} className="ml-4 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="panel overflow-hidden bg-white">
        <div className="flex flex-col gap-3 border-b border-[#edf0ea] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b9991]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, designation…"
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

        {isLoading ? (
          <LoadingState label="Loading employees" />
        ) : isError ? (
          <div className="p-4"><ErrorState retry={() => refetch()} /></div>
        ) : employees.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={search ? 'No matching employees found' : 'No employees added yet'}
              detail={search ? 'Try adjusting your search query.' : 'Add your first teacher or instructor account.'}
              icon={Users}
              action={
                !search && (
                  <button className="btn btn-primary text-xs" onClick={() => { resetForm(); setCreateOpen(true); }}>
                    <Plus size={14} /> Add First Employee
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
                    <th className="px-5 py-3.5 min-w-[200px]">Employee</th>
                    <th className="px-5 py-3.5 min-w-[110px]">Identifier</th>
                    <th className="px-5 py-3.5 min-w-[130px]">Designation</th>
                    <th className="px-5 py-3.5 min-w-[140px]">Teams</th>
                    <th className="px-5 py-3.5 min-w-[130px]">Assigned Students</th>
                    <th className="px-5 py-3.5 min-w-[90px]">Status</th>
                    <th className="px-5 py-3.5 min-w-[90px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ea]">
                  {paginatedEmployees.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-[#fafbf9] transition">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#273831]">{emp.fullName || emp.full_name}</div>
                        <div className="text-[11px] text-[#718079]">{emp.email}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-[#55665f]">
                        {emp.identifier || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-[#46574f]">
                        {emp.designation || 'Instructor'}
                      </td>
                      <td className="px-5 py-3.5 text-[11px] text-[#6d7e76]">
                        {emp.teams && emp.teams.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {emp.teams.map((t: any) => (
                              <span key={t.id} className="rounded bg-[#ebf2ec] px-1.5 py-0.5 font-semibold text-[#2f5c49]">
                                {t.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-[#30443c]">
                        {emp.studentCount} {emp.studentCount === 1 ? 'student' : 'students'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={emp.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleOpenPasswordModal(emp)}
                          className="rounded-lg p-1.5 text-[#285d4b] hover:bg-[#eaf6ee]"
                          title="Change Employee / Teacher Password"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="rounded-lg p-1.5 text-[#63746c] hover:bg-[#edf1eb]"
                          title="Edit Employee"
                        >
                          <Edit size={14} />
                        </button>
                        {emp.status === 'blocked' ? (
                          <button
                            onClick={() => setConfirmBlock({ id: emp.id, name: emp.fullName || emp.full_name, action: 'unblock' })}
                            className="rounded-lg p-1.5 text-[#326d55] hover:bg-[#ebf4ef]"
                            title="Unblock Employee"
                          >
                            <UserCheck size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmBlock({ id: emp.id, name: emp.fullName || emp.full_name, action: 'block' })}
                            className="rounded-lg p-1.5 text-[#b04337] hover:bg-[#fcedeb]"
                            title="Block Employee"
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

            {/* Pagination bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-[#edf0ea] px-5 py-3 text-xs text-[#718078] gap-3 bg-[#fafbf9]">
              <div>
                Showing <span className="font-semibold text-[#22352e]">{totalEmployees === 0 ? 0 : (page - 1) * pageSize + 1}</span> to <span className="font-semibold text-[#22352e]">{Math.min(page * pageSize, totalEmployees)}</span> of <span className="font-semibold text-[#22352e]">{totalEmployees}</span> employees
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

      {createOpen && (
        <Modal title="Add New Employee" onClose={() => setCreateOpen(false)}>
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              createMutation.mutate({ fullName, email, password, identifier, designation, contactNumber });
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
                placeholder="Sarah Connor"
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
                placeholder="sarah@organization.com"
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
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Designation</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Lead Instructor"
                  className="field text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Identifier (Optional)</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="field text-xs"
                />
              </div>
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
            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={createMutation.isPending} className="btn btn-primary text-xs">
                {createMutation.isPending ? 'Creating…' : 'Create Employee'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editOpen && selectedEmployee && (
        <Modal title="Edit Employee Profile" onClose={() => setEditOpen(false)}>
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              if (newEmpPassword && newEmpPassword.trim().length < 6) {
                setFormError('New password must be at least 6 characters.');
                return;
              }
              const payload: any = {
                full_name: fullName,
                email,
                designation,
                contact_number: contactNumber
              };
              if (newEmpPassword.trim()) {
                payload.password = newEmpPassword;
              }
              updateMutation.mutate({
                id: selectedEmployee.id,
                data: payload
              });
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
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="field text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Contact Number</label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="field text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">
                New Password <span className="font-normal text-[#7f8c85]">(optional, admin-only reset)</span>
              </label>
              <input
                type="password"
                minLength={6}
                value={newEmpPassword}
                onChange={(e) => setNewEmpPassword(e.target.value)}
                placeholder="Leave blank to keep existing password"
                className="field text-xs"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
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

      {pwModalOpen && selectedEmployee && (
        <Modal
          title={`Change Password: ${selectedEmployee.fullName || selectedEmployee.full_name}`}
          onClose={() => setPwModalOpen(false)}
          maxWidth="max-w-md"
        >
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              if (newEmpPassword.trim().length < 6) {
                setFormError('Password must be at least 6 characters.');
                return;
              }
              if (newEmpPassword !== confirmEmpPassword) {
                setFormError('Passwords do not match.');
                return;
              }
              updateMutation.mutate({
                id: selectedEmployee.id,
                data: { password: newEmpPassword }
              });
            }}
            className="space-y-3.5"
          >
            <div className="rounded-lg bg-[#f2f4ee] px-3 py-2 text-[11px] text-[#4a5952]">
              Only an administrator can reset or change an employee / teacher password.
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">New Password (min 6 chars)</label>
              <input
                type="password"
                required
                minLength={6}
                value={newEmpPassword}
                onChange={(e) => setNewEmpPassword(e.target.value)}
                placeholder="Enter new password"
                className="field text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4a5952]">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmEmpPassword}
                onChange={(e) => setConfirmEmpPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="field text-xs"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setPwModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={updateMutation.isPending} className="btn btn-primary text-xs">
                {updateMutation.isPending ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmBlock && (
        <ConfirmModal
          title={`${confirmBlock.action === 'block' ? 'Block' : 'Unblock'} Employee Account`}
          detail={
            confirmBlock.action === 'block'
              ? `Are you sure you want to block ${confirmBlock.name}? The employee will be prevented from logging in. Assigned students may need reassignment.`
              : `Are you sure you want to unblock ${confirmBlock.name}? Their portal access will be restored.`
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
    </div>
  );
}
