'use client';

import React, { useState } from 'react';
import { Check, ChevronRight, Copy, KeyRound, Link2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { NuviaBottomSheet } from '../NuviaBottomSheet';
import { IntegrationIcon } from './IntegrationIcon';

type KeyState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; token: string; endpoint: string }
  | { status: 'error'; message: string };

function CopyRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const shown = secret ? `${value.slice(0, 8)}••••••••${value.slice(-6)}` : value;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(`Copy ${label}:`, value);
    }
  };
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-elevated/40 p-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
        <p className="mt-0.5 text-xs font-semibold text-fg truncate font-mono">{shown}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="h-9 px-3 rounded-[10px] bg-fg text-app text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-accent text-on-accent text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-bold text-fg">{title}</p>
        <div className="text-xs text-fg-soft leading-relaxed space-y-1">{children}</div>
      </div>
    </li>
  );
}

/** Profile row + sheet: connect adidas Running through Apple Health and an iPhone Shortcut. */
export function HealthSyncConnect() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [keyState, setKeyState] = useState<KeyState>({ status: 'idle' });

  const signedIn = !!user?.id && isSupabaseConfigured() && user.id !== 'demo-user-001';

  const loadKey = async () => {
    setKeyState({ status: 'loading' });
    try {
      const { data } = await createClient().auth.getSession();
      const jwt = data.session?.access_token;
      if (!jwt) throw new Error('Sign in to get your key.');
      const res = await fetch('/api/health-sync/token', { headers: { Authorization: `Bearer ${jwt}` } });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Could not create your key.');
      setKeyState({ status: 'ready', token: json.token, endpoint: json.endpoint });
    } catch (e) {
      setKeyState({ status: 'error', message: e instanceof Error ? e.message : 'Could not create your key.' });
    }
  };

  const open = () => {
    setIsOpen(true);
    if (signedIn && keyState.status !== 'ready') loadKey();
  };

  const field = (name: string, value: string) => (
    <span className="block">
      <code className="font-mono text-fg">{name}</code> → {value}
    </span>
  );

  return (
    <>
      <button
          type="button"
          onClick={open}
          className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-fg/[0.03] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-3 min-w-0">
            <IntegrationIcon app="adidas" badge="apple-health" size={34} />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-fg">Connect adidas Running</span>
              <span className="block text-[11px] text-muted truncate">Auto-import runs through Apple Health</span>
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        </button>

      <NuviaBottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        variant="standard"
        ariaLabel="Connect adidas Running"
        contentClassName="space-y-5"
        title={
          <div className="flex items-center gap-2">
            <IntegrationIcon app="adidas" badge="apple-health" size={34} label="adidas Running and Apple Health" />
            <div>
              <h3 className="text-base font-bold text-fg leading-snug">Connect adidas Running</h3>
              <p className="text-[11px] text-muted">adidas Running → Apple Health → Shortcut → Nuvia</p>
            </div>
          </div>
        }
      >
        <p className="text-sm text-fg-soft leading-relaxed">
          adidas Running saves your runs to Apple Health. A daily iPhone Shortcut sends new workouts to Nuvia, and
          each one is logged on the day it happened. Sending a run twice is safe: duplicates are skipped.
        </p>

        {!signedIn ? (
          <div className="rounded-[var(--radius-control)] border border-line bg-elevated/40 p-3 text-xs text-fg-soft">
            Sign in to your Nuvia account to get your personal key. The demo profile can&apos;t receive workouts.
          </div>
        ) : keyState.status === 'ready' ? (
          <div className="space-y-2">
            <CopyRow label="Your key (keep private)" value={keyState.token} secret />
            <CopyRow label="Import URL" value={keyState.endpoint} />
            <CopyRow label="Test URL (saves nothing)" value={`${keyState.endpoint}?dryRun=1`} />
            <p className="flex items-start gap-1.5 text-[11px] text-muted leading-relaxed">
              <KeyRound className="w-3.5 h-3.5 shrink-0 mt-px" />
              The key can only add workouts to your account. It can&apos;t read your data.
            </p>
          </div>
        ) : keyState.status === 'error' ? (
          <div className="rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 p-3 text-xs font-semibold text-red-ink flex items-center justify-between gap-3">
            <span>{keyState.message}</span>
            <button type="button" onClick={loadKey} className="underline cursor-pointer shrink-0">
              Retry
            </button>
          </div>
        ) : (
          <div className="h-[150px] rounded-[var(--radius-control)] bg-elevated/50 animate-pulse" aria-label="Loading your key" />
        )}

        <div className="pt-4 border-t border-line">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Set up the Shortcut (once)</p>
          <ol className="mt-3 space-y-4">
            <Step n={1} title="Create the automation">
              <p>
                Shortcuts → <b>Automation</b> → <b>+</b> → <b>Time of Day</b>. Pick a time after your usual run (e.g.
                9:00 PM), <b>Daily</b>, and choose <b>Run Immediately</b>. Then <b>New Blank Automation</b>.
              </p>
            </Step>
            <Step n={2} title="Find Health Samples">
              <p>
                Type <b>Workouts</b>. Add filter <b>Start Date</b> is <b>in the last 2 days</b>. Sort by{' '}
                <b>Start Date</b>, <b>Latest First</b>.
              </p>
            </Step>
            <Step n={3} title="Repeat with Each">
              <p>Add <b>Repeat with Each</b> and choose <b>Health Samples</b>.</p>
            </Step>
            <Step n={4} title="Inside the repeat: Get Contents of URL">
              <p>
                URL: paste the <b>Import URL</b>. Tap ▸ to show more: Method <b>POST</b>.
              </p>
              <p>
                Headers: add <code className="font-mono text-fg">Authorization</code> with value{' '}
                <code className="font-mono text-fg">Bearer</code> + a space + your key.
              </p>
              <p>Request Body: <b>JSON</b>. Add Text fields, each set to <b>Repeat Item</b> and then tap it to pick the detail:</p>
              <div className="pl-2 border-l-2 border-line space-y-0.5">
                {field('start', 'Start Date (Date Format: ISO 8601)')}
                {field('end', 'End Date (Date Format: ISO 8601)')}
                {field('type', 'Type')}
                {field('source', 'Source')}
                {field('distance', 'Distance, if it is offered')}
              </div>
            </Step>
            <Step n={5} title="Test once by hand">
              <p>
                Temporarily use the <b>Test URL</b>, add <b>Show Result</b> after Get Contents of URL, and tap ▶. You
                should see something like “Nuvia test: would import 1 — Running 5.02 km · 31 min”. Then switch back to
                the Import URL and remove Show Result.
              </p>
            </Step>
          </ol>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-muted leading-relaxed pb-2">
          <Link2 className="w-3.5 h-3.5 shrink-0 mt-px" />
          Make sure adidas Running is allowed to write workouts: Health app → your profile → Apps → adidas Running.
        </p>
      </NuviaBottomSheet>
    </>
  );
}
