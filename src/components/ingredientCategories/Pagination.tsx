import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  loading?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  loading = false
}) => {
  // Calculate visible page numbers
  const getVisiblePages = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];

    // Calculate start and end of visible range
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);

    // Add pages to range
    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    // Add first page and dots if needed
    if (start > 1) {
      rangeWithDots.push(1);
      if (start > 2) {
        rangeWithDots.push('...');
      }
    }

    // Add visible pages
    rangeWithDots.push(...range);

    // Add last page and dots if needed
    if (end < totalPages) {
      if (end < totalPages - 1) {
        rangeWithDots.push('...');
      }
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && !loading) {
      onPageChange(page);
    }
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!loading) {
      onItemsPerPageChange(parseInt(e.target.value));
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="bg-white border-t border-gray-200 px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
        {/* Items per page selector and info - Mobile: Top, Desktop: Left */}
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="itemsPerPage" className="text-sm text-gray-700 whitespace-nowrap">
              Mostrar:
            </label>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              disabled={loading}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700 whitespace-nowrap">por página</span>
          </div>
          
          <div className="text-sm text-gray-700">
            Mostrando {startItem} a {endItem} de {totalItems} categorías
          </div>
        </div>

        {/* Pagination controls - Mobile: Bottom, Desktop: Right */}
        <div className="flex items-center space-x-1">
          {/* First page button */}
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || loading}
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Primera página"
            aria-label="Ir a la primera página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous page button */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Página anterior"
            aria-label="Ir a la página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page numbers */}
          <div className="hidden sm:flex items-center space-x-1">
            {visiblePages.map((page, index) => (
              <React.Fragment key={index}>
                {page === '...' ? (
                  <span className="px-3 py-2 text-gray-500">...</span>
                ) : (
                  <button
                    onClick={() => handlePageChange(page as number)}
                    disabled={loading}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50 border border-gray-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-label={`Ir a la página ${page}`}
                    aria-current={currentPage === page ? 'page' : undefined}
                  >
                    {page}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Mobile: Current page indicator */}
          <div className="sm:hidden px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-300">
            {currentPage} / {totalPages}
          </div>

          {/* Next page button */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Página siguiente"
            aria-label="Ir a la página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last page button */}
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || loading}
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Última página"
            aria-label="Ir a la última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;