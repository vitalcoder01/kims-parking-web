import React, {useCallback, useEffect, useState} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {Icon} from '../../components/Icon';
import {analyticsApi, AnalyticsPeriod, IntelligenceBundle, InsightCard, SlotClassification} from '../../services/api';
import {dark, darkCard, darkSectionLabel, darkEmptyText, DarkPill} from './adminDarkTheme';

/*
 * Admin-only analytics depth beyond what the shared Analytics tab already
 * covers (totals, driver leaderboard, park/retrieve trend, block
 * utilization all live there and aren't repeated here). This screen is
 * everything new from the backend's /analytics/intelligence bundle:
 * per-slot classification, task-lifecycle bottlenecks, notification
 * volume, data-quality findings, demand anomalies, and the computed
 * insight cards that read all of the above.
 *
 * Every number here traces to a real query in analytics.service.js — see
 * that file's comments for exactly what's measured vs derived. Nothing on
 * this screen is invented: a stat the database can't currently support
 * (e.g. true slot occupied-duration) is stated as unavailable, not
 * estimated and presented as fact.
 */

const PERIODS: {key: AnalyticsPeriod; label: string}[] = [
  {key: 'daily', label: 'Today'},
  {key: 'weekly', label: 'This Week'},
  {key: 'monthly', label: 'This Month'},
  {key: 'yearly', label: 'This Year'},
  {key: 'all', label: 'All-time'},
];

const CLASS_COLOR: Record<SlotClassification, string> = {
  HIGH: dark.accent2,
  NORMAL: dark.textMuted,
  UNDERUTILIZED: dark.warning,
  OVERLOADED: dark.danger,
  NO_DATA: dark.textMuted,
};

function minutesLabel(m: number | null): string {
  if (m == null) return '—';
  if (m < 1) return '<1 min';
  if (m < 60) return `${Math.round(m)} min`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
}

function InsightCardView({insight}: {insight: InsightCard}) {
  const color = insight.severity === 'warn' ? dark.warning : dark.accent2;
  return (
    <div style={{...darkCard, padding: 14, marginBottom: 10, borderLeft: `3px solid ${color}`}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8}}>
        <Icon name={insight.severity === 'warn' ? 'alert' : 'info'} size={15} color={color} />
        <span style={{fontSize: 13.5, fontWeight: 800, color: dark.textPrimary}}>{insight.title}</span>
      </div>
      <div style={{fontSize: 12.5, fontWeight: 600, color: dark.textPrimary, marginBottom: 6, lineHeight: '17px'}}>{insight.observation}</div>
      <div style={{fontSize: 11.5, color: dark.textSecondary, marginBottom: 8, lineHeight: '16px'}}>{insight.evidence}</div>
      <div style={{fontSize: 11, color: dark.textMuted, marginBottom: 6, lineHeight: '15px'}}>
        <span style={{fontWeight: 700, color: dark.textSecondary}}>Impact — </span>{insight.impact}
      </div>
      <div style={{fontSize: 11.5, color: dark.accent, fontWeight: 700, lineHeight: '15px'}}>→ {insight.recommendation}</div>
    </div>
  );
}

function FunnelPanel({title, sampleSize, stages, bottleneck}: {
  title: string; sampleSize: number;
  stages: {key: string; label: string; avgMinutes: number | null; sampleSize: number}[];
  bottleneck: {key: string} | null;
}) {
  const maxMinutes = Math.max(1, ...stages.map(s => s.avgMinutes ?? 0));
  return (
    <div style={{...darkCard, padding: 14, marginBottom: 12}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
        <span style={{fontSize: 13.5, fontWeight: 800, color: dark.textPrimary}}>{title}</span>
        <span style={{fontSize: 11, fontWeight: 700, color: dark.textMuted}}>{sampleSize} completed</span>
      </div>
      {sampleSize === 0 ? (
        <div style={darkEmptyText}>No completed jobs in this period yet.</div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
          {stages.map(s => {
            const isBottleneck = bottleneck?.key === s.key;
            const pct = s.avgMinutes != null ? Math.max(4, (s.avgMinutes / maxMinutes) * 100) : 0;
            return (
              <div key={s.key}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 4}}>
                  <span style={{fontSize: 11.5, fontWeight: 600, color: isBottleneck ? dark.textPrimary : dark.textSecondary}}>
                    {s.label}{isBottleneck && <span style={{color: dark.warning, fontWeight: 800}}> · slowest</span>}
                  </span>
                  <span style={{fontSize: 11.5, fontWeight: 800, color: dark.textPrimary, fontVariantNumeric: 'tabular-nums'}}>
                    {minutesLabel(s.avgMinutes)}
                  </span>
                </div>
                <div style={{height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: dark.divider}}>
                  <div style={{height: 6, borderRadius: 3, width: `${s.avgMinutes != null ? pct : 0}%`, backgroundColor: isBottleneck ? dark.warning : dark.accent}} />
                </div>
                {s.avgMinutes != null && s.sampleSize < 5 && (
                  <div style={{fontSize: 9.5, color: dark.textMuted, marginTop: 3}}>Only {s.sampleSize} sample{s.sampleSize === 1 ? '' : 's'} — too few to trust yet.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminIntelligenceScreen() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly');
  const [data, setData] = useState<IntelligenceBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback((p: AnalyticsPeriod, silent?: boolean) => {
    if (!silent) setLoading(true);
    analyticsApi.intelligence(p)
      .then(d => { setData(d); setErr(null); })
      .catch(() => setErr('Could not load intelligence data'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  if (loading && !data) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '60vh', backgroundColor: dark.bg}}>
        <span className="spinner" style={{borderColor: dark.border, borderTopColor: dark.accent}} />
        <span style={{fontSize: 12, fontWeight: 600, color: dark.textMuted}}>Loading intelligence…</span>
      </div>
    );
  }

  if (err && !data) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '60vh', backgroundColor: dark.bg}}>
        <Icon name="alert" size={24} color={dark.textMuted} />
        <span style={{fontSize: 13, color: dark.textMuted}}>{err}</span>
        <PressableScale onClick={() => load(period)} style={{padding: '10px 20px', borderRadius: 12, backgroundColor: dark.accent}}>
          <span style={{color: '#fff', fontSize: 13, fontWeight: 700}}>Retry</span>
        </PressableScale>
      </div>
    );
  }

  if (!data) return null;
  const {slots, taskFunnel, notifications, dataQuality, anomalies, insights} = data;

  const overloaded = slots.slots.filter(s => s.classification === 'OVERLOADED').slice(0, 6);
  const underutilized = slots.slots.filter(s => s.classification === 'UNDERUTILIZED').slice(0, 6);

  return (
    <div className="screen-scroll" style={{backgroundColor: dark.bg, padding: 16, paddingBottom: 40}}>
      {/* Period selector + refresh */}
      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16}}>
        <div className="hscroll" style={{gap: 8, flex: 1}}>
          {PERIODS.map(p => {
            const on = p.key === period;
            return (
              <PressableScale key={p.key} disabled={loading} onClick={() => setPeriod(p.key)}
                style={{flexShrink: 0, padding: '8px 14px', borderRadius: 999, backgroundColor: on ? dark.accent : dark.card, border: `1px solid ${on ? dark.accent : dark.border}`, opacity: loading ? 0.6 : 1}}>
                <span style={{fontSize: 12, fontWeight: 800, color: on ? '#fff' : dark.textSecondary}}>{p.label}</span>
              </PressableScale>
            );
          })}
        </div>
        <PressableScale
          disabled={refreshing}
          style={{width: 36, height: 36, borderRadius: 18, backgroundColor: dark.card, border: `1px solid ${dark.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: refreshing ? 0.6 : 1, flexShrink: 0}}
          onClick={() => { setRefreshing(true); load(period, true); }}>
          {refreshing ? <span className="spinner" style={{width: 14, height: 14, borderColor: dark.border, borderTopColor: dark.accent}} /> : <Icon name="refresh" size={16} color={dark.textPrimary} />}
        </PressableScale>
      </div>

      {/* AI Insights — computed, not generated. Silent when nothing clears a threshold. */}
      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10}}>
        <Icon name="sparkle" size={16} color={dark.accent} />
        <span style={{fontSize: 15, fontWeight: 900, color: dark.textPrimary}}>AI Insights</span>
      </div>
      {insights.length === 0 ? (
        <div style={{...darkCard, padding: 20, textAlign: 'center', marginBottom: 20}}>
          <div style={darkEmptyText}>Nothing has crossed a meaningful threshold this period — that itself is a good sign.</div>
        </div>
      ) : (
        <div style={{marginBottom: 20}}>
          {insights.map(i => <InsightCardView key={i.id} insight={i} />)}
        </div>
      )}

      {/* Slot intelligence */}
      <div style={darkSectionLabel}>Slot Intelligence</div>
      <div style={{display: 'flex', gap: 10, marginBottom: 12}}>
        <div style={{...darkCard, flex: 1, padding: 14, textAlign: 'center'}}>
          <div style={{fontSize: 22, fontWeight: 900, color: dark.warning}}>{slots.underutilizedCount}</div>
          <div style={{fontSize: 10.5, fontWeight: 700, color: dark.textMuted, marginTop: 3}}>Underutilized</div>
        </div>
        <div style={{...darkCard, flex: 1, padding: 14, textAlign: 'center'}}>
          <div style={{fontSize: 22, fontWeight: 900, color: dark.danger}}>{slots.overloadedCount}</div>
          <div style={{fontSize: 10.5, fontWeight: 700, color: dark.textMuted, marginTop: 3}}>Overloaded</div>
        </div>
        <div style={{...darkCard, flex: 1, padding: 14, textAlign: 'center'}}>
          <div style={{fontSize: 22, fontWeight: 900, color: dark.textPrimary}}>{slots.meanUsage}</div>
          <div style={{fontSize: 10.5, fontWeight: 700, color: dark.textMuted, marginTop: 3}}>Avg uses/slot</div>
        </div>
      </div>
      {(overloaded.length > 0 || underutilized.length > 0) && (
        <div style={{...darkCard, padding: 14, marginBottom: 8}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {[...overloaded, ...underutilized].map(s => (
              <div key={s.id} style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <span style={{width: 52, fontSize: 12, fontWeight: 800, color: dark.textPrimary}}>{s.id}</span>
                <DarkPill label={s.classification} color={CLASS_COLOR[s.classification]} />
                <span style={{flex: 1}} />
                <span style={{fontSize: 11.5, fontWeight: 700, color: dark.textSecondary, fontVariantNumeric: 'tabular-nums'}}>{s.usageCount} uses</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{fontSize: 10.5, color: dark.textMuted, lineHeight: '15px', marginBottom: 20}}>{slots.note}</div>

      {/* Task funnel */}
      <div style={darkSectionLabel}>Task Funnel — where time actually goes</div>
      <FunnelPanel title="Park" sampleSize={taskFunnel.park.sampleSize} stages={taskFunnel.park.stages} bottleneck={taskFunnel.park.bottleneck} />
      <div style={{marginBottom: 20}}>
        <FunnelPanel title="Retrieve" sampleSize={taskFunnel.retrieve.sampleSize} stages={taskFunnel.retrieve.stages} bottleneck={taskFunnel.retrieve.bottleneck} />
      </div>

      {/* Notification intelligence */}
      <div style={darkSectionLabel}>Notifications</div>
      <div style={{...darkCard, padding: 14, marginBottom: 20}}>
        {notifications.total === 0 ? (
          <div style={darkEmptyText}>No notifications in this period.</div>
        ) : (
          <>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
              <span style={{fontSize: 20, fontWeight: 900, color: dark.textPrimary}}>{notifications.total}</span>
              <span style={{fontSize: 11, fontWeight: 700, color: dark.textMuted}}>{notifications.meanPerDay}/day avg</span>
            </div>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: notifications.spikes.length ? 12 : 0}}>
              {Object.entries(notifications.byType).map(([type, count]) => (
                <span key={type} style={{padding: '5px 10px', borderRadius: 999, backgroundColor: dark.cardAlt}}>
                  <span style={{fontSize: 11, fontWeight: 700, color: dark.textSecondary}}>{type}: </span>
                  <span style={{fontSize: 11, fontWeight: 800, color: dark.textPrimary}}>{count}</span>
                </span>
              ))}
            </div>
            {notifications.spikes.length > 0 && (
              <div style={{borderTop: `1px solid ${dark.divider}`, paddingTop: 10}}>
                <div style={{fontSize: 10.5, fontWeight: 700, color: dark.warning, marginBottom: 6}}>SPIKES DETECTED</div>
                {notifications.spikes.map(s => (
                  <div key={s.date} style={{display: 'flex', justifyContent: 'space-between', fontSize: 11.5}}>
                    <span style={{color: dark.textSecondary}}>{s.date}</span>
                    <span style={{color: dark.textPrimary, fontWeight: 800}}>{s.count}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Data quality */}
      <div style={darkSectionLabel}>Data Quality</div>
      <div style={{...darkCard, padding: 14, marginBottom: 20}}>
        {dataQuality.openClientErrors === 0 && dataQuality.impossibleTimestampCount === 0 && dataQuality.orphanSlotReferenceCount === 0 ? (
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <Icon name="checkBold" size={15} color={dark.success} />
            <span style={{fontSize: 12.5, fontWeight: 600, color: dark.textSecondary}}>No integrity issues found.</span>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
            {dataQuality.impossibleTimestampCount > 0 && (
              <div style={{fontSize: 12, color: dark.textPrimary}}>
                <span style={{fontWeight: 800, color: dark.warning}}>{dataQuality.impossibleTimestampCount}</span> task(s) with a completion time earlier than their creation time.
              </div>
            )}
            {dataQuality.orphanSlotReferenceCount > 0 && (
              <div style={{fontSize: 12, color: dark.textPrimary}}>
                <span style={{fontWeight: 800, color: dark.warning}}>{dataQuality.orphanSlotReferenceCount}</span> task(s) reference a slot id that no longer exists ({dataQuality.orphanSlotIds.slice(0, 3).join(', ')}{dataQuality.orphanSlotIds.length > 3 ? ', …' : ''}).
              </div>
            )}
            {dataQuality.openClientErrors > 0 && (
              <div>
                <div style={{fontSize: 12, color: dark.textPrimary, marginBottom: 8}}>
                  <span style={{fontWeight: 800, color: dark.warning}}>{dataQuality.openClientErrors}</span> unresolved client error type(s).
                </div>
                {dataQuality.topClientErrors.map(e => (
                  <div key={e.id} style={{padding: '8px 10px', borderRadius: 10, backgroundColor: dark.cardAlt, marginBottom: 6}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{fontSize: 11.5, fontWeight: 800, color: dark.textPrimary}}>{e.name}</span>
                      <span style={{fontSize: 11, fontWeight: 700, color: dark.textMuted}}>×{e.count}</span>
                    </div>
                    <div style={{fontSize: 11, color: dark.textSecondary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{e.message}</div>
                    {e.screen && <div style={{fontSize: 10, color: dark.textMuted, marginTop: 2}}>on {e.screen} · {e.roles.join(', ') || 'unknown role'}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Demand anomalies */}
      <div style={darkSectionLabel}>Demand Anomalies (last {anomalies.lookbackDays} days)</div>
      <div style={{...darkCard, padding: 14}}>
        {anomalies.note ? (
          <div style={darkEmptyText}>{anomalies.note}</div>
        ) : anomalies.anomalies.length === 0 ? (
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <Icon name="checkBold" size={15} color={dark.success} />
            <span style={{fontSize: 12.5, fontWeight: 600, color: dark.textSecondary}}>Demand has stayed within normal range — {anomalies.mean} ± {anomalies.stddev} completed jobs/day.</span>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            <div style={{fontSize: 11, color: dark.textMuted, marginBottom: 4}}>Baseline: {anomalies.mean} ± {anomalies.stddev} completed jobs/day</div>
            {anomalies.anomalies.map(a => (
              <div key={a.date} style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <DarkPill label={a.direction === 'high' ? 'SURGE' : 'LOW'} color={a.direction === 'high' ? dark.danger : dark.warning} />
                <span style={{fontSize: 12, fontWeight: 700, color: dark.textPrimary}}>{a.date}</span>
                <span style={{flex: 1}} />
                <span style={{fontSize: 11.5, fontWeight: 700, color: dark.textSecondary}}>{a.count} jobs ({a.deviationStdDevs > 0 ? '+' : ''}{a.deviationStdDevs}σ)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
