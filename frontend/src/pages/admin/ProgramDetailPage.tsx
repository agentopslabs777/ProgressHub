import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'wouter';
import {
  Plus, ArrowLeft, Layers, BookOpen, Settings, CheckSquare,
  Video, FileText, ChevronDown, ChevronUp, ChevronRight, Trash2, Edit,
  ExternalLink, Sparkles, Clock, ShieldCheck, FolderClosed, Info,
  CheckCircle2, ListOrdered, ClipboardCheck, Calendar, Send,
  FileSpreadsheet, UploadCloud, Download, AlertCircle, CheckCircle
} from 'lucide-react';
import { programsApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState, Modal } from '@/components/common/UIComponents';

export function ProgramDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Dropdown & Modal states
  const [addContentDropdownOpen, setAddContentDropdownOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [subModuleModalOpen, setSubModuleModalOpen] = useState(false);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [editDayModalOpen, setEditDayModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState('');

  // Dedicated 4-Item Modals matching Image 1
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [openDayMenuId, setOpenDayMenuId] = useState<string | null>(null);

  // Expand / collapse state for modules & days (defaults to open)
  const [expandedTracks, setExpandedTracks] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedDayId, setSelectedDayId] = useState('');
  const [selectedDay, setSelectedDay] = useState<any>(null);

  // Track Form
  const [trackName, setTrackName] = useState('');
  const [trackDesc, setTrackDesc] = useState('');

  // Day Form (Shared between Add and Edit)
  const [dayTitle, setDayTitle] = useState('');
  const [dayNumber, setDayNumber] = useState<number | undefined>(undefined);
  const [dayDesc, setDayDesc] = useState('');
  const [dayContent, setDayContent] = useState('');
  const [dayVideo, setDayVideo] = useState('');
  const [summaryTelugu, setSummaryTelugu] = useState('');
  const [summaryEnglish, setSummaryEnglish] = useState('');
  const [summaryMain, setSummaryMain] = useState('');
  const [summaryUrl, setSummaryUrl] = useState('');
  const [unlockDelayHours, setUnlockDelayHours] = useState<number>(24);
  const [unlockMode, setUnlockMode] = useState<string>('both');
  const [requireDrive, setRequireDrive] = useState(true);
  const [dayApproval, setDayApproval] = useState(false);
  const [dayTaskRequired, setDayTaskRequired] = useState(false);
  const [dayPublished, setDayPublished] = useState(true);
  const [dayPoints, setDayPoints] = useState<number>(20);

// Live session form removed

  // Quiz form
  const [quizTitle, setQuizTitle] = useState('');
  const [quizInstructions, setQuizInstructions] = useState('');
  const [quizUrl, setQuizUrl] = useState('');

  // Assignment form
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentInstructions, setAssignmentInstructions] = useState('');
  const [assignmentUrl, setAssignmentUrl] = useState('');

  const [formError, setFormError] = useState('');

  const { data: program, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.get(id),
    enabled: !!id
  });

  const refreshProgram = () => {
    queryClient.invalidateQueries({ queryKey: ['program', id] });
    queryClient.invalidateQueries({ queryKey: ['programs'] });
  };

  const updateProgramMutation = useMutation({
    mutationFn: (data: any) => programsApi.update(id, data),
    onSuccess: refreshProgram
  });

  const deleteProgramMutation = useMutation({
    mutationFn: () => programsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      window.location.href = '/programs';
    },
    onError: (err: any) => alert(err?.message || 'Failed to delete course program')
  });

  const addTrackMutation = useMutation({
    mutationFn: (data: any) => programsApi.addTrack(id, data),
    onSuccess: () => {
      refreshProgram();
      setTrackModalOpen(false);
      setSubModuleModalOpen(false);
      setTrackName('');
      setTrackDesc('');
    },
    onError: (err: any) => setFormError(err.message || 'Failed to add track/module')
  });

  const deleteTrackMutation = useMutation({
    mutationFn: (trackId: string) => programsApi.deleteTrack(trackId),
    onSuccess: refreshProgram,
    onError: (err: any) => alert(err?.message || 'Failed to delete module')
  });

  const addDayMutation = useMutation({
    mutationFn: (data: any) => programsApi.addDay(selectedTrackId, data),
    onSuccess: () => {
      refreshProgram();
      setDayModalOpen(false);
      resetDayForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to add day/lesson')
  });

  const updateDayMutation = useMutation({
    mutationFn: (payload: any) => {
      const targetId = payload?.dayId || selectedDayId;
      const body = payload?.data !== undefined ? payload.data : payload;
      return programsApi.updateDay(targetId, body);
    },
    onSuccess: () => {
      refreshProgram();
      setEditDayModalOpen(false);
      setSummaryModalOpen(false);
      setVideoModalOpen(false);
      setQuizModalOpen(false);
      setAssignmentModalOpen(false);
      resetDayForm();
    },
    onError: (err: any) => setFormError(err.message || 'Failed to update day')
  });

  const toggleDayPublishedMutation = useMutation({
    mutationFn: ({ dayId, published }: { dayId: string; published: boolean }) =>
      programsApi.updateDay(dayId, { published }),
    onSuccess: () => {
      refreshProgram();
      setOpenDayMenuId(null);
    },
    onError: (err: any) => alert(err?.message || 'Failed to update day status')
  });

  const deleteDayMutation = useMutation({
    mutationFn: (dayId: string) => programsApi.deleteDay(dayId),
    onSuccess: () => {
      refreshProgram();
      setOpenDayMenuId(null);
    },
    onError: (err: any) => alert(err?.message || 'Failed to delete day')
  });

  const normalizeUrl = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const resetDayForm = () => {
    setDayTitle('');
    setDayNumber(undefined);
    setDayDesc('');
    setDayContent('');
    setDayVideo('');
    setSummaryTelugu('');
    setSummaryEnglish('');
    setSummaryMain('');
    setSummaryUrl('');
    setQuizUrl('');
    setAssignmentUrl('');
    setUnlockDelayHours(24);
    setUnlockMode('both');
    setRequireDrive(true);
    setDayApproval(false);
    setDayTaskRequired(false);
    setDayPublished(true);
    setFormError('');
  };

  const populateDayForEdit = (day: any) => {
    setFormError('');
    setSelectedDayId(day.id);
    setSelectedDay(day);
    setDayTitle(day.title || '');
    setDayNumber(day.dayNumber || day.day_number);
    setDayDesc(day.description || '');
    setDayContent(day.content || '');
    setDayVideo(day.video_url || day.summary_video_url || day.videoUrl || '');
    setSummaryTelugu(day.summary_telugu || '');
    setSummaryEnglish(day.summary_english || '');
    setSummaryMain(day.summary_main || '');
    setSummaryUrl(day.summary_url || day.summaryUrl || '');
    setQuizUrl(day.quiz_url || day.quizUrl || '');
    setAssignmentUrl(day.assignment_url || day.assignmentUrl || '');
    setUnlockDelayHours(day.unlock_delay_hours ?? 24);
    setUnlockMode(day.unlock_mode || 'both');
    setRequireDrive(Boolean(day.require_google_drive_submission));
    setDayApproval(Boolean(day.require_approval));
    setDayTaskRequired(Boolean(day.require_task_submission));
    setDayPublished(Boolean(day.published));
    setDayPoints(day.base_reward_points ?? day.reward_points ?? day.rewardPoints ?? 20);

    setQuizTitle(day.title ? `${day.title} Quiz` : 'Daily Quiz');
    setQuizInstructions(day.description || 'Answer key concept questions based on today\'s lecture.');
    setAssignmentTitle(day.title ? `${day.title} Assignment` : 'Daily Assignment');
    setAssignmentInstructions(day.description || 'Complete the assignment and submit your Google Drive evidence link.');
  };

  const openSummaryModal = (day: any) => {
    populateDayForEdit(day);
    setSummaryModalOpen(true);
  };

  const openVideoModal = (day: any) => {
    populateDayForEdit(day);
    setVideoModalOpen(true);
  };

  const openQuizModal = (day: any) => {
    populateDayForEdit(day);
    setQuizModalOpen(true);
  };

  const openAssignmentModal = (day: any) => {
    populateDayForEdit(day);
    setAssignmentModalOpen(true);
  };

  const openEditDayModal = (day: any) => {
    populateDayForEdit(day);
    setEditDayModalOpen(true);
  };

  const toggleExpandDay = (dayId: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayId]: prev[dayId] === undefined ? false : !prev[dayId]
    }));
  };

  const toggleExpandTrack = (trackId: string) => {
    setExpandedTracks(prev => ({
      ...prev,
      [trackId]: prev[trackId] === undefined ? false : !prev[trackId]
    }));
  };

  const collapseOrExpandAllTracks = (expand: boolean) => {
    if (!program?.tracks) return;
    const next: Record<string, boolean> = {};
    for (const t of program.tracks) {
      next[t.id] = expand;
    }
    setExpandedTracks(next);
  };

  if (isLoading) return <LoadingState label="Loading training program details" />;
  if (isError || !program) return <ErrorState error={(error as Error)?.message} retry={() => refetch()} />;

  const firstTrackId = program.tracks && program.tracks.length > 0 ? program.tracks[0].id : '';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="mb-2">
        <Link href="/programs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6e7e76] hover:text-[#235341]">
          <ArrowLeft size={14} /> Back to Programs List
        </Link>
      </div>

      {/* Program Summary Panel */}
      <div className="panel p-6 bg-white border border-[#e4ebe4]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-[#2d5d4a] bg-[#eef5f1] px-2.5 py-0.5 rounded-full border border-[#d6e5dc]">
                {program.code}
              </span>
              <StatusBadge status={program.status} />

              {/* One-click Publish / Draft Switcher */}
              {program.status?.toLowerCase() === 'published' ? (
                <button
                  onClick={() => updateProgramMutation.mutate({ status: 'draft' })}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a] border border-[#fcd34d] transition"
                  title="Unpublish this course (switch to Draft)"
                >
                  Unpublish to Draft
                </button>
              ) : (
                <button
                  onClick={() => updateProgramMutation.mutate({ status: 'published' })}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#059669] hover:bg-[#d1fae5] border border-[#a7f3d0] transition"
                  title="Publish this course to Explore & Purchase catalog"
                >
                  <CheckCircle2 size={12} /> Publish Program
                </button>
              )}

              {/* Course Price Badge */}
              <span className="text-xs font-black text-[#1e293b] bg-[#f8fafc] border border-[#cbd5e1] px-2.5 py-0.5 rounded-full" title="Course Price">
                ₹{Number(program.price || 2000).toLocaleString('en-IN')}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#23352e] pt-1">{program.name}</h1>
            <p className="text-xs text-[#718079] leading-relaxed">
              {program.description || 'Program description not configured.'}
            </p>
          </div>

          {/* TOP RIGHT ACTION BUTTONS (MATCHING IMAGE 2) */}
          <div className="flex flex-wrap items-center gap-2.5 relative">
            {/* 1. Import Curriculum from Excel Button (Replaces Live Session) */}
            <button
              onClick={() => {
                setImportFile(null);
                setImportResult(null);
                setImportError('');
                setImportModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-bold text-[#1e293b] hover:bg-[#f8fafc] shadow-xs transition"
              title="Import all Days, Modules, Videos, Summaries, Quizzes and Assignments at once from Excel"
            >
              <FileSpreadsheet size={16} className="text-[#107c41]" />
              <span>Import Excel</span>
            </button>

            {/* Delete Course Button */}
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to permanently delete course "${program.name}" (${program.code})? This will delete all its modules, days, and student records.`)) {
                  deleteProgramMutation.mutate();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 px-3.5 py-2 text-xs font-bold shadow-xs transition"
              title="Delete Course Program"
            >
              <Trash2 size={15} />
              <span>Delete Course</span>
            </button>

            {/* 2. Solid Blue "+ Add Content" Button with Dropdown (MATCHING IMAGE 2) */}
            <div className="relative">
              <button
                onClick={() => setAddContentDropdownOpen(!addContentDropdownOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0047ba] hover:bg-[#003893] text-white px-4 py-2 text-xs font-bold shadow-sm transition"
              >
                <Plus size={15} />
                <span>Add Content</span>
              </button>

              {/* DROPDOWN MENU (MATCHING IMAGE 2) */}
              {addContentDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-white shadow-xl border border-[#e2e8f0] py-2 z-50 text-xs font-semibold text-[#1e293b] enter"
                  onMouseLeave={() => setAddContentDropdownOpen(false)}
                >
                  <button
                    onClick={() => {
                      setAddContentDropdownOpen(false);
                      setTrackName('');
                      setTrackDesc('');
                      setTrackModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f1f5f9] text-left transition"
                  >
                    <FolderClosed size={16} className="text-[#3b82f6]" />
                    <span>Add Module</span>
                  </button>

                  <button
                    onClick={() => {
                      setAddContentDropdownOpen(false);
                      setTrackName('');
                      setTrackDesc('');
                      setSubModuleModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f1f5f9] text-left transition"
                  >
                    <FileText size={16} className="text-[#64748b]" />
                    <span>Add Sub-module</span>
                  </button>

                  <button
                    onClick={() => {
                      setAddContentDropdownOpen(false);
                      setSelectedTrackId(firstTrackId);
                      resetDayForm();
                      setDayModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f1f5f9] text-left transition"
                  >
                    <Edit size={16} className="text-[#64748b]" />
                    <span>Add Lesson</span>
                  </button>

                  <button
                    onClick={() => {
                      setAddContentDropdownOpen(false);
                      if (program.tracks?.[0]?.days?.[0]) {
                        openQuizModal(program.tracks[0].days[0]);
                      } else {
                        setSelectedTrackId(firstTrackId);
                        resetDayForm();
                        setDayModalOpen(true);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f1f5f9] text-left transition"
                  >
                    <ListOrdered size={16} className="text-[#64748b]" />
                    <span>Add Quiz</span>
                  </button>

                  <button
                    onClick={() => {
                      setAddContentDropdownOpen(false);
                      if (program.tracks?.[0]?.days?.[0]) {
                        openAssignmentModal(program.tracks[0].days[0]);
                      } else {
                        setSelectedTrackId(firstTrackId);
                        resetDayForm();
                        setDayModalOpen(true);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f1f5f9] text-left transition"
                  >
                    <ClipboardCheck size={16} className="text-[#64748b]" />
                    <span>Add Assignment</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CURRICULUM DAYS & MODULES (MATCHING IMAGE 1) */}
      <div className="space-y-6">
        {program.tracks && program.tracks.length > 0 && (
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-semibold text-[#64748b]">
              {program.tracks.length} Module{program.tracks.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => collapseOrExpandAllTracks(false)}
                className="text-xs font-semibold text-[#475569] hover:text-[#1e293b] bg-white hover:bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 transition flex items-center gap-1"
              >
                <ChevronUp size={13} /> Hide All Modules
              </button>
              <button
                type="button"
                onClick={() => collapseOrExpandAllTracks(true)}
                className="text-xs font-semibold text-[#0047ba] hover:bg-[#eff6ff] bg-white px-2.5 py-1 rounded-md border border-slate-200 transition flex items-center gap-1"
              >
                <ChevronDown size={13} /> Show All Modules
              </button>
            </div>
          </div>
        )}
        {program.tracks && program.tracks.length > 0 ? (
          program.tracks.map((track: any) => {
            const isTrackExpanded = expandedTracks[track.id] !== false; // default expanded
            return (
            <div key={track.id} className="space-y-4">
              {/* Module Header */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-[#e2e8f0] shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleExpandTrack(track.id)}
                  className="flex items-center gap-2 text-left flex-1 cursor-pointer group"
                  title={isTrackExpanded ? 'Hide Module Days' : 'Show Module Days'}
                >
                  {isTrackExpanded ? (
                    <ChevronUp size={16} className="text-[#475569] group-hover:text-[#0047ba] shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-[#475569] group-hover:text-[#0047ba] shrink-0" />
                  )}
                  <h3 className="text-sm font-bold text-[#334155] group-hover:text-[#0047ba] uppercase tracking-wider transition">
                    {track.name} ({track.days?.length || 0} Days)
                  </h3>
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedTracks(prev => ({ ...prev, [track.id]: true }));
                      setSelectedTrackId(track.id);
                      resetDayForm();
                      setDayModalOpen(true);
                    }}
                    className="text-xs font-semibold text-[#0047ba] hover:underline flex items-center gap-1"
                  >
                    <Plus size={13} /> Add Day
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete the module "${track.name}" and all its days? This cannot be undone.`)) {
                        deleteTrackMutation.mutate(track.id);
                      }
                    }}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
                    title="Delete Module"
                  >
                    <Trash2 size={13} /> Delete Module
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpandTrack(track.id)}
                    className="p-1.5 text-[#475569] hover:text-[#1e293b] hover:bg-[#f1f5f9] rounded-md transition flex items-center gap-1 text-xs font-semibold"
                    title={isTrackExpanded ? 'Hide Module Days' : 'Show Module Days'}
                  >
                    <span>{isTrackExpanded ? 'Hide' : 'Show'}</span>
                    {isTrackExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {/* Days List (MATCHING IMAGE 1) */}
              {isTrackExpanded && (
              <div className="space-y-4">
                {track.days && track.days.length > 0 ? (
                  track.days.map((day: any) => {
                    const isExpanded = expandedDays[day.id] !== false; // default expanded
                    const formattedNum = day.dayNumber < 10 ? `0${day.dayNumber}` : day.dayNumber;

                    return (
                      <div
                        key={day.id}
                        className="bg-white rounded-xl border border-[#e2e8f0] shadow-2xs overflow-hidden transition"
                      >
                        {/* MAIN DAY / MODULE ROW */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f5f9] bg-white">
                          {/* Left: Folder Icon + Title (e.g. 01.Python Setup) */}
                          <div
                            className="flex items-center gap-3.5 cursor-pointer flex-1"
                            onClick={() => toggleExpandDay(day.id)}
                          >
                            <FolderClosed size={20} className="text-[#475569] shrink-0" />
                            <span className="font-bold text-sm text-[#1e293b]">
                              {formattedNum}.{day.title}
                            </span>
                          </div>

                          {/* Right: Edit Day, + Add Content, (✓) Published ∨ dropdown, Delete Day, ^ Chevron */}
                          <div className="flex items-center gap-2 sm:gap-3" onClick={(e) => e.stopPropagation()}>
                            {/* Edit Day button */}
                            <button
                              type="button"
                              onClick={() => openEditDayModal(day)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1e293b] hover:text-[#0047ba] bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 transition"
                              title="Edit Day Title, Description & Links"
                            >
                              <Edit size={12} /> Edit Day
                            </button>

                            {/* + Add Content link */}
                            <button
                              onClick={() => openAssignmentModal(day)}
                              className="text-xs font-medium text-[#1e293b] hover:text-[#0047ba] transition"
                            >
                              + Add Content
                            </button>

                            {/* (✓) Published ∨ status pill & menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenDayMenuId(openDayMenuId === day.id ? null : day.id)}
                                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full transition border cursor-pointer ${
                                  day.published
                                    ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0] hover:bg-[#d1fae5]'
                                    : 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1] hover:bg-[#e2e8f0]'
                                }`}
                                title="Click to change status (Published / Draft) or Delete"
                              >
                                <CheckCircle2 size={14} className={day.published ? 'text-[#059669]' : 'text-[#94a3b8]'} />
                                <span>{day.published ? 'Published' : 'Draft'}</span>
                                <ChevronDown size={13} className="opacity-70" />
                              </button>

                              {openDayMenuId === day.id && (
                                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Change Status
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      toggleDayPublishedMutation.mutate({ dayId: day.id, published: true });
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition text-left hover:bg-slate-50 ${
                                      day.published ? 'text-emerald-700 font-bold bg-emerald-50/60' : 'text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 size={14} className="text-emerald-600" />
                                      <span>Publish</span>
                                    </div>
                                    {day.published && <span className="text-[10px] text-emerald-600 font-semibold">Active</span>}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      toggleDayPublishedMutation.mutate({ dayId: day.id, published: false });
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition text-left hover:bg-slate-50 ${
                                      !day.published ? 'text-slate-800 font-bold bg-slate-100' : 'text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 inline-block" />
                                      <span>Unpublish (Draft)</span>
                                    </div>
                                    {!day.published && <span className="text-[10px] text-slate-500 font-semibold">Draft</span>}
                                  </button>
                                  <div className="my-1.5 border-t border-slate-100" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDayMenuId(null);
                                      if (window.confirm(`Are you sure you want to delete Day ${day.dayNumber}: "${day.title}"? This cannot be undone.`)) {
                                        deleteDayMutation.mutate(day.id);
                                      }
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition text-left"
                                  >
                                    <Trash2 size={14} className="text-rose-600" />
                                    <span>Delete Day</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Direct Delete Day Icon */}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete Day ${day.dayNumber}: "${day.title}"? This cannot be undone.`)) {
                                  deleteDayMutation.mutate(day.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Day"
                            >
                              <Trash2 size={16} />
                            </button>

                            {/* ^ Chevron to expand / collapse */}
                            <button
                              type="button"
                              onClick={() => toggleExpandDay(day.id)}
                              className="p-1 text-[#475569] hover:text-[#0f172a] transition cursor-pointer"
                              title={isExpanded ? 'Collapse Day' : 'Expand Day'}
                            >
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </div>
                        </div>

                        {/* EXPANDED CONTENT: STRICTLY THE 4 ITEMS */}
                        {isExpanded && (
                          <div className="divide-y divide-[#f1f5f9] bg-[#ffffff] pl-6 pr-6">
                            {/* 1. 01.Summary */}
                            <div
                              onClick={() => openSummaryModal(day)}
                              className="flex items-center justify-between py-3.5 pl-6 hover:bg-[#f8fafc] cursor-pointer rounded-lg transition group"
                            >
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <Video size={16} className="text-[#475569] shrink-0" />
                                <span className="text-xs font-semibold text-[#1e293b] group-hover:text-[#0047ba] transition">
                                  01.Summary
                                </span>
                                {(day.summary_url || day.summaryUrl) && (
                                  <a
                                    href={day.summary_url || day.summaryUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047ba] hover:underline bg-[#eff6ff] px-2 py-0.5 rounded border border-[#bfdbfe]"
                                    title="Open redirect link in new tab"
                                  >
                                    <ExternalLink size={11} /> Open Link
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openSummaryModal(day);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047ba] hover:underline bg-[#eff6ff] hover:bg-[#dbeafe] px-2.5 py-1 rounded border border-[#bfdbfe] transition"
                                  title="Edit summary link and notes"
                                >
                                  <Edit size={12} /> Edit Link
                                </button>
                              </div>

                              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                  day.published
                                    ? 'text-[#059669] bg-[#ecfdf5] border-[#a7f3d0]'
                                    : 'text-[#64748b] bg-[#f1f5f9] border-[#cbd5e1]'
                                }`}>
                                  <CheckCircle2 size={13} className={day.published ? 'text-[#059669]' : 'text-[#94a3b8]'} />
                                  <span>{day.published ? 'Published' : 'Draft'}</span>
                                </span>
                                {(day.summary_main || day.summary_url || day.summaryUrl) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm("Remove Summary and notes from this day?")) {
                                        updateDayMutation.mutate({
                                          dayId: day.id,
                                          data: { summary_main: '', summary_url: '', summary_telugu: '', summary_english: '' }
                                        });
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                    title="Clear / Delete Summary"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* 2. 02.Main Class Video */}
                            <div
                              onClick={() => openVideoModal(day)}
                              className="flex items-center justify-between py-3.5 pl-6 hover:bg-[#f8fafc] cursor-pointer rounded-lg transition group"
                            >
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <Video size={16} className="text-[#475569] shrink-0" />
                                <span className="text-xs font-semibold text-[#1e293b] group-hover:text-[#0047ba] transition">
                                  02.Main Class Video
                                </span>
                                {(day.video_url || day.summary_video_url || day.videoUrl) && (
                                  <a
                                    href={day.video_url || day.summary_video_url || day.videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047ba] hover:underline bg-[#eff6ff] px-2 py-0.5 rounded border border-[#bfdbfe]"
                                    title="Open video link in new tab"
                                  >
                                    <ExternalLink size={11} /> Open Video
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openVideoModal(day);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047ba] hover:underline bg-[#eff6ff] hover:bg-[#dbeafe] px-2.5 py-1 rounded border border-[#bfdbfe] transition"
                                  title="Edit video link"
                                >
                                  <Edit size={12} /> Edit Link
                                </button>
                              </div>

                              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                  day.published
                                    ? 'text-[#059669] bg-[#ecfdf5] border-[#a7f3d0]'
                                    : 'text-[#64748b] bg-[#f1f5f9] border-[#cbd5e1]'
                                }`}>
                                  <CheckCircle2 size={13} className={day.published ? 'text-[#059669]' : 'text-[#94a3b8]'} />
                                  <span>{day.published ? 'Published' : 'Draft'}</span>
                                </span>
                                {(day.video_url || day.summary_video_url || day.videoUrl) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm("Remove Class Video from this day?")) {
                                        updateDayMutation.mutate({
                                          dayId: day.id,
                                          data: { video_url: '', summary_video_url: '' }
                                        });
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                    title="Clear / Delete Video"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* 3. 03.Quiz (i) */}
                            <div
                              onClick={() => openQuizModal(day)}
                              className="flex items-center justify-between py-3.5 pl-6 hover:bg-[#f8fafc] cursor-pointer rounded-lg transition group"
                            >
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <ListOrdered size={16} className="text-[#475569] shrink-0" />
                                <span className="text-xs font-semibold text-[#1e293b] group-hover:text-[#0047ba] transition">
                                  03.Quiz
                                </span>
                                <Info size={14} className="text-[#94a3b8]" />
                                {(day.quiz_url || day.quizUrl) && (
                                  <a
                                    href={day.quiz_url || day.quizUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047ba] hover:underline bg-[#eff6ff] px-2 py-0.5 rounded border border-[#bfdbfe]"
                                    title="Open quiz link in new tab"
                                  >
                                    <ExternalLink size={11} /> Open Quiz
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openQuizModal(day);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047ba] hover:underline bg-[#eff6ff] hover:bg-[#dbeafe] px-2.5 py-1 rounded border border-[#bfdbfe] transition"
                                  title="Edit quiz link"
                                >
                                  <Edit size={12} /> Edit Link
                                </button>
                              </div>

                              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                  day.published
                                    ? 'text-[#059669] bg-[#ecfdf5] border-[#a7f3d0]'
                                    : 'text-[#64748b] bg-[#f1f5f9] border-[#cbd5e1]'
                                }`}>
                                  <CheckCircle2 size={13} className={day.published ? 'text-[#059669]' : 'text-[#94a3b8]'} />
                                  <span>{day.published ? 'Published' : 'Draft'}</span>
                                </span>
                                {(day.quiz_url || day.quizUrl) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm("Remove Quiz link from this day?")) {
                                        updateDayMutation.mutate({
                                          dayId: day.id,
                                          data: { quiz_url: '' }
                                        });
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                    title="Clear / Delete Quiz"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* 4. 04.Assignment (i) */}
                            <div
                              onClick={() => openAssignmentModal(day)}
                              className="flex items-center justify-between py-3.5 pl-6 hover:bg-[#f8fafc] cursor-pointer rounded-lg transition group"
                            >
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <ClipboardCheck size={16} className="text-[#475569] shrink-0" />
                                <span className="text-xs font-semibold text-[#1e293b] group-hover:text-[#0047ba] transition">
                                  04.Assignment
                                </span>
                                <Info size={14} className="text-[#94a3b8]" />
                                {(day.assignment_url || day.assignmentUrl) && (
                                  <a
                                    href={day.assignment_url || day.assignmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047ba] hover:underline bg-[#eff6ff] px-2 py-0.5 rounded border border-[#bfdbfe]"
                                    title="Open assignment link in new tab"
                                  >
                                    <ExternalLink size={11} /> Open Assignment
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAssignmentModal(day);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0047ba] hover:underline bg-[#eff6ff] hover:bg-[#dbeafe] px-2.5 py-1 rounded border border-[#bfdbfe] transition"
                                  title="Edit assignment link"
                                >
                                  <Edit size={12} /> Edit Link
                                </button>
                              </div>

                              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                  day.published
                                    ? 'text-[#059669] bg-[#ecfdf5] border-[#a7f3d0]'
                                    : 'text-[#64748b] bg-[#f1f5f9] border-[#cbd5e1]'
                                }`}>
                                  <CheckCircle2 size={13} className={day.published ? 'text-[#059669]' : 'text-[#94a3b8]'} />
                                  <span>{day.published ? 'Published' : 'Draft'}</span>
                                </span>
                                {(day.assignment_url || day.assignmentUrl || day.require_task_submission) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm("Remove Assignment from this day?")) {
                                        updateDayMutation.mutate({
                                          dayId: day.id,
                                          data: { assignment_url: '', require_task_submission: false }
                                        });
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                    title="Clear / Delete Assignment"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 panel bg-white text-center text-xs text-[#64748b]">
                    No modules or days created for this course yet. Click <strong>+ Add Content</strong> to create Day 1!
                  </div>
                )}
              </div>
              )}
            </div>
            );
          })
        ) : (
          <div className="p-12 panel bg-white text-center">
            <EmptyState
              title="Curriculum Empty"
              detail="Click '+ Add Content' above to create your first Module and 7-day learning sessions."
              icon={Layers}
            />
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODALS FOR EDITING THE 4 DAY ITEMS (MATCHING IMAGE 1)          */}
      {/* ============================================================== */}

      {/* 1. SUMMARY MODAL (01.Summary) */}
      {summaryModalOpen && selectedDay && (
        <Modal
          title={`Edit 01.Summary: ${selectedDay.title}`}
          onClose={() => setSummaryModalOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              updateDayMutation.mutate({
                summary_url: normalizeUrl(summaryUrl),
                summary_main: summaryMain,
                summary_english: summaryEnglish,
                summary_telugu: summaryTelugu
              });
            }}
            className="space-y-4 text-xs"
          >
            {formError && (
              <div className="rounded-lg bg-[#faecea] p-2.5 text-xs font-medium text-[#b8483d] border border-[#f5c4be]">
                {formError}
              </div>
            )}
            <div>
              <label className="mb-1 block font-semibold text-[#334155]">
                Existing Summary Link / Redirect URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={summaryUrl}
                  onChange={(e) => setSummaryUrl(e.target.value)}
                  placeholder="https://docs.python.org/ or documentation/notion link…"
                  className="field text-xs flex-1"
                />
                {summaryUrl && (
                  <a
                    href={summaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={13} /> Test Link
                  </a>
                )}
              </div>
              <span className="text-[10px] text-[#64748b] mt-1 block">
                When students click 01.Summary, they will be redirected to this page.
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Main Lecture Summary Notes (Optional)</label>
              <textarea
                rows={3}
                value={summaryMain}
                onChange={(e) => setSummaryMain(e.target.value)}
                placeholder="Core learning takeaways and bullet points…"
                className="field text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">English Summary (Optional)</label>
              <textarea
                rows={2}
                value={summaryEnglish}
                onChange={(e) => setSummaryEnglish(e.target.value)}
                placeholder="Detailed English walkthrough and explanation…"
                className="field text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Telugu Summary (తెలుగు సారాంశం - Optional)</label>
              <textarea
                rows={2}
                value={summaryTelugu}
                onChange={(e) => setSummaryTelugu(e.target.value)}
                placeholder="ఈ సెషన్ యొక్క సారాంశం తెలుగులో రాయండి…"
                className="field text-xs"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setSummaryModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={updateDayMutation.isPending} className="btn btn-primary text-xs">
                {updateDayMutation.isPending ? 'Saving…' : 'Save Summary'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. MAIN CLASS VIDEO MODAL (02.Main Class Video) */}
      {videoModalOpen && selectedDay && (
        <Modal
          title={`Edit 02.Main Class Video: ${selectedDay.title}`}
          onClose={() => setVideoModalOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              updateDayMutation.mutate({
                summary_video_url: normalizeUrl(dayVideo),
                video_url: normalizeUrl(dayVideo)
              });
            }}
            className="space-y-4 text-xs"
          >
            {formError && (
              <div className="rounded-lg bg-[#faecea] p-2.5 text-xs font-medium text-[#b8483d] border border-[#f5c4be]">
                {formError}
              </div>
            )}
            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Main Class Video Link / Redirect URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="https://www.youtube.com/watch?v=... or MP4 / Vimeo embed URL"
                  value={dayVideo}
                  onChange={(e) => setDayVideo(e.target.value)}
                  className="field text-xs flex-1"
                />
                {dayVideo && (
                  <a
                    href={dayVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={13} /> Test Link
                  </a>
                )}
              </div>
              <span className="text-[10px] text-[#64748b] mt-1 block">
                Supports YouTube, Vimeo, or direct MP4 lecture video links.
              </span>
            </div>

            {dayVideo && (
              <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block mb-2">Video Preview</span>
                <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                  <iframe
                    src={(() => {
                      const norm = normalizeUrl(dayVideo);
                      if (norm.includes('watch?v=')) {
                        const vid = norm.split('watch?v=')[1]?.split('&')[0];
                        return vid ? `https://www.youtube.com/embed/${vid}` : norm;
                      }
                      if (norm.includes('youtu.be/')) {
                        const vid = norm.split('youtu.be/')[1]?.split('?')[0];
                        return vid ? `https://www.youtube.com/embed/${vid}` : norm;
                      }
                      return norm;
                    })()}
                    title="Preview"
                    className="w-full h-full border-0"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setVideoModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={updateDayMutation.isPending} className="btn btn-primary text-xs">
                {updateDayMutation.isPending ? 'Saving…' : 'Save Main Video'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. QUIZ MODAL (03.Quiz) */}
      {quizModalOpen && selectedDay && (
        <Modal
          title={`Configure 03.Quiz: ${selectedDay.title}`}
          onClose={() => setQuizModalOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              updateDayMutation.mutate({
                quiz_url: normalizeUrl(quizUrl),
                description: quizInstructions
              });
            }}
            className="space-y-4 text-xs"
          >
            {formError && (
              <div className="rounded-lg bg-[#faecea] p-2.5 text-xs font-medium text-[#b8483d] border border-[#f5c4be]">
                {formError}
              </div>
            )}
            <div>
              <label className="mb-1 block font-semibold text-[#334155]">
                Existing Quiz Link / Redirect URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quizUrl}
                  onChange={(e) => setQuizUrl(e.target.value)}
                  placeholder="https://forms.google.com/... or test/quiz platform URL"
                  className="field text-xs flex-1"
                />
                {quizUrl && (
                  <a
                    href={quizUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={13} /> Test Link
                  </a>
                )}
              </div>
              <span className="text-[10px] text-[#64748b] mt-1 block">
                When students click 03.Quiz, they will be redirected to this quiz page.
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Quiz Title</label>
              <input
                type="text"
                required
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                className="field text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Quiz Questions & Instructions (Optional)</label>
              <textarea
                rows={3}
                value={quizInstructions}
                onChange={(e) => setQuizInstructions(e.target.value)}
                placeholder="Instructions or questions if needed…"
                className="field text-xs font-mono text-[11px]"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#f0f9ff] border border-[#bae6fd] text-[11px] text-[#0369a1] flex items-center gap-2">
              <Info size={16} className="shrink-0 text-[#0284c7]" />
              <span>Students can click 03.Quiz to be redirected directly to your existing quiz.</span>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setQuizModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={updateDayMutation.isPending} className="btn btn-primary text-xs">
                {updateDayMutation.isPending ? 'Saving…' : 'Save Quiz'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. ASSIGNMENT MODAL (04.Assignment) */}
      {assignmentModalOpen && selectedDay && (
        <Modal
          title={`Configure 04.Assignment: ${selectedDay.title}`}
          onClose={() => setAssignmentModalOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              updateDayMutation.mutate({
                assignment_url: normalizeUrl(assignmentUrl),
                require_google_drive_submission: requireDrive,
                require_approval: dayApproval,
                description: assignmentInstructions
              });
            }}
            className="space-y-4 text-xs"
          >
            {formError && (
              <div className="rounded-lg bg-[#faecea] p-2.5 text-xs font-medium text-[#b8483d] border border-[#f5c4be]">
                {formError}
              </div>
            )}
            <div>
              <label className="mb-1 block font-semibold text-[#334155]">
                Existing Assignment Link / Redirect URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={assignmentUrl}
                  onChange={(e) => setAssignmentUrl(e.target.value)}
                  placeholder="https://docs.google.com/... or GitHub / project spec link"
                  className="field text-xs flex-1"
                />
                {assignmentUrl && (
                  <a
                    href={assignmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={13} /> Test Link
                  </a>
                )}
              </div>
              <span className="text-[10px] text-[#64748b] mt-1 block">
                When students click 04.Assignment, they will be redirected to this assignment page.
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Assignment Title</label>
              <input
                type="text"
                required
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
                className="field text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Assignment Instructions & Deliverables (Optional)</label>
              <textarea
                rows={3}
                value={assignmentInstructions}
                onChange={(e) => setAssignmentInstructions(e.target.value)}
                placeholder="Build the practical project, upload files to Google Drive, and submit the link…"
                className="field text-xs"
              />
            </div>

            {/* Google Drive Requirement Checkbox */}
            <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#1e293b]">
                <input
                  type="checkbox"
                  checked={requireDrive}
                  onChange={(e) => setRequireDrive(e.target.checked)}
                  className="rounded text-[#0047ba]"
                />
                <span>Require Student Google Drive Link Submission</span>
              </label>
              <p className="text-[11px] text-[#64748b] pl-5">
                When enabled, the student must provide their Google Drive link on the Task Submission page to complete this day.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setAssignmentModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={updateDayMutation.isPending} className="btn btn-primary text-xs">
                {updateDayMutation.isPending ? 'Saving…' : 'Save Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* IMPORT CURRICULUM FROM EXCEL MODAL */}
      {importModalOpen && (
        <Modal
          title="Import Curriculum from Excel / CSV"
          onClose={() => {
            if (!isImporting) {
              setImportModalOpen(false);
              setImportFile(null);
              setImportResult(null);
              setImportError('');
            }
          }}
        >
          <div className="space-y-4 text-xs">
            {/* Explanatory banner */}
            <div className="p-3.5 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] text-[#14532d] space-y-2">
              <div className="flex items-start gap-2">
                <FileSpreadsheet size={18} className="text-[#16a34a] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-[#15803d]">Batch Create Course Curriculum</h4>
                  <p className="text-[11px] text-[#166534] mt-0.5 leading-relaxed">
                    Upload an Excel (<span className="font-mono font-semibold">.xlsx / .xls</span>) or <span className="font-mono font-semibold">.csv</span> file to generate all learning days (e.g. Day 1 to Day 9), tracks/modules, main class videos, summaries, quizzes, and assignments automatically in sequenced order.
                  </p>
                </div>
              </div>

              {/* Download Template Action */}
              <div className="pt-2 border-t border-[#bbf7d0]/60 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#166534]">Need the official spreadsheet layout?</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await programsApi.downloadTemplate(id, program?.name);
                    } catch (err: any) {
                      alert('Download failed: ' + (err.message || 'Error'));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#86efac] text-[#15803d] text-[11px] font-bold hover:bg-[#dcfce7] shadow-xs transition"
                >
                  <Download size={13} />
                  <span>Download Excel Template (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Expected Format Columns Guide */}
            <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
              <span className="font-bold text-[#334155] block mb-1.5 text-[11px] uppercase tracking-wider">
                Recognized Excel Column Headers:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: 'Day', desc: '1, 2, ... 9' },
                  { name: 'Module', desc: 'Track / Module name' },
                  { name: 'Day Title', desc: 'Topic title' },
                  { name: 'Summary', desc: 'Overview notes' },
                  { name: 'Main Class Video', desc: 'YouTube/Drive/Zoom URL' },
                  { name: 'Quiz', desc: 'Quiz URL' },
                  { name: 'Assignment', desc: 'Task / Project instructions' },
                  { name: 'Checklist', desc: 'Tasks separated by commas' },
                  { name: 'Resources', desc: 'Reference links' }
                ].map((col) => (
                  <span
                    key={col.name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#cbd5e1] text-[10px] text-[#475569]"
                    title={col.desc}
                  >
                    <span className="font-bold text-[#0f172a]">{col.name}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Success Results Banner */}
            {importResult && (
              <div className="p-4 rounded-xl bg-[#ecfdf5] border border-[#6ee7b7] text-[#065f46] space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-[#059669]" />
                  <span className="font-bold text-xs">{importResult.message}</span>
                </div>
                {importResult.stats && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#a7f3d0] text-[11px]">
                    <div className="bg-white/80 p-2 rounded-lg border border-[#a7f3d0]">
                      <span className="text-[#047857] block font-semibold">Days Created</span>
                      <span className="text-base font-bold text-[#065f46]">{importResult.stats.days_created}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-[#a7f3d0]">
                      <span className="text-[#047857] block font-semibold">Days Updated</span>
                      <span className="text-base font-bold text-[#065f46]">{importResult.stats.days_updated}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-[#a7f3d0]">
                      <span className="text-[#047857] block font-semibold">Resources Added</span>
                      <span className="text-base font-bold text-[#065f46]">{importResult.stats.resources_created}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-[#a7f3d0]">
                      <span className="text-[#047857] block font-semibold">Assignments</span>
                      <span className="text-base font-bold text-[#065f46]">{importResult.stats.tasks_created}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-[#a7f3d0]">
                      <span className="text-[#047857] block font-semibold">Checklists</span>
                      <span className="text-base font-bold text-[#065f46]">{importResult.stats.checklists_created}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-[#a7f3d0]">
                      <span className="text-[#047857] block font-semibold">Modules / Tracks</span>
                      <span className="text-base font-bold text-[#065f46]">{importResult.stats.tracks_created}</span>
                    </div>
                  </div>
                )}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setImportModalOpen(false);
                      setImportFile(null);
                      setImportResult(null);
                    }}
                    className="btn btn-primary text-xs"
                  >
                    Done & View Curriculum
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {importError && (
              <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] flex items-start gap-2">
                <AlertCircle size={16} className="text-[#dc2626] shrink-0 mt-0.5" />
                <span className="text-xs">{importError}</span>
              </div>
            )}

            {/* File Upload Form (Shown when not yet completed) */}
            {!importResult && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!importFile) {
                    setImportError('Please choose an Excel (.xlsx/.xls) or CSV file first.');
                    return;
                  }
                  setIsImporting(true);
                  setImportError('');
                  try {
                    const res = await programsApi.importExcel(id, importFile);
                    setImportResult(res);
                    refreshProgram();
                  } catch (err: any) {
                    setImportError(err.message || 'Import failed. Please check your Excel structure and try again.');
                  } finally {
                    setIsImporting(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="mb-1.5 block font-semibold text-[#334155]">
                    Select Excel / CSV Curriculum File
                  </label>
                  <div className="relative border-2 border-dashed border-[#cbd5e1] hover:border-[#107c41] rounded-xl p-5 text-center transition bg-[#f8fafc]/50">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setImportFile(f);
                          setImportError('');
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <div className="w-10 h-10 rounded-full bg-[#f0fdf4] text-[#16a34a] flex items-center justify-center">
                        <UploadCloud size={20} />
                      </div>
                      {importFile ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-xs text-[#0f172a]">{importFile.name}</p>
                          <p className="text-[11px] text-[#64748b]">
                            {(importFile.size / 1024).toFixed(1)} KB — Click to choose a different file
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-[#1e293b]">
                            Click or drag & drop to choose Excel file
                          </p>
                          <p className="text-[11px] text-[#64748b]">Supports .xlsx, .xls, and .csv formats</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-[#edf0ea]">
                  <button
                    type="button"
                    disabled={isImporting}
                    className="btn btn-soft text-xs"
                    onClick={() => {
                      setImportModalOpen(false);
                      setImportFile(null);
                      setImportError('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!importFile || isImporting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#107c41] hover:bg-[#0b5c2f] text-white text-xs font-bold shadow-xs disabled:opacity-50 transition"
                  >
                    <FileSpreadsheet size={15} />
                    <span>{isImporting ? 'Importing Curriculum...' : 'Import & Generate Days'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* ADD MODULE / TRACK MODAL */}
      {trackModalOpen && (
        <Modal title="Add Module" onClose={() => setTrackModalOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTrackMutation.mutate({ name: trackName, description: trackDesc });
            }}
            className="space-y-3.5 text-xs"
          >
            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Module Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Python Setup, Data Analytics Basics"
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                className="field text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Module Description</label>
              <textarea
                rows={3}
                placeholder="Description of skills covered in this module…"
                value={trackDesc}
                onChange={(e) => setTrackDesc(e.target.value)}
                className="field text-xs"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setTrackModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={addTrackMutation.isPending} className="btn btn-primary text-xs">
                {addTrackMutation.isPending ? 'Creating…' : 'Create Module'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ADD DAY / LESSON MODAL */}
      {dayModalOpen && (
        <Modal
          title="Add Lesson / Day"
          onClose={() => setDayModalOpen(false)}
          maxWidth="max-w-2xl"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              addDayMutation.mutate({
                title: dayTitle.trim(),
                day_number: dayNumber || 1,
                description: dayDesc.trim() || undefined,
                summary_url: normalizeUrl(summaryUrl) || undefined,
                summary_main: summaryMain.trim() || undefined,
                summary_english: summaryEnglish.trim() || undefined,
                summary_telugu: summaryTelugu.trim() || undefined,
                video_url: normalizeUrl(dayVideo) || undefined,
                summary_video_url: normalizeUrl(dayVideo) || undefined,
                quiz_url: normalizeUrl(quizUrl) || undefined,
                assignment_url: normalizeUrl(assignmentUrl) || undefined,
                require_google_drive_submission: requireDrive,
                base_reward_points: dayPoints || 20,
                published: true
              });
            }}
            className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1"
          >
            {formError && (
              <div className="rounded-lg bg-[#faecea] p-2.5 text-xs font-medium text-[#b8483d] border border-[#f5c4be]">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="sm:col-span-3">
                <label className="mb-1 block font-semibold text-[#334155]">Day / Lesson Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python Setup, Variables & Control Flow"
                  value={dayTitle}
                  onChange={(e) => setDayTitle(e.target.value)}
                  className="field text-xs w-full"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#334155]">Day Sequence # *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={dayNumber ?? ''}
                  onChange={(e) => setDayNumber(e.target.value === '' ? undefined : Number(e.target.value))}
                  placeholder="1"
                  className="field text-xs w-full font-bold"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#334155]">Short Description</label>
              <input
                type="text"
                placeholder="Key learning objectives and concepts covered today…"
                value={dayDesc}
                onChange={(e) => setDayDesc(e.target.value)}
                className="field text-xs w-full"
              />
            </div>

            {/* SECTION 1: SUMMARY LINK */}
            <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-1.5">
              <label className="font-bold text-[#1e293b] flex items-center gap-1.5 text-xs">
                <Video size={13} className="text-[#3b82f6]" /> 01. Summary Link / Documentation URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.python.org/ or documentation / notion / slides URL"
                  value={summaryUrl}
                  onChange={(e) => setSummaryUrl(e.target.value)}
                  className="field text-xs flex-1 bg-white"
                />
                {summaryUrl && (
                  <a
                    href={summaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Test
                  </a>
                )}
              </div>
              <span className="text-[10px] text-[#64748b]">
                Students click 01.Summary to open this document or notes link.
              </span>
            </div>

            {/* SECTION 2: MAIN CLASS VIDEO */}
            <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-1.5">
              <label className="font-bold text-[#1e293b] flex items-center gap-1.5 text-xs">
                <Video size={13} className="text-[#10b981]" /> 02. Main Class Video Link / Embed URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=... or direct MP4 / Vimeo video URL"
                  value={dayVideo}
                  onChange={(e) => setDayVideo(e.target.value)}
                  className="field text-xs flex-1 bg-white"
                />
                {dayVideo && (
                  <a
                    href={dayVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Test
                  </a>
                )}
              </div>
              <span className="text-[10px] text-[#64748b]">
                The main recorded lecture or class session for students to watch.
              </span>
            </div>

            {/* SECTION 3: QUIZ */}
            <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-1.5">
              <label className="font-bold text-[#1e293b] flex items-center gap-1.5 text-xs">
                <ListOrdered size={13} className="text-[#8b5cf6]" /> 03. Quiz Link / Google Form URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://forms.google.com/... or quiz / assessment platform URL"
                  value={quizUrl}
                  onChange={(e) => setQuizUrl(e.target.value)}
                  className="field text-xs flex-1 bg-white"
                />
                {quizUrl && (
                  <a
                    href={quizUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Test
                  </a>
                )}
              </div>
              <span className="text-[10px] text-[#64748b]">
                Students click 03.Quiz to take the day's concept evaluation.
              </span>
            </div>

            {/* SECTION 4: ASSIGNMENT */}
            <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-1.5">
              <label className="font-bold text-[#1e293b] flex items-center gap-1.5 text-xs">
                <ClipboardCheck size={13} className="text-[#f59e0b]" /> 04. Assignment Brief Link / Google Doc URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/... or GitHub / project assignment document"
                  value={assignmentUrl}
                  onChange={(e) => setAssignmentUrl(e.target.value)}
                  className="field text-xs flex-1 bg-white"
                />
                {assignmentUrl && (
                  <a
                    href={assignmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Test
                  </a>
                )}
              </div>
              <span className="text-[10px] text-[#64748b]">
                The instructions, problem statements, and requirements for the daily task.
              </span>
            </div>

            {/* SECTION 5: GOOGLE DRIVE REQUIREMENT */}
            <div className="p-3 bg-[#ecfdf5] rounded-xl border border-[#a7f3d0] flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-[#065f46] text-xs block">05. Google Drive Link Submission</span>
                <span className="text-[11px] text-[#047857]">Requires student to submit Word Document / Drive link to complete day</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-[#065f46]">
                <input
                  type="checkbox"
                  checked={requireDrive}
                  onChange={(e) => setRequireDrive(e.target.checked)}
                  className="rounded text-[#059669]"
                />
                <span>Required</span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setDayModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={addDayMutation.isPending} className="btn btn-primary text-xs font-bold">
                {addDayMutation.isPending ? 'Creating…' : 'Create Day (with Links)'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT DAY MODAL (FULL EDIT FOR DAY TITLE & ALL 5 SECTIONS) */}
      {editDayModalOpen && selectedDay && (
        <Modal
          title={`Edit Day ${dayNumber || selectedDay.dayNumber || selectedDay.day_number}: ${dayTitle || selectedDay.title}`}
          onClose={() => setEditDayModalOpen(false)}
          maxWidth="max-w-2xl"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFormError('');
              updateDayMutation.mutate({
                title: dayTitle.trim(),
                day_number: dayNumber,
                base_reward_points: dayPoints,
                reward_points: dayPoints,
                description: dayDesc,
                summary_url: normalizeUrl(summaryUrl),
                summary_main: summaryMain,
                summary_english: summaryEnglish,
                summary_telugu: summaryTelugu,
                video_url: normalizeUrl(dayVideo),
                summary_video_url: normalizeUrl(dayVideo),
                quiz_url: normalizeUrl(quizUrl),
                assignment_url: normalizeUrl(assignmentUrl),
                require_google_drive_submission: requireDrive
              });
            }}
            className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1"
          >
            {formError && (
              <div className="rounded-lg bg-[#faecea] p-2.5 text-xs font-medium text-[#b8483d] border border-[#f5c4be]">
                {formError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block font-semibold text-[#334155]">Day / Submodule Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python Setup & Environment Configuration"
                  value={dayTitle}
                  onChange={(e) => setDayTitle(e.target.value)}
                  className="field text-xs w-full"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#334155]">Day Sequence # *</label>
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="1, 2, 3..."
                  value={dayNumber ?? ''}
                  onChange={(e) => setDayNumber(e.target.value ? Number(e.target.value) : undefined)}
                  className="field text-xs w-full font-bold"
                />
              </div>
            </div>

            {/* SECTION 1: SUMMARY LINK */}
            <div className="p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
              <span className="font-bold text-[#1e293b] flex items-center gap-1.5 text-xs">
                <Video size={14} className="text-[#3b82f6]" /> Section 1: Summary Link / Documentation URL
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.python.org/ or documentation/notion link"
                  value={summaryUrl}
                  onChange={(e) => setSummaryUrl(e.target.value)}
                  className="field text-xs flex-1 bg-white"
                />
                {summaryUrl && (
                  <a
                    href={summaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Test
                  </a>
                )}
              </div>
            </div>

            {/* SECTION 2: MAIN CLASS VIDEO */}
            <div className="p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
              <span className="font-bold text-[#1e293b] flex items-center gap-1.5 text-xs">
                <Video size={14} className="text-[#10b981]" /> Section 2: Main Class Video Link / Embed URL
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=... or direct MP4 / Vimeo video URL"
                  value={dayVideo}
                  onChange={(e) => setDayVideo(e.target.value)}
                  className="field text-xs flex-1 bg-white"
                />
                {dayVideo && (
                  <a
                    href={dayVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Test
                  </a>
                )}
              </div>
            </div>

            {/* SECTION 3: QUIZ */}
            <div className="p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
              <span className="font-bold text-[#1e293b] flex items-center gap-1.5 text-xs">
                <ListOrdered size={14} className="text-[#8b5cf6]" /> Section 3: Quiz Link / Google Form URL
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://forms.google.com/... or test / quiz platform URL"
                  value={quizUrl}
                  onChange={(e) => setQuizUrl(e.target.value)}
                  className="field text-xs flex-1 bg-white"
                />
                {quizUrl && (
                  <a
                    href={quizUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Test
                  </a>
                )}
              </div>
            </div>

            {/* SECTION 4: ASSIGNMENT */}
            <div className="p-3.5 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2">
              <span className="font-bold text-[#1e293b] flex items-center gap-1.5 text-xs">
                <ClipboardCheck size={14} className="text-[#f59e0b]" /> Section 4: Assignment Brief Link
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/... or GitHub / project assignment document"
                  value={assignmentUrl}
                  onChange={(e) => setAssignmentUrl(e.target.value)}
                  className="field text-xs flex-1 bg-white"
                />
                {assignmentUrl && (
                  <a
                    href={assignmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-soft text-xs shrink-0 flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> Test
                  </a>
                )}
              </div>
            </div>

            {/* SECTION 5: GOOGLE DRIVE REQUIREMENT */}
            <div className="p-3 bg-[#ecfdf5] rounded-xl border border-[#a7f3d0] flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-[#065f46] text-xs block">Section 5: Google Drive Link Submission</span>
                <span className="text-[11px] text-[#047857]">Requires student to submit Word Document link to complete Day {dayNumber || 1}</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-[#065f46]">
                <input
                  type="checkbox"
                  checked={requireDrive}
                  onChange={(e) => setRequireDrive(e.target.checked)}
                  className="rounded text-[#059669]"
                />
                <span>Enabled</span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-[#edf0ea]">
              <button type="button" className="btn btn-soft text-xs" onClick={() => setEditDayModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={updateDayMutation.isPending} className="btn btn-primary text-xs font-bold">
                {updateDayMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default ProgramDetailPage;
