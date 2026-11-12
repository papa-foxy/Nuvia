'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { NuviaBottomSheet } from '../NuviaBottomSheet';
import { IntegrationIcon } from './IntegrationIcon';

interface Status {
  configured: boolean;
  connected: boolean;
  athleteName: string | null;
  lastSyncAt: string | null;
}

/** Messages for the ?strava=<status> redirect from /api/strava/callback. */
const RETURN_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'Strava connected. Your last 30 days were imported, and new activities will arrive automatically.' },
  cancelled: { ok: false, text: 'Strava connection was cancelled.' },
  'missing-permission': { ok: false, text: 'Nuvia needs permission to view your activities. Connect again and keep that box ticked.' },
  'athlete-in-use': { ok: false, text: 'This Strava account is already connected to another Nuvia account.' },
  'not-configured': { ok: false, text: 'Strava is not set up on the server yet.' },
  error: { ok: false, text: 'Something went wrong connecting Strava. Please try again.' },
};

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await createClient().auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error('Sign in first.');
  const res = await fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${jwt}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || json.message || 'Request failed.');
  return json;
}

export function StravaConnect() {
  const { user } = useAuth();
  const signedIn = !!user?.id && isSupabaseConfigured() && user.id !== 'demo-user-001';

  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<null | 'connect' | 'sync' | 'disconnect'>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [removeActivities, setRemoveActivities] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      const s = await authedFetch('/api/strava/status');
      setStatus({ configured: s.configured, connected: s.connected, athleteName: s.athleteName, lastSyncAt: s.lastSyncAt });
    } catch {
      setStatus({ configured: false, connected: false, athleteName: null, lastSyncAt: null });
    }
  }, [signedIn]);

  // Initial status, and the result of a Strava redirect (?strava=...).
  useEffect(() => {
    let cancelled = false;
    const result = new URLSearchParams(window.location.search).get('strava');
    if (signedIn) {
      authedFetch('/api/strava/status')
        .then((s) => {
          if (!cancelled) setStatus({ configured: s.configured, connected: s.connected, athleteName: s.athleteName, lastSyncAt: s.lastSyncAt });
        })
        .catch(() => undefined);
    }
    if (result) {
      const url = new URL(window.location.href);
      url.searchParams.delete('strava');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      queueMicrotask(() => {
        if (cancelled) return;
        setNotice(RETURN_MESSAGES[result] ?? RETURN_MESSAGES.error);
        setIsOpen(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const connect = async () => {
    setBusy('connect');
    setNotice(null);
    try {
      const { url } = await authedFetch('/api/strava/connect', { method: 'POST' });
      window.location.href = url;
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Could not start Strava sign-in.' });
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy('sync');
    setNotice(null);
    try {
      const r = await authedFetch('/api/strava/sync', { method: 'POST' });
      setNotice({ ok: true, text: r.message });
      await refresh();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Sync failed.' });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      const r = await authedFetch('/api/strava/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeActivities }),
      });
      setNotice({
        ok: true,
        text: `Strava disconnected.${r.removed ? ` Removed ${r.removed} imported ${r.removed === 1 ? 'activity' : 'activities'}.` : ''}`,
      });
      setConfirmDisconnect(false);
      await refresh();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Could not disconnect.' });
    } finally {
      setBusy(null);
    }
  };

  const subtitle = !signedIn
    ? 'Sign in to connect'
    : status?.connected
      ? `Connected${status.athleteName ? ` as ${status.athleteName}` : ''}`
      : 'Import activities automatically';

  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          refresh();
        }}
        className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-fg/[0.03] transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-3 min-w-0">
          <IntegrationIcon app="strava" size={34} />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-fg">Strava</span>
            <span className="block text-[11px] text-muted truncate">{subtitle}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {status?.connected && <CheckCircle2 className="w-4 h-4 text-green-ink" aria-label="Connected" />}
          <ChevronRight className="w-4 h-4 text-muted" />
        </span>
      </button>

      <NuviaBottomSheet
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setConfirmDisconnect(false);
        }}
        variant="standard"
        ariaLabel="Strava"
        contentClassName="space-y-5"
        title={
          <div className="flex items-center gap-2">
            <IntegrationIcon app="strava" size={34} label="Strava" />
            <div>
              <h3 className="text-base font-bold text-fg leading-snug">Strava</h3>
              <p className="text-[11px] text-muted">New activities appear in Nuvia automatically</p>
            </div>
          </div>
        }
      >
        {notice && (
          <div
            role="status"
            className={`rounded-[var(--radius-control)] border p-3 text-xs font-semibold ${
              notice.ok ? 'border-accent/30 bg-accent/10 text-green-ink' : 'border-danger/40 bg-danger/10 text-red-ink'
            }`}
          >
            {notice.text}
          </div>
        )}

        {!signedIn ? (
          <p className="text-sm text-fg-soft">Sign in to your Nuvia account to connect Strava.</p>
        ) : !status ? (
          <div className="h-24 rounded-[var(--radius-control)] bg-elevated/50 animate-pulse" aria-label="Loading" />
        ) : !status.configured ? (
          <div className="rounded-[var(--radius-control)] border border-line bg-elevated/40 p-3 text-xs text-fg-soft leading-relaxed">
            Strava isn&apos;t set up on the server yet. It needs a Strava API app, three Vercel settings and the{' '}
            <code className="font-mono text-fg">strava_connections</code> table (see docs/STRAVA_SETUP.md).
          </div>
        ) : status.connected ? (
          <div className="space-y-4">
            <div className="rounded-[var(--radius-control)] border border-line bg-elevated/40 p-3.5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-ink shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-fg truncate">
                  Connected{status.athleteName ? ` as ${status.athleteName}` : ''}
                </p>
                <p className="text-[11px] text-muted">{lastSync ? `Last sync ${lastSync}` : 'Not synced yet'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={sync}
              disabled={!!busy}
              className="w-full h-12 rounded-[var(--radius-control)] bg-accent text-on-accent text-sm font-extrabold flex items-center justify-center gap-2 hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${busy === 'sync' ? 'animate-spin' : ''}`} />
              {busy === 'sync' ? 'Syncing…' : 'Sync now'}
            </button>

            {!confirmDisconnect ? (
              <button
                type="button"
                onClick={() => setConfirmDisconnect(true)}
                className="w-full h-11 rounded-[var(--radius-control)] text-sm font-bold text-red-ink hover:bg-danger/10 cursor-pointer"
              >
                Disconnect Strava
              </button>
            ) : (
              <div className="rounded-[var(--radius-control)] border border-danger/40 p-3.5 space-y-3">
                <p className="text-sm font-bold text-fg">Disconnect Strava?</p>
                <p className="text-xs text-fg-soft">Nuvia stops receiving activities and its access on Strava is revoked.</p>
                <label className="flex items-center gap-2 text-xs font-semibold text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeActivities}
                    onChange={(e) => setRemoveActivities(e.target.checked)}
                    className="w-4 h-4 accent-[var(--theme-accent)]"
                  />
                  Also remove activities imported from Strava
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    className="h-10 rounded-[var(--radius-control)] bg-elevated text-fg text-sm font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={disconnect}
                    disabled={!!busy}
                    className="h-10 rounded-[var(--radius-control)] bg-danger text-on-accent text-sm font-extrabold disabled:opacity-50 cursor-pointer"
                  >
                    {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-fg-soft leading-relaxed">
              Connect once and every new Strava activity is logged in Nuvia within seconds. Your last 30 days are
              imported when you connect. Runs that also reach Nuvia through Apple Health are only logged once.
            </p>
            <button
              type="button"
              onClick={connect}
              disabled={!!busy}
              className="w-full h-12 rounded-[var(--radius-control)] bg-[#FC4C02] text-white text-sm font-extrabold flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-60 cursor-pointer"
            >
              {busy === 'connect' ? 'Opening Strava…' : 'Connect with Strava'}
            </button>
          </div>
        )}

        <p className="text-[11px] font-semibold text-muted text-center pb-2">Powered by Strava</p>
      </NuviaBottomSheet>
    </>
  );
}
