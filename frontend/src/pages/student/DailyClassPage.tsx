import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import {
  ArrowLeft, CheckSquare, Upload, Video, FileText, CheckCircle2,
  Clock, Download, Sparkles, AlertCircle, ArrowRight, ExternalLink,
  RotateCw, Eye, BookOpen, Layers, Check, ChevronLeft, ChevronRight,
  Send, HelpCircle, ShieldCheck, ListOrdered, ClipboardCheck, Info,
  Award, Coins, Star, MessageSquare, Edit3
} from 'lucide-react';
import { studentApi, submissionsApi, authApi } from '@/services/api';
import { PageTitle, StatusBadge, LoadingState, ErrorState } from '@/components/common/UIComponents';

export function DailyClassPage() {
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Check student_id in URL params if employee/admin is reviewing
  const searchParams = new URLSearchParams(window.location.search);
  const studentIdParam = searchParams.get('student_id') || undefined;

  // Active section tab: 'summary' | 'video' | 'resources' | 'tasks' | 'submission'
  const [activeTab, setActiveTab] = useState<'summary' | 'video' | 'resources' | 'tasks' | 'submission'>('summary');
  
  // Summary language sub-tab: 'english' | 'telugu' | 'main'
  const [summaryLang, setSummaryLang] = useState<'english' | 'telugu' | 'main'>('english');

  // Flashcard flipper state (under Learning Resources)
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Optimistic local state for checklist items
  const [localChecklist, setLocalChecklist] = useState<any[]>([]);

  // Student Google Drive submission state
  const [driveUrl, setDriveUrl] = useState('');
  const [driveNotes, setDriveNotes] = useState('');
  const [driveUrlError, setDriveUrlError] = useState('');
  const [driveSubmitSuccess, setDriveSubmitSuccess] = useState(false);
  const [showEditDriveForm, setShowEditDriveForm] = useState(false);

  // Employee Review Form State
  const [reviewStatus, setReviewStatus] = useState<string>('approved');
  const [reviewScore, setReviewScore] = useState<number>(85);
  const [additionalReward, setAdditionalReward] = useState<number>(30);
  const [reviewComments, setReviewComments] = useState<string>('');
  const [improvementTips, setImprovementTips] = useState<string>('');
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [optimisticDrive, setOptimisticDrive] = useState<any>(null);

  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: authApi.me,
    staleTime: 60000
  });

  const { data: day, isLoading, isError, refetch } = useQuery({
    queryKey: ['student_day', id, studentIdParam],
    queryFn: () => studentApi.getDayDetails(id, studentIdParam),
    enabled: !!id,
    staleTime: 0,
    refetchOnWindowFocus: true
  });

  const isReviewer = currentUser && (currentUser.role === 'admin' || currentUser.role === 'employee');

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['student_day', id, studentIdParam] });
    queryClient.invalidateQueries({ queryKey: ['student_program_progress'] });
    queryClient.invalidateQueries({ queryKey: ['my_programs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
  };

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      studentApi.toggleChecklist(itemId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_day', id, studentIdParam] });
    }
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ activity, value }: { activity: string; value: boolean }) =>
      studentApi.updateActivityProgress(id, activity, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student_day', id, studentIdParam] });
    }
  });

  const submitDriveMutation = useMutation({
    mutationFn: (data: { googleDriveUrl: string; notes?: string }) =>
      studentApi.submitGoogleDrive(id, data.googleDriveUrl, data.notes),
    onSuccess: (res: any) => {
      setOptimisticDrive(res);
      setShowEditDriveForm(false);
      queryClient.setQueryData(['student_day', id, studentIdParam], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          google_drive_submission: res
        };
      });
      queryClient.invalidateQueries({ queryKey: ['student_day', id, studentIdParam] });
      queryClient.invalidateQueries({ queryKey: ['student_program_progress'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setDriveSubmitSuccess(true);
      setDriveUrlError('');
      setTimeout(() => setDriveSubmitSuccess(false), 5000);
    },
    onError: (err: any) => {
      setOptimisticDrive(null);
      setDriveUrlError(err.message || 'Failed to submit Google Drive assignment.');
    }
  });

  const employeeReviewMutation = useMutation({
    mutationFn: (data: { submissionId: string; status: string; comments: string; rating: number; additionalPoints: number; tips?: string }) =>
      submissionsApi.reviewGoogleDrive(data.submissionId, {
        status: data.status,
        review_comments: data.comments,
        rating: data.rating,
        additional_reward_points: data.additionalPoints,
        improvement_suggestions: data.tips
      }),
    onSuccess: () => {
      invalidateAll();
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 5000);
    }
  });

  const completeDayMutation = useMutation({
    mutationFn: () => studentApi.completeDay(id),
    onSuccess: invalidateAll
  });

  useEffect(() => {
    if (day?.checklist) {
      setLocalChecklist(day.checklist);
    }
  }, [day?.checklist]);

  useEffect(() => {
    if (day?.google_drive_submission) {
      setDriveUrl(day.google_drive_submission.google_drive_url || day.google_drive_submission.drive_url || '');
      setDriveNotes(day.google_drive_submission.notes || '');
    }
  }, [day?.google_drive_submission?.id]);

  const handleToggleChecklist = (item: any) => {
    if (isReviewer) return;
    const newCompleted = !item.completed;
    setLocalChecklist(prev => prev.map(it => it.id === item.id ? { ...it, completed: newCompleted } : it));
    toggleChecklistMutation.mutate(
      { itemId: item.id, completed: newCompleted },
      {
        onError: (err: any) => {
          setLocalChecklist(prev => prev.map(it => it.id === item.id ? { ...it, completed: !newCompleted } : it));
          alert(err?.message || 'Failed to update checklist item');
        }
      }
    );
  };

  if (isLoading) return <LoadingState label="Loading daily curriculum and learning session" />;
  if (isError || !day) return <ErrorState retry={() => refetch()} />;

  const checklist = day.checklist || [];
  const tasks = day.tasks || [];
  const resources = day.resources || [];
  const flashcards = day.flashcards || [];
  const latestDrive = day.google_drive_submission;
  const activeDrive = optimisticDrive || latestDrive;
  const driveHistory = day.google_drive_history || [];
  const activity = day.activity_progress || {};

  const requiredChecklist = checklist.filter((i: any) => i.is_required);
  const completedRequired = requiredChecklist.filter((i: any) => i.completed).length;
  const allRequiredChecklistDone = requiredChecklist.length === 0 || completedRequired === requiredChecklist.length;

  const validateAndSubmitDrive = (e: React.FormEvent) => {
    e.preventDefault();
    setDriveUrlError('');
    let trimmed = driveUrl.trim();
    if (!trimmed) {
      setDriveUrlError('Please enter your Google Drive or document evidence URL.');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      trimmed = `https://${trimmed}`;
    }

    // Instantly update UI optimistically with zero lag
    const optimistic = {
      id: 'opt-' + Date.now(),
      google_drive_url: trimmed,
      drive_url: trimmed,
      notes: driveNotes.trim(),
      status: 'submitted',
      attempt_number: (latestDrive?.attempt_number || 0) + 1,
      submitted_at: new Date().toISOString()
    };
    setOptimisticDrive(optimistic);
    setShowEditDriveForm(false);
    submitDriveMutation.mutate({ googleDriveUrl: trimmed, notes: driveNotes.trim() });
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!latestDrive) return;
    employeeReviewMutation.mutate({
      submissionId: latestDrive.id,
      status: reviewStatus,
      comments: reviewComments,
      rating: Number(reviewScore),
      additionalPoints: Number(additionalReward),
      tips: improvementTips
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5ebe5] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={isReviewer && studentIdParam ? "/student-reviews" : "/my-programs"}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#dde4dd] bg-white text-[#45574f] hover:bg-[#f2f6f2] transition"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#e8f1ec] text-[#245b46]">
                Day {day.day_number}
              </span>
              {day.is_completed ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e1f5ea] text-[#1b6b44] flex items-center gap-1">
                  <CheckCircle2 size={12} /> Completed
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#fcf5e5] text-[#865d1d] flex items-center gap-1">
                  <Clock size={12} /> In Progress
                </span>
              )}
              {isReviewer && day.student_info && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#f0e8f7] text-[#5e2b8c]">
                  Reviewing: {day.student_info.full_name} ({day.student_info.email})
                </span>
              )}
            </div>
            <h1 className="display text-xl font-extrabold text-[#20342c] mt-0.5">
              {day.title}
            </h1>
          </div>
        </div>

        {/* Reward Points Badge for this day */}
        <div className="flex items-center gap-2 bg-[#f4f7f4] border border-[#dce5dc] px-3.5 py-2 rounded-xl">
          <Award size={18} className="text-[#c28416]" />
          <div>
            <div className="text-[10px] uppercase font-bold text-[#62756b]">Base Reward</div>
            <div className="text-xs font-extrabold text-[#23352d]">
              +{day.base_reward_points ?? 20} Points on Submission
            </div>
          </div>
        </div>
      </div>

      {/* 5 Clearly Defined Sections Navigation Bar */}
      <div className="panel p-1.5 bg-[#edf2ee] border border-[#d8e2d8] rounded-2xl flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 min-w-[130px] rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'summary' ? 'bg-white text-[#21352d] shadow-xs' : 'text-[#5a6c63] hover:text-[#21352d]'
          }`}
        >
          <BookOpen size={14} /> 1. Summary
        </button>

        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 min-w-[130px] rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'video' ? 'bg-white text-[#21352d] shadow-xs' : 'text-[#5a6c63] hover:text-[#21352d]'
          }`}
        >
          <Video size={14} /> 2. Learning Videos
        </button>

        <button
          onClick={() => setActiveTab('resources')}
          className={`flex-1 min-w-[130px] rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'resources' ? 'bg-white text-[#21352d] shadow-xs' : 'text-[#5a6c63] hover:text-[#21352d]'
          }`}
        >
          <FileText size={14} /> 3. Learning Resources ({resources.length + (flashcards.length > 0 ? 1 : 0)})
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 min-w-[130px] rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'tasks' ? 'bg-white text-[#21352d] shadow-xs' : 'text-[#5a6c63] hover:text-[#21352d]'
          }`}
        >
          <CheckSquare size={14} /> 4. Tasks & Checklist ({completedRequired}/{requiredChecklist.length})
        </button>

        <button
          onClick={() => setActiveTab('submission')}
          className={`flex-1 min-w-[130px] rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'submission'
              ? 'bg-[#255f46] text-white shadow-xs'
              : 'text-[#5a6c63] hover:text-[#21352d]'
          }`}
        >
          <ExternalLink size={14} /> 5. Submission
          {latestDrive && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
              latestDrive.status === 'approved' ? 'bg-[#bce4cc] text-[#13492e]' : 'bg-white/20 text-white'
            }`}>
              {latestDrive.status}
            </span>
          )}
        </button>
      </div>

      {/* SECTION 1: SUMMARY */}
      {activeTab === 'summary' && (
        <div className="panel p-6 bg-white border border-[#e4ebe4] space-y-4 rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ee] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#23352e]">Section 1: Daily Learning Summary</h2>
              <p className="text-xs text-[#6e7e76]">
                Comprehensive day syllabus, core learning concepts, and bilingual summaries
              </p>
            </div>
            <div className="flex rounded-lg bg-[#eef3ef] p-1 text-xs">
              <button
                onClick={() => setSummaryLang('english')}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  summaryLang === 'english' ? 'bg-white text-[#245842] shadow-xs' : 'text-[#5e7167]'
                }`}
              >
                English Summary
              </button>
              <button
                onClick={() => setSummaryLang('telugu')}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  summaryLang === 'telugu' ? 'bg-white text-[#245842] shadow-xs' : 'text-[#5e7167]'
                }`}
              >
                Telugu Summary
              </button>
              <button
                onClick={() => setSummaryLang('main')}
                className={`rounded-md px-3 py-1 font-semibold transition ${
                  summaryLang === 'main' ? 'bg-white text-[#245842] shadow-xs' : 'text-[#5e7167]'
                }`}
              >
                Full Curriculum Notes
              </button>
            </div>
          </div>

          <div className="prose max-w-none text-xs text-[#384841] leading-relaxed bg-[#fbfcfb] p-5 rounded-xl border border-[#edf1ee]">
            {summaryLang === 'english' && (
              <div>{day.summary_english || day.description || 'English summary provided by faculty.'}</div>
            )}
            {summaryLang === 'telugu' && (
              <div>{day.summary_telugu || 'తెలుగు సారాంశం త్వరలో అందుబాటులో ఉంటుంది.'}</div>
            )}
            {summaryLang === 'main' && (
              <div>{day.summary_main || day.content || 'Curriculum notes and daily concepts.'}</div>
            )}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {day.summary_url && (
              <a
                href={day.summary_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-[#dbe6dc] bg-[#f7fbf8] hover:bg-[#edf5ef] text-xs font-bold text-[#235b44] transition"
              >
                <span>Curriculum Guide</span>
                <ExternalLink size={14} />
              </a>
            )}
            {day.quiz_url && (
              <a
                href={day.quiz_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-[#dbe6dc] bg-[#f7fbf8] hover:bg-[#edf5ef] text-xs font-bold text-[#235b44] transition"
              >
                <span>Knowledge Check</span>
                <ExternalLink size={14} />
              </a>
            )}
            {day.assignment_url && (
              <a
                href={day.assignment_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl border border-[#dbe6dc] bg-[#f7fbf8] hover:bg-[#edf5ef] text-xs font-bold text-[#235b44] transition"
              >
                <span>Assignment Brief</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: LEARNING VIDEOS */}
      {activeTab === 'video' && (
        <div className="panel p-6 bg-white border border-[#e4ebe4] space-y-4 rounded-2xl">
          <div className="border-b border-[#edf1ee] pb-3">
            <h2 className="text-base font-bold text-[#23352e]">Section 2: Learning Videos</h2>
            <p className="text-xs text-[#6e7e76]">
              Watch instructional sessions and faculty walkthroughs
            </p>
          </div>

          {day.video_url || day.summary_video_url ? (
            <div className="space-y-4">
              {day.video_url && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black/5 border border-[#e0e7e1] shadow-xs">
                  {day.video_url.includes('youtube.com') || day.video_url.includes('youtu.be') ? (
                    <iframe
                      src={
                        day.video_url.includes('embed')
                          ? day.video_url
                          : day.video_url.replace('watch?v=', 'embed/').split('&')[0]
                      }
                      title={day.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video controls className="w-full h-full object-cover">
                      <source src={day.video_url} />
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#7d8e85] border border-dashed border-[#ccd9cf] rounded-2xl">
              No specific video recording attached for this day. Review the study resources and tasks.
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: LEARNING RESOURCES */}
      {activeTab === 'resources' && (
        <div className="panel p-6 bg-white border border-[#e4ebe4] space-y-6 rounded-2xl">
          <div className="border-b border-[#edf1ee] pb-3">
            <h2 className="text-base font-bold text-[#23352e]">Section 3: Learning Resources & Study Materials</h2>
            <p className="text-xs text-[#6e7e76]">
              Faculty study guides, code repositories, downloadable cheat-sheets, and interactive concept flashcards
            </p>
          </div>

          {resources.length === 0 && flashcards.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#7d8e85] border border-dashed border-[#ccd9cf] rounded-2xl">
              No supplementary resources uploaded for this day yet.
            </div>
          ) : (
            <div className="space-y-6">
              {resources.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {resources.map((res: any) => (
                    <div key={res.id} className="p-4 rounded-xl border border-[#dde6df] bg-[#fafcfa] flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[#21352d]">{res.title}</div>
                        {res.description && <div className="text-[11px] text-[#6d7e75] mt-0.5">{res.description}</div>}
                        <span className="inline-block text-[10px] font-bold uppercase text-[#295c47] bg-[#e6f2eb] px-2 py-0.5 rounded mt-2">
                          {res.resource_type || 'Document'}
                        </span>
                      </div>
                      {res.url && (
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline text-xs py-1.5 px-3 flex items-center gap-1 shrink-0"
                        >
                          Open <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Interactive Flashcards */}
              {flashcards.length > 0 && (
                <div className="border-t border-[#edf1ee] pt-4">
                  <h3 className="text-xs font-bold text-[#23352d] mb-3 flex items-center gap-1.5">
                    <Layers size={14} className="text-[#255f46]" /> Interactive Concept Flashcards ({flashcards.length})
                  </h3>
                  <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="p-8 rounded-2xl border border-[#bce0cb] bg-[#f4faf6] cursor-pointer min-h-[160px] grid place-items-center text-center select-none shadow-xs transition hover:bg-[#eaf5ee]"
                  >
                    <div>
                      <div className="text-[10px] uppercase font-bold text-[#62776c] mb-1">
                        Card {currentCardIndex + 1} of {flashcards.length} · Click to flip
                      </div>
                      <div className="text-sm font-bold text-[#1f4e39]">
                        {isFlipped
                          ? flashcards[currentCardIndex].back_text
                          : flashcards[currentCardIndex].front_text}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <button
                      disabled={currentCardIndex === 0}
                      onClick={() => { setCurrentCardIndex(c => Math.max(0, c - 1)); setIsFlipped(false); }}
                      className="btn btn-outline text-xs py-1 px-3"
                    >
                      Previous
                    </button>
                    <button
                      disabled={currentCardIndex >= flashcards.length - 1}
                      onClick={() => { setCurrentCardIndex(c => Math.min(flashcards.length - 1, c + 1)); setIsFlipped(false); }}
                      className="btn btn-outline text-xs py-1 px-3"
                    >
                      Next Card
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: TASKS & CHECKLIST */}
      {activeTab === 'tasks' && (
        <div className="panel p-6 bg-white border border-[#e4ebe4] space-y-4 rounded-2xl">
          <div className="border-b border-[#edf1ee] pb-3">
            <h2 className="text-base font-bold text-[#23352e]">Section 4: Daily Tasks & Checklist</h2>
            <p className="text-xs text-[#6e7e76]">
              Check off tasks as you accomplish learning outcomes for today
            </p>
          </div>

          {(localChecklist.length === 0 && tasks.length === 0) ? (
            <div className="p-8 text-center text-xs text-[#7d8e85] border border-dashed border-[#ccd9cf] rounded-2xl">
              No specific checklist items configured for this day.
            </div>
          ) : (
            <div className="space-y-4">
              {localChecklist.length > 0 && (
                <div className="space-y-2">
                  {localChecklist.map((item: any) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklist(item)}
                      className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 select-none ${
                        isReviewer ? 'cursor-default' : 'cursor-pointer'
                      } ${
                        item.completed
                          ? 'bg-[#f0f8f3] border-[#bce4cc] text-[#1c4b35]'
                          : 'bg-white border-[#e0e7e1] text-[#2d3e36] hover:bg-[#fafbf9]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(item.completed)}
                          onChange={() => handleToggleChecklist(item)}
                          disabled={isReviewer}
                          className="h-4 w-4 rounded text-[#285e48] border-[#a9bcae] cursor-pointer"
                        />
                        <div>
                          <span className={`text-xs font-bold ${item.completed ? 'line-through text-[#6a8074]' : ''}`}>
                            {item.title}
                          </span>
                          {item.description && (
                            <p className="text-[11px] text-[#6b7b73] mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </div>

                      {item.is_required && (
                        <span className="text-[10px] font-bold text-[#a64033] bg-[#faecea] px-2 py-0.5 rounded border border-[#f5c3bd] shrink-0">
                          Required
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tasks.length > 0 && (
                <div className="pt-3 border-t border-[#edf1ee] space-y-2">
                  <h3 className="text-xs font-bold text-[#20342c] uppercase tracking-wider">
                    Practical Tasks & Instructions
                  </h3>
                  {tasks.map((t: any) => (
                    <div key={t.id} className="p-3.5 rounded-xl border border-[#dde5de] bg-[#f9fbf9]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#1f4e39]">{t.title}</span>
                        {t.is_required && (
                          <span className="text-[10px] font-bold text-[#a64033] bg-[#faecea] px-2 py-0.5 rounded border border-[#f5c3bd]">
                            Required
                          </span>
                        )}
                      </div>
                      {t.instructions && (
                        <p className="text-xs text-[#5f7368] mt-1 whitespace-pre-wrap">{t.instructions}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: SUBMISSION */}
      {activeTab === 'submission' && (
        <div className="space-y-6">
          {/* Section 5 Header with Rewards summary */}
          <div className="panel p-6 bg-white border border-[#e4ebe4] space-y-4 rounded-2xl">
            <div className="border-b border-[#edf1ee] pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#23352e] flex items-center gap-2">
                  <ExternalLink size={18} className="text-[#255f46]" /> Section 5: Assignment Submission & Evidence
                </h2>
                <p className="text-xs text-[#718079]">
                  Upload Word document assignment evidence via Google Drive · Evaluated directly by assigned faculty
                </p>
              </div>

              {/* Status Badge */}
              <div>
                {latestDrive ? (
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                    latestDrive.status === 'approved'
                      ? 'bg-[#e2f4ea] text-[#1a5b3b] border border-[#bce4cc]'
                      : latestDrive.status === 'changes_requested'
                      ? 'bg-[#fff5e5] text-[#8e601c] border border-[#f5dfbc]'
                      : latestDrive.status === 'rejected'
                      ? 'bg-[#faecea] text-[#a4453a] border border-[#f5c7c2]'
                      : 'bg-[#edf3f0] text-[#364d42] border border-[#d2dfd8]'
                  }`}>
                    {latestDrive.status.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#f4f7f4] text-[#62776c] border border-[#dce5dc]">
                    Not Submitted
                  </span>
                )}
              </div>
            </div>

            {/* Clear Google Drive Sharing Instructions Alert */}
            <div className="rounded-xl border border-[#bce0cb] bg-[#eef8f2] p-4 text-xs text-[#1e5239] flex items-start gap-3">
              <ShieldCheck size={20} className="text-[#256e49] shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold text-sm block mb-1">
                  Google Drive Sharing Requirement:
                </strong>
                <span>
                  Please upload your completed Word document evidence into Google Drive and set the link access permissions to{' '}
                  <span className="underline font-bold text-[#14472f]">"Anyone with the link can view"</span>{' '}
                  before pasting the link below. This ensures your assigned faculty can inspect and score your work.
                </span>
              </div>
            </div>

            {/* Reward Points Explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-[#dbe6dc] bg-[#fafcfa]">
                <div className="text-[10px] uppercase font-bold text-[#6a7c73]">Base Points</div>
                <div className="text-base font-extrabold text-[#235841]">
                  +{day.base_reward_points ?? 20} pts
                </div>
                <div className="text-[10px] text-[#788a81]">
                  {activeDrive ? 'Credited to wallet' : 'Credited on submission'}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-[#dbe6dc] bg-[#fafcfa]">
                <div className="text-[10px] uppercase font-bold text-[#6a7c73]">Faculty Bonus</div>
                <div className="text-base font-extrabold text-[#c28416]">
                  {activeDrive && typeof activeDrive.additional_reward_points === 'number' && activeDrive.additional_reward_points > 0
                    ? `+${activeDrive.additional_reward_points} pts`
                    : 'Up to +50 pts'}
                </div>
                <div className="text-[10px] text-[#788a81]">
                  {activeDrive?.status === 'approved' ? 'Awarded by faculty' : 'Awarded upon faculty review'}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-[#bce4cc] bg-[#f0f8f3]">
                <div className="text-[10px] uppercase font-bold text-[#1e583c]">Total Earned For Day</div>
                <div className="text-base font-black text-[#1b5e3d]">
                  {activeDrive ? (activeDrive.base_reward_points || 20) + (activeDrive.additional_reward_points || 0) : 0} pts
                </div>
                <div className="text-[10px] text-[#427158] font-semibold">1 Reward Point = ₹1 INR</div>
              </div>
            </div>

            {/* PROMINENT FACULTY EVALUATION & FEEDBACK CARD (Visible when reviewed) */}
            {activeDrive && (activeDrive.status === 'approved' || activeDrive.rating || activeDrive.review_comments) && (
              <div className="rounded-2xl border-2 border-[#86efac] bg-gradient-to-br from-[#f0fdf4] to-[#e8f7ee] p-5 space-y-3.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#bbf7d0] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#166534] text-white flex items-center justify-center font-black text-sm shadow-xs">
                      ✓
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#166534]">
                        Instructor Verification Verdict
                      </div>
                      <div className="text-sm font-extrabold text-[#14532d] flex items-center gap-1.5">
                        <span>{activeDrive.status === 'approved' ? 'Approved & Scored' : activeDrive.status.replace('_', ' ')}</span>
                        <CheckCircle2 size={15} className="text-[#16a34a]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeDrive.rating && (
                      <div className="px-3.5 py-1.5 rounded-xl bg-white border border-[#bbf7d0] shadow-xs text-right">
                        <div className="text-[10px] uppercase font-bold text-[#166534]">Performance Score</div>
                        <div className="text-base font-black text-[#15803d]">{activeDrive.rating} / 100</div>
                      </div>
                    )}
                    {typeof activeDrive.additional_reward_points === 'number' && activeDrive.additional_reward_points > 0 && (
                      <div className="px-3.5 py-1.5 rounded-xl bg-[#166534] text-white shadow-xs text-right">
                        <div className="text-[10px] uppercase font-bold text-[#bbf7d0]">Faculty Reward Bonus</div>
                        <div className="text-base font-black text-white">+{activeDrive.additional_reward_points} pts</div>
                      </div>
                    )}
                  </div>
                </div>

                {activeDrive.review_comments && (
                  <div className="p-3.5 bg-white/95 rounded-xl border border-[#bbf7d0] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#166534] block">
                      Faculty Feedback & Remarks:
                    </span>
                    <p className="text-xs font-semibold text-[#14532d] italic">
                      "{activeDrive.review_comments}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CURRENT ACTIVE SUBMISSION CARD (Visible to student) */}
            {activeDrive && (
              <div className="rounded-xl border border-[#bce4cc] bg-[#f0f8f3] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1f5f3e]">
                    <CheckCircle2 size={16} className="text-[#059669]" />
                    <span>Active Submitted Link (Attempt #{activeDrive.attempt_number || 1})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#527061] font-semibold">
                      Submitted: {activeDrive.submitted_at ? new Date(activeDrive.submitted_at).toLocaleString() : 'Recently'}
                    </span>
                    {(!isReviewer || !studentIdParam) && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditDriveForm(!showEditDriveForm);
                          setDriveUrl(activeDrive.google_drive_url || activeDrive.drive_url || '');
                          setDriveNotes(activeDrive.notes || '');
                        }}
                        className="btn btn-soft text-xs py-1 px-3 flex items-center gap-1.5 font-bold shadow-2xs border-[#b2d5c2] hover:bg-[#e4f2ea]"
                      >
                        <Edit3 size={12} /> {showEditDriveForm ? 'Hide Editor' : 'Edit / Update Submitted Link'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-[#cbe1d3] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-[#62776c] block">Google Drive URL:</span>
                    <a
                      href={activeDrive.google_drive_url || activeDrive.drive_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[#1b5f3d] hover:underline flex items-center gap-1.5 truncate"
                    >
                      <ExternalLink size={13} className="shrink-0" />
                      <span className="truncate">{activeDrive.google_drive_url || activeDrive.drive_url}</span>
                    </a>
                  </div>
                  <a
                    href={activeDrive.google_drive_url || activeDrive.drive_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1 font-bold"
                  >
                    <ExternalLink size={12} /> Open Document Link
                  </a>
                </div>

                {activeDrive.notes && (
                  <p className="text-xs text-[#4b6055] bg-white/70 p-2.5 rounded-lg border border-[#d6e5dc]">
                    <strong className="text-[#2d4439]">Your Notes:</strong> {activeDrive.notes}
                  </p>
                )}
              </div>
            )}

            {/* STUDENT SUBMISSION / RESUBMISSION FORM */}
            {(!isReviewer || !studentIdParam) && (!activeDrive || showEditDriveForm) && (
              <form onSubmit={validateAndSubmitDrive} className="space-y-3.5 pt-3 border-t-2 border-[#d2e5d9] bg-[#fafcfa] p-4 rounded-xl border">
                <div className="flex items-center justify-between pb-1 border-b border-[#e5ece7]">
                  <span className="text-xs font-bold text-[#203c2e] flex items-center gap-1.5">
                    <Edit3 size={14} className="text-[#2b684c]" />
                    {activeDrive ? `Edit / Resubmit Assignment (Attempt #${(activeDrive.attempt_number || 1) + 1})` : 'Submit Google Drive Assignment'}
                  </span>
                  {activeDrive && (
                    <button
                      type="button"
                      onClick={() => setShowEditDriveForm(false)}
                      className="text-[11px] text-[#697d72] hover:text-[#21352c] font-semibold"
                    >
                      ✕ Cancel Edit
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#485850]">
                    {activeDrive ? 'Update Google Drive Link *' : 'Google Drive Link (Word Document / Evidence URL) *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="https://drive.google.com/file/d/... or docs.google.com/..."
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    className="field text-xs py-2"
                  />
                  <span className="text-[10px] text-[#6d8276] mt-1 block">
                    Make sure link sharing is set to "Anyone with the link can view".
                  </span>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#485850]">
                    Student Notes / Comments for Faculty (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide context on your submission, tasks completed, or questions for faculty…"
                    value={driveNotes}
                    onChange={(e) => setDriveNotes(e.target.value)}
                    className="field text-xs"
                  />
                </div>

                {driveUrlError && (
                  <div className="rounded-lg bg-[#faecea] p-2.5 text-xs font-medium text-[#b8483d] border border-[#f5c4be]">
                    {driveUrlError}
                  </div>
                )}

                {driveSubmitSuccess && (
                  <div className="rounded-lg bg-[#e2f4ea] p-3 text-xs font-bold text-[#1f5f3e] border border-[#bce5cd] flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>
                      Assignment submitted successfully! Base reward points added to your wallet. Your assigned faculty has been notified.
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  {activeDrive && (
                    <button
                      type="button"
                      onClick={() => setShowEditDriveForm(false)}
                      className="btn btn-soft text-xs py-2 px-4"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitDriveMutation.isPending || !driveUrl.trim()}
                    className="btn btn-primary text-xs py-2 px-5 flex items-center gap-1.5 font-bold"
                  >
                    <Send size={13} /> {submitDriveMutation.isPending ? 'Submitting…' : activeDrive ? 'Update / Resubmit Link' : 'Submit Day Assignment'}
                  </button>
                </div>
              </form>
            )}

            {/* FACULTY / EMPLOYEE REVIEW FORM (When viewed by faculty/admin with student context) */}
            {isReviewer && latestDrive && (
              <div className="rounded-2xl border border-[#cbe1d3] bg-[#f7fbf8] p-5 space-y-4">
                <div className="border-b border-[#e0ede4] pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#1e4d38] flex items-center gap-2">
                      <Star size={16} className="text-[#c28416]" /> Faculty Review & Reward Panel
                    </h3>
                    <p className="text-[11px] text-[#5a7165]">
                      Review student Google Drive submission, assign rating score, and award additional reward points
                    </p>
                  </div>
                  <a
                    href={latestDrive.google_drive_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <Eye size={13} /> Open Student Document <ExternalLink size={11} />
                  </a>
                </div>

                <div className="text-xs text-[#384841] bg-white p-3 rounded-xl border border-[#dde7e0]">
                  <strong>Student Notes:</strong> {latestDrive.notes || 'No student notes provided.'}
                  <div className="text-[10px] text-[#71857c] mt-1">
                    Submitted on: {new Date(latestDrive.submitted_at).toLocaleString()} (Attempt #{latestDrive.attempt_number})
                  </div>
                </div>

                <form onSubmit={handleSaveReview} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#35483f] mb-1">
                        Evaluation Decision *
                      </label>
                      <select
                        value={reviewStatus}
                        onChange={(e) => setReviewStatus(e.target.value)}
                        className="field text-xs py-1.5"
                      >
                        <option value="approved">Approve Assignment</option>
                        <option value="changes_requested">Request Corrections</option>
                        <option value="rejected">Reject Assignment</option>
                        <option value="under_review">Mark Under Review</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#35483f] mb-1">
                        Performance Rating (1-100) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={reviewScore}
                        onChange={(e) => setReviewScore(Number(e.target.value))}
                        className="field text-xs py-1.5"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#35483f] mb-1 flex items-center justify-between">
                        <span>Additional Reward Points</span>
                        <span className="text-[10px] text-[#865d1d] font-normal">Max 50</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={additionalReward}
                        onChange={(e) => setAdditionalReward(Number(e.target.value))}
                        className="field text-xs py-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#35483f] mb-1">
                      Faculty Review Comments & Feedback *
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Specific feedback, what was done well, and areas for improvement…"
                      value={reviewComments}
                      onChange={(e) => setReviewComments(e.target.value)}
                      className="field text-xs"
                    />
                  </div>

                  {reviewSuccess && (
                    <div className="p-2.5 rounded-xl bg-[#e1f5ea] border border-[#bce4cc] text-xs font-bold text-[#1e5c3b]">
                      ✓ Review saved successfully! Points credited to student wallet and notification delivered.
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      disabled={employeeReviewMutation.isPending}
                      className="btn btn-primary text-xs py-2 px-5 flex items-center gap-1.5"
                    >
                      <Award size={14} /> {employeeReviewMutation.isPending ? 'Saving…' : 'Save Review & Award Points'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Submission Attempts History Table */}
          <div className="panel p-5 bg-white border border-[#e4ebe4] space-y-3 rounded-2xl">
            <h4 className="text-xs font-bold text-[#23352e]">All Submission Attempts & Faculty Reviews</h4>
            {driveHistory.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#7d8e85]">
                No submissions recorded for this day yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#edf0ea] text-[#697972] text-[11px]">
                      <th className="py-2.5 px-3 font-semibold">Attempt</th>
                      <th className="py-2.5 px-3 font-semibold">Submission Link</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Score</th>
                      <th className="py-2.5 px-3 font-semibold">Reward Points</th>
                      <th className="py-2.5 px-3 font-semibold">Faculty Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f4f1]">
                    {driveHistory.map((s: any) => (
                      <tr key={s.id}>
                        <td className="py-2.5 px-3 font-bold text-[#21352d]">Attempt #{s.attempt_number}</td>
                        <td className="py-2.5 px-3">
                          <a
                            href={s.google_drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-[#205e45] hover:underline inline-flex items-center gap-1"
                          >
                            <Eye size={12} /> Open Document <ExternalLink size={10} />
                          </a>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              s.status === 'approved'
                                ? 'bg-[#e2f4ea] text-[#20603f] border border-[#bce5cd]'
                                : s.status === 'changes_requested'
                                ? 'bg-[#fff5e5] text-[#8e601c] border border-[#f5dfbc]'
                                : s.status === 'rejected'
                                ? 'bg-[#faecea] text-[#a4453a] border border-[#f5c7c2]'
                                : 'bg-[#eef3f0] text-[#485b52] border border-[#d6e3dc]'
                            }`}
                          >
                            {s.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#245842]">
                          {s.rating !== null && s.rating !== undefined ? `${s.rating}/100` : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#b47a12]">
                          +{(s.base_reward_points || 0) + (s.additional_reward_points || 0)} pts
                        </td>
                        <td className="py-2.5 px-3 max-w-xs text-[#475750]">
                          <div>{s.review_comments || 'Pending evaluation'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DailyClassPage;
