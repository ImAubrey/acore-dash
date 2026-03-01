import React from 'react';
import { CloseIcon, InfoIcon } from './actionIcons';
import {
  AutoFoldText,
  SPLICE_LABEL,
  formatRateOrSplice,
  formatTime,
  getDetailDestinationLabel,
  getDetailSourceLabel,
  getDetailXraySrcLabel,
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
      case 'xraySrc': {
        const host = getDetailXraySrcLabel(detail);
        const port = detail.metadata?.xraySrcPort;
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
        const network = String(detail.metadata?.network || '-').trim() || '-';
        const type = String(detail.metadata?.type || '-').trim() || '-';
        const rawAlpn = String(detail.metadata?.alpn || '').trim();
        const alpnLower = rawAlpn.toLowerCase();
        const typeRawParts = type === '-' ? [] : type.split('+').map((part) => part.trim()).filter(Boolean);
        const typeParts = typeRawParts.map((part) => part.toLowerCase());
        const hasSplice = typeParts.includes(SPLICE_LABEL);
        const hasTLS = typeParts.includes('tls');
        const hasQUIC = typeParts.includes('quic');
        const hasHTTP = typeParts.includes('http');
        const networkLower = network.toLowerCase();
        const networkDisplay = networkLower === 'tcp'
          ? 'TCP'
          : networkLower === 'udp'
            ? 'UDP'
            : network;
        const tokens = [networkDisplay];
        if (hasTLS) {
          tokens.push('TLS');
        }
        if (hasQUIC) {
          tokens.push('QUIC');
        }
        const alpnDisplay = rawAlpn
          ? (alpnLower === 'http/1.1' || alpnLower === 'http/1.0'
            ? 'H1'
            : (alpnLower === 'h2' || alpnLower.startsWith('h2-'))
              ? 'H2'
              : (alpnLower === 'h3' || alpnLower.startsWith('h3-'))
                ? 'H3'
                : rawAlpn)
          : (hasHTTP
            ? 'H1'
            : '');
        if (alpnDisplay) {
          tokens.push(alpnDisplay);
        }
        const extraTypeParts = typeRawParts.filter((part, index) => {
          const lower = typeParts[index];
          if (!lower) return false;
          if (lower === SPLICE_LABEL) return false;
          if (lower === 'tls' || lower === 'quic' || lower === 'http' || lower === 'http1' || lower === 'http2') return false;
          if ((lower === 'tcp' || lower === 'udp') && lower === networkLower) return false;
          return true;
        });
        extraTypeParts.forEach((part) => tokens.push(part));
        const protocolDisplay = tokens.join(' · ');
        return (
          <span className="protocol-cell">
            <span>{highlightConnCell(protocolDisplay)}</span>
            {hasSplice ? <span className="splice-badge" title="splice mode active">SPLICE</span> : null}
          </span>
        );
      }
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
        return highlightConnCell(formatRateOrSplice(detailRate?.upload || 0, isSpliceType(detail?.metadata?.type)));
      case 'download':
        return highlightConnCell(formatRateOrSplice(detailRate?.download || 0, isSpliceType(detail?.metadata?.type)));
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
