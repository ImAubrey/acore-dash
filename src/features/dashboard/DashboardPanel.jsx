import { TrafficTempoCard } from './TrafficTempoCard';
import { SessionHealthCard } from './SessionHealthCard';
import { DnsCacheCard } from './DnsCacheCard';
import { TopDestinationsCard } from './TopDestinationsCard';
import { OutboundMixCard } from './OutboundMixCard';
import { ProtocolSplitCard } from './ProtocolSplitCard';
import { PanelHeader } from '../common/panelPrimitives';

export function DashboardPanel({
  page,
  connStreamLabel,
  toggleConnStream,
  connStreamPaused,
  formatRate,
  formatBytes,
  latestSpeed,
  averageSpeed,
  utilization,
  throughputSpark,
  totalSessions,
  totalConnections,
  sessionRatio,
  sessionsSpark,
  uniqueDestinations,
  outbounds,
  destinationRatio,
  trafficSeries,
  trafficChart,
  TRAFFIC_CLIP_ID,
  trafficShiftActive,
  trafficShift,
  TRAFFIC_ANIMATION_MS,
  latestSample,
  visibleSamples,
  gaugeDegrees,
  dnsCacheStats,
  dnsUpdatedLabel,
  triggerDnsCacheFlushFromDashboard,
  dnsCacheFlushBusy,
  dnsCacheStatus,
  dnsUsageRatio,
  dnsUsagePercent,
  dnsValidPercent,
  dnsValidRatio,
  dnsExpiredPercent,
  dnsExpiredRatio,
  dnsQueryTypes,
  dnsQueryType,
  setDnsQueryType,
  dnsQueryDomain,
  setDnsQueryDomain,
  dnsQueryBusy,
  dnsQueryStatus,
  dnsQueryResult,
  runDnsQuery,
  topSources,
  onTopSourceClick,
  outboundMix,
  buildConicGradient,
  CHART_COLORS,
  outboundTotal,
  protocolTotal,
  protocolMix,
  clamp
}) {
  if (page !== 'dashboard') return null;

  return (
    <div className="dashboard-grid">
      <section className="panel span-12" style={{ '--delay': '0.05s' }}>
        <PanelHeader
          title="Operations snapshot"
          description="Instant readouts from live sessions and outbound topology."
          actions={(
            <button
              className={`pill live-pill-fixed ${connStreamLabel}`}
              onClick={toggleConnStream}
              title={connStreamPaused ? 'Resume live updates' : 'Pause live updates'}
            >
              {connStreamLabel}
            </button>
          )}
        />
        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-label">Current throughput</span>
            <strong className="metric-value">{formatRate(latestSpeed)}</strong>
            <span className="metric-meta">Avg {formatRate(averageSpeed)}</span>
            <div className="meter">
              <span style={{ transform: `scaleX(${utilization})` }} />
            </div>
            <svg className="sparkline accent" viewBox="0 0 140 40" aria-hidden="true">
              <path d={throughputSpark} />
            </svg>
          </div>
          <div className="metric-card">
            <span className="metric-label">Active sessions</span>
            <strong className="metric-value">{totalSessions}</strong>
            <span className="metric-meta">{totalConnections} active connections</span>
            <div className="meter">
              <span style={{ transform: `scaleX(${sessionRatio})` }} />
            </div>
            <svg className="sparkline teal" viewBox="0 0 140 40" aria-hidden="true">
              <path d={sessionsSpark} />
            </svg>
          </div>
          <div className="metric-card">
            <span className="metric-label">Unique destinations</span>
            <strong className="metric-value">{uniqueDestinations}</strong>
            <span className="metric-meta">{outbounds.length} outbounds online</span>
            <div className="meter">
              <span style={{ transform: `scaleX(${destinationRatio})` }} />
            </div>
          </div>
        </div>
      </section>

      <TrafficTempoCard
        formatRate={formatRate}
        latestSpeed={latestSpeed}
        averageSpeed={averageSpeed}
        trafficSeries={trafficSeries}
        trafficChart={trafficChart}
        TRAFFIC_CLIP_ID={TRAFFIC_CLIP_ID}
        trafficShiftActive={trafficShiftActive}
        trafficShift={trafficShift}
        TRAFFIC_ANIMATION_MS={TRAFFIC_ANIMATION_MS}
        latestSample={latestSample}
        visibleSamples={visibleSamples}
      />

      <SessionHealthCard
        gaugeDegrees={gaugeDegrees}
        utilization={utilization}
        latestSpeed={latestSpeed}
        averageSpeed={averageSpeed}
        totalSessions={totalSessions}
        connStreamPaused={connStreamPaused}
        connStreamLabel={connStreamLabel}
        formatRate={formatRate}
      />

      <DnsCacheCard
        dnsCacheStats={dnsCacheStats}
        dnsUpdatedLabel={dnsUpdatedLabel}
        triggerDnsCacheFlushFromDashboard={triggerDnsCacheFlushFromDashboard}
        dnsCacheFlushBusy={dnsCacheFlushBusy}
        dnsCacheStatus={dnsCacheStatus}
        dnsUsageRatio={dnsUsageRatio}
        dnsUsagePercent={dnsUsagePercent}
        dnsValidPercent={dnsValidPercent}
        dnsValidRatio={dnsValidRatio}
        dnsExpiredPercent={dnsExpiredPercent}
        dnsExpiredRatio={dnsExpiredRatio}
        dnsQueryTypes={dnsQueryTypes}
        dnsQueryType={dnsQueryType}
        setDnsQueryType={setDnsQueryType}
        dnsQueryDomain={dnsQueryDomain}
        setDnsQueryDomain={setDnsQueryDomain}
        dnsQueryBusy={dnsQueryBusy}
        dnsQueryStatus={dnsQueryStatus}
        dnsQueryResult={dnsQueryResult}
        runDnsQuery={runDnsQuery}
        formatBytes={formatBytes}
      />

      <TopDestinationsCard
        topSources={topSources}
        CHART_COLORS={CHART_COLORS}
        onSourceClick={onTopSourceClick}
        connStreamLabel={connStreamLabel}
        toggleConnStream={toggleConnStream}
        connStreamPaused={connStreamPaused}
      />

      <OutboundMixCard
        outboundMix={outboundMix}
        buildConicGradient={buildConicGradient}
        CHART_COLORS={CHART_COLORS}
        outboundTotal={outboundTotal}
      />

      <ProtocolSplitCard
        protocolTotal={protocolTotal}
        protocolMix={protocolMix}
        clamp={clamp}
        CHART_COLORS={CHART_COLORS}
        connStreamLabel={connStreamLabel}
        toggleConnStream={toggleConnStream}
        connStreamPaused={connStreamPaused}
      />
    </div>
  );
}
