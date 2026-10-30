import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Receipt, CheckCircle2, AlertCircle, ShoppingBag, ArrowRight, ExternalLink } from 'lucide-react';
import { paymentsApi } from '@/services/api';
import { PageTitle, LoadingState, ErrorState, EmptyState } from '@/components/common/UIComponents';

export function PaymentHistoryPage() {
  const { data: purchases = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my_purchases'],
    queryFn: paymentsApi.getHistory
  });

  if (isLoading) return <LoadingState label="Loading payment and purchase history" />;
  if (isError) return <ErrorState retry={() => refetch()} />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5ebe5] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#285d4b]">
            TRANSACTIONS & INVOICES
          </span>
          <h1 className="display text-2xl font-extrabold text-[#20342c]">
            Payment & Enrollment History
          </h1>
          <p className="text-xs text-[#6e7e76] mt-0.5">
            View all completed program purchases, reward points redeemed, and payment receipts
          </p>
        </div>

        <Link
          href="/explore-programs"
          className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm"
        >
          <ShoppingBag size={14} /> Explore More Programs
        </Link>
      </div>

      {purchases.length === 0 ? (
        <EmptyState
          title="No Purchases Recorded"
          description="You haven't purchased any additional training programs yet. Explore available programs and redeem your reward points."
        />
      ) : (
        <div className="panel p-5 bg-white border border-[#e1e8e1] rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#edf0ea] text-[#697972] text-[11px]">
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Program</th>
                  <th className="py-2.5 px-3 font-semibold">Original Price</th>
                  <th className="py-2.5 px-3 font-semibold">Points Redeemed</th>
                  <th className="py-2.5 px-3 font-semibold">Final Paid</th>
                  <th className="py-2.5 px-3 font-semibold">Payment Method</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f1]">
                {purchases.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#fafbfa]">
                    <td className="py-2.5 px-3 text-[#52635a]">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#23352d]">
                      {p.program_name}
                      <span className="block text-[10px] text-[#718279] font-normal">{p.program_code}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#52635a]">
                      ₹{p.original_price?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#26624a]">
                      {p.points_redeemed > 0 ? `-${Math.round(p.points_redeemed)} pts (₹${p.discount_amount})` : '—'}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-[#194e36]">
                      ₹{p.final_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-[#52635a] uppercase text-[10px] font-semibold">
                      {p.payment_method}
                      {p.razorpay_payment_id && (
                        <span className="block text-[9px] text-[#7d8f86] font-mono lowercase">
                          {p.razorpay_payment_id}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.payment_status === 'paid'
                          ? 'bg-[#e2f4ea] text-[#1c5d3b] border border-[#bce4cc]'
                          : p.payment_status === 'failed'
                          ? 'bg-[#faecea] text-[#a4463a] border border-[#f5c7c2]'
                          : 'bg-[#fff5e5] text-[#8e5c1a] border border-[#fae2c0]'
                      }`}>
                        {p.payment_status === 'paid' && <CheckCircle2 size={10} />}
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentHistoryPage;
