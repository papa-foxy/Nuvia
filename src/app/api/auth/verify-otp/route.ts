import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OtpStore } from '@/lib/otp-store';

export async function POST(req: NextRequest) {
  try {
    const { email, otp, name } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and 6-digit OTP code are required.' },
        { status: 400 }
      );
    }

    const cleanOtp = String(otp).trim();
    if (cleanOtp.length !== 6) {
      return NextResponse.json(
        { error: 'Verification code must be exactly 6 digits.' },
        { status: 400 }
      );
    }

    const stored = OtpStore.consume(email, cleanOtp);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stored) {
      // Direct Supabase OTP verification fallback (in case native 6-digit OTP was dispatched by Supabase)
      if (supabaseUrl && anonKey) {
        const supabase = createClient(supabaseUrl, anonKey);
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: cleanOtp,
          type: 'email',
        });
        if (!error && data?.session) {
          return NextResponse.json({
            success: true,
            session: data.session,
            user: data.user,
          });
        }
      }

      return NextResponse.json(
        { error: 'Invalid or expired 6-digit verification code. Please check your email or request a new code.' },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Supabase authentication service is not configured.' },
        { status: 500 }
      );
    }

    // Authenticate with Supabase using the stored token hash
    const supabaseAnon = createClient(supabaseUrl, anonKey);
    let session = null;
    let user = null;

    if (stored.hashedToken) {
      const { data, error } = await supabaseAnon.auth.verifyOtp({
        token_hash: stored.hashedToken,
        type: (stored.verificationType === 'signup' ? 'signup' : 'magiclink') as any,
      });

      if (!error && data?.session) {
        session = data.session;
        user = data.user;
      }
    }

    // Fallback: If token_hash was absent or verifyOtp didn't yield a session, use admin client
    if (!session && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: usersData } = await admin.auth.admin.listUsers();
      const existingUser = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
        // Confirm user email and ensure password is set if provided
        const updateParams: { email_confirm: boolean; password?: string; user_metadata?: Record<string, any> } = {
          email_confirm: true,
        };
        if (stored.password) {
          updateParams.password = stored.password;
        }
        if (stored.name) {
          updateParams.user_metadata = { full_name: stored.name, name: stored.name };
        }
        await admin.auth.admin.updateUserById(existingUser.id, updateParams);

        // If password was stored, sign in directly with password
        if (stored.password) {
          const passSignIn = await supabaseAnon.auth.signInWithPassword({
            email,
            password: stored.password,
          });
          if (passSignIn.data?.session) {
            session = passSignIn.data.session;
            user = passSignIn.data.user;
          }
        }

        // Otherwise generate a fresh magiclink token hash and verify
        if (!session) {
          const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
          if (link.data?.properties?.hashed_token) {
            const retry = await supabaseAnon.auth.verifyOtp({
              token_hash: link.data.properties.hashed_token,
              type: 'magiclink',
            });
            if (retry.data?.session) {
              session = retry.data.session;
              user = retry.data.user;
            }
          }
        }
      }
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Verification failed. Please request a new code.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
      user,
      name: stored.name || name,
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'An error occurred during OTP verification.' },
      { status: 500 }
    );
  }
}
