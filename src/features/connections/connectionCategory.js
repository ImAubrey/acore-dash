const CATEGORY_STATES = {
  empty: ['-', 'No categories available.'],
  unknown: ['Unknown', 'No usable domain or IP classification data is available.'],
  unmatched: ['Unmatched', 'No category matched the classified domain or IP.'],
  mixed: ['Mixed', 'Connections in this group have different classifications.'],
  unavailable: ['Unavailable', 'Category information is unavailable for this connection.']
};

const categoryNames = (values) => Array.isArray(values)
  ? values.filter((category) => typeof category === 'string' && category.length > 0)
  : [];

export const getConnectionCategory = (connection) => {
  const metadata = connection?.metadata || {};
  const unified = Array.isArray(metadata.categories);
  const categories = [...new Set(unified ? categoryNames(metadata.categories) : [
    ...categoryNames(metadata.geositeCategories),
    ...categoryNames(metadata.geoipCategories).map((category) => `ip:${category}`)
  ])];
  const reportedStatus = metadata.geositeStatus || metadata.geoipStatus;
  const hasCategoryData = unified || Array.isArray(metadata.geositeCategories) || Array.isArray(metadata.geoipCategories);
  const status = unified
    ? categories.length > 0 ? 'classified' : 'empty'
    : reportedStatus === 'mixed' || metadata.geoipStatus === 'mixed'
      ? 'mixed'
      : categories.length > 0
        ? 'classified'
        : Object.hasOwn(CATEGORY_STATES, reportedStatus)
          ? reportedStatus
          : hasCategoryData ? 'unknown' : 'unavailable';
  const label = status === 'classified' ? categories.join(' · ') : CATEGORY_STATES[status][0];
  const description = status === 'classified'
    ? `Categories: ${categories.join(', ')}`
    : CATEGORY_STATES[status][1];
  const domain = typeof metadata.geositeDomain === 'string' ? metadata.geositeDomain : '';
  let title = domain ? `${description}\nDomain: ${domain}` : description;
  const destinationIP = typeof metadata.destinationIP === 'string' ? metadata.destinationIP : '';
  if (status === 'classified' && destinationIP && categories.some((category) => category.startsWith('ip:'))) {
    title += `\nDestination IP: ${destinationIP}`;
  }
  return { status, label, categories, title };
};
