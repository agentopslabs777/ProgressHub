import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft, Check, Lock, Play, Layers, Clock, AlertCircle, Sparkles,
  ShieldCheck, Video, ListOrdered, ClipboardCheck, Info, ExternalLink,
  UserCheck, Award, Eye
} from 'lucide-react';
import { studentApi, authApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState } from '@/components/common/UIComponents';

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return 'Unlocking now';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function StudentProgramView() {
  const { id = '' } = useParams<{ id: string }>();

  // URL search params for student_id
  const searchParams = new URLSearchParams(window.location.search);
  const urlStudentId = searchParams.get('student_id');

  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(urlStudentId || undefined);

  const { data: user } = useQuery({
    queryKey: ['current_user'],
    queryFn: authApi.me
  });

  const isFacultyOrAdmin = user && (user.role === 'employee' || user.role === 'admin');

  // If faculty or admin, fetch assigned students for this program
  const { data: assignedStudents = [] } = useQuery({
    queryKey: ['assigned_students_for_program', id],
    queryFn: () => studentApi.getAssignedStudents(id),
    enabled: !!id && isFacultyOrAdmin
  });

  // Default to first assigned student if none selected
  useEffect(() => {
    if (isFacultyOrAdmin && assignedStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(assignedStudents[0].student_id);
    }
  }, [isFacultyOrAdmin, assignedStudents, selectedStudentId]);

  const { data: tracks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['student_program_progress', id, selectedStudentId],
    queryFn: () => studentApi.getProgramProgress(id, selectedStudentId),
    enabled: !!id
  });

  if (isLoading) return <LoadingState label="Loading learning tracks and day progression" />;
  if (isError) return <ErrorState retry={() => refetch()} />;

  const currentStudent = assignedStudents.find((s: any) => s.student_id === selectedStudentId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="mb-2">
        <Link
          href={isFacultyOrAdmin ? "/daily-classes" : "/my-programs"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6e7e76] hover:text-[#235341]"
        >
          <ArrowLeft size={14} /> Back to {isFacultyOrAdmin ? 'Assigned Programs' : 'My Programs'}
        </Link>
      </div>

      {/* FACULTY STUDENT SELECTOR BAR */}
      {isFacultyOrAdmin && (
        <div className="panel p-4 bg-[#f4faf6] border border-[#bce0cb] rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <UserCheck size={18} className="text-[#255f46]" />
            <div>
              <div className="text-xs font-bold text-[#1f4e39]">
                Review Assigned Student's Curriculum & Submissions
              </div>
              <div className="text-[11px] text-[#637d70]">
                Select a student to inspect day progress and evaluate Section 5 assignments
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedStudentId || ''}
              onChange={(e) => setSelectedStudentId(e.target.value || undefined)}
              className="field text-xs py-1.5 px-3 bg-white font-semibold"
            >
              {assignedStudents.length === 0 ? (
                <option value="">No assigned students yet</option>
              ) : (
                assignedStudents.map((st: any) => (
                  <option key={st.student_id} value={st.student_id}>
                    {st.full_name} ({st.progress}% done)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      )}

      <PageTitle
        eyebrow="Curriculum Tracks"
        title="Learning Tracks & Sequential Day Progression"
        description="Tracks progress sequentially. Day 1 is available upon enrollment; subsequent days unlock automatically or via faculty approval."
      />

      {tracks.length === 0 ? (
        <div className="panel p-8 bg-white border border-[#e1e8e1] rounded-2xl">
          <EmptyState
            title="Curriculum being prepared"
            detail="Learning tracks and daily classes will appear here once published."
            icon={Layers}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {tracks.map((track: any) => (
            <div key={track.trackId} className="panel overflow-hidden bg-white border border-[#e4ebe4] rounded-2xl shadow-xs">
              {/* Track Header */}
              <div className="flex flex-wrap items-center justify-between border-b border-[#edf0ea] bg-[#fafbf9] px-5 py-4 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#245842] bg-[#eef5f1] px-2 py-0.5 rounded">
                      Track {track.position}
                    </span>
                    <h3 className="display text-base font-bold text-[#23352e]">{track.name}</h3>
                  </div>
                  {track.description && (
                    <p className="mt-1 text-xs text-[#718279]">{track.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#204938]">{track.progress}%</span>
                    <span className="text-[10px] text-[#718279] block">
                      {track.completedDays} / {track.totalDays} Days
                    </span>
                  </div>
                  <div className="h-2 w-24 bg-[#e8ece8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#275c47] rounded-full transition-all duration-300"
                      style={{ width: `${track.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Days List */}
              <div className="divide-y divide-[#edf0ea]">
                {track.days.map((day: any) => {
                  const isCompleted = day.completed || day.status === 'completed';
                  const isAvailable = day.status === 'available';
                  const isLocked = day.status === 'locked' && !isFacultyOrAdmin;
                  const isPendingReview = day.status === 'pending_review';

                  const dayLink = `/learning-days/${day.id}${selectedStudentId ? `?student_id=${selectedStudentId}` : ''}`;

                  return (
                    <div
                      key={day.id}
                      className={`p-5 transition ${
                        isAvailable
                          ? 'bg-white hover:bg-[#fafbfa]'
                          : isCompleted
                          ? 'bg-[#fbfcfa]'
                          : 'bg-[#fafafa]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                              isCompleted
                                ? 'bg-[#e2f3ea] text-[#1c5d3b]'
                                : isAvailable
                                ? 'bg-[#285d4b] text-white shadow-xs'
                                : isPendingReview
                                ? 'bg-[#fff5e5] text-[#8e5c1a]'
                                : 'bg-[#eef1ee] text-[#788880]'
                            }`}
                          >
                            {isCompleted ? <Check size={16} /> : day.dayNumber}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-xs font-bold text-[#23352e]">
                                Day {day.dayNumber}: {day.title}
                              </h4>
                              {isCompleted && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#205e42] bg-[#e1f3ea] px-2 py-0.5 rounded border border-[#bde4ce]">
                                  <Check size={10} /> Completed
                                </span>
                              )}
                              {isPendingReview && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8c621f] bg-[#fdf4de] px-2 py-0.5 rounded border border-[#f5dc9e]">
                                  <Clock size={10} /> Under Review
                                </span>
                              )}
                              {isAvailable && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#285d47] bg-[#eef5f1] px-2 py-0.5 rounded border border-[#d6e5dc]">
                                  Available Now
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-[#6d7e75] mt-0.5">
                              {day.description || '5 Sections: Summary, Learning Videos, Resources, Tasks, and Section 5 Submission.'}
                            </p>
                          </div>
                        </div>

                        {/* Action Button */}
                        <div>
                          {isFacultyOrAdmin ? (
                            <Link
                              href={dayLink}
                              className="btn btn-outline text-xs py-1.5 px-3.5 flex items-center gap-1.5 font-bold"
                            >
                              <Eye size={13} /> Review Day & Section 5
                            </Link>
                          ) : isLocked ? (
                            <button
                              disabled
                              className="btn btn-disabled text-xs py-1.5 px-3.5 flex items-center gap-1.5 cursor-not-allowed opacity-60"
                            >
                              <Lock size={13} /> Locked
                            </button>
                          ) : (
                            <Link
                              href={dayLink}
                              className="btn btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 font-bold shadow-xs"
                            >
                              <Play size={13} /> {isCompleted ? 'Review Day' : 'Start Day'}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentProgramView;
