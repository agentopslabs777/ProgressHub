import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import {
  ShoppingBag, Award, Gift, CheckCircle2, AlertCircle, ArrowRight,
  ShieldCheck, CreditCard, Sparkles, BookOpen, Layers, X
} from 'lucide-react';
import { paymentsApi, rewardsApi, authApi } from '@/services/api';
import { PageTitle, LoadingState, ErrorState, EmptyState, Modal } from '@/components/common/UIComponents';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export function ExploreProgramsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Check URL for referral code (?ref=CODE)
  const urlParams = new URLSearchParams(window.location.search);
  const initialRef = urlParams.get('ref') || '';

  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [referralCode, setReferralCode] = useState<string>(initialRef);
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<boolean>(false);

  // Load programs available for purchase
  const { data: programs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['purchasable_programs'],
    queryFn: paymentsApi.listPrograms
  });

  // Load user wallet
  const { data: walletData } = useQuery({
    queryKey: ['rewards_wallet'],
    queryFn: rewardsApi.getWallet
  });

  // Load Razorpay config
  const { data: razorpayConfig } = useQuery({
    queryKey: ['razorpay_config'],
    queryFn: paymentsApi.getConfig
  });

  const walletBalance = walletData?.balance ?? walletData?.wallet?.balance ?? 0;
  const ratio = walletData?.point_to_rupee_ratio ?? walletData?.config?.point_to_rupee_ratio ?? 1.0;

  // Dynamically load Razorpay SDK script
  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const openCheckout = (prog: any) => {
    setSelectedProgram(prog);
    setCheckoutError('');
    setPurchaseSuccess(false);
    // Default points to redeem: min(walletBalance, prog.max_redeemable_points)
    const initialPoints = Math.min(walletBalance, prog.max_redeemable_points || prog.price);
    setPointsToRedeem(initialPoints);
  };

  const closeCheckout = () => {
    setSelectedProgram(null);
    setCheckoutError('');
    setIsProcessing(false);
  };

  const calculateDiscount = () => {
    return Math.min(pointsToRedeem * ratio, selectedProgram ? selectedProgram.price : 0);
  };

  const calculateFinalAmount = () => {
    if (!selectedProgram) return 0;
    const discount = calculateDiscount();
    return Math.max(0, selectedProgram.price - discount);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;

    setCheckoutError('');
    setIsProcessing(true);

    try {
      // Step 1: Create Order on backend
      const orderRes = await paymentsApi.createOrder(
        selectedProgram.id,
        Number(pointsToRedeem),
        referralCode.trim() || undefined
      );

      // If fully covered by reward points (final amount = 0)
      if (orderRes.final_amount === 0) {
        await paymentsApi.verifyPayment({
          purchase_id: orderRes.purchase_id
        });

        queryClient.invalidateQueries({ queryKey: ['purchasable_programs'] });
        queryClient.invalidateQueries({ queryKey: ['rewards_wallet'] });
        queryClient.invalidateQueries({ queryKey: ['my_programs'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        
        setPurchaseSuccess(true);
        setIsProcessing(false);
        setTimeout(() => {
          closeCheckout();
          setLocation('/my-programs');
        }, 2000);
        return;
      }

      // Step 2: Final amount > 0, launch Razorpay Checkout
      const keyId = orderRes.razorpay_key_id || razorpayConfig?.razorpay_key_id || razorpayConfig?.key_id;
      if (!keyId) {
        throw new Error('Razorpay Payment Gateway is not configured. Please connect your Razorpay account in Admin Panel.');
      }

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const options = {
        key: keyId,
        amount: orderRes.amount, // in paise
        currency: orderRes.currency || 'INR',
        name: 'Training ProgressHub',
        description: `Enrollment: ${selectedProgram.name}`,
        order_id: orderRes.razorpay_order_id || orderRes.order_id,
        handler: async function (response: any) {
          try {
            await paymentsApi.verifyPayment({
              purchase_id: orderRes.purchase_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            queryClient.invalidateQueries({ queryKey: ['purchasable_programs'] });
            queryClient.invalidateQueries({ queryKey: ['rewards_wallet'] });
            queryClient.invalidateQueries({ queryKey: ['my_programs'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });

            setPurchaseSuccess(true);
            setIsProcessing(false);
            setTimeout(() => {
              closeCheckout();
              setLocation('/my-programs');
            }, 2000);
          } catch (verifyErr: any) {
            setCheckoutError(verifyErr.message || 'Payment signature verification failed.');
            setIsProcessing(false);
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        theme: {
          color: '#285d4b'
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setCheckoutError(resp.error?.description || 'Payment failed or was cancelled.');
        setIsProcessing(false);
      });
      rzp.open();

    } catch (err: any) {
      setCheckoutError(err.message || 'Could not initiate program purchase.');
      setIsProcessing(false);
    }
  };

  if (isLoading) return <LoadingState label="Loading available curriculum programs" />;
  if (isError) return <ErrorState retry={() => refetch()} />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5ebe5] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#285d4b]">
            CURRICULUM CATALOG
          </span>
          <h1 className="display text-2xl font-extrabold text-[#20342c]">
            Explore & Purchase Programs
          </h1>
          <p className="text-xs text-[#6e7e76] mt-0.5">
            Advance your skills with industry-curated curriculums · Redeem reward points at ₹1 per point
          </p>
        </div>

        <Link
          href="/wallet"
          className="flex items-center gap-2 bg-[#f4faf6] border border-[#bce0cb] px-4 py-2 rounded-xl text-xs font-bold text-[#1d523a]"
        >
          <Award size={16} className="text-[#c28416]" />
          <span>Wallet Balance: {Math.round(walletBalance)} pts (₹{Math.round(walletBalance * ratio)})</span>
        </Link>
      </div>

      {programs.length === 0 ? (
        <EmptyState
          title="No Published Programs Available"
          description="Check back soon! New training tracks and programs will be added here shortly."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {programs.map((prog: any) => {
            const isEnrolled = prog.is_enrolled;
            return (
              <div
                key={prog.id}
                className="panel p-6 bg-white border border-[#e1e8e1] rounded-2xl flex flex-col justify-between hover:border-[#b8d6c3] transition shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#edf5f0] text-[#245e46] px-2.5 py-0.5 rounded-full">
                      {prog.code || 'COURSE'}
                    </span>
                    {isEnrolled && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#e2f4ea] text-[#1c5d3b] flex items-center gap-1">
                        <CheckCircle2 size={12} /> Active Enrollment
                      </span>
                    )}
                  </div>

                  <h3 className="display text-base font-extrabold text-[#21352d]">
                    {prog.name}
                  </h3>

                  <p className="text-xs text-[#5e7067] mt-1.5 line-clamp-2 leading-relaxed">
                    {prog.description || 'Comprehensive training curriculum with daily checklists, video sessions, and evidence reviews.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#edf1ee] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#718279] block">Program Price</span>
                      <span className="text-base font-extrabold text-[#23352d]">
                        ₹{prog.price.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {prog.eligible_for_referral && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-[#718279] block">Referral Bonus</span>
                        <span className="text-xs font-bold text-[#c28416] flex items-center gap-1 justify-end">
                          <Gift size={12} /> +{prog.referral_bonus_points} pts
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#edf1ee]">
                  {isEnrolled ? (
                    <Link
                      href={`/my-programs/${prog.id}`}
                      className="btn btn-outline w-full text-xs py-2 flex items-center justify-center gap-1.5 font-bold"
                    >
                      <BookOpen size={14} /> Open Enrolled Track
                    </Link>
                  ) : (
                    <button
                      onClick={() => openCheckout(prog)}
                      className="btn btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5 font-bold shadow-xs"
                    >
                      <CreditCard size={14} /> Purchase & Enroll
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CHECKOUT MODAL WITH POINTS REDEMPTION */}
      {selectedProgram && (
        <Modal
          title={`Enroll in ${selectedProgram.name}`}
          open={!!selectedProgram}
          onClose={closeCheckout}
        >
          <form onSubmit={handleCheckout} className="space-y-4">
            {/* Price & Summary */}
            <div className="p-3.5 rounded-xl bg-[#f7faf7] border border-[#dbe6dc] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#596d62]">Original Price:</span>
                <span className="font-bold text-[#23352d]">₹{selectedProgram.price.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#596d62]">Your Available Reward Points:</span>
                <span className="font-bold text-[#235b44]">
                  {Math.round(walletBalance)} pts (₹{Math.round(walletBalance * ratio)})
                </span>
              </div>
            </div>

            {/* Points to Redeem Slider & Input */}
            {selectedProgram.allow_redemption && walletBalance > 0 && (
              <div className="p-3.5 rounded-xl bg-white border border-[#dce5dc] space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#23352d] flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#c28416]" /> Reward Points to Redeem
                  </label>
                  <span className="text-xs font-bold text-[#1f5f3e]">
                    -₹{calculateDiscount().toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max={Math.min(walletBalance, selectedProgram.max_redeemable_points || selectedProgram.price)}
                    value={pointsToRedeem}
                    onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                    className="w-full accent-[#285d4b]"
                  />
                  <input
                    type="number"
                    min="0"
                    max={Math.min(walletBalance, selectedProgram.max_redeemable_points || selectedProgram.price)}
                    value={pointsToRedeem}
                    onChange={(e) => setPointsToRedeem(Math.min(walletBalance, Math.max(0, Number(e.target.value))))}
                    className="w-20 field text-xs py-1 text-center font-bold"
                  />
                </div>
                <div className="text-[10px] text-[#71837a]">
                  1 Point = ₹1 INR. Points are safely deducted only after payment confirmation.
                </div>
              </div>
            )}

            {/* Referral Code (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-[#485850] mb-1">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                placeholder="Enter friend's referral code (e.g. ALEX123)"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="field text-xs uppercase"
              />
            </div>

            {/* Final Calculation Summary */}
            <div className="p-4 rounded-xl bg-[#edf5f0] border border-[#bce2cb] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#276148] block">Amount Payable</span>
                <span className="text-xs text-[#527464]">
                  Includes all curriculum resources & faculty reviews
                </span>
              </div>
              <div className="display text-2xl font-extrabold text-[#194e36]">
                ₹{calculateFinalAmount().toFixed(2)}
              </div>
            </div>

            {checkoutError && (
              <div className="p-3 rounded-xl bg-[#faecea] border border-[#f5c3bd] text-xs font-medium text-[#b33e33] flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            {purchaseSuccess && (
              <div className="p-3 rounded-xl bg-[#e1f5ea] border border-[#bce4cc] text-xs font-bold text-[#1b5f3d] flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>Payment & Enrollment confirmed! Redirecting to your programs…</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeCheckout}
                disabled={isProcessing}
                className="btn btn-outline text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing || purchaseSuccess}
                className="btn btn-primary text-xs py-2 px-6 flex items-center gap-1.5 font-bold shadow-xs"
              >
                <CreditCard size={14} />
                {isProcessing
                  ? 'Processing…'
                  : calculateFinalAmount() === 0
                  ? 'Enroll Free with Points'
                  : `Pay ₹${calculateFinalAmount().toFixed(2)} with Razorpay`}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default ExploreProgramsPage;
