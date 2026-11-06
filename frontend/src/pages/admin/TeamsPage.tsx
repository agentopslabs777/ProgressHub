import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, UserPlus, UserMinus, Edit, Layers, Trash2 } from 'lucide-react';
import { teamsApi, employeesApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState, Modal } from '@/components/common/UIComponents';

export function TeamsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [formError, setFormError] = useState('');

  const { data: teams = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list()
  });

  const createMutation = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to create team')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => teamsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditOpen(false);
      setSelectedTeam(null);
    },
    onError: (err: any) => setFormError(err.message || 'Failed to update team')
  });

  const assignMemberMutation = useMutation({
    mutationFn: ({ teamId, empId }: { teamId: string; empId: string }) => teamsApi.assignMember(teamId, empId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSelectedEmpId('');
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, empId }: { teamId: string; empId: string }) => teamsApi.removeMember(teamId, empId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditOpen(false);
      setSelectedTeam(null);
    },
    onError: (err: any) => alert(err.message || 'Failed to delete team')
  });

  const handleDeleteTeam = (teamId: string, teamName: string) => {
    if (window.confirm(`Are you sure you want to delete the team "${teamName}"? All member associations with this team will be removed.`)) {
      deleteMutation.mutate(teamId);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setFormError('');
  };

  const handleOpenEdit = (team: any) => {
    setSelectedTeam(team);
    setName(team.name);
    setDescription(team.description || '');
    setFormError('');
    setEditOpen(true);
  };

  const handleOpenMembers = (team: any) => {
    setSelectedTeam(team);
    setMemberModalOpen(true);
  };

  return (
    <div>
      <PageTitle
        eyebrow="Organization"
        title="Teams"
        description="Organize instructors and staff into collaborative functional teams."
        action={
          <button className="btn btn-primary text-xs" onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus size={14} /> Create Team
          </button>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading teams" />
      ) : isError ? (
        <ErrorState retry={() => refetch()} />
      ) : teams.length === 0 ? (
        <div className="panel p-8 bg-white">
          <EmptyState
            title="No teams created yet"
            detail="Group your instructors into technical, mentor, or support teams."
            icon={Layers}
            action={
              <button className="btn btn-primary text-xs" onClick={() => { resetForm(); setCreateOpen(true); }}>
                <Plus size={14} /> Create First Team
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team: any) => (
            <div key={team.id} className="panel p-5 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf3ee] text-[#346a54]">
                    <Layers size={18} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={team.active ? 'active' : 'inactive'} />
                    <button
                      onClick={() => handleOpenEdit(team)}
                      className="rounded-lg p-1 text-[#718279] hover:bg-[#edf1eb] transition"
                      title="Edit Team"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(team.id, team.name)}
                      className="rounded-lg p-1 text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fee2e2] transition"
                      title="Delete Team"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h3 className="display mt-4 text-base font-bold text-[#23362f]">{team.name}</h3>
                <p className="mt-1 text-xs text-[#708078] leading-5 line-clamp-2">
                  {team.description || 'No description provided.'}
                </p>

                <div className="mt-4 border-t border-[#edf0ea] pt-3">
                  <div className="flex items-center justify-between text-xs text-[#73837b] mb-2">
                    <span className="font-semibold">{team.memberCount} Team Members</span>
                    <button
                      onClick={() => handleOpenMembers(team)}
                      className="text-[11px] font-bold text-[#2a614d] hover:underline"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {team.members && team.members.length > 0 ? (
                      team.members.map((m: any) => (
                        <span key={m.employeeId} className="rounded bg-[#f0f4ef] px-2 py-0.5 text-[11px] text-[#2c5342] font-medium">
                          {m.fullName}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#909c95] italic">No members assigned yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal title="Create New Team" onClose={() => setCreateOpen(false)}>
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              createMutation.mutate({ name, description });
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485850]">Team Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Technical Mentors"
                className="field text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485850]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the purpose of this team…"
                rows={3}
                className="field text-xs"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={createMutation.isPending} className="btn btn-primary text-xs">
                {createMutation.isPending ? 'Creating…' : 'Create Team'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editOpen && selectedTeam && (
        <Modal title="Edit Team" onClose={() => setEditOpen(false)}>
          {formError && (
            <div className="mb-4 rounded-lg bg-[#faecea] p-2.5 text-xs text-[#b8483d] font-medium">
              {formError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              updateMutation.mutate({
                id: selectedTeam.id,
                data: { name, description }
              });
            }}
            className="space-y-3.5"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485850]">Team Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#485850]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="field text-xs"
              />
            </div>
            <div className="mt-5 flex items-center justify-between pt-2 border-t border-[#edf0ea]">
              <button
                type="button"
                onClick={() => handleDeleteTeam(selectedTeam.id, selectedTeam.name)}
                className="btn bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca] text-xs flex items-center gap-1.5"
                title="Delete Team"
              >
                <Trash2 size={13} /> Delete Team
              </button>
              <div className="flex gap-2">
                <button type="button" className="btn btn-soft text-xs" onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={updateMutation.isPending} className="btn btn-primary text-xs">
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Member Assignment Modal */}
      {memberModalOpen && selectedTeam && (
        <Modal title={`Manage Members · ${selectedTeam.name}`} onClose={() => setMemberModalOpen(false)}>
          <div className="space-y-4">
            {/* Add member select */}
            <div className="flex gap-2">
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="field text-xs flex-1"
              >
                <option value="">Select an employee to add…</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName || emp.full_name} ({emp.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedEmpId || assignMemberMutation.isPending}
                onClick={() => assignMemberMutation.mutate({ teamId: selectedTeam.id, empId: selectedEmpId })}
                className="btn btn-primary text-xs shrink-0"
              >
                <UserPlus size={14} /> Add
              </button>
            </div>

            {/* Current members list */}
            <div className="border-t border-[#edf0ea] pt-3">
              <div className="text-xs font-bold text-[#31433b] mb-2">Current Members</div>
              {selectedTeam.members && selectedTeam.members.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedTeam.members.map((m: any) => (
                    <div
                      key={m.employeeId}
                      className="flex items-center justify-between rounded-lg bg-[#fafbf9] border border-[#edf0ea] p-2.5 text-xs"
                    >
                      <div>
                        <div className="font-bold text-[#253730]">{m.fullName}</div>
                        <div className="text-[11px] text-[#72827a]">{m.email}</div>
                      </div>
                      <button
                        onClick={() => removeMemberMutation.mutate({ teamId: selectedTeam.id, empId: m.employeeId })}
                        className="rounded p-1 text-[#b5463b] hover:bg-[#faecea]"
                        title="Remove from team"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#7d8c85] italic py-3 text-center">
                  No employees in this team.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
