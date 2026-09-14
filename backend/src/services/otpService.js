/**
 * OTP Service for NOID Verification
 * In-memory store with 5-minute TTL & rate limiting
 */

const otpStore = new Map(); // pid -> { otp, email, expiresAt, attempts }
const verificationTokens = new Map(); // token -> { pid, email, expiresAt }

/**
 * Generate a random 6-digit numeric OTP
 */
function generateRandomOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send / Store OTP for a given PID and College Email
 */
function createAndSendOtp(pid, email) {
  const cleanPid = pid.trim().toUpperCase();
  const cleanEmail = email.trim().toLowerCase();

  const otp = generateRandomOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  otpStore.set(cleanPid, {
    otp,
    email: cleanEmail,
    expiresAt,
    attempts: 0,
  });

  console.log(`🔑 [OTP SERVICE] Generated OTP for ${cleanPid} (${cleanEmail}): ${otp}`);

  return {
    success: true,
    message: `OTP sent successfully to ${cleanEmail}`,
    expiresInSeconds: 300,
    demoOtp: otp, // For smooth testing & verification demo
  };
}

/**
 * Verify submitted OTP
 */
function verifyOtp(pid, email, userEnteredOtp) {
  const cleanPid = pid.trim().toUpperCase();
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  const stored = otpStore.get(cleanPid);

  if (!stored) {
    return {
      success: false,
      error: 'No OTP requested for this PID. Please click "Send OTP" first.',
    };
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(cleanPid);
    return {
      success: false,
      error: 'OTP has expired. Please request a new OTP.',
    };
  }

  if (stored.attempts >= 5) {
    otpStore.delete(cleanPid);
    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  // Validate OTP code
  if (stored.otp !== userEnteredOtp.trim()) {
    stored.attempts += 1;
    return {
      success: false,
      error: 'Incorrect OTP. Please check the code and try again.',
      attemptsLeft: 5 - stored.attempts,
    };
  }

  // OTP is correct -> Generate verification token valid for 15 minutes
  const token = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  verificationTokens.set(token, {
    pid: cleanPid,
    email: cleanEmail || stored.email,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  // Clear used OTP
  otpStore.delete(cleanPid);

  return {
    success: true,
    message: 'College email & OTP verified successfully!',
    verificationToken: token,
  };
}

/**
 * Validate that a generation request has a valid verified token
 */
function isVerificationTokenValid(token, pid) {
  if (!token) return false;
  const data = verificationTokens.get(token);
  if (!data) return false;
  if (Date.now() > data.expiresAt) {
    verificationTokens.delete(token);
    return false;
  }
  return data.pid === pid.trim().toUpperCase();
}

module.exports = {
  createAndSendOtp,
  verifyOtp,
  isVerificationTokenValid,
};
