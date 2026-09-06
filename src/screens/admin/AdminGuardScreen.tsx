import React, {useEffect, useMemo, useState} from 'react';
import {useAppState} from '../../context/AppStateContext';
import {PressableScale} from '../../components/PressableScale';
import {Icon, IconName} from '../../components/Icon';
import {spacing, radius, typography} from '../../theme';
import {dark, RadialGauge} from './adminDarkTheme';

/*
 * "Guard" — a live ops console. Originally styled after a reference the
 * user shared (a dark, glowing "Park.Guard" dashboard concept); adapted,
 * not copied — that reference's AI voice assistant, automatic windshield-
 * damage detection, drag-to-call emergency button and single "rental
 * vehicle" spotlight with a stock owner photo don't correspond to
 * anything KIMS actually does. Inventing UI for features with no backend
 * behind them is exactly what the AI-slop cleanup pass earlier this
 * session removed.
 *
 * Palette + shared pieces (RadialGauge, etc.) now live in
 * ./adminDarkTheme — see that file for the LaunchDarkly-sourced token
 * provenance. Every other admin "ops" screen (Dashboard, Staff,
 * Attendance, Map) pulls from the same module.
 *
 * What's kept from the layout idea: a live floor view + a selected-item
 * detail panel + a trend chart + an activity log — every number and
 * label reads off the same `useAppState()` data the rest of the admin
 * console uses. No new backend calls, no invented metrics.
 */

function agoLabel(ms?: number): string {
  if (!ms) return '—';
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min ago` : `${hrs} hr ago`;
}

export function AdminGuardScreen() {
  const {slots, tasks, fetchTaskHistory} = useAppState();
  const [history, setHistory] = useState<typeof tasks>([]);
  useEffect(() => { fetchTaskHistory().then(setHistory).catch(() => {}); }, [fetchTaskHistory]);

  const blocks = useMemo(() => {
    const byBlock = new Map<string, typeof slots>();
    for (const sl of slots) {
      const list = byBlock.get(sl.block) ?? [];
      list.push(sl);
      byBlock.set(sl.block, list);
    }
    return [...byBlock.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, list]) => ({name, slots: list.slice().sort((a, b) => a.number - b.number)}));
  }, [slots]);

  const [activeBlock, setActiveBlock] = useState<string | undefined>(undefined);
  useEffect(() => { if (!activeBlock && blocks.length) setActiveBlock(blocks[0].name); }, [blocks, activeBlock]);
  const currentBlock = blocks.find(b => b.name === activeBlock);

  const occupiedSlots = useMemo(() => slots.filter(s => s.status === 'occupied'), [slots]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!selectedId && occupiedSlots.length) setSelectedId(occupiedSlots[0].id);
  }, [occupiedSlots, selectedId]);
  const selectedSlot = slots.find(s => s.id === selectedId);
  const selectedTask = selectedSlot?.taskId ? tasks.find(t => t.id === selectedSlot.taskId) : undefined;

  const [detailTab, setDetailTab] = useState<'overview' | 'history'>('overview');
  const slotHistory = selectedSlot ? history.filter(t => t.slotId === selectedSlot.id).slice(0, 5) : [];

  // Real "needs attention" signal — a retrieval sitting with nobody
  // assigned, the same rule the co-pilot's insight engine already uses.
  // Not a fabricated "impact detected" narrative.
  const needsDriver = tasks.filter(t =>
    t.type === 'retrieve' && (t.status === 'requested' || t.status === 'accepted') && t.driverId == null);

  const occupied = slots.filter(s => s.status === 'occupied').length;
  const total = slots.length;
  const free = total - occupied;
  const occupancyPct = total ? (occupied / total) * 100 : 0;

  // Jobs completed per day, last 6 days — real, derived from fetched
  // history. Stands in for the reference's "rental time" chart.
  const trend = useMemo(() => {
    const out: {label: string; count: number}[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const count = history.filter(t => t.completedAt != null && t.completedAt >= dayStart && t.completedAt < dayEnd).length;
      out.push({label: d.toLocaleDateString(undefined, {weekday: 'short'}).slice(0, 3), count});
    }
    return out;
  }, [history]);
  const trendMax = Math.max(1, ...trend.map(t => t.count));

  const recentActivity = history.slice(0, 4);

  const glowCard: React.CSSProperties = {
    borderRadius: radius['2xl'], border: `1px solid ${dark.border}`,
    backgroundColor: dark.card, padding: 16, marginBottom: spacing.md,
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: dark.textMuted, marginBottom: spacing.sm,
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: dark.bg, paddingBottom: 40}}>
      {needsDriver.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, margin: '12px 16px 0',
          padding: '10px 14px', borderRadius: radius.lg,
          backgroundColor: dark.danger + '1c', border: `1px solid ${dark.danger}44`,
        }}>
          <span style={{position: 'relative', width: 8, height: 8, flexShrink: 0}}>
            <span className="ping-dot" style={{position: 'absolute', inset: 0, borderRadius: 4, backgroundColor: dark.danger}} />
            <span style={{position: 'absolute', inset: 0, borderRadius: 4, backgroundColor: dark.danger}} />
          </span>
          <span style={{fontSize: 12.5, fontWeight: 700, color: dark.textPrimary}}>
            {needsDriver.length} {needsDriver.length === 1 ? 'retrieval needs' : 'retrievals need'} a driver
          </span>
        </div>
      )}

      <div style={{padding: 16}}>
        {/* Live floor — block selector + this block's slot grid, the
            occupied/selected slot picked out with a glow ring instead of
            an isometric 3D render (same data AdminMapScreen shows, this
            screen's visual language is just the one thing that differs). */}
        <div style={sectionLabel}>Live floor</div>
        <div style={{
          ...glowCard,
          background: `radial-gradient(120% 140% at 15% 0%, ${dark.accent}22 0%, transparent 55%), ${dark.card}`,
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14}}>
            <RadialGauge pct={occupancyPct} color={dark.accent2} trackColor="rgba(255,255,255,0.08)" />
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, color: dark.textPrimary, letterSpacing: -0.5}}>
                {occupied}<span style={{fontSize: 14, fontWeight: 700, color: dark.textMuted}}> / {total} on site</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap'}}>
                <span style={{fontSize: 12, fontWeight: 800, color: dark.success}}>{free} free</span>
                {needsDriver.length > 0 && (
                  <span style={{fontSize: 12, fontWeight: 800, color: dark.danger}}>{needsDriver.length} need{needsDriver.length === 1 ? 's' : ''} a driver</span>
                )}
              </div>
            </div>
          </div>

          {blocks.length > 1 && (
            <div className="hscroll" style={{gap: 8, marginBottom: 12}}>
              {blocks.map(bl => {
                const on = bl.name === activeBlock;
                return (
                  <PressableScale key={bl.name} onClick={() => setActiveBlock(bl.name)}
                    style={{
                      flexShrink: 0, padding: '7px 14px', borderRadius: radius.full,
                      backgroundColor: on ? dark.accent : 'transparent',
                      border: `1px solid ${on ? dark.accent : dark.border}`,
                    }}>
                    <span style={{fontSize: 12, fontWeight: 800, color: on ? '#fff' : dark.textSecondary}}>Block {bl.name}</span>
                  </PressableScale>
                );
              })}
            </div>
          )}

          {!currentBlock || currentBlock.slots.length === 0 ? (
            <div style={{padding: '20px 0', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: dark.textMuted}}>No slots configured yet</div>
          ) : (
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
              {currentBlock.slots.map(sl => {
                const isSel = sl.id === selectedId;
                const free = sl.status === 'free';
                return (
                  <PressableScale key={sl.id} onClick={() => { setSelectedId(sl.id); setDetailTab('overview'); }}
                    style={{
                      width: 42, height: 38, borderRadius: radius.md,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isSel ? dark.accent : free ? 'transparent' : dark.cardAlt,
                      border: `1.5px solid ${isSel ? dark.accent2 : free ? dark.border : 'transparent'}`,
                      boxShadow: isSel ? `0 0 0 3px ${dark.accent}33, 0 0 16px ${dark.accent2}66` : 'none',
                    }}>
                    <span style={{fontSize: 11.5, fontWeight: 800, color: isSel ? '#fff' : free ? dark.textMuted : dark.textSecondary}}>{sl.number}</span>
                  </PressableScale>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected slot — real occupant detail, tabbed like the
            reference's Overview/Payment/History panel (Payment dropped:
            KIMS valet parking has no billing concept to show). */}
        <div style={sectionLabel}>Selected slot</div>
        <div style={glowCard}>
          {!selectedSlot ? (
            <div style={{padding: '16px 0', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: dark.textMuted}}>Tap a slot above to inspect it</div>
          ) : (
            <>
              <div style={{display: 'flex', gap: 6, marginBottom: 14}}>
                {(['overview', 'history'] as const).map(t => {
                  const on = detailTab === t;
                  return (
                    <PressableScale key={t} onClick={() => setDetailTab(t)}
                      style={{
                        padding: '6px 14px', borderRadius: radius.full,
                        backgroundColor: on ? dark.accent : 'transparent',
                        border: `1px solid ${on ? dark.accent : dark.border}`,
                      }}>
                      <span style={{fontSize: 11.5, fontWeight: 800, textTransform: 'capitalize', color: on ? '#fff' : dark.textSecondary}}>{t}</span>
                    </PressableScale>
                  );
                })}
              </div>

              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14}}>
                <div>
                  <div style={{fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: dark.textMuted}}>SLOT {selectedSlot.id}</div>
                  <div style={{fontSize: 18, fontWeight: 900, marginTop: 2, color: dark.textPrimary}}>
                    {selectedSlot.status === 'occupied' ? (selectedTask?.carNumber ?? selectedSlot.carNumber ?? 'Occupied') : 'Free'}
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: radius.full, fontSize: 10.5, fontWeight: 800,
                  backgroundColor: selectedSlot.status === 'occupied' ? dark.accent2 + '22' : dark.success + '22',
                  color: selectedSlot.status === 'occupied' ? dark.accent2 : dark.success,
                }}>{selectedSlot.status === 'occupied' ? 'OCCUPIED' : 'FREE'}</span>
              </div>

              {detailTab === 'overview' ? (
                selectedSlot.status !== 'occupied' ? (
                  <div style={{fontSize: 12.5, fontWeight: 600, color: dark.textMuted, textAlign: 'center', padding: '8px 0'}}>This slot is free.</div>
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                    {([
                      [selectedTask?.isVisitor ? 'Visitor' : 'Owner', selectedTask?.doctorName ?? '—'],
                      ...(selectedTask?.doctorDepartment ? [['Department', selectedTask.doctorDepartment]] as [string, string][] : []),
                      ...(selectedTask?.driverName ? [['Driver', selectedTask.driverName]] as [string, string][] : []),
                      ['Parked', agoLabel(selectedTask?.completedAt)],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} style={{display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', borderRadius: radius.md, backgroundColor: dark.cardAlt}}>
                        <span style={{fontSize: 11.5, fontWeight: 700, color: dark.textMuted}}>{k}</span>
                        <span style={{fontSize: 12.5, fontWeight: 800, color: dark.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                slotHistory.length === 0 ? (
                  <div style={{fontSize: 12.5, fontWeight: 600, color: dark.textMuted, textAlign: 'center', padding: '8px 0'}}>No recent sessions in this slot.</div>
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                    {slotHistory.map(t => (
                      <div key={t.id} style={{display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', borderRadius: radius.md, backgroundColor: dark.cardAlt}}>
                        <span style={{fontSize: 12, fontWeight: 700, color: dark.textPrimary}}>{t.carNumber}</span>
                        <span style={{fontSize: 11, fontWeight: 600, color: dark.textMuted}}>{agoLabel(t.completedAt)}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Trend — completed jobs per day, real numbers from history. */}
        <div style={sectionLabel}>Jobs — last 6 days</div>
        <div style={glowCard}>
          <div style={{display: 'flex', alignItems: 'flex-end', gap: 10, height: 90}}>
            {trend.map(d => (
              <div key={d.label} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end'}}>
                <div style={{
                  width: '100%', maxWidth: 22, borderRadius: 5,
                  height: `${Math.max(6, (d.count / trendMax) * 64)}px`,
                  background: `linear-gradient(180deg, ${dark.accent2}, ${dark.accent})`,
                }} />
                <span style={{fontSize: 10, fontWeight: 700, color: dark.textMuted}}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live activity — the same real feed the Dashboard tab surfaces,
            restyled here instead of a spoken AI transcript. */}
        <div style={sectionLabel}>Recent activity</div>
        <div style={{...glowCard, marginBottom: 4}}>
          {recentActivity.length === 0 ? (
            <div style={{padding: '16px 0', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: dark.textMuted}}>No activity yet today</div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              {recentActivity.map((t, i) => {
                const icon: IconName = t.status === 'completed' ? 'checkBold' : t.type === 'park' ? 'car' : 'refresh';
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px',
                    borderBottom: i === recentActivity.length - 1 ? 'none' : `1px solid ${dark.divider}`,
                  }}>
                    <div style={{width: 28, height: 28, borderRadius: radius.md, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: dark.accent + '22'}}>
                      <Icon name={icon} size={13} color={dark.accent} />
                    </div>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontSize: 12.5, fontWeight: 700, color: dark.textPrimary}}>
                        {t.carNumber} — {t.type === 'park' ? 'parked' : 'retrieved'}{t.slotId ? ` at ${t.slotId}` : ''}
                      </div>
                      <div style={{fontSize: 11, marginTop: 1, color: dark.textMuted}}>{t.doctorName}{t.driverName ? ` · ${t.driverName}` : ''}</div>
                    </div>
                    <span style={{fontSize: 10.5, fontWeight: 600, color: dark.textMuted, flexShrink: 0}}>{agoLabel(t.completedAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
