import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckSquare, Download, MessageSquare, Check, X, RefreshCw,
  ExternalLink, Eye, Star, AlertCircle, FileText, Send, Clock,
  CheckCircle2, ChevronRight, BookOpen, Layers
} from 'lucide-react';
import { submissionsApi, tasksApi, filesApi, User, studentApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState, Modal } from '@/components/common/UIComponents';

export function SubmissionsPage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const isTeacherOrAdmin = user.role === 'admin' || user.role === 'employee';

  const [activeTab, setActiveTab] = useState<'google_drive' | 'tasks'>('google_drive');
  const [statusFilter, setStatusFilter] = useState('');

  // Student 7-day submission state: map of day_id -> driveUrl input
  const [studentLinks, setStudentLinks] = useState<Record<string, string>>({});
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [submittingDayId, setSubmittingDayId] = useState<string | null>(null);
  const [studentErrors, setStudentErrors] = useState<Record<string, string>>({});
  const [editingDays, setEditingDays] = useState<Record<string, boolean>>({});

  // Admin/Employee inline comment states per submission ID
  const [inlineComments, setInlineComments] = useState<Record<string, string>>({});
  const [inlineRatings, setInlineRatings] = useState<Record<string, number | ''>>({});
  const [inlineStatuses, setInlineStatuses] = useState<Record<string, string>>({});
  const [savedRowSuccess, setSavedRowSuccess] = useState<Record<string, boolean>>({});

  // Review modal state for Google Drive
  const [selectedDriveSub, setSelectedDriveSub] = useState<any>(null);
  const [driveReviewStatus, setDriveReviewStatus] = useState('approved');
  const [driveRating, setDriveRating] = useState<number | ''>(85);
  const [driveComments, setDriveComments] = useState('');
  const [driveSuggestions, setDriveSuggestions] = useState('');

  // Review modal state for standard task
  const [selectedTaskSub, setSelectedTaskSub] = useState<any>(null);
  const [taskReviewStatus, setTaskReviewStatus] = useState('accepted');
  const [taskFeedback, setTaskFeedback] = useState('');

  // 1. Student enrolled course days query (all 7 days with blank lines & latest submissions)
  const {
    data: studentCourseDays = [],
    isLoading: studentCourseLoading,
    isError: studentCourseError,
    refetch: refetchStudentCourses
  } = useQuery({
    queryKey: ['student_course_days'],
    queryFn: submissionsApi.getStudentCourseDays,
    enabled: user.role === 'student'
  });

  // 2. Admin & Employee Google Drive Submissions Query
  const {
    data: driveSubmissions = [],
    isLoading: driveLoading,
    isError: driveError,
    refetch: refetchDrive
  } = useQuery({
    queryKey: ['drive_submissions', statusFilter],
    queryFn: () => submissionsApi.listGoogleDrive({ status_filter: statusFilter || undefined }),
    enabled: isTeacherOrAdmin
  });

  // 3. Task Submissions Query
  const {
    data: taskSubmissions = [],
    isLoading: taskLoading,
    isError: taskError,
    refetch: refetchTask
  } = useQuery({
    queryKey: ['task_submissions', statusFilter],
    queryFn: () => tasksApi.listSubmissions(statusFilter || undefined)
  });

  // Student Submit Mutation (Student pastes drive link and submits it)
  const submitDriveMutation = useMutation({
    mutationFn: ({ dayId, url, notes }: { dayId: string; url: string; notes?: string }) =>
      studentApi.submitGoogleDrive(dayId, url, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['student_course_days'] });
      queryClient.invalidateQueries({ queryKey: ['drive_submissions'] });
      queryClient.invalidateQueries({ queryKey: ['reviews_overview'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSubmittingDayId(null);
      setEditingDays(prev => ({ ...prev, [variables.dayId]: false }));
      setStudentLinks(prev => ({ ...prev, [variables.dayId]: '' }));
    },
    onError: (err: any, variables) => {
      setSubmittingDayId(null);
      setStudentErrors(prev => ({
        ...prev,
        [variables.dayId]: err.message || 'Failed to submit link. Please provide a valid drive.google.com or docs.google.com link.'
      }));
    }
  });

  // Admin/Employee Review / Inline Comment Mutation
  const reviewDriveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      submissionsApi.reviewGoogleDrive(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drive_submissions'] });
      queryClient.invalidateQueries({ queryKey: ['student_course_days'] });
      queryClient.invalidateQueries({ queryKey: ['reviews_overview'] });
      queryClient.invalidateQueries({ queryKey: ['reviews_spreadsheet'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSavedRowSuccess(prev => ({ ...prev, [variables.id]: true }));
      setTimeout(() => {
        setSavedRowSuccess(prev => ({ ...prev, [variables.id]: false }));
      }, 3000);
      setSelectedDriveSub(null);
    }
  });

  // Task Review Mutation
  const reviewTaskMutation = useMutation({
    mutationFn: ({ id, status, feedback }: { id: string; status: string; feedback: string }) =>
      tasksApi.reviewSubmission(id, status, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_submissions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelectedTaskSub(null);
    }
  });

  const handleStudentSubmit = (dayId: string) => {
    const rawUrl = (studentLinks[dayId] || '').trim();
    setStudentErrors(prev => ({ ...prev, [dayId]: '' }));

    if (!rawUrl) {
      setStudentErrors(prev => ({ ...prev, [dayId]: 'Please paste your Google Drive link.' }));
      return;
    }

    if (!rawUrl.match(/^https?:\/\/(drive|docs)\.google\.com\/[^\s]+$/i)) {
      setStudentErrors(prev => ({
        ...prev,
        [dayId]: 'Invalid link. Must start with https://drive.google.com/ or https://docs.google.com/'
      }));
      return;
    }

    setSubmittingDayId(dayId);
    submitDriveMutation.mutate({
      dayId,
      url: rawUrl,
      notes: studentNotes[dayId] || undefined
    });
  };

  const handleInlineSaveComment = (sub: any) => {
    const currentComment = inlineComments[sub.id] !== undefined ? inlineComments[sub.id] : (sub.review_comments || '');
    const currentRating = inlineRatings[sub.id] !== undefined ? inlineRatings[sub.id] : (sub.rating ?? 95);
    const currentStatus = inlineStatuses[sub.id] || sub.status || 'approved';

    reviewDriveMutation.mutate({
      id: sub.id,
      data: {
        status: currentStatus,
        review_comments: currentComment,
        rating: currentRating === '' ? null : Number(currentRating)
      }
    });
  };

  const handleOpenDriveReview = (sub: any) => {
    setSelectedDriveSub(sub);
    setDriveReviewStatus(sub.status === 'submitted' || sub.status === 'under_review' ? 'approved' : sub.status);
    setDriveRating(sub.rating ?? 85);
    setDriveComments(sub.review_comments || '');
    setDriveSuggestions(sub.improvement_suggestions || '');
  };

  const handleOpenTaskReview = (sub: any) => {
    setSelectedTaskSub(sub);
    setTaskReviewStatus(sub.status === 'submitted' || sub.status === 'under_review' ? 'accepted' : sub.status);
    setTaskFeedback(sub.feedback || '');
  };

  const handleRefresh = () => {
    if (user.role === 'student') {
      refetchStudentCourses();
    } else {
      refetchDrive();
      refetchTask();
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        eyebrow={user.role === 'student' ? 'Student Task Submission' : 'Evaluation & Feedback'}
        title={user.role === 'student' ? 'Course Daily Task Submissions' : 'Student Submissions & Evidence Reviews'}
        description={
          user.role === 'student'
            ? 'Submit your assignment Google Drive links for each day of your enrolled course. Your instructors will review, evaluate, and provide feedback directly on your submissions.'
            : 'Access student-submitted Google Drive links, evaluate progress, and write feedback comments directly on the submission page.'
        }
        action={
          <button onClick={handleRefresh} className="btn btn-soft text-xs">
            <RefreshCw size={13} /> Refresh
          </button>
        }
      />

      {/* ============================================================== */}
      {/* 1. STUDENT VIEW: 7 BLANK LINES WITH SUBMIT BUTTON PER DAY     */}
      {/* ============================================================== */}
      {user.role === 'student' && (
        <div className="space-y-6">
          {studentCourseLoading ? (
            <div className="p-12 panel bg-white"><LoadingState label="Loading your enrolled course curriculum days" /></div>
          ) : studentCourseError ? (
            <div className="p-8 panel bg-white"><ErrorState retry={() => refetchStudentCourses()} /></div>
          ) : studentCourseDays.length === 0 ? (
            <div className="p-12 panel bg-white text-center">
              <EmptyState
                title="No Enrolled Courses Found"
                detail="Once you are enrolled in a training course, its 7 daily task submission lines will appear here for you to submit Google Drive links."
                icon={BookOpen}
              />
            </div>
          ) : (
            studentCourseDays.map((course: any) => (
              <div key={course.program_id} className="panel overflow-hidden bg-white border border-[#e4ebe4]">
                {/* Course Header Banner */}
                <div className="border-b border-[#edf0ea] bg-[#fafbf9] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e3ece4] text-[#245844]">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#23352e]">{course.program_name}</h3>
                      <p className="text-xs text-[#718079]">
                        {course.total_days} Days Learning Curriculum · Submit your Google Drive work link for each day below
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#eef5f1] text-[#275c46] border border-[#d6e5dc]">
                    {course.days.filter((d: any) => d.latest_submission).length} / {course.days.length} Days Submitted
                  </span>
                </div>

                {/* 7 Daily Blank Lines / Submission Rows */}
                <div className="divide-y divide-[#edf0ea]">
                  {course.days.map((day: any) => {
                    const sub = day.latest_submission;
                    const isEditing = editingDays[day.day_id];
                    const hasSubmitted = Boolean(sub) && !isEditing;
                    const isPending = submittingDayId === day.day_id && submitDriveMutation.isPending;
                    const errorMsg = studentErrors[day.day_id];

                    return (
                      <div key={day.day_id} className="p-5 hover:bg-[#fbfcfb] transition space-y-3">
                        {/* Day Title & Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f0f3ee] text-xs font-bold text-[#42544c]">
                              {day.day_number}
                            </span>
                            <span className="text-sm font-bold text-[#21352d]">
                              Day {day.day_number}: {day.title}
                            </span>
                          </div>

                          {/* Submission Status Badge if already submitted */}
                          {hasSubmitted && (
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                                  sub.status === 'approved'
                                    ? 'bg-[#e2f4ea] text-[#20603f] border border-[#bce5cd]'
                                    : sub.status === 'changes_requested'
                                    ? 'bg-[#fff5e5] text-[#8e601c] border border-[#f5dfbc]'
                                    : sub.status === 'rejected'
                                    ? 'bg-[#faecea] text-[#a4453a] border border-[#f5c7c2]'
                                    : 'bg-[#eef3f0] text-[#485b52] border border-[#d6e3dc]'
                                }`}
                              >
                                {sub.status.replace('_', ' ')}
                              </span>
                              {sub.rating !== null && sub.rating !== undefined && (
                                <span className="text-xs font-black text-[#205e43] bg-[#eef6f1] px-2.5 py-0.5 rounded-full border border-[#d2e5da]">
                                  Score: {sub.rating}/100
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* SUBMISSION ROW */}
                        {hasSubmitted ? (
                          /* ALREADY SUBMITTED: Display link & Faculty Comment */
                          <div className="space-y-3 pt-1">
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f8faf8] p-3 rounded-xl border border-[#dde7e0]">
                              <div className="flex items-center gap-3">
                                <a
                                  href={sub.google_drive_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-xs text-[#205e45] hover:underline inline-flex items-center gap-1.5"
                                >
                                  <Eye size={14} /> Open Submitted Google Drive Link <ExternalLink size={12} />
                                </a>
                                <span className="text-[11px] text-[#6d7e76]">
                                  (Attempt #{sub.attempt_number})
                                </span>
                              </div>

                              <button
                                onClick={() => {
                                  setEditingDays(prev => ({ ...prev, [day.day_id]: true }));
                                  setStudentLinks(prev => ({ ...prev, [day.day_id]: sub.google_drive_url }));
                                }}
                                className="btn btn-soft py-1 px-3 text-[11px] text-[#2d5d49]"
                              >
                                Update Link / Submit New Attempt
                              </button>
                            </div>

                            {/* FACULTY / ADMIN COMMENT (Only seen by student) */}
                            {sub.review_comments ? (
                              <div className="rounded-xl border border-[#c4e3d0] bg-[#f0f9f3] p-3.5 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1e523b]">
                                  <MessageSquare size={14} className="text-[#246347]" />
                                  <span>Faculty / Admin Comment:</span>
                                  {sub.reviewer_name && (
                                    <span className="text-[11px] font-normal text-[#587265]">by {sub.reviewer_name}</span>
                                  )}
                                </div>
                                <p className="text-xs text-[#253e32] leading-relaxed font-medium pl-5">
                                  "{sub.review_comments}"
                                </p>
                                {sub.improvement_suggestions && (
                                  <p className="text-[11px] text-[#8e6120] italic pl-5 mt-1">
                                    Tip: {sub.improvement_suggestions}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#718279] italic flex items-center gap-1.5 pl-1">
                                <Clock size={12} /> Link submitted successfully. Awaiting faculty evaluation and comment.
                              </div>
                            )}
                          </div>
                        ) : (
                          /* NOT SUBMITTED: BLANK LINE WITH SUBMIT BUTTON */
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-col sm:flex-row items-center gap-2.5">
                              <div className="relative flex-1 w-full">
                                <input
                                  type="url"
                                  placeholder="Paste your Google Drive link here (e.g. https://drive.google.com/file/d/...)"
                                  value={studentLinks[day.day_id] || ''}
                                  onChange={(e) => setStudentLinks(prev => ({ ...prev, [day.day_id]: e.target.value }))}
                                  className="field text-xs py-2 w-full font-mono placeholder:font-sans"
                                />
                              </div>

                              <button
                                onClick={() => handleStudentSubmit(day.day_id)}
                                disabled={isPending || !(studentLinks[day.day_id] || '').trim()}
                                className="btn btn-primary text-xs py-2 px-5 shrink-0 flex items-center gap-1.5 w-full sm:w-auto justify-center"
                              >
                                <Send size={13} /> {isPending ? 'Submitting…' : 'Submit'}
                              </button>

                              {isEditing && (
                                <button
                                  onClick={() => setEditingDays(prev => ({ ...prev, [day.day_id]: false }))}
                                  className="btn btn-soft text-xs py-2 px-3 shrink-0"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>

                            {/* Error Alert */}
                            {errorMsg && (
                              <div className="text-[11px] text-[#a84236] bg-[#faecea] p-2 rounded-lg border border-[#f5c3bc] flex items-center gap-1.5">
                                <AlertCircle size={13} /> {errorMsg}
                              </div>
                            )}

                            <span className="text-[10px] text-[#73847c] block pl-1">
                              * Give your Google Drive link above and click Submit. Ensure general sharing access is set to "Anyone with the link can view".
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. ADMIN & EMPLOYEE VIEW: SUBMISSION TABLE WITH DIRECT COMMENT */}
      {/* ============================================================== */}
      {isTeacherOrAdmin && (
        <div className="space-y-6">
          {/* Tabs Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-[#e1e8e2] pb-3 gap-3">
            <div className="inline-flex rounded-xl bg-[#e9eee9] p-1 border border-[#d6dfd7]">
              <button
                onClick={() => setActiveTab('google_drive')}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'google_drive' ? 'bg-white text-[#21352d] shadow-sm' : 'text-[#62736b] hover:text-[#21352d]'
                }`}
              >
                <ExternalLink size={13} /> Student Uploaded Links ({driveSubmissions.length})
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'tasks' ? 'bg-white text-[#21352d] shadow-sm' : 'text-[#62736b] hover:text-[#21352d]'
                }`}
              >
                <FileText size={13} /> Task Assignments ({taskSubmissions.length})
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#5a6c63]">Status filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="field w-auto py-1 text-xs"
              >
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="changes_requested">Changes Requested</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* TAB 1: GOOGLE DRIVE EVIDENCE SUBMISSIONS (MATCHING IMAGE 3 + DIRECT COMMENTS) */}
          {activeTab === 'google_drive' && (
            <div className="panel overflow-hidden bg-white border border-[#e4ebe4]">
              {driveLoading ? (
                <div className="p-10"><LoadingState label="Loading student Google Drive submissions" /></div>
              ) : driveError ? (
                <div className="p-8"><ErrorState retry={() => refetchDrive()} /></div>
              ) : driveSubmissions.length === 0 ? (
                <div className="p-10 text-center">
                  <EmptyState
                    title="No student submissions found"
                    detail="When students submit their Google Drive links, they will appear here in the review queue."
                    icon={CheckSquare}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[1050px]">
                    <thead className="bg-[#f7faf8] text-[11px] font-bold text-[#55675e] border-b border-[#e6ede8]">
                      <tr>
                        <th className="py-3.5 px-4">Day & Title</th>
                        <th className="py-3.5 px-4">Student Uploaded Link</th>
                        <th className="py-3.5 px-4 text-center">Attempt</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Faculty Score</th>
                        <th className="py-3.5 px-4 min-w-[280px]">Faculty Remarks & Direct Comment</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1ed]">
                      {driveSubmissions.map((sub: any) => {
                        const currentComment = inlineComments[sub.id] !== undefined ? inlineComments[sub.id] : (sub.review_comments || '');
                        const currentRating = inlineRatings[sub.id] !== undefined ? inlineRatings[sub.id] : (sub.rating ?? 95);
                        const currentStatus = inlineStatuses[sub.id] || sub.status || 'approved';
                        const isRowSaving = reviewDriveMutation.isPending && reviewDriveMutation.variables?.id === sub.id;
                        const isSaved = savedRowSuccess[sub.id];

                        return (
                          <tr key={sub.id} className="hover:bg-[#fafbf9] transition">
                            {/* 1. Day & Title */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="font-bold text-xs text-[#23352e]">
                                Day {sub.day_number}: {sub.day_title}
                              </div>
                              <div className="text-[11px] text-[#718179] mt-0.5">{sub.program_name}</div>
                              <div className="text-[10px] text-[#345747] font-semibold mt-1">
                                Student: {sub.student_name}
                              </div>
                            </td>

                            {/* 2. Student Uploaded Link (Clickable for Admin/Employee) */}
                            <td className="py-3.5 px-4 align-top">
                              <a
                                href={sub.google_drive_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-bold text-xs text-[#205e45] hover:underline"
                                title="Open student Google Drive link in new tab"
                              >
                                <Eye size={14} /> Open Student Link <ExternalLink size={11} />
                              </a>
                              {sub.notes && (
                                <div className="text-[11px] text-[#63756c] mt-1 italic line-clamp-2">
                                  "{sub.notes}"
                                </div>
                              )}
                            </td>

                            {/* 3. Attempt */}
                            <td className="py-3.5 px-4 align-top text-center font-bold text-[#4d5e56]">
                              #{sub.attempt_number}
                            </td>

                            {/* 4. Status Badge (Matching Image 3) */}
                            <td className="py-3.5 px-4 align-top">
                              <span
                                className={`inline-block text-[11px] font-bold px-3 py-1 rounded-full ${
                                  sub.status === 'approved'
                                    ? 'bg-[#e2f4ea] text-[#20603f] border border-[#bce5cd]'
                                    : sub.status === 'changes_requested'
                                    ? 'bg-[#fff5e5] text-[#8e601c] border border-[#f5dfbc]'
                                    : sub.status === 'rejected'
                                    ? 'bg-[#faecea] text-[#a4453a] border border-[#f5c7c2]'
                                    : 'bg-[#eef3f0] text-[#485b52] border border-[#d6e3dc]'
                                }`}
                              >
                                {sub.status.replace('_', ' ')}
                              </span>
                            </td>

                            {/* 5. Faculty Score (Matching Image 3) */}
                            <td className="py-3.5 px-4 align-top font-black text-sm text-[#205e43]">
                              {sub.rating !== null && sub.rating !== undefined ? `${sub.rating}/100` : '—'}
                            </td>

                            {/* 6. DIRECT COMMENT WRITING ON SUBMISSION PAGE (Visible to student) */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="space-y-1.5">
                                {/* Input field to write comment directly from submission page */}
                                <input
                                  type="text"
                                  placeholder="Write comment directly for student..."
                                  value={currentComment}
                                  onChange={(e) => setInlineComments(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                  className="field text-xs py-1.5 px-2.5 w-full bg-white"
                                />

                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder="Score"
                                    value={currentRating}
                                    onChange={(e) => setInlineRatings(prev => ({ ...prev, [sub.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                    className="field text-xs py-1 px-2 w-16"
                                    title="Score (0-100)"
                                  />

                                  <select
                                    value={currentStatus}
                                    onChange={(e) => setInlineStatuses(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                    className="field text-[11px] py-1 px-1.5 w-32"
                                  >
                                    <option value="approved">Approved</option>
                                    <option value="changes_requested">Changes Req.</option>
                                    <option value="under_review">Under Review</option>
                                    <option value="rejected">Rejected</option>
                                  </select>

                                  <button
                                    onClick={() => handleInlineSaveComment(sub)}
                                    disabled={isRowSaving}
                                    className="btn btn-primary py-1 px-3 text-xs shrink-0"
                                  >
                                    {isRowSaving ? 'Saving…' : 'Save Comment'}
                                  </button>
                                </div>

                                {isSaved && (
                                  <div className="text-[10px] font-bold text-[#1e6140] flex items-center gap-1">
                                    <Check size={11} /> Comment saved! Student can now view it.
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* 7. Action Button for detailed review modal */}
                            <td className="py-3.5 px-4 align-top text-right">
                              <button
                                onClick={() => handleOpenDriveReview(sub)}
                                className="btn btn-soft py-1 px-2.5 text-xs text-[#2a5e4a]"
                                title="Open full evaluation modal with tips"
                              >
                                Full Review
                              </button>
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

          {/* TAB 2: TASK ASSIGNMENTS */}
          {activeTab === 'tasks' && (
            <div className="panel overflow-hidden bg-white border border-[#e4ebe4]">
              {taskLoading ? (
                <div className="p-10"><LoadingState label="Loading task assignments" /></div>
              ) : taskError ? (
                <div className="p-8"><ErrorState retry={() => refetchTask()} /></div>
              ) : taskSubmissions.length === 0 ? (
                <div className="p-10 text-center">
                  <EmptyState
                    title="No task submissions found"
                    detail="When students submit daily tasks, they will appear here in the review queue."
                    icon={CheckSquare}
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[900px]">
                    <thead className="bg-[#f7faf8] text-[11px] font-bold text-[#55675e] border-b border-[#e6ede8]">
                      <tr>
                        <th className="py-3 px-4">Task</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Program</th>
                        <th className="py-3 px-4">Text / Files</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Feedback</th>
                        <th className="py-3 px-4 text-right">Review</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf1ed]">
                      {taskSubmissions.map((s: any) => (
                        <tr key={s.id} className="hover:bg-[#fafbf9]">
                          <td className="py-3 px-4 font-bold text-[#23352e]">{s.task_title || 'Daily Task'}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#253730]">{s.student_name}</div>
                          </td>
                          <td className="py-3 px-4 text-[#52645c]">{s.program_name}</td>
                          <td className="py-3 px-4">
                            {s.file_id ? (
                              <a
                                href={filesApi.getDownloadUrl(s.file_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#205e45] font-semibold hover:underline inline-flex items-center gap-1"
                              >
                                <Download size={12} /> {s.file_name || 'Download File'}
                              </a>
                            ) : (
                              <div className="text-[11px] text-[#4d5e56] line-clamp-1 italic">
                                "{s.submission_text || 'No text'}"
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={s.status} />
                          </td>
                          <td className="py-3 px-4 text-[#52645c] max-w-xs truncate">
                            {s.feedback || '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenTaskReview(s)}
                              className="btn btn-primary py-1 px-2.5 text-[11px]"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Review Modal for Google Drive Submission */}
      {selectedDriveSub && (
        <Modal
          title={`Faculty Evaluation: Day ${selectedDriveSub.day_number} Student Uploaded Link`}
          onClose={() => setSelectedDriveSub(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              reviewDriveMutation.mutate({
                id: selectedDriveSub.id,
                data: {
                  status: driveReviewStatus,
                  rating: driveRating === '' ? null : Number(driveRating),
                  review_comments: driveComments,
                  improvement_suggestions: driveSuggestions
                }
              });
            }}
            className="space-y-4 text-xs"
          >
            {/* Submission Preview Card */}
            <div className="p-3 bg-[#f8faf8] rounded-xl border border-[#dde7e0] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#23352e]">Student: {selectedDriveSub.student_name}</span>
                <span className="text-[10px] font-semibold text-[#6f8078]">Attempt #{selectedDriveSub.attempt_number}</span>
              </div>
              <a
                href={selectedDriveSub.google_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#216148] font-bold hover:underline inline-flex items-center gap-1 text-xs"
              >
                <Eye size={13} /> {selectedDriveSub.google_drive_url} <ExternalLink size={11} />
              </a>
              {selectedDriveSub.notes && (
                <p className="text-[11px] text-[#55675f] italic">Notes: "{selectedDriveSub.notes}"</p>
              )}
            </div>

            {/* Verdict Status */}
            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Evaluation Verdict</label>
              <select
                value={driveReviewStatus}
                onChange={(e) => setDriveReviewStatus(e.target.value)}
                className="field text-xs"
              >
                <option value="approved">Approve Submission (Unlock Progression)</option>
                <option value="changes_requested">Request Changes (Requires Revision)</option>
                <option value="rejected">Reject Submission</option>
                <option value="under_review">Mark Under Review</option>
              </select>
            </div>

            {/* Rating Score */}
            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Score / Rating (0 to 100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={driveRating}
                onChange={(e) => setDriveRating(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 90"
                className="field text-xs"
              />
            </div>

            {/* Review Comments */}
            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Review Comments & Feedback (Visible to Student)</label>
              <textarea
                rows={3}
                value={driveComments}
                onChange={(e) => setDriveComments(e.target.value)}
                placeholder="Actionable feedback for the student…"
                className="field text-xs"
              />
            </div>

            {/* Improvement Suggestions */}
            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Improvement Suggestions (Optional)</label>
              <textarea
                rows={2}
                value={driveSuggestions}
                onChange={(e) => setDriveSuggestions(e.target.value)}
                placeholder="e.g. Consider adding drill-through pages or unit tests…"
                className="field text-xs"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button
                type="button"
                className="btn btn-soft text-xs"
                onClick={() => setSelectedDriveSub(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reviewDriveMutation.isPending}
                className="btn btn-primary text-xs"
              >
                {reviewDriveMutation.isPending ? 'Saving…' : 'Submit Faculty Evaluation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review Modal for Task Submission */}
      {selectedTaskSub && (
        <Modal
          title={`Review Task: ${selectedTaskSub.task_title || 'Assignment'}`}
          onClose={() => setSelectedTaskSub(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              reviewTaskMutation.mutate({
                id: selectedTaskSub.id,
                status: taskReviewStatus,
                feedback: taskFeedback
              });
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Review Verdict</label>
              <select
                value={taskReviewStatus}
                onChange={(e) => setTaskReviewStatus(e.target.value)}
                className="field text-xs"
              >
                <option value="accepted">Accept Submission</option>
                <option value="revision_requested">Request Revision</option>
                <option value="rejected">Reject Submission</option>
                <option value="under_review">Mark Under Review</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#485850]">Feedback Comments</label>
              <textarea
                rows={3}
                value={taskFeedback}
                onChange={(e) => setTaskFeedback(e.target.value)}
                placeholder="Provide evaluation notes and guidance for the student…"
                className="field text-xs"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button
                type="button"
                className="btn btn-soft text-xs"
                onClick={() => setSelectedTaskSub(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reviewTaskMutation.isPending}
                className="btn btn-primary text-xs"
              >
                {reviewTaskMutation.isPending ? 'Submitting…' : 'Submit Review'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default SubmissionsPage;
