import React, { useState, useEffect } from 'react';

export default function PidSearch({
  onGenerate,
  loading,
  error: parentError,
  paymentRequiredInfo,
  onResetPaymentPrompt,
}) {
  const [pid, setPid] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [demoOtpCode, setDemoOtpCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [verifiedStudent, setVerifiedStudent] = useState(null);
  const [verificationToken, setVerificationToken] = useState(null);

  // Razorpay Payment State
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('PENDING'); // PENDING, SUCCESS, FAILED
  const [statusMessage, setStatusMessage] = useState('');
  const [verifiedPaymentData, setVerifiedPaymentData] = useState(null);
  const [orderInfo, setOrderInfo] = useState(null);

  // Timer countdown for OTP resend
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (paymentRequiredInfo && paymentRequiredInfo.initialVerifiedData) {
      setPaymentStatus('SUCCESS');
      setVerifiedPaymentData(paymentRequiredInfo.initialVerifiedData);
      setStatusMessage('✓ Payment verified! Ready to generate ID card.');
    } else if (paymentRequiredInfo && paymentRequiredInfo.pid) {
      setPaymentStatus('PENDING');
      setVerifiedPaymentData(null);
      setOrderInfo(null);
      setStatusMessage('');
    } else {
      setPaymentStatus('PENDING');
      setVerifiedPaymentData(null);
      setOrderInfo(null);
    }
  }, [paymentRequiredInfo]);

  /**
   * Handle Sending OTP to College Email
   */
  const handleSendOtp = async () => {
    if (!pid.trim()) {
      setOtpError('Please enter your PID first.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setOtpError('Please enter a valid College Email ID.');
      return;
    }

    try {
      setOtpLoading(true);
      setOtpError('');
      setOtpMessage('');

      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pid: pid.trim().toUpperCase(),
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOtpSent(true);
        setOtpMessage(`OTP sent to ${email.trim()}`);
        if (data.demoOtp) {
          setDemoOtpCode(data.demoOtp);
        }
        setResendTimer(30);
      } else {
        setOtpError(data.error || 'Failed to send OTP. Please check your PID.');
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setOtpError('Network error while sending OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  /**
   * Handle Verifying OTP
   */
  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.trim().length < 4) {
      setOtpError('Please enter the 6-digit OTP code.');
      return;
    }

    try {
      setOtpLoading(true);
      setOtpError('');

      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pid: pid.trim().toUpperCase(),
          email: email.trim(),
          otp: otp.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOtpVerified(true);
        setVerifiedStudent(data.student);
        setVerificationToken(data.verificationToken);
        setOtpMessage(`✓ Verified! Welcome, ${data.student?.name || 'Student'}`);
      } else {
        setOtpError(data.error || 'Invalid OTP code. Please try again.');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setOtpError('Network error while verifying OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  /**
   * Handle Main Form Submission
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!otpVerified) {
      setOtpError('Please verify your College Email with OTP before generating ID card.');
      return;
    }
    if (pid.trim()) {
      onGenerate(pid.trim().toUpperCase(), null, verificationToken);
    }
  };

  /**
   * Opens Razorpay Standard Checkout Modal
   */
  const handlePayWithRazorpay = async () => {
    const studentPid = paymentRequiredInfo?.pid || pid;
    if (!studentPid) return;

    try {
      setRazorpayLoading(true);
      setStatusMessage('Opening secure Razorpay checkout...');

      const res = await fetch('/api/payment/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: studentPid }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        setStatusMessage(orderData.error || 'Failed to initialize payment.');
        setRazorpayLoading(false);
        return;
      }

      setOrderInfo(orderData);

      const options = {
        key: orderData.keyId,
        amount: orderData.amountInPaise || 1500,
        currency: orderData.currency || 'INR',
        name: 'NOID Card Generator',
        description: `₹15 ID Card Fee for PID ${studentPid}`,
        image: '/photos/NOID.jpg',
        order_id: orderData.orderId,
        prefill: {
          name: verifiedStudent?.name || orderData.studentName || 'Student',
          email: email || `${studentPid.toLowerCase()}@universal.edu.in`,
          contact: '8261836404',
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: () => {
            setRazorpayLoading(false);
            setStatusMessage('Payment was cancelled or closed.');
          },
        },
        handler: async (response) => {
          try {
            setStatusMessage('Verifying cryptographic signature with Razorpay...');
            const verifyRes = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id || orderData.orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                pid: studentPid,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success && verifyData.verified) {
              setPaymentStatus('SUCCESS');
              setVerifiedPaymentData(verifyData);
              setStatusMessage('✓ Payment confirmed by Razorpay!');
              onGenerate(studentPid, verifyData.merchantOrderId || response.razorpay_order_id, verificationToken);
            } else {
              setPaymentStatus('FAILED');
              setStatusMessage(verifyData.error || 'Payment signature verification failed.');
            }
          } catch (verifyErr) {
            console.error('Signature verification error:', verifyErr);
            setPaymentStatus('FAILED');
          } finally {
            setRazorpayLoading(false);
          }
        },
      };

      if (typeof window.Razorpay === 'function') {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (failResponse) => {
          console.error('Razorpay payment failed:', failResponse.error);
          setPaymentStatus('FAILED');
          setStatusMessage(failResponse.error?.description || 'Payment was declined or failed.');
          setRazorpayLoading(false);
        });
        rzp.open();
      } else {
        alert('Razorpay SDK loading. Please try again in 2 seconds.');
        setRazorpayLoading(false);
      }
    } catch (err) {
      console.error('Error starting Razorpay checkout:', err);
      setRazorpayLoading(false);
    }
  };

  const handleGenerateAfterPayment = () => {
    const orderId =
      verifiedPaymentData?.merchantOrderId ||
      verifiedPaymentData?.razorpayOrderId ||
      orderInfo?.orderId;
    const studentPid = paymentRequiredInfo?.pid || pid;
    onGenerate(studentPid, orderId, verificationToken);
  };

  const resetForm = () => {
    setPid('');
    setEmail('');
    setOtp('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpMessage('');
    setOtpError('');
    setDemoOtpCode('');
    setVerifiedStudent(null);
    setVerificationToken(null);
    if (onResetPaymentPrompt) onResetPaymentPrompt();
  };

  return (
    <div className="outer-card">
      <div className="header">
        <div className="logo-wrapper">
          <img
            className="logo"
            src="/photos/NOID.jpg"
            alt="NOID Logo"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/NOID.jpg';
            }}
          />
        </div>
        <h1>NOID</h1>
        <p className="subtitle">Dynamic ID Card Generator</p>
      </div>

      {(parentError || otpError) && (
        <div className="error">{parentError || otpError}</div>
      )}

      {/* Payment Flow (Monthly quota exceeded >= 3) */}
      {paymentRequiredInfo ? (
        paymentStatus === 'SUCCESS' && verifiedPaymentData ? (
          /* SUCCESS STATE */
          <div className="payment-card payment-success-card">
            <div className="success-icon-badge">✓</div>
            <div className="payment-success-badge">Payment Successful</div>
            <h3>Payment Received (₹{verifiedPaymentData.amount || 15}.00)</h3>
            <p className="payment-desc">
              Your ₹15 payment for PID <span className="mono-pid">{paymentRequiredInfo.pid}</span> has been confirmed by Razorpay.
            </p>

            <div className="payment-receipt-box">
              <div className="receipt-row">
                <span className="receipt-label">Student PID:</span>
                <span className="receipt-value mono-pid">{paymentRequiredInfo.pid}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Payment ID:</span>
                <span className="receipt-value mono-pid" style={{ fontSize: '12px' }}>
                  {verifiedPaymentData.razorpayPaymentId || verifiedPaymentData.transactionId || 'pay_verified'}
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Amount Paid:</span>
                <span className="receipt-value paid-amount-text">
                  ₹{verifiedPaymentData.amount || 15}.00
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Verification:</span>
                <span className="receipt-value status-paid-text">HMAC-SHA256 SECURED ✓</span>
              </div>
            </div>

            <div className="payment-actions">
              <button
                type="button"
                className="btn-generate-unlocked"
                disabled={loading}
                onClick={handleGenerateAfterPayment}
              >
                {loading ? 'Generating ID Card...' : '🪪 Generate ID Card'}
              </button>

              <button
                type="button"
                className="btn-cancel"
                onClick={resetForm}
              >
                Done / Search Another PID
              </button>
            </div>
          </div>
        ) : (
          /* SECURE PAYMENT CHECKOUT */
          <div className="payment-card">
            <div className="payment-badge">Monthly Free Limit Reached</div>
            <h3>Pay ₹15 to Generate ID Card</h3>
            <p className="payment-desc">
              You have used all <b>3 free generations</b> for PID{' '}
              <span className="mono-pid">{paymentRequiredInfo.pid}</span> in{' '}
              <b>
                {paymentRequiredInfo.monthName || 'this month'} {paymentRequiredInfo.year || ''}
              </b>
              . Additional generations require a verified payment of <b>₹15</b>.
            </p>

            <div className="payment-amount-box">
              <span className="amount-label">Amount Payable</span>
              <span className="amount-val">₹{paymentRequiredInfo.amount || 15}.00</span>
            </div>

            <div className="razorpay-gateway-box">
              <div className="razorpay-badge-header">
                <span className="rzp-shield-icon">🛡️</span>
                <span>Razorpay 256-Bit SSL Gateway</span>
              </div>

              <div className="payment-supported-methods">
                <span className="method-tag">⚡ UPI / PhonePe / GPay</span>
                <span className="method-tag">💳 Debit &amp; Credit Cards</span>
                <span className="method-tag">🏦 NetBanking</span>
              </div>

              {statusMessage && (
                <div className="razorpay-status-pill">
                  <span className="pulse-dot" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>

            <div className="payment-actions">
              <button
                type="button"
                className="btn-pay-razorpay"
                disabled={razorpayLoading || loading}
                onClick={handlePayWithRazorpay}
              >
                {razorpayLoading ? (
                  <>
                    <span className="spinner-small" /> Opening Razorpay...
                  </>
                ) : (
                  <>
                    <span className="rzp-bolt">⚡</span> Pay ₹15 with Razorpay
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-cancel"
                disabled={loading || razorpayLoading}
                onClick={resetForm}
              >
                Cancel &amp; Search Another
              </button>
            </div>
          </div>
        )
      ) : (
        /* PID + EMAIL + OTP INPUT FORM */
        <form className="pid-form" onSubmit={handleSubmit}>
          
          {/* 1. PID Input */}
          <div className="form-group">
            <label htmlFor="pid">
              Enter PID <span className="required-star">*</span>
            </label>
            <input
              id="pid"
              name="pid"
              type="text"
              placeholder="e.g. EU1244017"
              value={pid}
              disabled={otpVerified}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setPid(val);
                setOtpVerified(false);
                setOtpSent(false);
                setOtpMessage('');
                setOtpError('');
                setDemoOtpCode('');
                if (onResetPaymentPrompt) onResetPaymentPrompt();
              }}
              required
              autoFocus
            />
          </div>

          {/* 2. College Email ID Input */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <div className="label-with-action">
              <label htmlFor="collegeEmail">
                College Email ID <span className="required-star">*</span>
              </label>
              {!otpVerified && (
                <button
                  type="button"
                  className="btn-send-otp-inline"
                  disabled={otpLoading || !pid.trim() || !email.trim() || resendTimer > 0}
                  onClick={handleSendOtp}
                >
                  {otpLoading ? (
                    'Sending...'
                  ) : resendTimer > 0 ? (
                    `Resend in ${resendTimer}s`
                  ) : otpSent ? (
                    'Resend OTP'
                  ) : (
                    'Send OTP'
                  )}
                </button>
              )}
            </div>
            <input
              id="collegeEmail"
              name="collegeEmail"
              type="email"
              placeholder="e.g. saanj@universal.edu.in"
              value={email}
              disabled={otpVerified}
              onChange={(e) => {
                setEmail(e.target.value);
                setOtpVerified(false);
                setOtpError('');
              }}
              required
            />
          </div>

          {/* OTP Notification / Demo Helper Pill */}
          {otpSent && !otpVerified && (
            <div className="otp-sent-banner">
              <span>📩 An OTP has been sent to your email.</span>
              {demoOtpCode && (
                <div className="demo-otp-chip">
                  <span>Demo OTP: <b>{demoOtpCode}</b></span>
                  <button
                    type="button"
                    className="btn-autofill-otp"
                    onClick={() => setOtp(demoOtpCode)}
                  >
                    Auto-fill
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. OTP Input Field */}
          {otpSent && !otpVerified && (
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label htmlFor="otp">
                Enter 6-Digit OTP <span className="required-star">*</span>
              </label>
              <div className="otp-input-row">
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => {
                    const num = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(num);
                    setOtpError('');
                  }}
                  className="otp-pin-input"
                  required
                />
                <button
                  type="button"
                  className="btn-verify-otp"
                  disabled={otpLoading || otp.length < 4}
                  onClick={handleVerifyOtp}
                >
                  {otpLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            </div>
          )}

          {/* 4. Verified State Badge */}
          {otpVerified && (
            <div className="otp-verified-badge">
              <span className="badge-check-icon">✓</span>
              <div className="badge-text-box">
                <span className="badge-title">Email &amp; PID Verified</span>
                <span className="badge-sub">{verifiedStudent?.name || pid} • {email}</span>
              </div>
              <button
                type="button"
                className="btn-badge-change"
                onClick={resetForm}
              >
                Change
              </button>
            </div>
          )}

          {otpMessage && !otpError && (
            <div className="otp-success-text">{otpMessage}</div>
          )}

          {/* 5. Generate ID Card Button */}
          <button
            type="submit"
            className="btn-generate-main"
            disabled={loading || !otpVerified}
            style={{ marginTop: '20px' }}
          >
            {loading
              ? 'Generating ID Card...'
              : !otpVerified
              ? '🔒 Verify OTP to Generate ID Card'
              : '🪪 Generate ID Card'}
          </button>
        </form>
      )}
    </div>
  );
}
