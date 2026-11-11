import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Layers, CheckCircle2, ArrowRight, ShieldCheck, CreditCard,
  User, Mail, Phone, Lock, BookOpen, AlertCircle, FileText
} from 'lucide-react';
import { studentsApi, programsApi } from '@/services/api';

export function PublicRegisterPage() {
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [programId, setProgramId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: programs = [], isLoading: programsLoading } = useQuery({
    queryKey: ['public_programs'],
    queryFn: programsApi.listPublic
  });

  const registerMutation = useMutation({
    mutationFn: studentsApi.publicRegister,
    onSuccess: () => {
      setSubmitted(true);
      setErrorMessage('');
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to submit registration form. Please check your details and try again.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in your name, email, and password.');
      return;
    }

    registerMutation.mutate({
      full_name: fullName.trim(),
      contact_number: contactNumber.trim() || undefined,
      email: email.trim().toLowerCase(),
      password: password,
      payment_id: paymentId.trim() || undefined,
      program_id: programId || undefined,
      notes: notes.trim() || undefined
    });
  };

  const selectedProgramObj = programs.find((p: any) => p.id === programId);

  return (
    <div className="min-h-screen bg-[#f3f6f3] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#285d4b] text-white shadow-md mb-3">
            <Layers size={24} strokeWidth={2.4} />
          </div>
          <h1 className="text-2xl font-black text-[#1c3227] tracking-tight">
            Student Admission & Course Registration
          </h1>
          <p className="text-xs text-[#5f7469] mt-1 max-w-md mx-auto">
            Fill in your admission details and payment reference to enroll in the training curriculum.
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-3xl border border-[#dbe6dc] shadow-sm p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#e2f5ea] text-[#16a34a] flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-xl font-extrabold text-[#193d2b]">
                Registration Application Received!
              </h2>
              <div className="p-4 bg-[#f4faf6] rounded-2xl border border-[#bce4cc] text-left text-xs text-[#1e5239] space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#16a34a] shrink-0" />
                  <span className="font-bold">Status: Pending Administrator Approval</span>
                </div>
                <p>
                  Thank you, <strong className="text-[#15462f]">{fullName}</strong>. Your payment ID (<strong>{paymentId || 'N/A'}</strong>) and admission details have been saved.
                </p>
                <p>
                  Once approved by the administrator, your student account will be activated with course access. You can log in using your email (<strong>{email}</strong>) and password.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
                <Link
                  href="/login"
                  className="btn btn-primary text-xs py-2.5 px-6 font-bold shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>Go to Login Page</span>
                  <ArrowRight size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setFullName('');
                    setContactNumber('');
                    setEmail('');
                    setPassword('');
                    setPaymentId('');
                    setNotes('');
                  }}
                  className="btn btn-outline text-xs py-2.5 px-5 font-bold"
                >
                  Submit Another Form
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 bg-[#faecea] border border-[#f5c4be] rounded-xl text-xs font-semibold text-[#b8483d] flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-[#23382e] mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-2.5 text-[#869b8f]" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="field pl-9 text-xs py-2 w-full"
                    />
                  </div>
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-xs font-bold text-[#23382e] mb-1">
                    Contact Number / Phone *
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-2.5 text-[#869b8f]" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 9876543210"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      className="field pl-9 text-xs py-2 w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-[#23382e] mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-2.5 text-[#869b8f]" />
                    <input
                      type="email"
                      required
                      placeholder="student@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="field pl-9 text-xs py-2 w-full"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-[#23382e] mb-1">
                    Choose Password *
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-2.5 text-[#869b8f]" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field pl-9 text-xs py-2 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Course / Program Selector */}
              <div>
                <label className="block text-xs font-bold text-[#23382e] mb-1">
                  Select Course / Program to Enroll *
                </label>
                <div className="relative">
                  <BookOpen size={15} className="absolute left-3 top-2.5 text-[#869b8f]" />
                  <select
                    required
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="field pl-9 text-xs py-2 w-full font-semibold"
                  >
                    <option value="">-- Choose Course Program --</option>
                    {programs.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) — {p.price ? `₹${p.price}` : 'Free'}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedProgramObj && (
                  <p className="text-[11px] text-[#4f6b5c] mt-1 bg-[#f4faf6] p-2 rounded-lg border border-[#cbe1d3]">
                    {selectedProgramObj.description || `Enrolling into ${selectedProgramObj.name}`}
                  </p>
                )}
              </div>

              {/* Payment ID / Transaction Reference */}
              <div>
                <label className="block text-xs font-bold text-[#23382e] mb-1">
                  Payment ID / Transaction Reference (UPI / Bank / Razorpay) *
                </label>
                <div className="relative">
                  <CreditCard size={15} className="absolute left-3 top-2.5 text-[#869b8f]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. pay_N29d82jd or UPI-8291048291"
                    value={paymentId}
                    onChange={(e) => setPaymentId(e.target.value)}
                    className="field pl-9 text-xs py-2 w-full font-mono"
                  />
                </div>
                <span className="text-[10px] text-[#708479] mt-0.5 block">
                  Enter the transaction ID or payment reference number from your fee payment.
                </span>
              </div>

              {/* Additional Notes (Optional) */}
              <div>
                <label className="block text-xs font-bold text-[#23382e] mb-1">
                  Additional Notes / Queries (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Any prior background, questions, or payment comments…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="field text-xs py-2 w-full"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={registerMutation.isPending || programsLoading}
                  className="btn btn-primary text-xs py-3 w-full font-extrabold flex items-center justify-center gap-2 shadow-sm rounded-xl"
                >
                  <ShieldCheck size={16} />
                  <span>
                    {registerMutation.isPending ? 'Submitting Registration…' : 'Submit Admission Application'}
                  </span>
                </button>
              </div>

              <div className="text-center pt-2">
                <span className="text-xs text-[#708479]">
                  Already have an active account?{' '}
                  <Link href="/login" className="font-bold text-[#205b43] hover:underline">
                    Log in here
                  </Link>
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default PublicRegisterPage;
