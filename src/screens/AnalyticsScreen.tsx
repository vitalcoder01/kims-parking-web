import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '../context/ThemeContext';
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

const MEDALS = ['#F59E0B', '#94A3B8', '#D97706']; // Champagne Gold / Frosted Silver / Warm Bronze

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

const PERIOD_TITLES: Record<AnalyticsPeriod, string> = {
  daily: 'Today',
  weekly: 'This Week',
  monthly: 'This Month',
  yearly: 'This Year',
  all: 'All-Time',
};

function buildShareText(data: AnalyticsOverview): string {
  const visitorTotal = data.visitorJobs + data.staffJobs;
  const visitorPct = visitorTotal > 0 ? Math.round((data.visitorJobs / visitorTotal) * 100) : 0;
  const lines = [
    `📊 KIMS Parking — ${PERIOD_TITLES[data.period]} Operational Analytics`,
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

// Generate smooth cubic Bézier spline through points for professional chart aesthetics
function buildSmoothSpline(points: {x: number; y: number}[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function AnalyticsScreen() {
  const {colors, isDark} = useTheme();
  const dialog = useDialog();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [trendIndex, setTrendIndex] = useState<number | null>(null);
  const [expandedDriverId, setExpandedDriverId] = useState<number | null>(null);
  const [idleExpanded, setIdleExpanded] = useState(false);
  const [period, setPeriod] = useState<AnalyticsPeriod>('all');
  const [sharing, setSharing] = useState(false);

  const load = useCallback((p: AnalyticsPeriod, silent?: boolean) => {
    if (!silent) setLoading(true);
    analyticsApi.overview(p)
      .then(d => { setData(d); setErr(null); })
      .catch(() => setErr('Could not load operational analytics'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    load(period);
    setTrendIndex(null);
    setSelectedHour(null);
  }, [period, load]);

  const visitorTotal = (data?.visitorJobs ?? 0) + (data?.staffJobs ?? 0);
  const visitorPct = visitorTotal > 0 ? Math.round(((data?.visitorJobs ?? 0) / visitorTotal) * 100) : 0;
  const staffPct = 100 - visitorPct;
  const activeDrivers = (data?.drivers ?? []).filter(d => d.totalCompleted > 0);
  const idleDrivers = (data?.drivers ?? []).filter(d => d.totalCompleted === 0);

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

  const hourly = useMemo(() => data?.hourlyDistribution ?? new Array(24).fill(0), [data]);
  const maxHourly = useMemo(() => Math.max(1, ...hourly), [hourly]);
  const activeHour = selectedHour ?? data?.busiestHour ?? null;
  const activeHourCount = activeHour != null ? hourly[activeHour] : 0;

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

  // Glass card styles
  const glassCardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 2px 10px rgba(0, 0, 0, 0.03)',
  };

  return (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.background, minHeight: 0}}>
      {/* 1. Restrained Glassy Workstation Header */}
      <div style={{
        padding: '14px 18px',
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: 12,
      }}>
        <div style={{minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontSize: 16, fontWeight: 900, color: colors.textPrimary, letterSpacing: -0.2}}>
              Operational Analytics
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 6,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
              color: colors.primary,
              letterSpacing: 0.4,
            }}>
              KIMS TELEMETRY
            </span>
          </div>
          <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, marginTop: 2}}>
            {PERIODS.find(p => p.key === period)?.label} Overview {data?.generatedAt ? `· ${relativeTime(data.generatedAt)}` : ''}
          </div>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0}}>
          {/* Share Report */}
          <PressableScale
            disabled={sharing || !data}
            onClick={onShare}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.cardAlt,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: sharing || !data ? 0.5 : 1,
            }}>
            {sharing ? (
              <span className="spinner" style={{width: 14, height: 14, borderColor: colors.border, borderTopColor: colors.primary}} />
            ) : (
              <Icon name="share" size={16} color={colors.textPrimary} />
            )}
          </PressableScale>

          {/* Refresh Action */}
          <PressableScale
            disabled={refreshing}
            onClick={() => { setRefreshing(true); load(period, true); }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.cardAlt,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: refreshing ? 0.5 : 1,
            }}>
            <Icon
              name="refresh"
              size={16}
              color={colors.textPrimary}
              style={{transform: refreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease'}}
            />
          </PressableScale>
        </div>
      </div>

      <div className="screen-scroll" style={{padding: 16, paddingBottom: 40}}>
        {/* 2. Horizontal Period Selector Pills */}
        <div className="hscroll" style={{gap: 8, paddingBottom: 16}}>
          {PERIODS.map(p => {
            const on = p.key === period;
            return (
              <PressableScale
                key={p.key}
                disabled={loading}
                onClick={() => setPeriod(p.key)}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  borderRadius: 20,
                  backgroundColor: on ? colors.primary : colors.surface,
                  border: `1px solid ${on ? colors.primary : colors.border}`,
                  transition: 'all 0.15s ease',
                  opacity: loading ? 0.6 : 1,
                }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: on ? colors.textOnPrimary : colors.textSecondary,
                  letterSpacing: 0.2,
                }}>
                  {p.label}
                </span>
              </PressableScale>
            );
          })}
        </div>

        {loading && !data ? (
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px'}}>
            <div className="spinner" style={{width: 32, height: 32, borderColor: colors.border, borderTopColor: colors.primary}} />
          </div>
        ) : err && !data ? (
          <div style={{
            ...glassCardStyle,
            padding: '40px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}>
            <Icon name="alert" size={32} color={colors.error} style={{marginBottom: 10}} />
            <div style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary, marginBottom: 4}}>{err}</div>
            <div style={{fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: 16}}>
              Failed to fetch operational metrics from backend.
            </div>
            <PressableScale
              disabled={loading}
              onClick={() => load(period)}
              style={{
                padding: '9px 20px',
                borderRadius: 10,
                backgroundColor: colors.primary,
                color: colors.textOnPrimary,
                fontWeight: 800,
                fontSize: 12.5,
              }}>
              Retry Connection
            </PressableScale>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            {/* 3. Executive KPI Metric Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {/* Parked Card */}
              <div style={{...glassCardStyle, padding: 14, position: 'relative', overflow: 'hidden'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                  <span style={{fontSize: 11.5, fontWeight: 700, color: colors.textSecondary}}>Cars Parked</span>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon name="key" size={13} color={colors.primary} />
                  </div>
                </div>
                <div style={{fontSize: 26, fontWeight: 900, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5}}>
                  {data?.totalCarsParked ?? 0}
                </div>
                <div style={{fontSize: 11, fontWeight: 600, color: colors.textMuted, marginTop: 4}}>
                  Avg. {minutesLabel(data?.avgParkMinutes ?? null)}
                </div>
              </div>

              {/* Retrieved Card */}
              <div style={{...glassCardStyle, padding: 14, position: 'relative', overflow: 'hidden'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                  <span style={{fontSize: 11.5, fontWeight: 700, color: colors.textSecondary}}>Cars Retrieved</span>
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    backgroundColor: isDark ? 'rgba(6, 182, 212, 0.15)' : '#ECFEFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon name="route" size={13} color="#06B6D4" />
                  </div>
                </div>
                <div style={{fontSize: 26, fontWeight: 900, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5}}>
                  {data?.totalCarsRetrieved ?? 0}
                </div>
                <div style={{fontSize: 11, fontWeight: 600, color: colors.textMuted, marginTop: 4}}>
                  Avg. {minutesLabel(data?.avgRetrieveMinutes ?? null)}
                </div>
              </div>

              {/* Total Operations Throughput */}
              <div style={{...glassCardStyle, padding: 14, gridColumn: 'span 2'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                  <div>
                    <div style={{fontSize: 11.5, fontWeight: 700, color: colors.textSecondary}}>
                      Total Completed Trips
                    </div>
                    <div style={{fontSize: 24, fontWeight: 900, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums', marginTop: 2}}>
                      {data?.totalJobsCompleted ?? 0} <span style={{fontSize: 13, fontWeight: 700, color: colors.textMuted}}>operations</span>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 12,
                    backgroundColor: colors.cardAlt,
                    border: `1px solid ${colors.border}`,
                  }}>
                    <Icon name="flag" size={14} color={colors.success} />
                    <span style={{fontSize: 11.5, fontWeight: 800, color: colors.textPrimary}}>
                      Busiest: {hourLabel(data?.busiestHour ?? null)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. VISUALIZATION: 24-Hour Surge Intensity Histogram */}
            <div style={{...glassCardStyle, padding: 16}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                  <Icon name="analytics" size={15} color={colors.primary} />
                  <span style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>
                    24-Hour Activity Surge
                  </span>
                </div>
                {activeHour != null && (
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 6,
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                    color: colors.primary,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {activeHourCount} {activeHourCount === 1 ? 'vehicle' : 'vehicles'} at {hourLabel(activeHour)}
                  </span>
                )}
              </div>

              {/* Interactive SVG Histogram */}
              <div style={{position: 'relative', width: '100%', height: 110, touchAction: 'none'}}>
                <svg
                  width="100%"
                  height="90"
                  viewBox="0 0 600 90"
                  preserveAspectRatio="none"
                  style={{display: 'block', overflow: 'visible', cursor: 'pointer'}}>
                  <defs>
                    <linearGradient id="barGradDefault" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.primary} stopOpacity="0.9" />
                      <stop offset="100%" stopColor={colors.primary} stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="barGradPeak" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="1" />
                      <stop offset="100%" stopColor="#D97706" stopOpacity="0.6" />
                    </linearGradient>
                  </defs>

                  {/* Hairline baseline */}
                  <line x1="0" y1="84" x2="600" y2="84" stroke={colors.border} strokeWidth="1" />

                  {/* 24 Hourly Bars */}
                  {hourly.map((count, h) => {
                    const isPeak = h === data?.busiestHour && count > 0;
                    const isSelected = h === activeHour;
                    const barWidth = 16;
                    const x = (h / 23) * (600 - barWidth);
                    const barHeight = count > 0 ? 8 + (count / maxHourly) * 70 : 3;
                    const y = 84 - barHeight;

                    return (
                      <g key={h} onClick={() => setSelectedHour(h === selectedHour ? null : h)}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx={3}
                          ry={3}
                          fill={isPeak ? 'url(#barGradPeak)' : (isSelected ? colors.primary : 'url(#barGradDefault)')}
                          opacity={isSelected || isPeak ? 1 : 0.65}
                          style={{transition: 'all 0.2s ease'}}
                        />
                        {isPeak && (
                          <circle cx={x + barWidth / 2} cy={y - 5} r={3} fill="#F59E0B" />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* X-Axis Ticks */}
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4}}>
                  {['12 AM', '4 AM', '8 AM', '12 PM', '4 PM', '8 PM', '11 PM'].map(t => (
                    <span key={t} style={{fontSize: 9.5, fontWeight: 700, color: colors.textMuted}}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. VISUALIZATION: Dual-Stream Park vs. Retrieve Spline Area Chart */}
            {data?.trend && (
              <div style={{...glassCardStyle, padding: 16}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                    <Icon name="carKey" size={15} color={colors.primary} />
                    <span style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>
                      Park vs. Retrieve Streams
                    </span>
                  </div>

                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
                      <span style={{width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary}} />
                      <span style={{fontSize: 11, fontWeight: 700, color: colors.textSecondary}}>Park</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
                      <span style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#06B6D4'}} />
                      <span style={{fontSize: 11, fontWeight: 700, color: colors.textSecondary}}>Retrieve</span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const {labels, park, retrieve} = data.trend;
                  const n = labels.length;
                  const maxVal = Math.max(1, ...park, ...retrieve);
                  const isHourly = n === 24;
                  const selected = trendIndex != null && trendIndex < n ? trendIndex : null;

                  // Project points onto SVG coordinate space
                  const padX = 14;
                  const padY = 16;
                  const svgW = 580;
                  const svgH = 120;
                  const graphW = svgW - padX * 2;
                  const graphH = svgH - padY * 2;

                  const parkPoints = park.map((val, i) => ({
                    x: padX + (i / Math.max(1, n - 1)) * graphW,
                    y: padY + graphH - (val / maxVal) * graphH,
                  }));

                  const retrievePoints = retrieve.map((val, i) => ({
                    x: padX + (i / Math.max(1, n - 1)) * graphW,
                    y: padY + graphH - (val / maxVal) * graphH,
                  }));

                  const parkSpline = buildSmoothSpline(parkPoints);
                  const retrieveSpline = buildSmoothSpline(retrievePoints);

                  const parkArea = `${parkSpline} L ${parkPoints[parkPoints.length - 1].x} ${padY + graphH} L ${parkPoints[0].x} ${padY + graphH} Z`;
                  const retrieveArea = `${retrieveSpline} L ${retrievePoints[retrievePoints.length - 1].x} ${padY + graphH} L ${retrievePoints[0].x} ${padY + graphH} Z`;

                  const activeIdx = selected ?? (maxVal > 0 ? [...park.keys()].reduce((best, i) => (park[i] + retrieve[i]) > (park[best] + retrieve[best]) ? i : best) : 0);
                  const activePark = park[activeIdx] ?? 0;
                  const activeRetrieve = retrieve[activeIdx] ?? 0;
                  const activeLabel = isHourly ? hourLabel(activeIdx) : labels[activeIdx];

                  return (
                    <div>
                      {/* Active Telemetry Tooltip Pill */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        borderRadius: 10,
                        backgroundColor: colors.cardAlt,
                        border: `1px solid ${colors.border}`,
                        marginBottom: 10,
                      }}>
                        <span style={{fontSize: 12, fontWeight: 800, color: colors.textPrimary}}>
                          {activeLabel}
                        </span>
                        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                          <span style={{fontSize: 11.5, fontWeight: 800, color: colors.primary, fontVariantNumeric: 'tabular-nums'}}>
                            {activePark} Parked
                          </span>
                          <span style={{fontSize: 11.5, fontWeight: 800, color: '#06B6D4', fontVariantNumeric: 'tabular-nums'}}>
                            {activeRetrieve} Retrieved
                          </span>
                        </div>
                      </div>

                      {/* SVG Canvas */}
                      <div style={{position: 'relative', width: '100%', height: 120, touchAction: 'none'}}>
                        <svg
                          width="100%"
                          height="120"
                          viewBox={`0 0 ${svgW} ${svgH}`}
                          preserveAspectRatio="none"
                          style={{display: 'block', overflow: 'visible', cursor: 'crosshair'}}
                          onClick={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = (e.clientX - rect.left) / rect.width;
                            const idx = Math.max(0, Math.min(n - 1, Math.round(relX * (n - 1))));
                            setTrendIndex(idx === trendIndex ? null : idx);
                          }}>
                          <defs>
                            <linearGradient id="parkFillGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.32" />
                              <stop offset="100%" stopColor={colors.primary} stopOpacity="0.0" />
                            </linearGradient>
                            <linearGradient id="retrieveFillGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid lines */}
                          <line x1={padX} y1={padY + graphH} x2={padX + graphW} y2={padY + graphH} stroke={colors.border} strokeWidth="1" />
                          <line x1={padX} y1={padY + graphH / 2} x2={padX + graphW} y2={padY + graphH / 2} stroke={colors.border} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />

                          {/* Area fills */}
                          <path d={parkArea} fill="url(#parkFillGrad)" />
                          <path d={retrieveArea} fill="url(#retrieveFillGrad)" />

                          {/* Spline strokes */}
                          <path d={parkSpline} fill="none" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round" />
                          <path d={retrieveSpline} fill="none" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" />

                          {/* Interactive Scrubber Line */}
                          {parkPoints[activeIdx] && (
                            <g>
                              <line
                                x1={parkPoints[activeIdx].x}
                                y1={padY}
                                x2={parkPoints[activeIdx].x}
                                y2={padY + graphH}
                                stroke={colors.textSecondary}
                                strokeWidth="1.5"
                                strokeDasharray="2 2"
                              />
                              <circle cx={parkPoints[activeIdx].x} cy={parkPoints[activeIdx].y} r="4.5" fill={colors.surface} stroke={colors.primary} strokeWidth="2.5" />
                              <circle cx={retrievePoints[activeIdx].x} cy={retrievePoints[activeIdx].y} r="4.5" fill={colors.surface} stroke="#06B6D4" strokeWidth="2.5" />
                            </g>
                          )}
                        </svg>

                        {/* X-axis labels */}
                        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4}}>
                          {labels.filter((_, i) => i === 0 || i === Math.floor(n / 2) || i === n - 1).map((lbl, idx) => (
                            <span key={idx} style={{fontSize: 9.5, fontWeight: 700, color: colors.textMuted}}>
                              {isHourly ? (idx === 0 ? '12 AM' : idx === 1 ? '12 PM' : '11 PM') : lbl}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 6. VISUALIZATION: Spatial Block Capacity & Utilization Matrix */}
            {!!data?.blockUtilization.length && (
              <div style={{...glassCardStyle, padding: 16}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                    <Icon name="parking" size={15} color={colors.primary} />
                    <span style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>
                      Parking Block Utilization
                    </span>
                  </div>
                  <span style={{fontSize: 11, fontWeight: 600, color: colors.textMuted}}>
                    Physical Lot Occupancy
                  </span>
                </div>

                {(() => {
                  const maxCount = Math.max(1, ...data.blockUtilization.map(b => b.count));
                  const totalVolume = data.blockUtilization.reduce((sum, b) => sum + b.count, 0);

                  return (
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10}}>
                      {data.blockUtilization.map(b => {
                        const pct = Math.round((b.count / Math.max(1, totalVolume)) * 100);
                        const loadRatio = b.count / maxCount;
                        const blockColor = loadRatio > 0.8 ? '#F59E0B' : (loadRatio > 0.4 ? colors.primary : colors.success);

                        return (
                          <div
                            key={b.block}
                            style={{
                              padding: 12,
                              borderRadius: 14,
                              backgroundColor: colors.cardAlt,
                              border: `1px solid ${colors.border}`,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                              <span style={{fontSize: 12, fontWeight: 900, color: colors.textPrimary}}>
                                BLOCK {b.block}
                              </span>
                              <span style={{fontSize: 11, fontWeight: 800, color: blockColor, fontVariantNumeric: 'tabular-nums'}}>
                                {b.count} cars
                              </span>
                            </div>

                            {/* Precision horizontal progress meter */}
                            <div style={{height: 7, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden'}}>
                              <div style={{
                                height: '100%',
                                width: `${(b.count / maxCount) * 100}%`,
                                backgroundColor: blockColor,
                                borderRadius: 4,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>

                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                              <span style={{fontSize: 10, fontWeight: 700, color: colors.textMuted}}>
                                Campus Share
                              </span>
                              <span style={{fontSize: 10, fontWeight: 800, color: colors.textSecondary}}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 7. VISUALIZATION: Visitor vs. Staff Circular Arc / Donut Meter */}
            <div style={{...glassCardStyle, padding: 16}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12}}>
                <Icon name="people" size={15} color={colors.primary} />
                <span style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>
                  Visitor vs. Staff Ratio
                </span>
              </div>

              <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
                {/* SVG Donut Ring */}
                <div style={{position: 'relative', width: 90, height: 90, flexShrink: 0}}>
                  <svg width="90" height="90" viewBox="0 0 90 90" style={{transform: 'rotate(-90deg)'}}>
                    <circle
                      cx="45"
                      cy="45"
                      r="36"
                      fill="none"
                      stroke={colors.border}
                      strokeWidth="9"
                    />
                    {/* Visitor Arc */}
                    <circle
                      cx="45"
                      cy="45"
                      r="36"
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth="9"
                      strokeDasharray={`${(visitorPct / 100) * 226.2} 226.2`}
                      strokeLinecap="round"
                      style={{transition: 'stroke-dasharray 0.5s ease'}}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 90,
                    height: 90,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{fontSize: 16, fontWeight: 900, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>
                      {visitorPct}%
                    </span>
                    <span style={{fontSize: 8.5, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.2}}>
                      VISITORS
                    </span>
                  </div>
                </div>

                {/* Legend & Count Breakdown */}
                <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 10}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                      <span style={{width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary}} />
                      <span style={{fontSize: 12, fontWeight: 700, color: colors.textPrimary}}>Visitor Vehicles</span>
                    </div>
                    <span style={{fontSize: 13, fontWeight: 900, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>
                      {data?.visitorJobs ?? 0}
                    </span>
                  </div>

                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                      <span style={{width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border}} />
                      <span style={{fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>Hospital Staff</span>
                    </div>
                    <span style={{fontSize: 13, fontWeight: 900, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>
                      {data?.staffJobs ?? 0}
                    </span>
                  </div>

                  <div style={{fontSize: 11, fontWeight: 600, color: colors.textMuted, marginTop: 2}}>
                    {visitorPct >= 50 ? 'Curbside visitor turnover dominates demand.' : 'Staff parking allocation dominates demand.'}
                  </div>
                </div>
              </div>
            </div>

            {/* 8. Fleet Performance Leaderboard & Speed Matrix */}
            <div>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                  <Icon name="trophy" size={15} color="#F59E0B" />
                  <span style={{fontSize: 14, fontWeight: 900, color: colors.textPrimary}}>
                    Fleet Runner Leaderboard
                  </span>
                </div>
                <span style={{fontSize: 11, fontWeight: 600, color: colors.textMuted}}>
                  Tap runner to inspect
                </span>
              </div>

              {activeDrivers.length === 0 && idleDrivers.length === 0 ? (
                <div style={{...glassCardStyle, padding: '36px 20px', textAlign: 'center'}}>
                  <Icon name="trophy" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
                  <div style={{fontSize: 13, fontWeight: 700, color: colors.textMuted}}>No drivers registered in roster</div>
                </div>
              ) : activeDrivers.length === 0 ? (
                <div style={{...glassCardStyle, padding: '36px 20px', textAlign: 'center'}}>
                  <Icon name="trophy" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
                  <div style={{fontSize: 13, fontWeight: 700, color: colors.textMuted}}>
                    No completed jobs yet for {PERIOD_TITLES[period]}. Roster updates as runners complete tasks.
                  </div>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                  {activeDrivers.map((d, i) => {
                    const medal = MEDALS[i] ?? null;
                    const expanded = expandedDriverId === d.id;
                    const parkShare = d.totalCompleted > 0 ? Math.round((d.parksCompleted / d.totalCompleted) * 100) : 0;
                    const badges: string[] = [];
                    if (d.id === fastestParkId) badges.push('Fastest Park');
                    if (d.id === fastestRetrieveId) badges.push('Fastest Retrieve');

                    return (
                      <PressableScale
                        key={d.id}
                        onClick={() => setExpandedDriverId(expanded ? null : d.id)}
                        style={{
                          ...glassCardStyle,
                          borderColor: medal ?? colors.border,
                          borderWidth: medal ? 1.5 : 1,
                          padding: 12,
                          textAlign: 'left',
                          display: 'block',
                          cursor: 'pointer',
                        }}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                          {/* Rank Badge */}
                          <div style={{
                            width: 30,
                            height: 30,
                            borderRadius: 15,
                            backgroundColor: medal ?? colors.cardAlt,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <span style={{fontSize: 13, fontWeight: 900, color: medal ? '#1E293B' : colors.textSecondary}}>
                              {i + 1}
                            </span>
                          </div>

                          {/* Runner Info */}
                          <div style={{flex: 1, minWidth: 0}}>
                            <div style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                              {d.name}
                            </div>
                            <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, marginTop: 2}}>
                              {d.parksCompleted} parked · {d.retrievesCompleted} retrieved
                            </div>
                          </div>

                          {/* Total Completed Metric */}
                          <div style={{textAlign: 'right', flexShrink: 0}}>
                            <span style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>
                              {d.totalCompleted}
                            </span>
                            <div style={{fontSize: 10, fontWeight: 700, color: colors.textMuted}}>
                              JOBS
                            </div>
                          </div>

                          <Icon
                            name="chevronDown"
                            size={16}
                            color={colors.textMuted}
                            style={{transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0}}
                          />
                        </div>

                        {/* Speed Badges */}
                        {badges.length > 0 && (
                          <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 42}}>
                            {badges.map(b => (
                              <span
                                key={b}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
                                }}>
                                <Icon name="crown" size={11} color="#F59E0B" />
                                <span style={{fontSize: 10, fontWeight: 800, color: isDark ? '#F59E0B' : '#B45309'}}>{b}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Expandable Telemetry Drawer */}
                        {expanded && (
                          <div style={{marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.border}`}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 6}}>
                              <span style={{fontSize: 12, fontWeight: 600, color: colors.textSecondary}}>Avg Park Duration</span>
                              <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textPrimary}}>
                                {minutesLabel(d.avgParkMinutes)}
                              </span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                              <span style={{fontSize: 12, fontWeight: 600, color: colors.textSecondary}}>Avg Retrieve Duration</span>
                              <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textPrimary}}>
                                {minutesLabel(d.avgRetrieveMinutes)}
                              </span>
                            </div>

                            {/* Park vs Retrieve split bar */}
                            <div style={{height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border}}>
                              <div style={{height: '100%', width: `${parkShare}%`, backgroundColor: colors.primary}} />
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4}}>
                              <span style={{fontSize: 10, fontWeight: 700, color: colors.textMuted}}>{parkShare}% park</span>
                              <span style={{fontSize: 10, fontWeight: 700, color: colors.textMuted}}>{100 - parkShare}% retrieve</span>
                            </div>
                          </div>
                        )}
                      </PressableScale>
                    );
                  })}

                  {/* Idle Runners Strip */}
                  {idleDrivers.length > 0 && (
                    <PressableScale
                      onClick={() => setIdleExpanded(v => !v)}
                      style={{...glassCardStyle, padding: 12, textAlign: 'left', display: 'block', cursor: 'pointer'}}>
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                        <span style={{fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>
                          {idleDrivers.length} driver{idleDrivers.length > 1 ? 's' : ''} on shift with no jobs completed yet
                        </span>
                        <Icon
                          name="chevronDown"
                          size={15}
                          color={colors.textMuted}
                          style={{transform: idleExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s'}}
                        />
                      </div>
                      {idleExpanded && (
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10}}>
                          {idleDrivers.map(d => (
                            <span
                              key={d.id}
                              style={{
                                borderRadius: 8,
                                border: `1px solid ${colors.border}`,
                                padding: '4px 9px',
                                backgroundColor: colors.cardAlt,
                                fontSize: 11,
                                fontWeight: 700,
                                color: colors.textSecondary,
                              }}>
                              {d.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </PressableScale>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
