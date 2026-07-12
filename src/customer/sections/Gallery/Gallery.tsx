import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface GalleryItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  category?: string;
}

interface GalleryProps {
  title?: string;
  subtitle?: string;
  items?: GalleryItem[];
  layout?: 'grid' | 'carousel' | 'masonry';
  itemsPerPage?: number;
  showPagination?: boolean;
  backgroundColor?: string;
  columns?: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export const Gallery: React.FC<GalleryProps> = ({
  title = "Meals Designed to Support Your Health Goals",
  subtitle = "It's easy to fuel up and feel good with ready-to-eat meals across 8 dietary preferences- all developed by our registered dietitians.",
  items = [],
  layout = 'grid',
  itemsPerPage = 6,
  showPagination = true,
  backgroundColor = "#ffffff",
  columns = {
    mobile: 1,
    tablet: 2,
    desktop: 3
  }
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Pagination logic
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage);

  // Carousel navigation
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % items.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + items.length) % items.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Grid layout component
  const GridLayout = ({ items: gridItems }: { items: GalleryItem[] }) => (
    <div className={`
      grid gap-6 md:gap-8
      grid-cols-${columns.mobile}
      md:grid-cols-${columns.tablet}
      lg:grid-cols-${columns.desktop}
      max-w-7xl mx-auto
    `}>
      {gridItems.map((item, index) => (
        <GalleryCard key={item.id} item={item} index={index} />
      ))}
    </div>
  );

  // Carousel layout component
  const CarouselLayout = ({ items: carouselItems }: { items: GalleryItem[] }) => (
    <div className="relative max-w-7xl mx-auto">
      <div className="overflow-hidden rounded-[45px]">
        <div 
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {carouselItems.map((item, index) => (
            <div key={item.id} className="w-full flex-shrink-0">
              <GalleryCard item={item} index={index} />
            </div>
          ))}
        </div>
      </div>

      {/* Carousel Navigation */}
      {carouselItems.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>

          {/* Carousel Indicators */}
          <div className="flex justify-center mt-6 space-x-2">
            {carouselItems.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentSlide 
                    ? 'bg-[#bfd730]' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Masonry layout component
  const MasonryLayout = ({ items: masonryItems }: { items: GalleryItem[] }) => (
    <div className="columns-1 md:columns-2 lg:columns-3 gap-6 md:gap-8 max-w-7xl mx-auto">
      {masonryItems.map((item, index) => (
        <div key={item.id} className="break-inside-avoid mb-6 md:mb-8">
          <GalleryCard item={item} index={index} />
        </div>
      ))}
    </div>
  );

  return (
    <section className="w-full py-8 md:py-16 px-8 rounded-[45px]" style={{ backgroundColor }}>
      {/* Header */}
      {(title || subtitle) && (
        <div className="text-center mb-8 md:mb-16">
          {title && (
            <h2 className="[font-family:'Antonio',Helvetica] font-bold text-black text-3xl md:text-4xl lg:text-5xl text-center tracking-[-0.25px] leading-tight lg:leading-[120px] mb-4">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="[font-family:'Chivo',Helvetica] font-medium text-[#1d1c21] text-lg md:text-xl text-center leading-7 tracking-[-0.25px] max-w-4xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Gallery Content */}
      {items.length > 0 ? (
        <>
          {layout === 'grid' && <GridLayout items={paginatedItems} />}
          {layout === 'carousel' && <CarouselLayout items={items} />}
          {layout === 'masonry' && <MasonryLayout items={paginatedItems} />}

          {/* Pagination */}
          {showPagination && layout !== 'carousel' && totalPages > 1 && (
            <div className="flex justify-center items-center mt-12 space-x-4">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-4 py-2 bg-[#e9ff93] hover:bg-[#e9ff93]/80 disabled:bg-gray-200 disabled:text-gray-400 rounded-full border border-black disabled:border-gray-300 transition-colors [font-family:'Chivo',Helvetica] font-medium"
                aria-label="Previous page"
              >
                Previous
              </button>
              
              <div className="flex space-x-2">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`w-10 h-10 rounded-full border transition-colors [font-family:'Chivo',Helvetica] font-medium ${
                      currentPage === i
                        ? 'bg-[#bfd730] border-black text-black'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-label={`Go to page ${i + 1}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage === totalPages - 1}
                className="px-4 py-2 bg-[#e9ff93] hover:bg-[#e9ff93]/80 disabled:bg-gray-200 disabled:text-gray-400 rounded-full border border-black disabled:border-gray-300 transition-colors [font-family:'Chivo',Helvetica] font-medium"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="[font-family:'Inria_Serif',Helvetica] font-normal text-[#1d1c21] text-lg">
            No gallery items to display.
          </p>
        </div>
      )}
    </section>
  );
};

// Gallery Card Component
const GalleryCard: React.FC<{ item: GalleryItem; index: number }> = ({ item, index }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-white rounded-[45px] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
      {/* Image Container */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {!imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-gray-300 border-t-[#bfd730] rounded-full animate-spin"></div>
              </div>
            )}
            <img
              src={item.imageUrl}
              alt={item.imageAlt}
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="w-16 h-16 bg-gray-300 rounded-lg mx-auto mb-2"></div>
              <p className="text-sm">Image not available</p>
            </div>
          </div>
        )}
        
        {/* Category Badge */}
        {item.category && (
          <div className="absolute top-4 left-4 bg-[#bfd730] text-black px-3 py-1 rounded-full text-sm font-medium [font-family:'Chivo',Helvetica]">
            {item.category}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="[font-family:'Chivo',Helvetica] font-bold text-black text-xl md:text-2xl mb-3 leading-tight">
          {item.title}
        </h3>
        <p className="[font-family:'Inria_Serif',Helvetica] font-normal text-[#1d1c21] text-base leading-6 tracking-[-0.25px]">
          {item.description}
        </p>
      </div>
    </div>
  );
};