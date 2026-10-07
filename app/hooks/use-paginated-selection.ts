import { useEffect, useState } from 'react';
const PAGE_SIZE = 10;
export function usePaginatedSelection<T>(items: T[], getId: (item: T) => string) {
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const existingIds = new Set(items.map(getId));
  const selectedItems = items.filter((item) => selectedIds.has(getId(item)));
  const selectedCount = selectedItems.length;
  const visibleSelectedCount = visibleItems.filter((item) => selectedIds.has(getId(item))).length;
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);
  useEffect(() => {
    setSelectedIds(
      (current) => new Set([...current].filter((id) => items.some((item) => getId(item) === id))),
    );
  }, [items, getId]);
  const select = (id: string, selected: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  const selectPage = (selected: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const item of visibleItems) {
        if (selected) next.add(getId(item));
        else next.delete(getId(item));
      }
      return next;
    });
  return {
    page: currentPage,
    setPage,
    pageCount,
    visibleItems,
    selectedItems,
    selectedCount,
    visibleSelectedCount,
    selectedIds,
    select,
    selectPage,
    selectAll: () => setSelectedIds(existingIds),
    clearSelection: () => setSelectedIds(new Set()),
  };
}
