import { useCallback, useState } from 'react';

const getOrderKey = (item) => {
  try {
    return JSON.stringify(item ?? null);
  } catch (_err) {
    return '';
  }
};

export const getRuleOrderChanges = (items, baselineItems, enabled) => {
  const changes = new Map();
  if (!enabled || !Array.isArray(items) || !Array.isArray(baselineItems) || baselineItems.length === 0) {
    return changes;
  }
  const baselineByKey = new Map();
  baselineItems.forEach((item, index) => {
    const key = getOrderKey(item);
    if (!key) return;
    const indexes = baselineByKey.get(key) || [];
    indexes.push(index);
    baselineByKey.set(key, indexes);
  });
  items.forEach((item, index) => {
    const indexes = baselineByKey.get(getOrderKey(item));
    if (!indexes || indexes.length === 0) return;
    const originalIndex = indexes.shift();
    if (originalIndex !== index) {
      changes.set(index, `${originalIndex + 1}->${index + 1}`);
    }
  });
  return changes;
};

export const moveListItemByDrop = (items, fromIndex, targetIndex, position = 'before') => {
  const sourceIndex = Number(fromIndex);
  const destinationIndex = Number(targetIndex);
  const nextItems = Array.isArray(items) ? [...items] : [];
  if (
    !Number.isInteger(sourceIndex)
    || !Number.isInteger(destinationIndex)
    || sourceIndex < 0
    || destinationIndex < 0
    || sourceIndex >= nextItems.length
    || destinationIndex >= nextItems.length
  ) {
    return {
      items: nextItems,
      changed: false,
      error: 'index out of range'
    };
  }

  const rawInsertIndex = position === 'after' ? destinationIndex + 1 : destinationIndex;
  let insertIndex = sourceIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
  insertIndex = Math.min(Math.max(insertIndex, 0), nextItems.length - 1);
  if (insertIndex === sourceIndex) {
    return {
      items: nextItems,
      changed: false,
      error: ''
    };
  }

  const [item] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(insertIndex, 0, item);
  return {
    items: nextItems,
    changed: true,
    error: ''
  };
};

export function useSortableRuleList({ onReorder } = {}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const getDropPosition = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }, []);

  const clearDragState = useCallback(() => {
    setDraggedIndex(null);
    setDropTarget(null);
  }, []);

  const handleDragStart = useCallback((event, index) => {
    setDraggedIndex(index);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((event, index) => {
    if (draggedIndex === null) return;
    event.preventDefault();
    const position = getDropPosition(event);
    event.dataTransfer.dropEffect = 'move';
    setDropTarget((current) => {
      if (current?.index === index && current?.position === position) {
        return current;
      }
      return { index, position };
    });
  }, [draggedIndex, getDropPosition]);

  const handleDragLeave = useCallback((index) => {
    setDropTarget((current) => (
      current?.index === index ? null : current
    ));
  }, []);

  const handleDrop = useCallback((event, index) => {
    event.preventDefault();
    const sourceText = event.dataTransfer.getData('text/plain');
    const sourceIndex = sourceText === '' ? NaN : Number(sourceText);
    const fromIndex = Number.isFinite(sourceIndex) ? sourceIndex : draggedIndex;
    const position = getDropPosition(event);
    clearDragState();
    if (fromIndex === null || fromIndex === undefined || fromIndex === index) {
      return;
    }
    onReorder?.(fromIndex, index, position);
  }, [clearDragState, draggedIndex, getDropPosition, onReorder]);

  const getDropPositionForIndex = useCallback((index) => (
    dropTarget?.index === index ? dropTarget.position : ''
  ), [dropTarget]);

  return {
    draggedIndex,
    clearDragState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    getDropPositionForIndex
  };
}
