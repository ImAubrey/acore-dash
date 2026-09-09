import React from 'react';
import { CloseIcon, InfoIcon } from './actionIcons';
import { getConnectionCategory } from './connectionCategory';
import { ECH_HINT, getConnectionECH, getConnectionProtocolView } from './connectionProtocol';
import {
  AutoFoldText,
  formatRateOrSplice,
  formatTime,
  getDetailDestinationLabel,
  getDetailSourceLabel,
  getDetailAcoreSrcLabel,
  getDetailJa4Info,
  getDetailJa4DbLabel,
  normalizeDomainSource,
  getDetailDomainSourceBadge,
  getDetailLastSeen,
  formatHostPort,
  formatHostPortDisplay,
  isSpliceType
} from '../../dashboardShared';

const DETAIL_AUTOFOLD_PERF_THRESHOLD = 80;

export function DetailActionButtons({
  onInfo,
  onClose,
  closeDisabled = false,
  infoTitle = 'Info',
  closeTitle = 'Close this connection',
  infoAriaLabel = 'Info',
  closeAriaLabel = 'Close this connection'
}) {
  return (
    <span className="detail-actions">
      <button
        type="button"
        className="conn-info"
        onClick={onInfo}
        title={infoTitle}
        aria-label={infoAriaLabel}
      >
        <InfoIcon />
      </button>
      <button
        type="button"
        className="conn-close"
        onClick={onClose}
        disabled={closeDisabled}
        title={closeDisabled ? closeTitle : 'Close this connection'}
        aria-label={closeAriaLabel}
      >
        <CloseIcon />
      </button>
    </span>
  );
}

export function createDetailCellRenderer({
  highlightConnCell,
  handleInfoDetail,
  handleCloseDetail
}) {
  return (columnKey, conn, detail, detailRate, detailKey) => {
    const disableAdaptiveFold = (conn?.details?.length || 0) >= DETAIL_AUTOFOLD_PERF_THRESHOLD;
    switch (columnKey) {
      case 'destination': {
        const host = getDetailDestinationLabel(detail);
        const port = detail.metadata?.destinationPort;
        const full = formatHostPort(host, port);
        const display = formatHostPortDisplay(host, port);
        const detailSourceBadge = getDetailDomainSourceBadge(detail);
        return (
          <span className="destination-cell">
            {detailSourceBadge ? (
              <span
                className={`domain-source-pill ${normalizeDomainSource(detail?.metadata?.domainSource)}`}
                title={`Domain source: ${detailSourceBadge}`}
              >
                {detailSourceBadge}
              </span>
            ) : null}
            <AutoFoldText
              className="destination-cell-text"
              fullText={full}
              foldedText={display}
              renderText={highlightConnCell}
              disableAdaptive={disableAdaptiveFold}
              forceFold={disableAdaptiveFold}
            />
          </span>
        );
      }
      case 'source': {
        const host = getDetailSourceLabel(detail);
        const port = detail.metadata?.sourcePort;
        const full = formatHostPort(host, port);
        const display = formatHostPortDisplay(host, port);
        return (
          <AutoFoldText
            fullText={full}
            foldedText={display}
            renderText={highlightConnCell}
            disableAdaptive={disableAdaptiveFold}
            forceFold={disableAdaptiveFold}
          />
        );
      }
      case 'acoreSrc': {
        const host = getDetailAcoreSrcLabel(detail);
        const port = detail.metadata?.acoreSrcPort;
        const full = formatHostPort(host, port);
        const display = formatHostPortDisplay(host, port);
        return (
          <AutoFoldText
            fullText={full}
            foldedText={display}
            renderText={highlightConnCell}
            disableAdaptive={disableAdaptiveFold}
            forceFold={disableAdaptiveFold}
          />
        );
      }
      case 'user':
        return highlightConnCell(detail.metadata?.user || '-');
      case 'inbound':
        return highlightConnCell(detail.metadata?.inboundTag || '-');
      case 'inboundName':
        return highlightConnCell(detail.metadata?.inboundName || '-');
      case 'tlsOuterSNI':
        return <span title={ECH_HINT}>{highlightConnCell(detail.metadata?.tlsOuterSNI || '-')}</span>;
      case 'outbound':
        return highlightConnCell(detail.metadata?.outboundTag || '-');
      case 'rule':
        return highlightConnCell(
          detail.rulePayload
          || detail.rule
          || conn?.rulePayload
          || conn?.rule
          || '-'
        );
      case 'protocol': {
        const { label, splice } = getConnectionProtocolView(detail.metadata);
        return (
          <span className="protocol-cell" title={getConnectionECH(detail.metadata) ? ECH_HINT : undefined}>
            <span>{highlightConnCell(label)}</span>
            {splice ? <span className="splice-badge" title="splice mode active">SPLICE</span> : null}
          </span>
        );
      }
      case 'category': {
        const category = getConnectionCategory(detail);
        return (
          <span className={`connection-category-cell ${category.status}`} title={category.title}>
            {category.status === 'classified'
              ? category.categories.map((name) => (
                <span key={name} className="connection-category-item">{highlightConnCell(name)}</span>
              ))
              : highlightConnCell(category.label)}
          </span>
        );
      }
      case 'firewallFlow':
        return highlightConnCell(detail.metadata?.firewallFlow || '-');
      case 'ja4': {
        const ja4Info = getDetailJa4Info(detail);
        const label = getDetailJa4DbLabel(detail, '-');
        const titleParts = [];
        if (ja4Info?.dbLabel) titleParts.push(`Label: ${ja4Info.dbLabel}`);
        if (ja4Info?.dbTag) titleParts.push(`Tag: ${ja4Info.dbTag}`);
        if (ja4Info?.dbFile) titleParts.push(`Database: ${ja4Info.dbFile}`);
        if (ja4Info?.fingerprint) titleParts.push(`JA4: ${ja4Info.fingerprint}`);
        return (
          <span title={titleParts.length ? titleParts.join('\n') : undefined}>
            {highlightConnCell(label)}
          </span>
        );
      }
      case 'upload':
        return highlightConnCell(formatRateOrSplice(
          detailRate?.upload || 0,
          isSpliceType(detail?.metadata?.type),
          detailRate?.resolved
        ));
      case 'download':
        return highlightConnCell(formatRateOrSplice(
          detailRate?.download || 0,
          isSpliceType(detail?.metadata?.type),
          detailRate?.resolved
        ));
      case 'lastSeen':
        return highlightConnCell(formatTime(getDetailLastSeen(detail)));
      case 'close':
        return (
          <DetailActionButtons
            onInfo={(event) => handleInfoDetail(event, conn, detail, detailRate, detailKey)}
            onClose={(event) => handleCloseDetail(event, detail)}
            closeDisabled={!detail?.id}
            closeTitle="No connection to close"
          />
        );
      default:
        return '-';
    }
  };
}
