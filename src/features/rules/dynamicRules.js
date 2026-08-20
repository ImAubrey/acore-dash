const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toText = (value) => String(value ?? '').trim();

const firstText = (...values) => {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return '';
};

const toPositiveInteger = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;
  return number;
};

const pluralize = (value, unit) => `${value} ${unit}${value === 1 ? '' : 's'}`;

const TRIGGER_KEYS = new Set([
  'rulewide', 'srcip', 'srcport', 'srcipsrcport', 'dstip', 'srcipdstip', 'srcportdstip',
  'srcipsrcportdstip', 'dstport', 'srcipdstport', 'srcportdstport', 'srcipsrcportdstport',
  'dstipdstport', 'srcipdstipdstport', 'srcportdstipdstport', 'srcipsrcportdstipdstport'
]);

const COMPACT_TRIGGER_KEYS = new Map([
  ['rulewide', 'all'],
  ['srcip', 'srcIP'],
  ['srcport', 'sport'],
  ['srcipsrcport', 'srcIP+sport'],
  ['dstip', 'dstIP'],
  ['srcipdstip', 'srcIP+dstIP'],
  ['srcportdstip', 'sport+dstIP'],
  ['srcipsrcportdstip', 'srcIP+sport+dstIP'],
  ['dstport', 'dport'],
  ['srcipdstport', 'srcIP+dport'],
  ['srcportdstport', 'sport+dport'],
  ['srcipsrcportdstport', 'srcIP+sport+dport'],
  ['dstipdstport', 'dstIP+dport'],
  ['srcipdstipdstport', 'srcIP+dstIP+dport'],
  ['srcportdstipdstport', 'sport+dstIP+dport'],
  ['srcipsrcportdstipdstport', 'srcIP+sport+dstIP+dport']
]);

export const getDynamicRuleTarget = (value) => {
  const item = isRecord(value) ? value : {};
  const rule = isRecord(item.rule) ? item.rule : item;
  const explicit = firstText(item.target, item.targetTag, item.outboundTag, rule.target, rule.targetTag);
  if (explicit) return explicit;
  const outbound = firstText(rule.outboundTag);
  if (outbound) return outbound;
  const balancer = firstText(item.balancerTag, rule.balancerTag);
  return balancer ? `balancer:${balancer}` : '';
};

export const normalizeDynamicRules = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index) => {
    const rule = isRecord(item.rule)
      ? item.rule
      : isRecord(item.raw)
        ? item.raw
        : {};
    return {
      ...item,
      key: firstText(item.id, item.ruleTag, rule.ruleTag)
        || `${firstText(item.sourceRuleTag, item.sourceTag) || 'dynamic'}:${index}`,
      sourceRuleTag: firstText(item.sourceRuleTag, item.sourceTag),
      ruleTag: firstText(item.ruleTag, rule.ruleTag),
      activatedAt: firstText(item.activatedAt),
      expiresAt: firstText(item.expiresAt),
      target: getDynamicRuleTarget({ ...item, rule }),
      rule,
      raw: item.raw ?? item
    };
  });
};

export const normalizeActiveTriggers = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index) => ({
    ...item,
    key: firstText(item.ruleId, item.ruleTag) || `active-trigger:${index}`,
    ruleTag: firstText(item.ruleTag),
    triggerKey: firstText(item.key) || 'ruleWide',
    sourceIp: firstText(item.sourceIp, item.sourceIP),
    sourcePort: Number(item.sourcePort) || 0,
    destinationIp: firstText(item.destinationIp, item.destinationIP),
    destinationPort: Number(item.destinationPort) || 0,
    mode: firstText(item.mode) || 'activeConnections',
    count: Number(item.count) || 0,
    max: Number(item.max) || 0,
    activatedAt: firstText(item.activatedAt),
    blockedUntil: firstText(item.blockedUntil),
    raw: item
  }));
};

export const formatActiveTriggerBucket = (item) => {
  const current = isRecord(item) ? item : {};
  if ((firstText(current.triggerKey, current.key) || 'ruleWide') === 'ruleWide') return 'Whole rule';
  const sourceIp = firstText(current.sourceIp, current.sourceIP);
  const destinationIp = firstText(current.destinationIp, current.destinationIP);
  const sourcePort = Number(current.sourcePort) || 0;
  const destinationPort = Number(current.destinationPort) || 0;
  return [
    sourceIp ? `src=${sourceIp}` : '',
    sourcePort ? `sport=${sourcePort}` : '',
    destinationIp ? `dst=${destinationIp}` : '',
    destinationPort ? `dport=${destinationPort}` : ''
  ].filter(Boolean).join(' · ') || '-';
};

export const getRemainingTtl = (expiresAt, now = Date.now()) => {
  const expiresMs = typeof expiresAt === 'number'
    ? expiresAt
    : Date.parse(toText(expiresAt));
  if (!Number.isFinite(expiresMs)) {
    return { label: 'No expiry', remainingMs: null, expired: false };
  }
  const remainingMs = expiresMs - Number(now);
  if (remainingMs <= 0) {
    return { label: 'Expired', remainingMs: 0, expired: true };
  }
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) {
    return { label: `${seconds}s remaining`, remainingMs, expired: false };
  }
  const minutes = Math.floor(seconds / 60);
  const tailSeconds = seconds % 60;
  if (minutes < 60) {
    return {
      label: `${minutes}m ${String(tailSeconds).padStart(2, '0')}s remaining`,
      remainingMs,
      expired: false
    };
  }
  const hours = Math.floor(minutes / 60);
  const tailMinutes = minutes % 60;
  return {
    label: `${hours}h ${String(tailMinutes).padStart(2, '0')}m remaining`,
    remainingMs,
    expired: false
  };
};

export const formatTriggerDuration = (trigger, prefix = 'block') => {
  const current = isRecord(trigger) ? trigger : {};
  const seconds = toPositiveInteger(current[`${prefix}Seconds`]);
  if (seconds !== null) return pluralize(seconds, 'second');
  const minutes = toPositiveInteger(current[`${prefix}Minutes`]);
  if (minutes !== null) return pluralize(minutes, 'minute');
  return '';
};

const formatCompactTriggerDuration = (trigger, prefix) => {
  const current = isRecord(trigger) ? trigger : {};
  if (prefix === 'sustain') {
    const sustain = firstText(current.sustain);
    if (sustain) return sustain;
  }
  const seconds = toPositiveInteger(current[`${prefix}Seconds`]);
  if (seconds !== null) return `${seconds}s`;
  const minutes = toPositiveInteger(current[`${prefix}Minutes`]);
  return minutes === null ? '' : `${minutes}m`;
};

const formatCompactTriggerKey = (value) => {
  const key = firstText(value) || 'ruleWide';
  return COMPACT_TRIGGER_KEYS.get(key.replace(/[_\-\s]/g, '').toLowerCase()) || key;
};

export const getFirewallTriggerDetail = (rule) => {
  const current = isRecord(rule) ? rule : {};
  const trigger = isRecord(current.trigger) ? current.trigger : {};
  const dynamicRule = isRecord(trigger.dynamicRule) ? trigger.dynamicRule : {};
  const threshold = toPositiveInteger(trigger.maxConnections);
  const sustain = formatCompactTriggerDuration(trigger, 'sustain');
  const ttl = formatCompactTriggerDuration(trigger, 'block');
  const target = getDynamicRuleTarget(dynamicRule);
  const key = formatCompactTriggerKey(trigger.key);
  return [
    threshold === null ? '' : `>${threshold} conn`,
    key,
    sustain ? `hold ${sustain}` : '',
    target ? `→ ${target}` : '',
    ttl ? `ban ${ttl}` : ''
  ].filter(Boolean).join(' · ');
};

export const getConfiguredDynamicRuleTriggers = (firewall) => {
  const current = isRecord(firewall) ? firewall : {};
  const rawRules = Array.isArray(current.rules)
    ? current.rules
    : Array.isArray(current.rule)
      ? current.rule
      : [];
  const entries = [];
  rawRules.forEach((rawRule, index) => {
    if (!isRecord(rawRule)) return;
    const match = isRecord(rawRule.match) ? rawRule.match : {};
    const rule = { ...match, ...rawRule };
    delete rule.match;
    const action = typeof rule.action === 'number'
      ? (rule.action === 5 ? 'trigger' : '')
      : toText(rule.action).toLowerCase();
    if (action !== 'trigger') return;
    const trigger = isRecord(rule.trigger) ? rule.trigger : {};
    const dynamicRule = isRecord(trigger.dynamicRule) ? trigger.dynamicRule : {};
    const sourceIPs = Array.isArray(rule.sourceIP)
      ? rule.sourceIP.map(toText).filter(Boolean)
      : [];
    entries.push({
      index,
      rule,
      trigger,
      dynamicRule,
      title: firstText(rule.ruleTag) || `firewall trigger ${index + 1}`,
      source: sourceIPs.join(', '),
      detail: getFirewallTriggerDetail(rule),
      target: getDynamicRuleTarget(dynamicRule),
      duration: formatTriggerDuration(trigger, 'block')
    });
  });
  return entries;
};

export const validateFirewallTrigger = (rule) => {
  if (!isRecord(rule)) return 'Firewall rule must be a JSON object.';
  const action = typeof rule.action === 'number'
    ? (rule.action === 5 ? 'trigger' : '')
    : toText(rule.action).toLowerCase();
  if (action !== 'trigger') return '';
  if (!isRecord(rule.trigger)) return 'trigger action requires a trigger object.';
  if (rule.limit !== undefined && rule.limit !== null) {
    return 'limit is only valid when action=limit.';
  }

  const trigger = rule.trigger;
  const key = firstText(trigger.key) || 'ruleWide';
  const normalizedKey = key.replace(/[_\-\s]/g, '').toLowerCase();
  if (!TRIGGER_KEYS.has(normalizedKey)) {
    return `unsupported trigger.key: ${key}.`;
  }
  if (toPositiveInteger(trigger.maxConnections) === null) {
    return 'trigger.maxConnections must be a positive integer.';
  }
  const mode = firstText(trigger.mode).toLowerCase() || 'activeconnections';
  if (mode === 'newconnections' || mode === 'new_connections' || mode === 'new') {
    if (toPositiveInteger(trigger.windowSeconds) === null) {
      return 'trigger.windowSeconds must be a positive integer when mode=newConnections.';
    }
  } else if (trigger.windowSeconds !== undefined && Number(trigger.windowSeconds) !== 0) {
    return 'trigger.windowSeconds is only valid when mode=newConnections.';
  }

  const sustain = firstText(trigger.sustain);
  const legacySustainKeys = ['sustainSeconds', 'sustainMinutes'];
  const presentLegacySustainKeys = legacySustainKeys.filter((key) => (
    trigger[key] !== undefined && trigger[key] !== null && trigger[key] !== ''
  ));
  if (sustain && presentLegacySustainKeys.length) {
    return `trigger.sustain cannot be combined with legacy trigger.${presentLegacySustainKeys[0]}.`;
  }
  if (presentLegacySustainKeys.length > 1) {
    return 'legacy trigger sustain fields cannot be combined.';
  }
  if (sustain && !/^[1-9][0-9]*(?:ms|s|m|h|d)$/.test(sustain)) {
    return 'trigger.sustain must be a positive duration such as 2ms, 2s, 2m, 2h, or 2d.';
  }
  if (presentLegacySustainKeys.length && toPositiveInteger(trigger[presentLegacySustainKeys[0]]) === null) {
    return `trigger.${presentLegacySustainKeys[0]} must be a positive integer.`;
  }

  const durationPairs = [['blockSeconds', 'blockMinutes', true]];
  for (const [secondsKey, minutesKey, required] of durationPairs) {
    const secondsPresent = trigger[secondsKey] !== undefined && trigger[secondsKey] !== null && trigger[secondsKey] !== '';
    const minutesPresent = trigger[minutesKey] !== undefined && trigger[minutesKey] !== null && trigger[minutesKey] !== '';
    if (secondsPresent && minutesPresent) {
      return `trigger.${secondsKey} and trigger.${minutesKey} cannot both be set.`;
    }
    if (secondsPresent && toPositiveInteger(trigger[secondsKey]) === null) {
      return `trigger.${secondsKey} must be a positive integer.`;
    }
    if (minutesPresent && toPositiveInteger(trigger[minutesKey]) === null) {
      return `trigger.${minutesKey} must be a positive integer.`;
    }
    if (required && !secondsPresent && !minutesPresent) {
      return 'trigger.blockSeconds or trigger.blockMinutes must be set.';
    }
  }

  const hasDynamicRule = trigger.dynamicRule !== undefined && trigger.dynamicRule !== null;
  if (!hasDynamicRule) return '';
  if (normalizedKey !== 'rulewide') {
    return 'trigger.dynamicRule only supports key=ruleWide.';
  }
  if (!isRecord(trigger.dynamicRule)) {
    return 'trigger.dynamicRule must be a routing rule object.';
  }
  const dynamicRule = trigger.dynamicRule;
  if (!firstText(dynamicRule.ruleTag)) {
    return 'trigger.dynamicRule.ruleTag is required.';
  }
  if (!firstText(dynamicRule.outboundTag, dynamicRule.balancerTag)) {
    return 'trigger.dynamicRule requires outboundTag or balancerTag.';
  }
  return '';
};
