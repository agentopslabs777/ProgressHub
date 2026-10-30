import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Search, Filter, ShieldCheck, Clock } from 'lucide-react';
import { auditLogsApi } from '@/services/api';
import { PageTitle, EmptyState, LoadingState, ErrorState } from '@/components/common/UIComponents';

export function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  const { data: logs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['audit_logs', actionFilter, targetFilter],
    queryFn: () => auditLogsApi.list(actionFilter || undefined, targetFilter || undefined)
  });

  return (
    <div>
      <PageTitle
        eyebrow="Compliance & Security"
        title="Audit Logs"
        description="Immutable record of system operations, program configuration, access grants, and manual overrides."
      />

      <div className="panel overflow-hidden bg-white">
        <div className="flex flex-col gap-3 border-b border-[#edf0ea] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by action name…"
              className="field w-auto py-1.5 text-xs"
            />
            <input
              type="text"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              placeholder="Filter by target type…"
              className="field w-auto py-1.5 text-xs"
            />
          </div>
          <span className="text-xs text-[#7d8d85]">{logs.length} audit event(s)</span>
        </div>

        {isLoading ? (
          <LoadingState label="Loading audit logs" />
        ) : isError ? (
          <div className="p-4"><ErrorState retry={() => refetch()} /></div>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No audit events recorded"
              detail="System modifications, enrollments, and status updates will be logged here."
              icon={ShieldAlert}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-[#fafbf9] text-[10px] font-bold uppercase tracking-wider text-[#798981] border-b border-[#edf0ea]">
                <tr>
                  <th className="px-5 py-3.5 min-w-[170px]">Timestamp</th>
                  <th className="px-5 py-3.5 min-w-[160px]">Actor</th>
                  <th className="px-5 py-3.5 min-w-[140px]">Action</th>
                  <th className="px-5 py-3.5 min-w-[120px]">Target</th>
                  <th className="px-5 py-3.5 min-w-[260px]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ea]">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#fafbf9] transition">
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#6b7b73] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[#23352e]">
                      {log.actor_name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded bg-[#edf4ee] px-2 py-0.5 text-[10px] font-bold text-[#2c5b48]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#55675f]">
                      {log.target_type}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#485951] max-w-sm">
                      {log.details || '—'}
                    </td>
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
