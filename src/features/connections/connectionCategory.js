const CATEGORY_STATES = {
  unknown: ['Unknown', 'No domain or classification data is available.'],
  unmatched: ['Unmatched', 'The domain did not match any GeoSite category.'],
  mixed: ['Mixed', 'Connections in this group have different classifications.'],
  unavailable: ['Unavailable', 'Category information is unavailable for this connection.']
};

export const getConnectionCategory = (connection) => {
  const metadata = connection?.metadata || {};
  const categories = Array.isArray(metadata.geositeCategories)
    ? metadata.geositeCategories.filter((category) => typeof category === 'string' && category.length > 0)
    : [];
  const status = metadata.geositeStatus === 'mixed'
    ? 'mixed'
    : categories.length > 0
      ? 'classified'
      : Object.hasOwn(CATEGORY_STATES, metadata.geositeStatus)
        ? metadata.geositeStatus
        : Array.isArray(metadata.geositeCategories) ? 'unknown' : 'unavailable';
  const label = status === 'classified' ? categories.join(' · ') : CATEGORY_STATES[status][0];
  const description = status === 'classified'
    ? `Categories: ${categories.join(', ')}`
    : CATEGORY_STATES[status][1];
  const domain = typeof metadata.geositeDomain === 'string' ? metadata.geositeDomain : '';
  return { status, label, categories, title: domain ? `${description}\nDomain: ${domain}` : description };
};
