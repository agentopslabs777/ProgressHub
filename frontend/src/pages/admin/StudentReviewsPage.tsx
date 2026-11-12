import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Filter, Download, UserCheck, AlertCircle, Clock,
  CheckCircle2, FileSpreadsheet, Eye, RefreshCw, User, Users,
  X, ChevronRight, GraduationCap, BookOpen, Award, ExternalLink,
  Check, Lock, ChevronDown, ChevronUp, Layers, Edit3
} from 'lucide-react';
import { reviewsApi, programsApi, studentApi, submissionsApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState } from '@/components/common/UIComponents';

interface AdminDayReviewCardProps {
  day: any;
  studentId: string;
  onReviewSaved: () => void;
}

function AdminDayReviewCard({ day, studentId, onReviewSaved }: AdminDayReviewCardProps) {
  const sub = day.google_drive_submission;
  const prog = day.activity_progress || {};

  const [reviewStatus, setReviewStatus] = useState<string>(
    sub?.status && ['approved', 'changes_requested', 'rejected'].includes(sub.status) ? sub.status : 'approved'
  );
  const [reviewScore, setReviewScore] = useState<number>(sub?.rating || 85);
  const [additionalPoints, setAdditionalPoints] = useState<number>(
    typeof sub?.additional_reward_points === 'number' && sub.additional_reward_points > 0
      ? sub.additional_reward_points
      : 30
  );
  const [reviewComments, setReviewComments] = useState<string>(sub?.review_comments || '');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: fullDayDetail } = useQuery({
    queryKey: ['admin_student_day_detail', day.id, studentId],
    queryFn: () => studentApi.getDayDetails(day.id, studentId),
    enabled: !!day.id && !!studentId,
    staleTime: 30000
  });

  const activeSub = fullDayDetail?.google_drive_submission || sub;

  useEffect(() => {
    if (activeSub) {
      if (activeSub.status && ['approved', 'changes_requested', 'rejected'].includes(activeSub.status)) {
        setReviewStatus(activeSub.status);
      }
      if (activeSub.rating) setReviewScore(activeSub.rating);
      if (typeof activeSub.additional_reward_points === 'number' && activeSub.additional_reward_points > 0) {
        setAdditionalPoints(activeSub.additional_reward_points);
      }
      if (activeSub.review_comments) setReviewComments(activeSub.review_comments);
    }
  }, [activeSub?.id, activeSub?.status, activeSub?.rating]);

  const reviewMutation = useMutation({
    mutationFn: (data: any) => submissionsApi.reviewGoogleDrive(activeSub.id, data),
    onSuccess: (res: any) => {
      const extra = res?.additional_reward_points ? ` (+${res.additional_reward_points} pts added to student wallet)` : '';
      setSuccessMsg(`Evaluation and score saved successfully!${extra}`);
      setErrorMsg('');
      onReviewSaved();
      setTimeout(() => setSuccessMsg(''), 7000);
    },
    onError: (err: any) => {
      setSuccessMsg('');
      setErrorMsg(err.message || 'Failed to submit review');
    }
  });

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSub?.id) {
      setErrorMsg('No Google Drive submission record found to review for this day.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('Saving evaluation and awarding points to student...');
    reviewMutation.mutate({
      status: reviewStatus,
      rating: Number(reviewScore),
      additional_reward_points: Number(additionalPoints),
      review_comments: reviewComments.trim() || 'Reviewed and approved by administrator.'
    });
  };

  const driveUrl = activeSub?.google_drive_url || activeSub?.drive_url;
  const isCompleted = day.completed || day.is_completed;
  const isUnlocked = day.is_unlocked;

  return (
    <div
      id={`day-card-${day.day_number || day.dayNumber}`}
      className="panel p-5 bg-white border border-[#e2e8e2] rounded-2xl shadow-sm space-y-4"
    >
      {/* Day Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ee] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xs text-[#285d47] uppercase tracking-wider bg-[#e6f4ec] px-2.5 py-0.5 rounded-full border border-[#bde4ce]">
              Day {day.day_number || day.dayNumber}
            </span>
            <span className="text-[11px] font-semibold text-[#667a6e]">
              {day.trackName || 'Module'}
            </span>
            {isCompleted ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#166534] bg-[#dcfce7] px-2 py-0.5 rounded-full border border-[#86efac]">
                <CheckCircle2 size={12} /> Completed
              </span>
            ) : isUnlocked ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1e40af] bg-[#dbeafe] px-2 py-0.5 rounded-full border border-[#93c5fd]">
                <Clock size={12} /> In Progress
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded-full border border-[#cbd5e1]">
                <Lock size={12} /> Locked
              </span>
            )}
          </div>
          <h4 className="text-sm font-bold text-[#1d2f26] mt-1">{day.title}</h4>
        </div>
      </div>

      {/* Sections 1 to 4 Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-xl border border-[#e0eae2] bg-[#f9fbf9]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#697d72] block">01. Summary</span>
          <span className="text-xs font-semibold text-[#1f3128] mt-0.5 flex items-center gap-1">
            {prog.summary_viewed ? <Check size={13} className="text-[#15803d]" /> : <Clock size={13} className="text-[#a16207]" />}
            {prog.summary_viewed ? 'Completed' : 'Pending'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl border border-[#e0eae2] bg-[#f9fbf9]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#697d72] block">02. Main Video</span>
          <span className="text-xs font-semibold text-[#1f3128] mt-0.5 flex items-center gap-1">
            {prog.video_watched ? <Check size={13} className="text-[#15803d]" /> : <Clock size={13} className="text-[#a16207]" />}
            {prog.video_watched ? 'Watched' : 'Pending'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl border border-[#e0eae2] bg-[#f9fbf9]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#697d72] block">03. Quiz Score</span>
          <span className="text-xs font-bold text-[#1f3128] mt-0.5 flex items-center gap-1">
            {prog.quiz_score !== null && prog.quiz_score !== undefined ? (
              <span className="text-[#15803d] font-black">{prog.quiz_score} / 100</span>
            ) : prog.quiz_completed ? (
              <span className="text-[#15803d]">Completed</span>
            ) : (
              <span className="text-[#64748b]">Not Taken</span>
            )}
          </span>
        </div>

        <div className="p-2.5 rounded-xl border border-[#e0eae2] bg-[#f9fbf9]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#697d72] block">04. Assignment</span>
          <span className="text-xs font-semibold text-[#1f3128] mt-0.5 flex items-center gap-1">
            {prog.assignment_completed || isCompleted ? <Check size={13} className="text-[#15803d]" /> : <Clock size={13} className="text-[#a16207]" />}
            {prog.assignment_completed || isCompleted ? 'Completed' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Section 5: Student Google Drive Submission */}
      {driveUrl ? (
        <div className="p-4 bg-[#f2f8f4] rounded-xl border border-[#b8ddc6] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#14442f] flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-[#1e7e52]" />
              Section 5: Student Google Drive Evidence Submission
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-[#b8ddc6] text-[#1c5f3e]">
              Attempt #{activeSub?.attempt_number || 1}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-lg border border-[#cbe1d3]">
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-xs text-[#1e583e] hover:underline flex items-center gap-1.5 break-all"
            >
              <span className="truncate max-w-lg">{driveUrl}</span>
              <ExternalLink size={13} className="shrink-0 text-[#2b6d4e]" />
            </a>
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary text-xs py-1.5 px-3 shadow-xs flex items-center gap-1 font-bold"
            >
              <ExternalLink size={13} /> Open Document in Google Drive
            </a>
          </div>

          {activeSub?.notes && (
            <p className="text-xs text-[#526a5d] bg-white p-2 rounded-lg border border-[#e3ebe4]">
              <strong className="text-[#2c4c3d]">Student Note:</strong> {activeSub.notes}
            </p>
          )}
        </div>
      ) : (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-[#64748b]">
          The student has not yet submitted a Google Drive URL for Day {day.day_number || day.dayNumber}.
        </div>
      )}

      {/* Admin Grading & Review Form */}
      {activeSub && (
        <form onSubmit={handleSaveEvaluation} className="p-4 bg-white rounded-xl border border-[#bcdbc9] space-y-3">
          <div className="flex items-center justify-between border-b border-[#e8efe9] pb-2">
            <span className="text-xs font-bold text-[#1e3329] flex items-center gap-1.5">
              <Award size={15} className="text-[#a47018]" /> Instructor Grading & Reward Points Form
            </span>
            <span className="text-[11px] text-[#55695f]">Direct submission verification</span>
          </div>

          {activeSub.reviewed_at && (
            <div className="p-2.5 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#065f46]">
                Recorded Verdict: {activeSub.status?.toUpperCase()} · Score: {activeSub.rating || 0}/100
              </span>
              <span className="text-[11px] font-bold text-[#047857] bg-white px-2 py-0.5 rounded border border-[#a7f3d0]">
                +{activeSub.additional_reward_points || 0} Bonus Points Credited
              </span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 bg-[#e2f5ea] border border-[#a8dfc1] text-[#1c5d3a] rounded-lg text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#15803d]" /> {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 bg-[#faecea] border border-[#f5c6c2] text-[#b44033] rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#3d5246] block mb-1">Verification Verdict:</label>
              <select
                value={reviewStatus}
                onChange={(e: any) => setReviewStatus(e.target.value)}
                className="field text-xs py-1.5 w-full font-semibold"
              >
                <option value="approved">Approved ✅</option>
                <option value="changes_requested">Changes Requested ⚠️</option>
                <option value="rejected">Rejected ❌</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#3d5246] block mb-1">Score / Rating (1 - 100):</label>
              <input
                type="number"
                min={1}
                max={100}
                value={reviewScore}
                onChange={(e) => setReviewScore(Number(e.target.value))}
                className="field text-xs py-1.5 w-full font-bold text-[#1f3529]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#3d5246] block mb-1">Additional Points (0 - 50):</label>
              <input
                type="number"
                min={0}
                max={50}
                value={additionalPoints}
                onChange={(e) => setAdditionalPoints(Number(e.target.value))}
                className="field text-xs py-1.5 w-full font-bold text-[#1f3529]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#3d5246] block mb-1">Feedback & Instructor Comments:</label>
            <textarea
              rows={2}
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder="Provide constructive feedback on the student's submission..."
              className="field text-xs w-full"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={reviewMutation.isPending}
              className="btn btn-primary text-xs py-2 px-4 shadow-xs font-bold flex items-center gap-1.5"
            >
              <Check size={14} />
              {reviewMutation.isPending ? 'Saving...' : 'Submit Evaluation & Award Points'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function StudentReviewsPage() {
  const queryClient = useQueryClient();
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'vertical'>('spreadsheet');

  // Fetch available programs for dropdown
  const { data: programs = [] } = useQuery({
    queryKey: ['programs_for_reviews'],
    queryFn: programsApi.list
  });

  // Automatically select first program if none chosen yet
  useEffect(() => {
    if (!selectedProgramId && programs.length > 0) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId]);

  // Fetch performance metrics overview
  const { data: overview } = useQuery({
    queryKey: ['reviews_overview', selectedProgramId],
    queryFn: () => reviewsApi.getOverview(selectedProgramId || undefined)
  });

  // Fetch spreadsheet data with placeholderData so data doesn't flicker away
  const { data: sheetData, isLoading: sheetLoading, isError, refetch } = useQuery({
    queryKey: ['reviews_spreadsheet', selectedProgramId, selectedStudentId, search, statusFilter],
    queryFn: () => reviewsApi.getSpreadsheet({
      program_id: selectedProgramId || undefined,
      student_id: (selectedStudentId && selectedStudentId !== 'ALL') ? selectedStudentId : undefined,
      search: search || undefined,
      status_filter: statusFilter || undefined
    }),
    placeholderData: (previousData) => previousData
  });

  const columns = sheetData?.columns || [];
  const rows = sheetData?.rows || [];
  const enrolledStudents: any[] = sheetData?.enrolled_students || [];

  // Automatically select the first enrolled student when a program is selected and no student chosen yet
  useEffect(() => {
    if (enrolledStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(enrolledStudents[0].id);
    }
  }, [enrolledStudents, selectedStudentId]);


  // Find currently selected student object
  const currentStudent = enrolledStudents.find((s: any) => s.id === selectedStudentId);

  // Filter student suggestions for the search autocomplete
  const searchSuggestions = search.trim()
    ? enrolledStudents.filter((s: any) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      )
    : enrolledStudents;

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    if (studentId === 'ALL') {
      setSearch('');
    } else if (studentId) {
      const found = enrolledStudents.find((s: any) => s.id === studentId);
      if (found) setSearch(found.name);
    } else {
      setSearch('');
    }
    setSearchDropdownOpen(false);
  };

  const handleClearSelection = () => {
    setSelectedStudentId('');
    setSearch('');
    setSearchDropdownOpen(false);
  };

  const targetProgId = currentStudent?.program_id || selectedProgramId;
  const { data: adminStudentProgress = [], isLoading: isAdminProgLoading } = useQuery({
    queryKey: ['admin_student_progress', targetProgId, currentStudent?.id],
    queryFn: () => {
      if (!targetProgId || !currentStudent?.id) return Promise.resolve([]);
      return studentApi.getProgramProgress(targetProgId, currentStudent.id);
    },
    enabled: !!targetProgId && !!currentStudent?.id,
    staleTime: 30000
  });

  const allAdminDays: any[] = [];
  adminStudentProgress.forEach((track: any) => {
    const tId = track.trackId || track.track_id || track.id;
    if (track.days) {
      track.days.forEach((day: any) => {
        allAdminDays.push({
          ...day,
          trackId: tId,
          trackName: track.name
        });
      });
    }
  });

  const displayedAdminDays = allAdminDays.filter((d: any) => {
    if (selectedTrackId && selectedTrackId !== 'ALL') {
      return d.trackId === selectedTrackId;
    }
    return true;
  });

  const handleAdminReviewSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['admin_student_progress'] });
    queryClient.invalidateQueries({ queryKey: ['reviews_spreadsheet'] });
    queryClient.invalidateQueries({ queryKey: ['reviews_overview'], refetchType: 'none' });
    queryClient.invalidateQueries({ queryKey: ['student_day'], refetchType: 'none' });
    queryClient.invalidateQueries({ queryKey: ['wallet'], refetchType: 'none' });
  };

  const handleExportCsv = () => {
    const url = reviewsApi.getExportCsvUrl({
      program_id: selectedProgramId || undefined,
      student_id: (selectedStudentId && selectedStudentId !== 'ALL') ? selectedStudentId : undefined,
      search: search || undefined,
      status_filter: statusFilter || undefined
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow="Student Evaluation & Analytics"
        title="Student Reviews & Performance Report"
        description="Comprehensive spreadsheet worksheet dynamically generated from program curriculum, tracking submodules, daily quiz scores, assignments, Google Drive links, and faculty reviews."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="btn btn-soft text-xs"
              title="Refresh spreadsheet data"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={handleExportCsv}
              className="btn btn-primary text-xs font-bold"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>
        }
      />

      {/* Program Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Total Enrolled</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#21342c]">{overview?.total_students ?? 0}</span>
            <span className="text-xs text-[#52655c] font-medium">{overview?.active_students ?? 0} active</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Average Completion</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#285d47]">{overview?.avg_completion_rate ?? 0}%</span>
            <span className="text-xs text-[#73847c]">Curriculum progress</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Submissions Pending</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#b5583b]">{overview?.pending_reviews_count ?? 0}</span>
            <span className="text-xs text-[#9c693a] font-medium">Awaiting evaluation</span>
          </div>
        </div>

        <div className="panel p-4 bg-white border border-[#e4ebe4]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#73847c] block">Student Uploaded Links</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#2f5e82]">{overview?.pending_drive_submissions ?? 0}</span>
            <span className="text-xs text-[#5f7480]">Ready for score</span>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="panel p-4 bg-white border border-[#e4ebe4]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Program Selector */}
            <div className="min-w-[190px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#72837b] block mb-1">
                Program
              </label>
              <select
                value={selectedProgramId}
                onChange={(e) => {
                  setSelectedProgramId(e.target.value);
                  setSelectedStudentId('');
                  setSelectedTrackId('ALL');
                  setSearch('');
                }}
                className="field text-xs py-1.5 w-full font-medium"
              >
                <option value="">All Programs / Default Program</option>
                {programs.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Student Selector Dropdown */}
            <div className="min-w-[230px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#72837b] block mb-1">
                Select Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => handleSelectStudent(e.target.value)}
                className="field text-xs py-1.5 w-full font-semibold text-[#1f3128] border-[#a9c9b6] bg-[#f8fbf9]"
              >
                <option value="">-- Choose a Student to View --</option>
                <option value="ALL">👥 All Students (Show All in Table)</option>
                {enrolledStudents.length > 0 && (
                  <optgroup label="Enrolled Students">
                    {enrolledStudents.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email}) — {s.progress}%
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Module Selector Dropdown */}
            {adminStudentProgress.length > 0 && (
              <div className="min-w-[190px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#72837b] block mb-1">
                  Module / Subject
                </label>
                <select
                  value={selectedTrackId}
                  onChange={(e) => setSelectedTrackId(e.target.value)}
                  className="field text-xs py-1.5 w-full font-semibold text-[#1f3128] border-[#a9c9b6] bg-[#f8fbf9]"
                >
                  <option value="ALL">🌐 All Modules ({adminStudentProgress.length})</option>
                  {adminStudentProgress.map((track: any) => (
                    <option key={track.trackId || track.id} value={track.trackId || track.id}>
                      {track.name} ({track.days?.length || 0} submodules)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#72837b] block mb-1">
                Search Student Name / Email
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-[#93a39b]" />
                <input
                  type="text"
                  placeholder="Type to filter learners…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchDropdownOpen(true);
                  }}
                  onFocus={() => setSearchDropdownOpen(true)}
                  className="field pl-8 text-xs py-1.5 w-full"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setSearchDropdownOpen(false);
                    }}
                    className="absolute right-2 top-2 text-[#93a39b] hover:text-[#333]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {searchDropdownOpen && search && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setSearchDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#cbe0d3] rounded-lg shadow-xl z-40 max-h-64 overflow-y-auto divide-y divide-[#edf3ef]">
                    <div className="px-3 py-1.5 bg-[#f4f8f5] text-[10px] font-bold text-[#5c7367] uppercase tracking-wider flex items-center justify-between">
                      <span>Select Student from Search ({searchSuggestions.length})</span>
                      <button
                        onClick={() => setSearchDropdownOpen(false)}
                        className="text-[#889a91] hover:text-[#333]"
                      >
                        <X size={11} />
                      </button>
                    </div>

                    {searchSuggestions.length === 0 ? (
                      <div className="p-3 text-center text-xs text-[#7c8f85]">
                        No students matching "{search}"
                      </div>
                    ) : (
                      searchSuggestions.map((stu: any) => (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => handleSelectStudent(stu.id)}
                          className={`w-full text-left px-3 py-2 hover:bg-[#eef7f2] transition flex items-center justify-between gap-2 ${
                            selectedStudentId === stu.id ? 'bg-[#e7f5ec] font-semibold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#285d47] text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {stu.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-semibold text-[#1e3028] leading-tight truncate">
                                {stu.name}
                              </p>
                              <p className="text-[11px] text-[#607369] leading-tight truncate">
                                {stu.email}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#235841] bg-[#dcf2e5] px-1.5 py-0.5 rounded border border-[#bde4ce]">
                              {stu.progress}%
                            </span>
                            <span className="text-[10px] text-[#697c72] capitalize hidden sm:inline">
                              {stu.status}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="self-end pb-1.5">
            <span className="text-xs text-[#6e7e76] font-medium">
              Showing <strong className="text-[#23352e]">{enrolledStudents.length || rows.length}</strong> enrolled student(s)
            </span>
          </div>
        </div>
      </div>

      {/* Selected Student Banner */}
      {currentStudent && (
        <div className="panel p-4 bg-gradient-to-r from-[#edf6f1] via-white to-[#f4f9f6] border border-[#a8d3bc] shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#235841] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
              {currentStudent.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-[#1a2c24]">{currentStudent.name}</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#d6eedf] text-[#195037] border border-[#a2d4b7]">
                  {currentStudent.status}
                </span>
                <span className="text-xs text-[#526a5e] font-medium">
                  • Instructor: <strong className="text-[#21352a]">{currentStudent.teacher_name || 'Unassigned'}</strong>
                </span>
              </div>
              <p className="text-xs text-[#526a5e] mt-0.5">{currentStudent.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#687f73] block">
                Overall Progress
              </span>
              <span className="text-xl font-black text-[#21573f]">{currentStudent.progress}%</span>
            </div>
            <div className="w-28 bg-[#d8e6de] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#245842] h-full rounded-full transition-all duration-300"
                style={{ width: `${currentStudent.progress}%` }}
              />
            </div>
            <button
              onClick={handleClearSelection}
              className="btn btn-soft text-xs text-[#51675c] hover:text-[#1c2e25] flex items-center gap-1 ml-2"
              title="Clear selection and view student picker"
            >
              <X size={13} /> Change Student
            </button>
          </div>
        </div>
      )}

      {/* VIEW MODE TOGGLE (When a single student is chosen) */}
      {currentStudent && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8e2] pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#eef3ef] rounded-xl border border-[#d6e3da] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('spreadsheet')}
              className={`rounded-lg px-3.5 py-1.5 font-bold transition flex items-center gap-1.5 ${
                viewMode === 'spreadsheet' ? 'bg-[#255e46] text-white shadow-xs' : 'text-[#5a6e63] hover:text-[#21352d]'
              }`}
            >
              <FileSpreadsheet size={14} /> Spreadsheet View (5 Columns)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('vertical')}
              className={`rounded-lg px-3.5 py-1.5 font-bold transition flex items-center gap-1.5 ${
                viewMode === 'vertical' ? 'bg-[#255e46] text-white shadow-xs' : 'text-[#5a6e63] hover:text-[#21352d]'
              }`}
            >
              <BookOpen size={14} /> Day-by-Day Process View (Cards)
            </button>
          </div>
          <span className="text-[11px] text-[#697c72]">
            {viewMode === 'spreadsheet'
              ? 'Displaying 5-Column Day Worksheet: Submodule Name | Status | Quiz Marks | Assignment Link | Faculty Review'
              : 'Displaying sequential daily learning progression & grading cards'}
          </span>
        </div>
      )}

      {/* 1. SPREADSHEET 5-COLUMN VIEW (When a student is picked and viewMode === 'spreadsheet') */}
      {currentStudent && viewMode === 'spreadsheet' && (
        <div className="panel overflow-hidden bg-white border border-[#e4ebe4]">
          <div className="p-3.5 bg-[#f4f7f4] border-b border-[#d8e2d9] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-[#1d2f26] flex items-center gap-1.5">
                <FileSpreadsheet size={15} className="text-[#285d47]" />
                Curriculum Progression Worksheet · {currentStudent.name}
              </h4>
              <span className="text-[11px] text-[#63766d]">
                Submodule Name · Status · Quiz Marks · Assignment Link · Faculty Review
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#285d47] bg-[#e5f4eb] px-2.5 py-1 rounded-full border border-[#bde4ce]">
              {displayedAdminDays.length} Submodules / Days
            </span>
          </div>

          {/* INTERACTIVE MODULE TABS (Python, AWS, C...) */}
          {adminStudentProgress.length > 0 && (
            <div className="p-3 bg-[#f3f7f4] border-b border-[#d8e4dc] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4d6657] mr-1 flex items-center gap-1">
                  <Layers size={13} className="text-[#255f46]" /> Course Modules:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTrackId('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    selectedTrackId === 'ALL'
                      ? 'bg-[#255e46] text-white shadow-xs'
                      : 'bg-white text-[#45584e] border border-[#d6e0d8] hover:bg-[#eaf1ec]'
                  }`}
                >
                  <span>All Modules</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selectedTrackId === 'ALL' ? 'bg-white/20 text-white' : 'bg-[#eef4f0] text-[#2c5b48]'}`}>
                    {allAdminDays.length}
                  </span>
                </button>

                {adminStudentProgress.map((track: any) => {
                  const tId = track.trackId || track.track_id || track.id;
                  const isSelected = selectedTrackId === tId;
                  const totalDays = track.totalDays || track.days?.length || 0;
                  const completedDays = track.completedDays || track.days?.filter((d: any) => d.completed || d.is_completed).length || 0;
                  return (
                    <button
                      key={tId}
                      type="button"
                      onClick={() => setSelectedTrackId(tId)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        isSelected
                          ? 'bg-[#255e46] text-white shadow-xs ring-2 ring-[#255e46]/20'
                          : 'bg-white text-[#334b3e] border border-[#d2ded5] hover:bg-[#ebf4ee]'
                      }`}
                    >
                      <span>{track.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${isSelected ? 'bg-white/25 text-white' : 'bg-[#e5f1ea] text-[#1e583f]'}`}>
                        {completedDays}/{totalDays} Submodules
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] font-semibold text-[#375a48] bg-white px-3 py-1 rounded-lg border border-[#cfe0d5]">
                Showing <span className="font-bold text-[#1f4a36]">{displayedAdminDays.length}</span> submodules
                {selectedTrackId !== 'ALL' && (
                  <span> in <span className="font-bold text-[#235842]">{adminStudentProgress.find((t: any) => (t.trackId || t.track_id || t.id) === selectedTrackId)?.name}</span></span>
                )}
              </div>
            </div>
          )}

          {isAdminProgLoading ? (
            <div className="p-12">
              <LoadingState label="Loading student curriculum progress and evaluation records..." />
            </div>
          ) : displayedAdminDays.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6e7e76]">
              No curriculum days configured yet for this module.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead className="sticky top-0 bg-[#eef4f0] z-10 border-b border-[#cbdad0]">
                  <tr>
                    <th className="px-4 py-3 font-bold text-[#23352e] border-r border-[#d4e3d8] w-[26%]">
                      Submodule Name
                    </th>
                    <th className="px-4 py-3 font-bold text-[#23352e] border-r border-[#d4e3d8] w-[14%] text-center">
                      Status
                    </th>
                    <th className="px-4 py-3 font-bold text-[#23352e] border-r border-[#d4e3d8] w-[16%] text-center">
                      Quiz (Marks)
                    </th>
                    <th className="px-4 py-3 font-bold text-[#23352e] border-r border-[#d4e3d8] w-[22%]">
                      Assignment (Link Submitted or Not)
                    </th>
                    <th className="px-4 py-3 font-bold text-[#23352e] w-[22%]">
                      Faculty Review
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebf1eb]">
                  {displayedAdminDays.map((d: any) => {
                    const sub = d.google_drive_submission;
                    const prog = d.activity_progress || {};
                    const isCompleted = d.completed || d.is_completed;
                    const isUnlocked = d.is_unlocked;

                    // 1. Status badge
                    let statusBadge;
                    if (isCompleted) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#166534] bg-[#dcfce7] px-2.5 py-1 rounded-full border border-[#86efac]">
                          <CheckCircle2 size={12} /> Completed
                        </span>
                      );
                    } else if (sub && (sub.status === 'submitted' || sub.status === 'under_review')) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#854d0e] bg-[#fef9c3] px-2.5 py-1 rounded-full border border-[#fde047]">
                          <Clock size={12} /> Under Review
                        </span>
                      );
                    } else if (d.status === 'locked' || !isUnlocked) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748b] bg-[#f1f5f9] px-2.5 py-1 rounded-full border border-[#cbd5e1]">
                          <Lock size={12} /> Locked
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e40af] bg-[#dbeafe] px-2.5 py-1 rounded-full border border-[#93c5fd]">
                          <Clock size={12} /> In Progress
                        </span>
                      );
                    }

                    // 2. Quiz Marks
                    let quizContent;
                    if (prog.quiz_score !== null && prog.quiz_score !== undefined) {
                      quizContent = (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-[#0f172a] bg-[#f1f5f9] px-2.5 py-1 rounded-md border border-[#cbd5e1]">
                            {prog.quiz_score} / 100
                          </span>
                          <span className="text-[10px] font-bold text-[#166534] bg-[#dcfce7] px-1.5 py-0.5 rounded border border-[#86efac]">
                            Recorded
                          </span>
                        </div>
                      );
                    } else if (prog.quiz_completed) {
                      quizContent = (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Completed
                        </span>
                      );
                    } else {
                      quizContent = <span className="text-xs text-slate-400 font-medium italic">Pending / Not Taken</span>;
                    }

                    // 3. Assignment link submitted or not
                    const driveUrl = sub?.google_drive_url || sub?.drive_url;
                    let assignmentContent;
                    if (driveUrl) {
                      assignmentContent = (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#065f46] bg-[#ecfdf5] px-2 py-0.5 rounded border border-[#a7f3d0]">
                              <Check size={11} /> Submitted (Attempt #{sub.attempt_number || 1})
                            </span>
                          </div>
                          <div>
                            <a
                              href={driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-[#0047ba] hover:underline bg-[#eff6ff] hover:bg-[#dbeafe] px-2.5 py-1 rounded-md border border-[#bfdbfe] transition"
                              title="Open uploaded assignment document in Google Drive"
                            >
                              <ExternalLink size={12} /> Open Document
                            </a>
                          </div>
                        </div>
                      );
                    } else {
                      assignmentContent = <span className="text-xs text-slate-400 font-medium italic">Not Submitted</span>;
                    }

                    // 4. Faculty Review
                    let reviewContent;
                    if (sub && sub.reviewed_at) {
                      reviewContent = (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              sub.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : sub.status === 'changes_requested'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {sub.status === 'approved' ? 'Approved ✅' : sub.status === 'changes_requested' ? 'Changes Requested ⚠️' : 'Rejected ❌'}
                            </span>
                            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              Score: {sub.rating || 0}/100
                            </span>
                            {sub.additional_reward_points > 0 && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                +{sub.additional_reward_points} pts
                              </span>
                            )}
                          </div>
                          {sub.review_comments && (
                            <p className="text-xs text-[#334155] bg-[#f8fafc] p-1.5 rounded border border-slate-200 italic line-clamp-2">
                              "{sub.review_comments}"
                            </p>
                          )}
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setViewMode('vertical');
                                setTimeout(() => {
                                  document.getElementById(`day-card-${d.day_number || d.dayNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#285d47] hover:underline bg-[#edf6f1] px-2 py-0.5 rounded border border-[#cbe0d3] transition"
                            >
                              <Edit3 size={11} /> Update Review
                            </button>
                          </div>
                        </div>
                      );
                    } else if (sub) {
                      reviewContent = (
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            <Clock size={12} /> Awaiting Faculty Review
                          </span>
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setViewMode('vertical');
                                setTimeout(() => {
                                  document.getElementById(`day-card-${d.day_number || d.dayNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#285d47] hover:underline bg-[#edf6f1] px-2.5 py-1 rounded border border-[#cbe0d3] transition"
                            >
                              <Award size={12} /> Grade / Review Now
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      reviewContent = <span className="text-xs text-slate-400 font-medium italic">Pending Evaluation</span>;
                    }

                    return (
                      <tr key={d.id} className="hover:bg-[#f9fbf9] transition">
                        <td className="px-4 py-3.5 border-r border-[#ebf1eb]">
                          <span className="font-bold text-xs text-[#1e293b] block">
                            Day {d.day_number || d.dayNumber}: {d.title}
                          </span>
                          <span className="text-[11px] text-[#64748b] block mt-0.5">
                            {d.trackName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#ebf1eb] text-center">
                          {statusBadge}
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#ebf1eb] text-center">
                          {quizContent}
                        </td>
                        <td className="px-4 py-3.5 border-r border-[#ebf1eb]">
                          {assignmentContent}
                        </td>
                        <td className="px-4 py-3.5">
                          {reviewContent}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. VERTICAL DAY-BY-DAY PROGRESSION VIEW (When a single student is chosen and viewMode === 'vertical') */}
      {currentStudent && viewMode === 'vertical' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#45574f] flex items-center gap-1.5">
              <BookOpen size={14} className="text-[#285d47]" />
              Student Curriculum Progression ({displayedAdminDays.length} Submodules)
              {selectedTrackId !== 'ALL' && (
                <span className="text-[#255e46] font-normal"> · {adminStudentProgress.find((t: any) => (t.trackId || t.track_id || t.id) === selectedTrackId)?.name}</span>
              )}
            </h3>
            <span className="text-[11px] text-[#6e7e76]">
              Sequential Day-by-Day Progress & Evidence Evaluations
            </span>
          </div>

          {/* Quick Scroll Navigation Bar */}
          {displayedAdminDays.length > 0 && (
            <div className="p-2.5 bg-white border border-[#e2e8e2] rounded-xl flex items-center gap-2 overflow-x-auto shadow-2xs">
              <span className="text-[10px] font-bold text-[#62776c] uppercase shrink-0">Jump To Day:</span>
              <div className="flex items-center gap-1.5">
                {displayedAdminDays.map((d: any) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      document.getElementById(`day-card-${d.day_number || d.dayNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition flex items-center gap-1 border shrink-0 ${
                      d.completed || d.is_completed
                        ? 'bg-[#e1f5ea] text-[#166534] border-[#a7f3d0] hover:bg-[#cbf2db]'
                        : 'bg-[#f4f7f4] text-[#475b52] border-[#d4ded7] hover:bg-[#e6efe8]'
                    }`}
                  >
                    <span>Day {d.day_number || d.dayNumber}</span>
                    {(d.completed || d.is_completed) && <CheckCircle2 size={10} className="text-[#166534]" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isAdminProgLoading ? (
            <LoadingState label="Loading student curriculum days and submissions..." />
          ) : displayedAdminDays.length === 0 ? (
            <div className="panel p-8 bg-white border border-[#e2e8e2] text-center text-xs text-[#718279] rounded-2xl">
              No curriculum submodules configured yet for this module.
            </div>
          ) : (
            displayedAdminDays.map((d: any) => (
              <AdminDayReviewCard
                key={d.id}
                day={d}
                studentId={currentStudent.id}
                onReviewSaved={handleAdminReviewSaved}
              />
            ))
          )}
        </div>
      )}

      {/* 3. MULTI-STUDENT SELECTION OR OVERVIEW (When no student is picked or ALL chosen) */}
      {!currentStudent && (
        <>
          {enrolledStudents.length > 0 && (
            <div className="panel p-5 bg-white border border-[#e4ebe4] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#1f3128] flex items-center gap-2">
                    <GraduationCap size={16} className="text-[#255b44]" />
                    Select a Student to View Performance Worksheet
                  </h3>
                  <p className="text-xs text-[#63766d] mt-0.5">
                    Click any student below to view their 5-column Day progression, quiz scores, assignment links, and faculty reviews:
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStudentId('ALL')}
                  className="btn btn-soft text-xs text-[#285d47] font-semibold flex items-center gap-1"
                >
                  <Users size={13} /> View All in Table
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {enrolledStudents.map((stu: any) => (
                  <div
                    key={stu.id}
                    onClick={() => handleSelectStudent(stu.id)}
                    className="p-3.5 rounded-lg border border-[#d8e5dc] hover:border-[#285d47] hover:bg-[#f6fbf8] transition cursor-pointer flex flex-col justify-between gap-3 group bg-white shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#e3f0e8] group-hover:bg-[#285d47] group-hover:text-white text-[#245842] font-bold text-xs flex items-center justify-center transition">
                          {stu.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#1d2f26] group-hover:text-[#285d47] transition">
                            {stu.name}
                          </h4>
                          <p className="text-[11px] text-[#63766d] truncate max-w-[170px]">{stu.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#235841] bg-[#e5f4eb] px-1.5 py-0.5 rounded border border-[#bde4ce]">
                        {stu.progress}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#edf3ee] text-[11px]">
                      <span className="text-[#6d8076]">
                        Instructor: <strong>{stu.teacher_name || 'Unassigned'}</strong>
                      </span>
                      <span className="font-semibold text-[#285d47] flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
                        View Worksheet <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback Table for ALL students */}
          <div className="panel overflow-hidden bg-white border border-[#e4ebe4]">
            {sheetLoading ? (
              <div className="p-12">
                <LoadingState label="Compiling curriculum worksheet and student evaluations" />
              </div>
            ) : isError ? (
              <div className="p-8">
                <ErrorState retry={() => refetch()} />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  title="No student evaluations found"
                  detail="When students enroll and progress through the curriculum, their records will appear here."
                  icon={FileSpreadsheet}
                />
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
                  <thead className="sticky top-0 bg-[#f4f7f4] z-10 border-b border-[#d8e2d9]">
                    <tr>
                      {columns.map((col: any) => (
                        <th
                          key={col.key}
                          className="px-3.5 py-3 font-bold text-[#35483e] whitespace-nowrap border-r border-[#e0eae1] last:border-r-0"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ebf1eb]">
                    {rows.map((row: any, rIdx: number) => (
                      <tr key={row.enrollment_id || rIdx} className="hover:bg-[#f9fbf9] transition">
                        {columns.map((col: any) => {
                          const val = row[col.key];
                          const isStatusCol = col.key.endsWith('_status');
                          const isDriveCol = col.key.endsWith('_drive');

                          let cellContent = val;

                          if (isStatusCol) {
                            if (val === 'Completed') {
                              cellContent = (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#205e42] bg-[#e1f3ea] px-2 py-0.5 rounded border border-[#bde4ce]">
                                  <CheckCircle2 size={11} /> Completed
                                </span>
                              );
                            } else if (val === 'Pending Review') {
                              cellContent = (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8f6424] bg-[#fbf2dc] px-2 py-0.5 rounded border border-[#f5deaa]">
                                  <Clock size={11} /> Review Pending
                                </span>
                              );
                            } else {
                              cellContent = (
                                <span className="text-[11px] text-[#6b7b73] font-medium">
                                  {val || 'In Progress'}
                                </span>
                              );
                            }
                          } else if (isDriveCol && val && val !== 'Not Submitted') {
                            const match = String(val).match(/\((https?:\/\/[^\)]+)\)/);
                            const url = match ? match[1] : null;
                            cellContent = url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#2b604b] font-semibold hover:underline inline-flex items-center gap-1"
                              >
                                <Eye size={12} /> Student Link
                              </a>
                            ) : (
                              <span className="text-[#43554d]">{val}</span>
                            );
                          }

                          return (
                            <td
                              key={col.key}
                              className="px-3.5 py-2.5 whitespace-nowrap text-[#2c3d35] border-r border-[#ebf1eb] last:border-r-0"
                            >
                              {cellContent || <span className="text-[#a4b2aa]">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default StudentReviewsPage;
