import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { BookOpen, ArrowRight, Layers, UserCheck } from 'lucide-react';
import { studentApi } from '@/services/api';
import { PageTitle, EmptyState, LoadingState, ErrorState } from '@/components/common/UIComponents';

export function MyProgramsPage() {
  const { data: programs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my_programs'],
    queryFn: studentApi.getMyPrograms
  });

  if (isLoading) return <LoadingState label="Loading your assigned programs" />;
  if (isError) return <ErrorState retry={() => refetch()} />;

  return (
    <div>
      <PageTitle
        eyebrow="Curriculum Enrolled"
        title="My Learning Programs"
        description="Every training program assigned to you, structured into sequential independent tracks."
      />

      {programs.length === 0 ? (
        <div className="panel p-8 bg-white">
          <EmptyState
            title="No programs assigned yet"
            detail="Your workspace administrator has not yet assigned a training program to your account. Contact your administrator or trainer to grant program access."
            icon={BookOpen}
          />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {programs.map((p: any) => (
            <Link
              key={p.id}
              href={`/my-programs/${p.id}`}
              className="panel p-5 bg-white hover:shadow-md transition group block border border-[#e1e6de]"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e3ece4] text-[#2c5b48]">
                  <BookOpen size={18} />
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#2a614d]">
                  <span>{p.progress}%</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                </div>
              </div>

              <h2 className="display mt-4 text-base font-bold text-[#23352e] group-hover:text-[#215340]">
                {p.name}
              </h2>
              <p className="mt-1 min-h-10 text-xs text-[#6e7e76] line-clamp-2 leading-5">
                {p.description || 'Structured learning curriculum.'}
              </p>

              <div className="mt-5 border-t border-[#edf0ea] pt-3">
                <div className="flex items-center justify-between text-xs text-[#73827a] mb-2">
                  <span className="flex items-center gap-1 font-medium">
                    <Layers size={13} /> {p.trackCount || p.tracks} Tracks
                  </span>
                  <span className="text-[11px]">
                    Trainer: {p.employeeName || 'Unassigned'}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#e8eee8] overflow-hidden">
                  <div
                    className="h-full bg-[#2f6651] rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(p.progress, 100)}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
