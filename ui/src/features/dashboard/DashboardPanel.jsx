import { TrafficTempoCard } from './TrafficTempoCard';
import { SessionHealthCard } from './SessionHealthCard';
import { TopDestinationsCard } from './TopDestinationsCard';
import { OutboundMixCard } from './OutboundMixCard';
import { ProtocolSplitCard } from './ProtocolSplitCard';

export function DashboardPanel({
  page,
  connStreamLabel,
  toggleConnStream,
  connStreamPaused,
  formatRate,
  formatBytes,
  latestSpeed,
  averageSpeed,
  peakSpeed,
  totalTraffic,
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
  topDestinations,
  truncateLabel,
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
        <div className="panel-header">
          <div>
            <h2>Operations snapshot</h2>
            <p>Instant readouts from live sessions and outbound topology.</p>
          </div>
          <div className="header-actions">
            <button
              className={`pill ${connStreamLabel}`}
              onClick={toggleConnStream}
              title={connStreamPaused ? 'Resume live updates' : 'Pause live updates'}
            >
              {connStreamLabel}
            </button>
          </div>
        </div>
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
            <span className="metric-label">Peak window</span>
            <strong className="metric-value">{formatRate(peakSpeed)}</strong>
            <span className="metric-meta">Total {formatBytes(totalTraffic)}</span>
            <div className="meter">
              <span style={{ transform: 'scaleX(1)' }} />
            </div>
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
        peakSpeed={peakSpeed}
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

      <TopDestinationsCard topDestinations={topDestinations} truncateLabel={truncateLabel} />

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
      />
    </div>
  );
}
