import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Filter, Download, UserCheck, AlertCircle, Clock,
  CheckCircle2, FileSpreadsheet, Eye, RefreshCw, User, Users,
  X, ChevronRight, GraduationCap
} from 'lucide-react';
import { reviewsApi, programsApi } from '@/services/api';
import { PageTitle, StatusBadge, EmptyState, LoadingState, ErrorState } from '@/components/common/UIComponents';

export function StudentReviewsPage() {
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Fetch available programs for dropdown
  const { data: programs = [] } = useQuery({
    queryKey: ['programs_for_reviews'],
    queryFn: programsApi.list
  });

  // Fetch performance metrics overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['reviews_overview', selectedProgramId],
    queryFn: () => reviewsApi.getOverview(selectedProgramId || undefined)
  });

  // Fetch spreadsheet data
  const { data: sheetData, isLoading: sheetLoading, isError, refetch } = useQuery({
    queryKey: ['reviews_spreadsheet', selectedProgramId, selectedStudentId, search, statusFilter],
    queryFn: () => reviewsApi.getSpreadsheet({
      program_id: selectedProgramId || undefined,
      student_id: (selectedStudentId && selectedStudentId !== 'ALL') ? selectedStudentId : undefined,
      search: search || undefined,
      status_filter: statusFilter || undefined
    })
  });

  const columns = sheetData?.columns || [];
  const rows = sheetData?.rows || [];
  const enrolledStudents: any[] = sheetData?.enrolled_students || [];

  // Automatically select the student if only one is enrolled and none chosen yet
  useEffect(() => {
    if (enrolledStudents.length === 1 && !selectedStudentId) {
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
        description="Comprehensive spreadsheet worksheet dynamically generated from program curriculum, tracking multi-resource progress, assignments, Google Drive submissions, and ratings."
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
              className="btn btn-primary text-xs"
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

            {/* Status Filter */}
            <div className="min-w-[130px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#72837b] block mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="field text-xs py-1.5 w-full"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>

            {/* Search Input with Autocomplete Suggestions */}
            <div className="relative flex-1 min-w-[220px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#72837b] block mb-1">
                Search Student
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-[#93a29a]" />
                <input
                  type="text"
                  placeholder="Search student name or email…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchDropdownOpen(true);
                  }}
                  onFocus={() => setSearchDropdownOpen(true)}
                  className="field pl-8 pr-7 text-xs py-1.5 w-full"
                />
                {search && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="absolute right-2.5 top-2.5 text-[#93a29a] hover:text-[#333]"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {searchDropdownOpen && (
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
              Showing <strong className="text-[#23352e]">{rows.length}</strong> student record(s)
            </span>
          </div>
        </div>
      </div>

      {/* Selected Student Banner (shown when a specific student is picked) */}
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

      {/* When no student is selected and multiple students are enrolled, show interactive student selection cards */}
      {!selectedStudentId && enrolledStudents.length > 0 && (
        <div className="panel p-5 bg-white border border-[#e4ebe4] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#1f3128] flex items-center gap-2">
                <GraduationCap size={16} className="text-[#255b44]" />
                Select a Student to View Performance Worksheet
              </h3>
              <p className="text-xs text-[#63766d] mt-0.5">
                Choose a student to view their dynamic curriculum progress, Google Drive links, and faculty reviews:
              </p>
            </div>
            <button
              onClick={() => setSelectedStudentId('ALL')}
              className="btn btn-soft text-xs text-[#285d47] font-semibold flex items-center gap-1"
            >
              <Users size={13} /> View All Students in Table
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
                    View Details <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Spreadsheet Table */}
      <div className="panel overflow-hidden bg-white border border-[#e4ebe4]">
        {sheetLoading ? (
          <div className="p-12">
            <LoadingState label="Compiling dynamic curriculum worksheet and student evaluations" />
          </div>
        ) : isError ? (
          <div className="p-8">
            <ErrorState retry={() => refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title={selectedStudentId && selectedStudentId !== 'ALL' ? "No performance records found for this student" : "No student evaluations yet"}
              detail={selectedStudentId && selectedStudentId !== 'ALL' ? "This student does not have any curriculum day records for the selected filters." : "When students enroll and submit work across curriculum days, their live spreadsheet performance records will appear here."}
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
                      const isReviewCol = col.key.endsWith('_review');

                      // Render badges based on cell type
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
                        // Extract drive url if formatted as "status (url)"
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
    </div>
  );
}
export default StudentReviewsPage;
