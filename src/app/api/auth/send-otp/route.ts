import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function sendEmailOtpDirectly(
  to: string,
  otp: string,
  name?: string,
  purpose: 'signup' | 'reset_password' = 'signup'
): Promise<{ sent: boolean; provider?: string }> {
  const isReset = purpose === 'reset_password';
  const subject = isReset
    ? `Your Nuvia Password Reset Code: ${otp}`
    : `Your Nuvia Verification Code: ${otp}`;
  const actionText = isReset
    ? 'Enter this 6-digit code in Nuvia to reset your password.'
    : 'Enter this 6-digit code in Nuvia to complete your registration.';

  // 1. Check for Resend API Key
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || 'Nuvia <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html: `
            <div style="background:#000000;color:#FFFFFF;padding:40px 24px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro',sans-serif;max-width:480px;margin:auto;border-radius:24px;">
              <h1 style="font-size:24px;font-weight:700;margin:0 0 8px 0;letter-spacing:-0.5px;">Nuvia</h1>
              <p style="color:#8E8E93;font-size:14px;margin:0 0 24px 0;">Hello${name ? ' ' + name : ''}, ${isReset ? 'here is your password reset code:' : 'here is your verification code:'}</p>
              <div style="background:#1C1C1E;padding:28px;border-radius:20px;text-align:center;margin-bottom:24px;border:1px solid rgba(255,255,255,0.08);">
                <span style="font-size:38px;font-weight:700;letter-spacing:8px;color:#30D158;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${otp}</span>
              </div>
              <p style="color:#8E8E93;font-size:13px;line-height:1.6;margin:0;">${actionText} This code expires in 10 minutes.</p>
            </div>
          `,
        }),
      });
      if (res.ok) return { sent: true, provider: 'resend' };
    } catch (err) {
      console.error('Failed to send via Resend:', err);
    }
  }

  // 2. Check for SMTP / Gmail credentials
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass) {
    try {
      const nodemailer = await import('nodemailer');
      const isGmail = smtpUser.includes('@gmail.com');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'smtp.mailgun.org'),
        port: Number(process.env.SMTP_PORT) || (isGmail ? 465 : 587),
        secure: (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) === 465 : true),
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Nuvia" <${smtpUser}>`,
        to,
        subject,
        text: `Your Nuvia code is: ${otp}`,
        html: `
          <div style="background:#000000;color:#FFFFFF;padding:40px 24px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro',sans-serif;max-width:480px;margin:auto;border-radius:24px;">
            <h1 style="font-size:24px;font-weight:700;margin:0 0 8px 0;letter-spacing:-0.5px;">Nuvia</h1>
            <p style="color:#8E8E93;font-size:14px;margin:0 0 24px 0;">Hello${name ? ' ' + name : ''}, ${isReset ? 'here is your password reset code:' : 'here is your verification code:'}</p>
            <div style="background:#1C1C1E;padding:28px;border-radius:20px;text-align:center;margin-bottom:24px;border:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:38px;font-weight:700;letter-spacing:8px;color:#30D158;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${otp}</span>
            </div>
            <p style="color:#8E8E93;font-size:13px;line-height:1.6;margin:0;">${actionText} This code expires in 10 minutes.</p>
          </div>
        `,
      });
      return { sent: true, provider: 'smtp' };
    } catch (err) {
      console.error('Failed to send via SMTP:', err);
    }
  }

  return { sent: false };
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, type } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const isReset = type === 'reset_password';

    if (!isReset && (!password || password.length < 6)) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey) {
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      return NextResponse.json({
        success: true,
        message: 'OTP verification code sent.',
        devOtp: mockOtp,
        verificationType: isReset ? 'reset_password' : 'signup',
      });
    }

    // Generate strictly 6-digit OTP
    const sixDigitOtp = Math.floor(100000 + Math.random() * 900000).toString();

    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { OtpStore } = await import('@/lib/otp-store');

      if (isReset) {
        // Check if user exists
        const { data: usersData } = await adminClient.auth.admin.listUsers();
        const userExists = usersData.users.some(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (!userExists) {
          return NextResponse.json(
            { error: 'No account registered with this email address.' },
            { status: 404 }
          );
        }

        // Save 6-digit reset OTP
        OtpStore.save(email, sixDigitOtp, undefined, 'reset_password');

        // Dispatch real email with strictly 6-digit OTP
        const emailDispatch = await sendEmailOtpDirectly(email, sixDigitOtp, undefined, 'reset_password');

        return NextResponse.json({
          success: true,
          message: `6-digit password reset code sent to ${email}.`,
          verificationType: 'reset_password',
          emailDelivered: emailDispatch.sent,
          devOtp: emailDispatch.sent ? undefined : sixDigitOtp,
        });
      }

      // Registration: create signup link with the user's chosen password
      let linkRes = await adminClient.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          data: { name: name || '' },
        },
      });

      let verificationType: 'signup' | 'magiclink' = 'signup';

      if (linkRes.error) {
        // If user already registered, update their password and generate link
        const { data: usersData } = await adminClient.auth.admin.listUsers();
        const existingUser = usersData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
          await adminClient.auth.admin.updateUserById(existingUser.id, {
            password,
            user_metadata: { name: name || '' },
          });
        }

        linkRes = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            data: { name: name || '' },
          },
        });
        verificationType = 'magiclink';
      }

      const hashedToken = linkRes.data?.properties?.hashed_token;

      if (hashedToken) {
        // Save 6-digit OTP mapping with the chosen password
        OtpStore.save(email, sixDigitOtp, hashedToken, verificationType, name, password);

        // Dispatch real email with strictly 6-digit OTP
        const emailDispatch = await sendEmailOtpDirectly(email, sixDigitOtp, name, 'signup');

        return NextResponse.json({
          success: true,
          message: `6-digit OTP verification code sent to ${email}. Please check your inbox.`,
          verificationType,
          emailDelivered: emailDispatch.sent,
          devOtp: emailDispatch.sent ? undefined : sixDigitOtp,
        });
      }
    }

    return NextResponse.json(
      { error: 'Unable to generate verification link. Please try again.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'An unexpected error occurred while sending OTP.' },
      { status: 500 }
    );
  }
}
