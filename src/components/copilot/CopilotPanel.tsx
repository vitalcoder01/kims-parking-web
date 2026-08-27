import React, {useState, useMemo, useCallback} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/AuthContext';
import {useAppState} from '../../context/AppStateContext';
import {PressableScale} from '../PressableScale';
import {Icon} from '../Icon';
import {Creature} from './Creature';
import {selectShiftSummary, hourLabel} from '../../core/copilot/summary';
import {syncAgeLabel} from '../../services/syncClock';
import {runHealthCheck, requestNotificationPermission, HealthItem} from '../../services/healthCheck';
import {diagnosticsApi} from '../../services/api';
import {buildReport} from '../../core/copilot/reporter';
import type {Insight, CopilotRole} from '../../core/copilot/insights';

const APP_VERSION = (import.meta as {env?: Record<string, string>}).env?.VITE_APP_VERSION ?? 'web';

/*
 * What the creature can do once you tap it. Web port of the mobile panel —
 * same sections, same order, same data, expressed in DOM.
 *
 * The overlay's bubble answers "what is wrong right now" in one line. This
 * is everything else the app already knows and never says out loud, grouped
 * so someone mid-shift can find one thing fast rather than read a dashboard.
 *
 * Ordered by urgency rather than by feature: what needs attention, whether
 * the app itself is healthy, how the day has gone, then the tools. Nothing
 * here runs until the panel is opened.
 */

interface Props {
  visible: boolean;
  onClose: () => void;
  insights: Insight[];
  onAct: (insight: Insight) => void;
  onDismiss: (id: string) => void;
}

const STATE_COLOR = {ok: '#2FA84F', warn: '#F5A524', fail: '#E5484D', checking: '#8A8F98'} as const;

export function CopilotPanel({visible, onClose, insights, onAct, onDismiss}: Props) {
  const {colors} = useTheme();
  const {user} = useAuth();
  const {tasks, visitors, refreshTasks} = useAppState();

  const [health, setHealth] = useState<HealthItem[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [problem, setProblem] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);

  const now = Date.now();
  const role = (user?.role ?? 'doctor') as CopilotRole;

  const summary = useMemo(
    () => selectShiftSummary(tasks, {role, userId: user?.id, driverId: user?.linkedDriverId ?? null, now}),
    // `now` deliberately excluded: it changes every render and this is a
    // today-figure, not a live clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, role, user?.id, user?.linkedDriverId, visible],
  );

  const check = useCallback(async () => {
    setChecking(true);
    try { setHealth(await runHealthCheck()); } finally { setChecking(false); }
  }, []);

  const resync = useCallback(async () => {
    setResyncing(true);
    try { await refreshTasks(); } catch { /* the health row will show it failed */ }
    finally { setResyncing(false); }
  }, [refreshTasks]);

  /*
   * A problem someone can see but the app cannot.
   *
   * Crash reporting only catches faults that THROW. "The map shows the wrong
   * driver" throws nothing and reaches nobody. This lands in the same table
   * as real crashes, with role, screen and version attached, so it sits in
   * triage next to them instead of in a WhatsApp message.
   */
  const sendProblem = useCallback(async () => {
    const text = problem.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const r = buildReport(new Error(text), {
        platform: 'web',
        appVersion: APP_VERSION,
        screen: 'reported-by-user',
      });
      await diagnosticsApi.reportError({...r, name: 'UserReport'});
      setProblem('');
    } catch {
      // Deliberately silent — someone reporting a problem should not be
      // handed a second one.
    } finally {
      setSending(false);
      setSent(true);
    }
  }, [problem, sending]);

  /*
   * Web has no release-notes endpoint to read. appVersion.js describes APK
   * releases and would be describing a different application here, so this
   * says only what is true of the web app.
   */
  const loadNotes = useCallback(() => {
    setNotes('This app updates automatically. Reload when the update banner appears.');
  }, []);

  // Live records only. A plate that finished yesterday is a records search,
  // not a "where is it now" question.
  const found = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits: {label: string; sub: string}[] = [];
    for (const v of visitors) {
      if (v.status === 'retrieved' || v.status === 'cancelled') continue;
      if ((v.carNumber ?? '').toLowerCase().includes(q) || (v.token ?? '').toLowerCase().includes(q)) {
        hits.push({label: v.carNumber ?? 'No plate', sub: `Visitor · ${v.status}${v.slotId ? ` · ${v.slotId}` : ''}`});
      }
    }
    for (const t of tasks) {
      if (t.status === 'completed' || t.status === 'cancelled') continue;
      if ((t.carNumber ?? '').toLowerCase().includes(q)) {
        hits.push({label: t.carNumber ?? 'No plate', sub: `${t.doctorName ?? 'Staff'} · ${t.status}${t.slotId ? ` · ${t.slotId}` : ''}`});
      }
    }
    return hits.slice(0, 6);
  }, [findQuery, visitors, tasks]);

  if (!visible) return null;

  const worst = insights[0]?.severity ?? null;

  const card: React.CSSProperties = {
    borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.surface,
    padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
  };
  const ghost: React.CSSProperties = {
    borderRadius: 9, border: `1px solid ${colors.border}`, padding: '8px 13px',
    background: 'transparent', minWidth: 92,
  };
  const primary: React.CSSProperties = {
    borderRadius: 9, border: 'none', padding: '8px 15px', background: colors.primary,
  };
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', borderRadius: 12,
    border: `1px solid ${colors.border}`, background: colors.surface,
    color: colors.textPrimary, padding: '11px 13px', fontSize: 13.5, fontWeight: 600,
    fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'absolute', inset: 0, zIndex: 60,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      {/* Tap-outside-to-close. A dismiss region, not a button — it should not
          animate or look pressable. */}
      <div onClick={onClose} style={{flex: 1}} aria-label="Close" />

      <div
        className="screen-enter"
        style={{
          maxHeight: '86%', display: 'flex', flexDirection: 'column',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          background: colors.background, overflow: 'hidden',
        }}
      >
        <div style={{display: 'flex', justifyContent: 'center', paddingTop: 8}}>
          <span style={{width: 38, height: 4, borderRadius: 2, background: colors.border}} />
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px'}}>
          <Creature mood="idle" severity={worst} size={38} restColor={colors.cardAlt} eyeColor={colors.textPrimary} />
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontSize: 16, fontWeight: 900, color: colors.textPrimary}}>
              {insights.length ? `${insights.length} thing${insights.length === 1 ? '' : 's'} to look at` : 'All clear'}
            </div>
            <div style={{fontSize: 11.5, fontWeight: 600, marginTop: 2, color: colors.textMuted}}>
              Synced {syncAgeLabel(now)}
            </div>
          </div>
          <PressableScale
            onClick={onClose}
            style={{width: 32, height: 32, borderRadius: 16, border: `1px solid ${colors.border}`, background: 'transparent'}}
          >
            <Icon name="close" size={16} color={colors.textSecondary} />
          </PressableScale>
        </div>

        <div className="screen-scroll" style={{padding: '0 18px 34px'}}>
          {insights.length > 0 && (
            <Section title="Needs attention" colors={colors}>
              {insights.map(i => (
                <div key={i.id} style={card}>
                  <div style={{display: 'flex', alignItems: 'flex-start', gap: 9}}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0,
                      background: STATE_COLOR[i.severity === 'critical' ? 'fail' : i.severity === 'warn' ? 'warn' : 'checking'],
                    }} />
                    <span style={{flex: 1, fontSize: 13, fontWeight: 700, lineHeight: 1.4, color: colors.textPrimary}}>
                      {i.message}
                    </span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                    <PressableScale onClick={() => onDismiss(i.id)} style={ghost}>
                      <span style={{fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>Dismiss</span>
                    </PressableScale>
                    {i.action && (
                      <PressableScale onClick={() => { onAct(i); onClose(); }} style={primary}>
                        <span style={{fontSize: 12, fontWeight: 800, color: colors.textOnPrimary}}>{i.action.label}</span>
                      </PressableScale>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

          <Section title="App health" colors={colors}>
            {health?.map(h => (
              <div key={h.key} style={card}>
                <div style={{display: 'flex', alignItems: 'flex-start', gap: 9}}>
                  <span style={{width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0, background: STATE_COLOR[h.state]}} />
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>{h.label}</div>
                    <div style={{fontSize: 11.5, fontWeight: 600, marginTop: 2, lineHeight: 1.4, color: colors.textMuted}}>{h.detail}</div>
                  </div>
                </div>
                {h.fix === 'requestPermission' && (
                  <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                    <PressableScale onClick={async () => { await requestNotificationPermission(); check(); }} style={primary}>
                      <span style={{fontSize: 12, fontWeight: 800, color: colors.textOnPrimary}}>Allow alerts</span>
                    </PressableScale>
                  </div>
                )}
              </div>
            ))}
            <div style={{display: 'flex', gap: 8}}>
              <PressableScale onClick={check} disabled={checking} style={{...ghost, opacity: checking ? 0.5 : 1}}>
                <span style={{fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>
                  {checking ? 'Checking…' : health ? 'Check again' : 'Run health check'}
                </span>
              </PressableScale>
              <PressableScale onClick={resync} disabled={resyncing} style={{...ghost, opacity: resyncing ? 0.5 : 1}}>
                <span style={{fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>
                  {resyncing ? 'Syncing…' : 'Resync now'}
                </span>
              </PressableScale>
            </div>
          </Section>

          <Section title="Today" colors={colors}>
            <div style={{display: 'flex', gap: 8}}>
              <Stat value={String(summary.completed)} label="Completed" colors={colors} />
              <Stat value={String(summary.active)} label="Active" colors={colors} />
              <Stat value={summary.medianMinutes != null ? `${summary.medianMinutes}m` : '—'} label="Typical" colors={colors} />
              <Stat value={summary.busiestHour != null ? hourLabel(summary.busiestHour) : '—'} label="Busiest" colors={colors} />
            </div>
          </Section>

          <Section title="Find a car" colors={colors}>
            <input
              value={findQuery}
              onChange={e => setFindQuery(e.target.value)}
              placeholder="Plate or token"
              style={input}
            />
            {findQuery.trim().length >= 2 && found.length === 0 && (
              <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textMuted, padding: '0 4px'}}>
                Nothing live matches that. It may be finished — try the Jobs tab.
              </div>
            )}
            {found.map((f, i) => (
              <div key={i} style={card}>
                <div style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>{f.label}</div>
                <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textMuted, marginTop: -4}}>{f.sub}</div>
              </div>
            ))}
          </Section>

          <Section title="Report a problem" colors={colors}>
            {sent ? (
              <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textMuted, padding: '0 4px'}}>
                Sent. It will show up alongside crash reports.
              </div>
            ) : (
              <>
                <textarea
                  value={problem}
                  onChange={e => setProblem(e.target.value)}
                  placeholder="What is wrong? e.g. map shows the wrong driver"
                  style={{...input, minHeight: 78, resize: 'vertical'}}
                />
                <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                  <PressableScale
                    onClick={sendProblem}
                    disabled={!problem.trim() || sending}
                    style={{...primary, opacity: !problem.trim() || sending ? 0.5 : 1}}
                  >
                    <span style={{fontSize: 12, fontWeight: 800, color: colors.textOnPrimary}}>
                      {sending ? 'Sending…' : 'Send'}
                    </span>
                  </PressableScale>
                </div>
              </>
            )}
          </Section>

          <Section title="What's new" colors={colors}>
            {notes == null ? (
              <PressableScale onClick={loadNotes} style={{...ghost, alignSelf: 'flex-start'}}>
                <span style={{fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>Show</span>
              </PressableScale>
            ) : (
              <div style={{fontSize: 11.5, fontWeight: 600, lineHeight: 1.6, color: colors.textSecondary, padding: '0 4px'}}>
                {notes}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({title, colors, children}: {title: string; colors: any; children: React.ReactNode}) {
  return (
    <div style={{marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8}}>
      <div style={{fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: colors.textMuted}}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Stat({value, label, colors}: {value: string; label: string; colors: any}) {
  return (
    <div style={{
      flex: 1, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface,
      padding: '11px 4px', textAlign: 'center',
    }}>
      <div style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary}}>{value}</div>
      <div style={{fontSize: 10, fontWeight: 700, marginTop: 2, color: colors.textMuted}}>{label}</div>
    </div>
  );
}
