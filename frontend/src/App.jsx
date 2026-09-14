import React, { useState, useEffect } from 'react';
import PidSearch from './components/PidSearch';
import IdCard from './components/IdCard';
import './index.css';

export default function App() {
  const [student, setStudent] = useState(null);
  const [generationMeta, setGenerationMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentRequiredInfo, setPaymentRequiredInfo] = useState(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Check URL query parameters for return from PhonePe checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('merchantOrderId') || urlParams.get('verifyPayment') || urlParams.get('transactionId');
    const pid = urlParams.get('pid');

    if (orderId && pid) {
      verifyReturnedPayment(orderId, pid);
    }
  }, []);

  const verifyReturnedPayment = async (orderId, pid) => {
    try {
      setVerifyingPayment(true);
      setError(null);

      const res = await fetch(`/api/payment/status/${encodeURIComponent(orderId)}?pid=${encodeURIComponent(pid)}`);
      const data = await res.json();

      // Clean URL params cleanly
      window.history.replaceState({}, document.title, window.location.pathname);

      if (res.ok && data.success && data.status === 'SUCCESS' && data.verified) {
        setStudent(null);
        setPaymentRequiredInfo({
          pid: pid.toUpperCase(),
          amount: data.amount || 15,
          merchantOrderId: orderId,
          initialVerifiedData: data,
        });
        setError(null);
      } else if (data.status === 'PENDING') {
        setPaymentRequiredInfo({
          pid: pid.toUpperCase(),
          amount: data.amount || 15,
          merchantOrderId: orderId,
        });
      } else {
        setError(data.error || 'Payment was not completed or failed on PhonePe. Please try again.');
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      setError('Unable to verify payment with server. Please try again.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleGenerate = async (pid, merchantOrderId = null, verificationToken = null) => {
    if (!pid || !pid.trim()) return;
    const cleanPid = pid.trim().toUpperCase();

    setLoading(true);
    setError(null);

    try {
      const payload = { pid: cleanPid };
      if (merchantOrderId) {
        payload.merchantOrderId = merchantOrderId;
      }
      if (verificationToken) {
        payload.verificationToken = verificationToken;
      }

      const res = await fetch('/api/students/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 200 && data.success && data.student) {
        // Successful generation (Free or Paid)
        setStudent(data.student);
        setGenerationMeta({
          count: data.monthlyGenerationCount,
          freeRemaining: data.freeGenerationsRemaining,
          paid: Boolean(data.paymentRequired),
          monthName: data.monthName,
          year: data.year,
        });
        setPaymentRequiredInfo(null);
        setError(null);
      } else if (res.status === 402 || data.paymentRequired) {
        // Monthly quota reached -> prompt for ₹15 PhonePe payment
        setStudent(null);
        setPaymentRequiredInfo({
          pid: cleanPid,
          amount: data.amount || 15,
          count: data.monthlyGenerationCount || 3,
          freeRemaining: data.freeGenerationsRemaining || 0,
          monthName: data.monthName || 'this month',
          year: data.year || new Date().getFullYear(),
          message: data.message,
        });
      } else if (res.status === 409) {
        setError(data.error || 'Duplicate transaction. This payment has already been consumed.');
      } else {
        setError(data.error || 'Student not found or generation failed. Please try again.');
      }
    } catch (err) {
      console.error('Generate error:', err);
      setError('Unable to connect to server. Please ensure backend is running.');
      setStudent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStudent(null);
    setGenerationMeta(null);
    setPaymentRequiredInfo(null);
    setError(null);
  };

  return (
    <div className="container">
      {verifyingPayment ? (
        <div className="outer-card verifying-box">
          <div className="spinner" />
          <h2>Verifying PhonePe Payment...</h2>
          <p>Please wait while we check your payment status with the PhonePe gateway.</p>
        </div>
      ) : student ? (
        <IdCard
          student={student}
          onBack={handleBack}
        />
      ) : (
        <PidSearch
          onGenerate={handleGenerate}
          loading={loading}
          error={error}
          paymentRequiredInfo={paymentRequiredInfo}
          onResetPaymentPrompt={() => setPaymentRequiredInfo(null)}
        />
      )}
    </div>
  );
}
