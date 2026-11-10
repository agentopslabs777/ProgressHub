import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap, Search, CheckCircle2, Clock, ExternalLink,
  Award, MessageSquare, AlertCircle, ChevronRight, BookOpen,
  Sparkles, Check, RefreshCw, Send, FileText, CheckSquare
} from 'lucide-react';
import { enrollmentsApi, studentApi, submissionsApi } from '@/services/api';
import { PageTitle, StatusBadge, LoadingState, ErrorState, EmptyState } from '@/components/common/UIComponents';

export function MyStudentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Review form states
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'changes_requested' | 'rejected'>('approved');
  const [reviewScore, setReviewScore] = useState<number>(85);
  const [additionalPoints, setAdditionalPoints] = useState<number>(30);
  const [reviewComments, setReviewComments] = useState<string>('');
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string>('');
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string>('');

  // 1. Fetch only students assigned to this employee
  const { data: enrollments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my_assigned_enrollments'],
    queryFn: enrollmentsApi.list,
    staleTime: 30000
  });

  // Filter enrollments by search
  const filteredEnrollments = enrollments.filter((e: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.studentName && e.studentName.toLowerCase().includes(q)) ||
      (e.studentEmail && e.studentEmail.toLowerCase().includes(q)) ||
      (e.programName && e.programName.toLowerCase().includes(q))
    );
  });

  // Active selected enrollment
  const currentEnrollment = enrollments.find((e: any) => e.id === selectedEnrollmentId) || filteredEnrollments[0] || null;

  // 2. Fetch the assigned program's tracks and days for this specific student
  const { data: programProgress = [], isLoading: isCurriculumLoading } = useQuery({
    queryKey: ['employee_student_progress', currentEnrollment?.programId, currentEnrollment?.studentId],
    queryFn: () => {
      if (!currentEnrollment?.programId || !currentEnrollment?.studentId) return Promise.resolve([]);
      return studentApi.getProgramProgress(currentEnrollment.programId, currentEnrollment.studentId);
    },
    enabled: !!currentEnrollment?.programId && !!currentEnrollment?.studentId,
    staleTime: 30000
  });

  // Collect all days across tracks for quick day selection
  const allDays: any[] = [];
  programProgress.forEach((track: any) => {
    if (track.days) {
      track.days.forEach((day: any) => {
        allDays.push({ ...day, trackName: track.name });
      });
    }
  });

  const activeDay = allDays.find((d: any) => d.id === selectedDayId) || allDays[0] || null;

  // 3. Fetch specific day detail with checklist and Google Drive submission
  const { data: dayDetail, isLoading: isDayLoading, refetch: refetchDay } = useQuery({
    queryKey: ['employee_student_day_detail', activeDay?.id, currentEnrollment?.studentId],
    queryFn: () => {
      if (!activeDay?.id || !currentEnrollment?.studentId) return Promise.resolve(null);
      return studentApi.getDayDetails(activeDay.id, currentEnrollment.studentId);
    },
    enabled: !!activeDay?.id && !!currentEnrollment?.studentId,
    staleTime: 15000
  });

  // Sync initial review form values when dayDetail changes
  React.useEffect(() => {
    const sub = dayDetail?.google_drive_submission;
    if (sub) {
      if (sub.status && ['approved', 'changes_requested', 'rejected'].includes(sub.status)) {
        setReviewStatus(sub.status);
      } else {
        setReviewStatus('approved');
      }
      if (sub.rating) setReviewScore(sub.rating);
      if (typeof sub.additional_reward_points === 'number' && sub.additional_reward_points > 0) {
        setAdditionalPoints(sub.additional_reward_points);
      } else {
        setAdditionalPoints(30);
      }
      if (sub.review_comments) setReviewComments(sub.review_comments);
    }
  }, [dayDetail?.google_drive_submission?.id]);

  // 4. Review mutation for Google Drive submission
  const reviewMutation = useMutation({
    mutationFn: ({ submissionId, data }: { submissionId: string; data: any }) =>
      submissionsApi.reviewGoogleDrive(submissionId, data),
    onSuccess: (res: any) => {
      const extra = res?.additional_reward_points ? ` (+${res.additional_reward_points} pts added to student wallet)` : '';
      setReviewSuccessMsg(`Evaluation and score saved successfully!${extra}`);
      setReviewErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['employee_student_day_detail'] });
      queryClient.invalidateQueries({ queryKey: ['employee_student_progress'] });
      queryClient.invalidateQueries({ queryKey: ['my_assigned_enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['student_day'] });
      queryClient.invalidateQueries({ queryKey: ['student_program_progress'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['my_programs'] });
      setTimeout(() => setReviewSuccessMsg(''), 7000);
    },
    onError: (err: any) => {
      setReviewErrorMsg(err.message || 'Failed to submit review');
    }
  });

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayDetail?.google_drive_submission?.id) {
      setReviewErrorMsg('No Google Drive submission record found to review for this day.');
      return;
    }

    setReviewErrorMsg('');
    setReviewSuccessMsg('Submitting evaluation and updating student points wallet...');

    reviewMutation.mutate({
      submissionId: dayDetail.google_drive_submission.id,
      data: {
        status: reviewStatus,
        rating: Number(reviewScore),
        additional_reward_points: Number(additionalPoints),
        review_comments: reviewComments.trim() || 'Reviewed and approved by supporting teacher.'
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageTitle
        eyebrow="Instructor Workspace · Mentorship & Grading"
        title="My Assigned Students"
        description="View students assigned to you as Supporting Teacher. Review daily checklist progress, inspect Google Drive Word document submissions, and directly award comments, scores, and reward points."
        action={
          <button onClick={() => refetch()} className="btn btn-soft text-xs flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh List
          </button>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading assigned students..." />
      ) : isError ? (
        <ErrorState retry={() => refetch()} />
      ) : enrollments.length === 0 ? (
        <div className="panel p-10 bg-white">
          <EmptyState
            title="No students currently assigned to you"
            detail="When an administrator assigns you as the supporting teacher for an enrolled student, their course progress and submissions will appear here for verification."
            icon={GraduationCap}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Assigned Student List (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="panel p-3.5 bg-white border border-[#e2e8e2] shadow-sm space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-[#93a39b]" />
                <input
                  type="text"
                  placeholder="Search student or course…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="field pl-8 text-xs py-1.5 w-full"
                />
              </div>

              <div className="text-[11px] font-bold uppercase tracking-wider text-[#6f8278] flex items-center justify-between">
                <span>Assigned Learners ({filteredEnrollments.length})</span>
                <span className="text-[10px] text-[#285d47] font-semibold bg-[#e8f3ed] px-2 py-0.5 rounded-full">
                  You are Supporting Teacher
                </span>
              </div>

              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {filteredEnrollments.map((enr: any) => {
                  const isSelected = (currentEnrollment?.id === enr.id);
                  const initials = (enr.studentName || enr.studentEmail || 'ST').slice(0, 2).toUpperCase();

                  return (
                    <button
                      key={enr.id}
                      type="button"
                      onClick={() => {
                        setSelectedEnrollmentId(enr.id);
                        setSelectedDayId(null);
                        setReviewSuccessMsg('');
                        setReviewErrorMsg('');
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 ${
                        isSelected
                          ? 'bg-[#edf6f1] border-[#295d47] shadow-sm'
                          : 'bg-[#fafbfa] border-[#e4ebe4] hover:bg-[#f3f7f4]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected ? 'bg-[#295d47] text-white shadow-xs' : 'bg-[#e0e8e2] text-[#33463e]'
                      }`}>
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-[#1f3128] truncate">{enr.studentName}</h4>
                          <span className="text-[10px] font-bold text-[#275e47] bg-white px-1.5 py-0.5 rounded border border-[#d2e2d8]">
                            {enr.progress}%
                          </span>
                        </div>
                        <p className="text-[11px] text-[#697d72] truncate">{enr.studentEmail}</p>

                        <div className="mt-1.5 pt-1.5 border-t border-black/5 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-[#275947] truncate max-w-[150px]">
                            {enr.programName}
                          </span>
                          <span className="font-mono text-[#819289]">{enr.programCode}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Assigned Course Learning Days & Evaluation Center (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {currentEnrollment ? (
              <>
                {/* Active Student & Assigned Course Banner */}
                <div
                  className="p-5 text-white rounded-2xl shadow-md space-y-3 border border-[#133d2c]"
                  style={{ background: 'linear-gradient(135deg, #144231 0%, #1a4f3c 50%, #25634b 100%)', color: '#ffffff' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#0e3022] text-white font-black text-sm flex items-center justify-center border-2 border-white/40 shadow-inner">
                        {(currentEnrollment.studentName || 'ST').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-white tracking-tight">{currentEnrollment.studentName}</h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-[#a3f0ca] px-2.5 py-0.5 rounded-full border border-white/30 backdrop-blur-xs">
                            Assigned to You
                          </span>
                        </div>
                        <p className="text-xs text-[#d1eee0] font-medium">{currentEnrollment.studentEmail}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#b1dfcb] block">
                        Assigned Course
                      </span>
                      <span className="text-sm font-extrabold text-white block">
                        {currentEnrollment.programName} ({currentEnrollment.programCode})
                      </span>
                      <div className="inline-block text-xs font-bold text-white bg-[#0e3022] px-2.5 py-0.5 rounded-md mt-1 border border-white/20">
                        {currentEnrollment.progress}% Completed
                      </div>
                    </div>
                  </div>
                </div>

                {/* Day Selector Pills */}
                <div className="panel p-3 bg-white border border-[#e2e8e2] shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#708278] mb-2 px-1">
                    Select Course Learning Day:
                  </div>

                  {allDays.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#718279]">
                      No days configured yet for this program curriculum.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allDays.map((d: any) => {
                        const isDaySelected = (activeDay?.id === d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSelectedDayId(d.id);
                              setReviewSuccessMsg('');
                              setReviewErrorMsg('');
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                              isDaySelected
                                ? 'bg-[#285d47] text-white border-[#285d47] shadow-sm'
                                : 'bg-[#f4f7f4] text-[#33463e] border-[#d8e3dc] hover:bg-[#eaf1ec]'
                            }`}
                          >
                            <span>Day {d.day_number || d.dayNumber}</span>
                            {d.is_completed ? (
                              <CheckCircle2 size={13} className={isDaySelected ? 'text-[#87f1bf]' : 'text-[#2a7a56]'} />
                            ) : (
                              <Clock size={13} className={isDaySelected ? 'text-white/60' : 'text-[#95a69e]'} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Day Details: What Student Completed & Evaluation Form */}
                {isDayLoading ? (
                  <LoadingState label="Loading student day details and submissions..." />
                ) : activeDay ? (
                  <div className="space-y-4">
                    {/* Day Summary Card */}
                    <div className="panel p-5 bg-white border border-[#e2e8e2] shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-[#edf1ee] pb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#285d47] block">
                            {activeDay.trackName || 'Learning Track'}
                          </span>
                          <h4 className="text-base font-extrabold text-[#1d2f26]">
                            Day {activeDay.day_number || activeDay.dayNumber}: {activeDay.title}
                          </h4>
                        </div>

                        {activeDay.is_completed ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#20603f] bg-[#e3f4ea] px-3 py-1 rounded-full border border-[#bfe2cf]">
                            <CheckCircle2 size={14} /> Completed by Student
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8a6825] bg-[#fbf5e2] px-3 py-1 rounded-full border border-[#f3e1b4]">
                            <Clock size={14} /> In Progress
                          </span>
                        )}
                      </div>

                      {/* Checklist & Tasks Completed by Student */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Checklist Section */}
                        <div className="p-3.5 rounded-xl bg-[#fafbfa] border border-[#e5ebe5] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#22352d] flex items-center gap-1.5">
                              <CheckSquare size={14} className="text-[#2b654e]" /> Section 4: Daily Checklist
                            </span>
                            <span className="text-[11px] font-bold text-[#295c47]">
                              {dayDetail?.checklist?.filter((c: any) => c.completed).length || 0} / {dayDetail?.checklist?.length || 0}
                            </span>
                          </div>

                          {dayDetail?.checklist && dayDetail.checklist.length > 0 ? (
                            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                              {dayDetail.checklist.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-2 p-2 rounded-lg bg-white border border-[#e9efe9] text-xs"
                                >
                                  {item.completed ? (
                                    <CheckCircle2 size={14} className="text-[#22724c] shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-[#b2c3b8] shrink-0" />
                                  )}
                                  <span className={item.completed ? 'font-medium text-[#21352c]' : 'text-[#7a8c82]'}>
                                    {item.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[#718279] italic">No checklist items set for this day.</p>
                          )}
                        </div>

                        {/* Daily Tasks Section */}
                        <div className="p-3.5 rounded-xl bg-[#fafbfa] border border-[#e5ebe5] space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#22352d] flex items-center gap-1.5">
                              <FileText size={14} className="text-[#2b654e]" /> Tasks Completed
                            </span>
                            <span className="text-[11px] font-bold text-[#295c47]">
                              {dayDetail?.daily_tasks?.filter((t: any) => t.is_completed || t.submission).length || 0} / {dayDetail?.daily_tasks?.length || 0}
                            </span>
                          </div>

                          {dayDetail?.daily_tasks && dayDetail.daily_tasks.length > 0 ? (
                            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                              {dayDetail.daily_tasks.map((task: any) => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#e9efe9] text-xs"
                                >
                                  <span className="font-medium text-[#21352c] truncate">{task.title}</span>
                                  {task.is_completed || task.submission ? (
                                    <span className="text-[10px] font-bold text-[#22724c] bg-[#e7f5ed] px-1.5 py-0.5 rounded">
                                      Done
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-[#7a8c82] bg-[#f0f2f0] px-1.5 py-0.5 rounded">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[#718279] italic">No daily tasks configured for this day.</p>
                          )}
                        </div>
                      </div>

                      {/* Section 5: Google Drive Word Document Evidence & Evaluation Form */}
                      <div className="p-5 rounded-xl bg-gradient-to-br from-[#f8faf8] to-[#edf4f0] border-2 border-[#b5dbca] space-y-4">
                        <div className="flex items-center justify-between border-b border-[#cde0d5] pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[#275947] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              5
                            </div>
                            <div>
                              <h5 className="text-sm font-black text-[#1e3229]">
                                Section 5: Student Google Drive Evidence Submission
                              </h5>
                              <p className="text-[11px] text-[#55695f]">
                                Verify the Word document link uploaded by the student and award points.
                              </p>
                            </div>
                          </div>

                          {dayDetail?.google_drive_submission?.status ? (
                            <StatusBadge status={dayDetail.google_drive_submission.status} />
                          ) : (
                            <span className="text-[11px] font-semibold text-[#8b6528] bg-[#fdf5df] px-2.5 py-0.5 rounded-full border border-[#f3e1b5]">
                              Not Submitted Yet
                            </span>
                          )}
                        </div>

                        {/* Submission Link Box */}
                        {(() => {
                          const driveUrl = dayDetail?.google_drive_submission?.google_drive_url || dayDetail?.google_drive_submission?.drive_url;
                          if (driveUrl) {
                            return (
                              <div className="p-4 bg-white rounded-xl border border-[#b2d5c3] shadow-xs flex flex-wrap items-center justify-between gap-4">
                                <div className="space-y-1.5 max-w-xl">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#436353] bg-[#eaf4ef] px-2 py-0.5 rounded">
                                      Student Uploaded Evidence Link
                                    </span>
                                    {dayDetail.google_drive_submission.attempt_number && (
                                      <span className="text-[10px] font-bold text-[#235841]">
                                        Attempt #{dayDetail.google_drive_submission.attempt_number}
                                      </span>
                                    )}
                                  </div>
                                  <a
                                    href={driveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-xs text-[#1e583e] hover:underline flex items-center gap-1.5 break-all"
                                  >
                                    <span className="truncate max-w-lg">{driveUrl}</span>
                                    <ExternalLink size={13} className="shrink-0 text-[#2b6d4e]" />
                                  </a>
                                  {dayDetail.google_drive_submission.notes && (
                                    <p className="text-xs text-[#526a5d] bg-[#f8faf8] p-2 rounded-lg border border-[#e3ebe4]">
                                      <strong className="text-[#2c4c3d]">Student Note:</strong> {dayDetail.google_drive_submission.notes}
                                    </p>
                                  )}
                                  <span className="text-[11px] text-[#697d72] block">
                                    Submitted on: {dayDetail.google_drive_submission.submitted_at ? new Date(dayDetail.google_drive_submission.submitted_at).toLocaleString() : 'Recently'}
                                  </span>
                                </div>

                                <a
                                  href={driveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-primary text-xs py-2.5 px-4 shadow-sm flex items-center gap-1.5 font-bold"
                                >
                                  <ExternalLink size={14} /> Open Document in Google Drive
                                </a>
                              </div>
                            );
                          }
                          return (
                            <div className="p-4 bg-white rounded-xl border border-dashed border-[#ccd9cf] text-center text-xs text-[#718279]">
                              The student has not yet submitted a Google Drive URL for Day {activeDay.day_number || activeDay.dayNumber}.
                            </div>
                          );
                        })()}

                        {/* Teacher Direct Review & Award Points Form */}
                        {dayDetail?.google_drive_submission && (
                          <form onSubmit={handleSaveEvaluation} className="p-4 bg-white rounded-xl border border-[#bcdbc9] space-y-4">
                            <div className="flex items-center justify-between border-b border-[#e8efe9] pb-2.5">
                              <span className="text-xs font-bold text-[#1e3329] flex items-center gap-1.5">
                                <Award size={15} className="text-[#a47018]" /> Instructor Grading & Reward Points Form
                              </span>
                              <span className="text-[11px] text-[#55695f]">
                                Direct submission verification
                              </span>
                            </div>

                            {/* Saved Evaluation Status Banner */}
                            {dayDetail.google_drive_submission.reviewed_at && (
                              <div className="p-3 rounded-xl bg-[#ecfdf5] border-2 border-[#a7f3d0] flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 size={16} className="text-[#059669]" />
                                  <span className="font-bold text-[#065f46]">
                                    Recorded Verdict: {dayDetail.google_drive_submission.status?.toUpperCase()} · Score: {dayDetail.google_drive_submission.rating || 0}/100
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-[#047857] bg-white px-2.5 py-0.5 rounded-md border border-[#a7f3d0]">
                                  +{dayDetail.google_drive_submission.additional_reward_points || 0} Bonus Points Credited
                                </span>
                              </div>
                            )}

                            {reviewSuccessMsg && (
                              <div className="p-3 bg-[#e2f5ea] border-2 border-[#a8dfc1] text-[#1c5d3a] rounded-lg text-xs font-bold flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-[#15803d]" /> {reviewSuccessMsg}
                              </div>
                            )}

                            {reviewErrorMsg && (
                              <div className="p-3 bg-[#faecea] border border-[#f5c6c2] text-[#b44033] rounded-lg text-xs font-medium flex items-center gap-2">
                                <AlertCircle size={16} /> {reviewErrorMsg}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Evaluation Status */}
                              <div>
                                <label className="text-[11px] font-bold text-[#3d5246] block mb-1">
                                  Verification Verdict:
                                </label>
                                <select
                                  value={reviewStatus}
                                  onChange={(e: any) => setReviewStatus(e.target.value)}
                                  className="field text-xs py-2 w-full font-semibold"
                                >
                                  <option value="approved">Approved ✅</option>
                                  <option value="changes_requested">Changes Requested ⚠️</option>
                                  <option value="rejected">Rejected ❌</option>
                                </select>
                              </div>

                              {/* Rating / Score */}
                              <div>
                                <label className="text-[11px] font-bold text-[#3d5246] block mb-1">
                                  Score / Rating (1 - 100):
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={reviewScore}
                                  onChange={(e) => setReviewScore(Number(e.target.value))}
                                  className="field text-xs py-2 w-full font-bold text-[#1f3529]"
                                />
                              </div>

                              {/* Additional Points */}
                              <div>
                                <label className="text-[11px] font-bold text-[#3d5246] block mb-1">
                                  Additional Points (0 - 50):
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={0}
                                    max={50}
                                    value={additionalPoints}
                                    onChange={(e) => setAdditionalPoints(Number(e.target.value))}
                                    className="field text-xs py-2 w-full font-bold text-[#20573e]"
                                  />
                                  <span className="absolute right-2.5 top-2 text-[10px] font-bold text-[#20573e]">
                                    +pts
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Review Comments */}
                            <div>
                              <label className="text-[11px] font-bold text-[#3d5246] block mb-1">
                                Feedback & Instructor Comments:
                              </label>
                              <textarea
                                value={reviewComments}
                                onChange={(e) => setReviewComments(e.target.value)}
                                placeholder="Write positive feedback, constructive suggestions, or notes for the student…"
                                rows={2}
                                className="field text-xs w-full"
                              />
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[#edf2ee]">
                              <span className="text-[11px] text-[#6a7c73]">
                                Approving awards base points + additional review points directly to the student's wallet.
                              </span>

                              <button
                                type="submit"
                                disabled={reviewMutation.isPending}
                                className="btn btn-primary text-xs py-2 px-5 font-bold shadow-sm flex items-center gap-1.5"
                              >
                                {reviewMutation.isPending ? 'Saving Evaluation…' : (
                                  <>
                                    <Check size={14} />
                                    {dayDetail.google_drive_submission.reviewed_at ? 'Update Evaluation & Award Points' : 'Submit Evaluation & Award Points'}
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="panel p-8 bg-white text-center text-xs text-[#718279]">
                    Select a learning day above to inspect and evaluate student progress.
                  </div>
                )}
              </>
            ) : (
              <div className="panel p-12 bg-white text-center">
                <EmptyState
                  title="Select a student from the list"
                  detail="Choose an assigned learner from the left panel to review their enrolled program curriculum, check off completed milestones, and score Google Drive evidence."
                  icon={GraduationCap}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MyStudentsPage;
