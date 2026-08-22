import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '../context/ThemeContext';
import {BRAND_GRADIENT, BRAND_GRADIENT_DARK, gradientCss} from '../theme/colors';
import {Icon} from '../components/Icon';
import {PressableScale} from '../components/PressableScale';
import {useDialog} from '../components/AppDialog';
import {analyticsApi, AnalyticsOverview, AnalyticsPeriod} from '../services/api';

const PERIODS: {key: AnalyticsPeriod; label: string}[] = [
  {key: 'daily', label: 'Today'},
  {key: 'weekly', label: 'This Week'},
  {key: 'monthly', label: 'This Month'},
  {key: 'yearly', label: 'This Year'},
  {key: 'all', label: 'All-time'},
];

// Shared by both the valet and admin tabs — the data isn't role-scoped (see
// backend analytics.service.js: it's the whole operation's all-time
// picture), so a valet reads it as "how is my shift going" and admin reads
// the identical screen as "how is the operation going". One screen, two
// doors in — mirrors mobile's screens/AnalyticsScreen.tsx exactly.

const MEDALS = ['#F5C168', '#C7CDD6', '#D3946B']; // gold / silver / bronze

function hourLabel(h: number | null): string {
  if (h == null) return '—';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

function minutesLabel(m: number | null): string {
  if (m == null) return '—';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'Updated just now';
  if (secs < 3600) return `Updated ${Math.floor(secs / 60)}m ago`;
  return `Updated ${Math.floor(secs / 3600)}h ago`;
}

// Tunable heuristics, not contractual SLAs — just enough to turn a raw
// minutes figure into an at-a-glance "is this good" signal.
function parkRating(m: number | null): {label: string; tone: 'good' | 'ok' | 'bad'} | null {
  if (m == null) return null;
  if (m <= 5) return {label: 'Excellent', tone: 'good'};
  if (m <= 9) return {label: 'Good', tone: 'ok'};
  return {label: 'Needs attention', tone: 'bad'};
}
function retrieveRating(m: number | null): {label: string; tone: 'good' | 'ok' | 'bad'} | null {
  if (m == null) return null;
  if (m <= 3) return {label: 'Excellent', tone: 'good'};
  if (m <= 6) return {label: 'Good', tone: 'ok'};
  return {label: 'Needs attention', tone: 'bad'};
}

const PERIOD_TITLES: Record<AnalyticsPeriod, string> = {
  daily: 'Today', weekly: 'This Week', monthly: 'This Month', yearly: 'This Year', all: 'All-Time',
};

function buildShareText(data: AnalyticsOverview): string {
  const visitorTotal = data.visitorJobs + data.staffJobs;
  const visitorPct = visitorTotal > 0 ? Math.round((data.visitorJobs / visitorTotal) * 100) : 0;
  const lines = [
    `📊 KIMS Parking — ${PERIOD_TITLES[data.period]} Analytics`,
    ``,
    `🚗 ${data.totalCarsParked} parked · ${data.totalCarsRetrieved} retrieved · ${data.totalJobsCompleted} total jobs`,
    `⏱ Avg park ${minutesLabel(data.avgParkMinutes)} · Avg retrieve ${minutesLabel(data.avgRetrieveMinutes)}`,
    `🕐 Busiest hour ${hourLabel(data.busiestHour)}`,
    `👥 ${visitorPct}% visitor · ${100 - visitorPct}% staff`,
    ``,
    `🏆 Top Performers`,
    ...data.drivers.filter(d => d.totalCompleted > 0).slice(0, 5).map((d, i) =>
      `${i + 1}. ${d.name} — ${d.totalCompleted} jobs (${d.parksCompleted} parked, ${d.retrievesCompleted} retrieved)`),
  ];
  return lines.join('\n');
}

function toneColor(tone: 'good' | 'ok' | 'bad', colors: any) {
  return tone === 'good' ? colors.success : tone === 'ok' ? colors.warning : colors.error;
}

export function AnalyticsScreen() {
  const {colors, isDark} = useTheme();
  const dialog = useDialog();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [expandedDriverId, setExpandedDriverId] = useState<number | null>(null);
  const [idleExpanded, setIdleExpanded] = useState(false);
  const [period, setPeriod] = useState<AnalyticsPeriod>('all');

  const load = useCallback((p: AnalyticsPeriod, silent?: boolean) => {
    if (!silent) setLoading(true);
    analyticsApi.overview(p)
      .then(d => { setData(d); setErr(null); })
      .catch(() => setErr('Could not load analytics'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  // Switching periods re-fetches fresh (not silent — the old period's
  // numbers would otherwise sit on screen, wrong, while the new ones load).
  useEffect(() => { load(period); }, [period, load]);

  const visitorTotal = (data?.visitorJobs ?? 0) + (data?.staffJobs ?? 0);
  const visitorPct = visitorTotal > 0 ? Math.round(((data?.visitorJobs ?? 0) / visitorTotal) * 100) : 0;
  const activeDrivers = (data?.drivers ?? []).filter(d => d.totalCompleted > 0);
  const idleDrivers = (data?.drivers ?? []).filter(d => d.totalCompleted === 0);
  const pRating = parkRating(data?.avgParkMinutes ?? null);
  const rRating = retrieveRating(data?.avgRetrieveMinutes ?? null);

  const fastestParkId = useMemo(() => {
    const withAvg = activeDrivers.filter(d => d.avgParkMinutes != null);
    if (!withAvg.length) return null;
    return withAvg.reduce((best, d) => d.avgParkMinutes! < best.avgParkMinutes! ? d : best).id;
  }, [activeDrivers]);
  const fastestRetrieveId = useMemo(() => {
    const withAvg = activeDrivers.filter(d => d.avgRetrieveMinutes != null);
    if (!withAvg.length) return null;
    return withAvg.reduce((best, d) => d.avgRetrieveMinutes! < best.avgRetrieveMinutes! ? d : best).id;
  }, [activeDrivers]);

  const hourly = data?.hourlyDistribution ?? new Array(24).fill(0);
  const maxHourly = Math.max(1, ...hourly);
  const activeHour = selectedHour ?? data?.busiestHour ?? null;
  const activeHourCount = activeHour != null ? hourly[activeHour] : 0;

  const [sharing, setSharing] = useState(false);
  const onShare = async () => {
    if (!data || sharing) return;
    setSharing(true);
    try {
      const text = buildShareText(data);
      const nav = navigator as any;
      if (nav.share) {
        try { await nav.share({title: 'KIMS Parking Analytics', text}); } catch { /* user cancelled */ }
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        dialog.alert('Report copied to clipboard', {tone: 'success'});
      } catch {
        dialog.alert(text);
      }
    } finally {
      setSharing(false);
    }
  };

  const cardStyle: React.CSSProperties = {backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16};
  const emptyBoxStyle: React.CSSProperties = {
    borderRadius: 16, border: `1px dashed ${colors.border}`, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '32px 20px', textAlign: 'center',
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background}}>
      <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), padding: '16px 20px 18px', borderBottomLeftRadius: 28, borderBottomRightRadius: 28}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4}}>
              <Icon name="sparkle" size={12} color="rgba(255,255,255,0.75)" />
              <span style={{color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 800, letterSpacing: 1.2}}>{PERIODS.find(p => p.key === period)?.label.toUpperCase()} · LIVE</span>
            </div>
            <div style={{color: '#fff', fontSize: 24, fontWeight: 900}}>Analytics</div>
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <PressableScale
              disabled={sharing}
              style={{width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sharing ? 0.6 : 1}}
              onClick={onShare}>
              {sharing ? <span className="spinner" style={{width: 16, height: 16, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} /> : <Icon name="share" size={17} color="#fff" />}
            </PressableScale>
            <PressableScale
              disabled={refreshing}
              style={{width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: refreshing ? 0.6 : 1}}
              onClick={() => { setRefreshing(true); load(period, true); }}>
              <Icon name="refresh" size={18} color="#fff" />
            </PressableScale>
          </div>
        </div>

        <div style={{display: 'flex', alignItems: 'center', position: 'relative'}}>
          {[
            ['key', data?.totalCarsParked ?? (loading ? '–' : 0), 'Parked'],
            ['route', data?.totalCarsRetrieved ?? (loading ? '–' : 0), 'Retrieved'],
            ['flag', data?.totalJobsCompleted ?? (loading ? '–' : 0), 'Total Jobs'],
          ].map(([icon, num, lbl], i) => (
            <React.Fragment key={lbl as string}>
              {i > 0 && <div style={{width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)'}} />}
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
                <Icon name={icon as any} size={13} color="rgba(255,255,255,0.55)" />
                <span style={{color: '#fff', fontSize: 28, fontWeight: 900, fontVariantNumeric: 'tabular-nums'}}>{num}</span>
                <span style={{color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700}}>{lbl}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {data && <div style={{color: 'rgba(255,255,255,0.5)', fontSize: 10.5, fontWeight: 600, textAlign: 'center', marginTop: 14, position: 'relative'}}>{relativeTime(data.generatedAt)}</div>}
      </div>

      {/* Period selector — switches the whole overview (stats, hourly
          histogram, leaderboard) to a real, database-scoped answer for that
          window, not an all-time number relabeled. */}
      <div className="hscroll" style={{gap: 8, padding: '14px 20px 4px'}}>
        {PERIODS.map(p => {
          const on = p.key === period;
          return (
            <PressableScale key={p.key} disabled={loading} onClick={() => setPeriod(p.key)}
              style={{flexShrink: 0, padding: '8px 14px', borderRadius: 999, backgroundColor: on ? colors.primary : colors.surface, border: `1px solid ${on ? colors.primary : colors.border}`, opacity: loading ? 0.6 : 1}}>
              <span style={{fontSize: 12.5, fontWeight: 800, color: on ? colors.textOnPrimary : colors.textSecondary}}>{p.label}</span>
            </PressableScale>
          );
        })}
      </div>

      {loading && !data ? (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 30px'}}>
          <div className="spinner" style={{width: 28, height: 28, borderColor: colors.primary}} />
        </div>
      ) : err && !data ? (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 30px'}}>
          <Icon name="alert" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
          <span style={{color: colors.textMuted, marginBottom: 12}}>{err}</span>
          <PressableScale disabled={loading} onClick={() => load(period)} style={{padding: '10px 20px', borderRadius: 12, backgroundColor: colors.primary, opacity: loading ? 0.6 : 1}}>
            {loading
              ? <span className="spinner" style={{width: 14, height: 14, borderColor: 'rgba(0,0,0,0.2)', borderTopColor: colors.background}} />
              : <span style={{color: colors.background, fontWeight: 800}}>Retry</span>}
          </PressableScale>
        </div>
      ) : (
        <div style={{padding: '18px 20px 32px'}}>
          {/* Performance — rated, not just reported */}
          <div style={{display: 'flex', gap: 12, marginBottom: 14}}>
            {([
              ['carKey', colors.success, minutesLabel(data?.avgParkMinutes ?? null), 'Avg. park time', pRating],
              ['route', colors.info, minutesLabel(data?.avgRetrieveMinutes ?? null), 'Avg. retrieve time', rRating],
            ] as const).map(([icon, tint, val, lbl, rating], i) => (
              <div key={i} style={{...cardStyle, flex: 1, display: 'flex', overflow: 'hidden'}}>
                <div style={{width: 4, backgroundColor: rating ? toneColor(rating.tone, colors) : colors.border, flexShrink: 0}} />
                <div style={{flex: 1, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
                  <div style={{width: 32, height: 32, borderRadius: 10, backgroundColor: tint + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10}}>
                    <Icon name={icon} size={17} color={tint} />
                  </div>
                  <span style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>{val}</span>
                  <span style={{fontSize: 11, fontWeight: 700, marginTop: 2, color: colors.textMuted}}>{lbl}</span>
                  {rating && (
                    <span style={{marginTop: 8, padding: '3px 8px', borderRadius: 999, backgroundColor: toneColor(rating.tone, colors) + '18'}}>
                      <span style={{fontSize: 10, fontWeight: 800, color: toneColor(rating.tone, colors)}}>{rating.label}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Activity by hour — real 24h histogram, click any bar to inspect it */}
          <div style={{...cardStyle, padding: 14, marginBottom: 14}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <Icon name="trending" size={15} color={colors.primary} />
                <span style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>Activity by Hour</span>
              </div>
              {activeHour != null && (
                <span style={{fontSize: 11, fontWeight: 700, color: colors.textMuted}}>
                  {activeHourCount} job{activeHourCount === 1 ? '' : 's'} · {hourLabel(activeHour)}
                </span>
              )}
            </div>
            <div style={{display: 'flex', alignItems: 'flex-end', height: 58, marginBottom: 6, gap: 2}}>
              {hourly.map((count, h) => {
                const isPeak = h === data?.busiestHour;
                const isSelected = h === activeHour;
                const heightPx = 6 + (count / maxHourly) * 46;
                const barColor = isSelected ? '#F5C168' : count > 0 ? colors.primary : colors.border;
                return (
                  <button
                    key={h}
                    type="button"
                    className="pressable"
                    onClick={() => setSelectedHour(h === selectedHour ? null : h)}
                    style={{flex: 1, height: 58, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer'}}>
                    <div style={{width: '55%', minHeight: 4, borderRadius: 2, height: heightPx, backgroundColor: barColor, opacity: isPeak && !isSelected ? 1 : (isSelected ? 1 : 0.55)}} />
                  </button>
                );
              })}
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              {['12AM', '6AM', '12PM', '6PM', '11PM'].map(t => (
                <span key={t} style={{fontSize: 9.5, fontWeight: 700, color: colors.textMuted}}>{t}</span>
              ))}
            </div>
          </div>

          {/* Park vs Retrieve trend — bucketed at whatever resolution suits
              the selected period (hourly/daily/monthly, see backend
              trendBuckets). Absent for All-time, where a calendar trend
              can't usefully answer "when" over a multi-year span. */}
          {data?.trend && (
            <div style={{...cardStyle, padding: 14, marginBottom: 14}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                  <Icon name="carKey" size={15} color={colors.primary} />
                  <span style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>Park vs Retrieve</span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                  <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                    <span style={{width: 7, height: 7, borderRadius: 2, backgroundColor: colors.primary}} />
                    <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textMuted}}>Park</span>
                  </span>
                  <span style={{display: 'flex', alignItems: 'center', gap: 4}}>
                    <span style={{width: 7, height: 7, borderRadius: 2, backgroundColor: colors.info}} />
                    <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textMuted}}>Retrieve</span>
                  </span>
                </div>
              </div>
              {(() => {
                const {labels, park, retrieve} = data.trend;
                const maxVal = Math.max(1, ...park, ...retrieve);
                // Weekly/monthly buckets are few enough to label every bar;
                // hourly (24) and yearly-in-months (12) still fit, so the
                // only real crowding case would be a long month — thin those
                // labels out rather than let them overlap illegibly.
                const showEveryLabel = labels.length <= 14;
                return (
                  <>
                    <div style={{display: 'flex', alignItems: 'flex-end', height: 58, marginBottom: 6, gap: labels.length > 20 ? 1 : 2}}>
                      {labels.map((_, i) => (
                        <div key={i} style={{flex: 1, height: 58, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 1}}>
                          <div style={{width: '45%', minHeight: park[i] ? 3 : 0, borderRadius: 1, height: 4 + (park[i] / maxVal) * 50, backgroundColor: colors.primary}} />
                          <div style={{width: '45%', minHeight: retrieve[i] ? 3 : 0, borderRadius: 1, height: 4 + (retrieve[i] / maxVal) * 50, backgroundColor: colors.info}} />
                        </div>
                      ))}
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      {labels.map((l, i) => (showEveryLabel || i === 0 || i === labels.length - 1) ? (
                        <span key={i} style={{fontSize: 9.5, fontWeight: 700, color: colors.textMuted, flex: showEveryLabel ? 1 : undefined, textAlign: 'center'}}>{l}</span>
                      ) : <span key={i} style={{flex: 1}} />)}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Block utilization — which block actually got used this period,
              computed from completed park jobs (real slot ids), never
              invented. */}
          {!!data?.blockUtilization.length && (
            <div style={{...cardStyle, padding: 14, marginBottom: 14}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12}}>
                <Icon name="parking" size={15} color={colors.primary} />
                <span style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>Block Utilization</span>
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                {(() => {
                  const maxCount = Math.max(...data.blockUtilization.map(b => b.count));
                  return data.blockUtilization.map(b => (
                    <div key={b.block} style={{display: 'flex', alignItems: 'center', gap: 10}}>
                      <span style={{width: 56, fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>Block {b.block}</span>
                      <div style={{flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border}}>
                        <div style={{height: 8, borderRadius: 4, width: `${(b.count / maxCount) * 100}%`, backgroundColor: colors.primary}} />
                      </div>
                      <span style={{width: 28, fontSize: 12, fontWeight: 800, textAlign: 'right', color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>{b.count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Visitor vs staff */}
          <div style={{...cardStyle, padding: 14, marginBottom: 22}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primary + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <Icon name="people" size={16} color={colors.primary} />
              </div>
              <div style={{flex: 1}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                  <span style={{fontSize: 12, fontWeight: 700, color: colors.textMuted}}>Visitor vs staff jobs</span>
                  <span style={{fontSize: 12, fontWeight: 800, color: colors.textMuted}}>{visitorPct}% visitor</span>
                </div>
                <div style={{height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border}}>
                  <div style={{height: 6, borderRadius: 3, width: `${visitorPct}%`, backgroundColor: colors.primary}} />
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4}}>
                  <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textMuted}}>{data?.visitorJobs ?? 0} visitor</span>
                  <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textMuted}}>{data?.staffJobs ?? 0} staff</span>
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard — click a row to expand */}
          <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12}}>
            <Icon name="trophy" size={16} color="#F5C168" />
            <span style={{fontSize: 15, fontWeight: 900, color: colors.textPrimary}}>Top Performers</span>
          </div>

          {activeDrivers.length === 0 && idleDrivers.length === 0 ? (
            <div style={emptyBoxStyle}>
              <Icon name="trophy" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No drivers yet</span>
            </div>
          ) : activeDrivers.length === 0 ? (
            <div style={emptyBoxStyle}>
              <Icon name="trophy" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No completed jobs yet — the leaderboard fills in as drivers finish their first job.</span>
            </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              {activeDrivers.map((d, i) => {
                const medal = MEDALS[i] ?? null;
                const expanded = expandedDriverId === d.id;
                const parkShare = d.totalCompleted > 0 ? Math.round((d.parksCompleted / d.totalCompleted) * 100) : 0;
                const badges: string[] = [];
                if (d.id === fastestParkId) badges.push('Fastest park');
                if (d.id === fastestRetrieveId) badges.push('Fastest retrieve');
                return (
                  <PressableScale
                    key={d.id}
                    onClick={() => setExpandedDriverId(expanded ? null : d.id)}
                    style={{
                      ...cardStyle, borderColor: medal ?? colors.border, borderWidth: medal ? 1.5 : 1,
                      padding: 14, textAlign: 'left', display: 'block',
                      boxShadow: i === 0 && medal ? '0 3px 10px rgba(245,193,104,0.35)' : undefined,
                    }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                      <div style={{width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: medal ?? colors.border}}>
                        <span style={{fontSize: 13, fontWeight: 900, color: medal ? '#15161A' : colors.textMuted}}>{i + 1}</span>
                      </div>
                      <div style={{flex: 1, minWidth: 0}}>
                        <div style={{fontSize: 14.5, fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.name}</div>
                        <div style={{fontSize: 11.5, fontWeight: 600, marginTop: 2, color: colors.textMuted}}>
                          {d.parksCompleted} parked · {d.retrievesCompleted} retrieved
                        </div>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0}}>
                        <span style={{fontSize: 20, fontWeight: 900, color: colors.textPrimary}}>{d.totalCompleted}</span>
                        <span style={{fontSize: 10, fontWeight: 700, color: colors.textMuted}}>jobs</span>
                      </div>
                      <Icon name="chevronDown" size={16} color={colors.textMuted} style={{transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0}} />
                    </div>

                    {badges.length > 0 && (
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginLeft: 42}}>
                        {badges.map(b => (
                          <span key={b} style={{display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, backgroundColor: '#F5C16818'}}>
                            <Icon name="crown" size={11} color="#F5C168" />
                            <span style={{fontSize: 10, fontWeight: 800, color: '#B8860B'}}>{b}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {expanded && (
                      <div style={{marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.divider}`}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                          <span style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>Avg park time</span>
                          <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textPrimary}}>{minutesLabel(d.avgParkMinutes)}</span>
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                          <span style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>Avg retrieve time</span>
                          <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textPrimary}}>{minutesLabel(d.avgRetrieveMinutes)}</span>
                        </div>
                        <div style={{height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border, marginTop: 8}}>
                          <div style={{height: 6, borderRadius: 3, width: `${parkShare}%`, backgroundColor: colors.success}} />
                        </div>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4}}>
                          <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textMuted}}>{parkShare}% park jobs</span>
                          <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textMuted}}>{100 - parkShare}% retrieve jobs</span>
                        </div>
                      </div>
                    )}
                  </PressableScale>
                );
              })}

              {idleDrivers.length > 0 && (
                <PressableScale
                  onClick={() => setIdleExpanded(v => !v)}
                  style={{...cardStyle, padding: 12, textAlign: 'left', display: 'block'}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <span style={{fontSize: 12, fontWeight: 700, color: colors.textMuted, flex: 1}}>
                      {idleDrivers.length} driver{idleDrivers.length > 1 ? 's' : ''} with no completed jobs yet
                    </span>
                    <Icon name="chevronDown" size={15} color={colors.textMuted} style={{transform: idleExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s'}} />
                  </div>
                  {idleExpanded && (
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10}}>
                      {idleDrivers.map(d => (
                        <span key={d.id} style={{borderRadius: 999, border: `1px solid ${colors.border}`, padding: '5px 10px', backgroundColor: colors.background}}>
                          <span style={{fontSize: 11, fontWeight: 700, color: colors.textMuted}}>{d.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </PressableScale>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
