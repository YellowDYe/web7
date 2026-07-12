import React, { useState } from 'react';

export interface GalleryImage {
  id: string;
  imageUrl: string;
  imageAlt: string;
  description: string;
  order: number;
}

interface StructuredGalleryProps {
  title?: string;
  subtitle?: string;
  images?: GalleryImage[];
  backgroundColor?: string;
}

export const StructuredGallery: React.FC<StructuredGalleryProps> = ({
  title = "Our Featured Gallery",
  subtitle = "Discover our carefully curated collection",
  images = [],
  backgroundColor = "#ffffff"
}) => {
  const [imageLoadStates, setImageLoadStates] = useState<Record<string, boolean>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Ensure we have exactly 8 images (2 rows × 4 columns)
  const galleryImages = [...images].sort((a, b) => a.order - b.order).slice(0, 8);
  
  // Fill empty slots if we have fewer than 8 images
  while (galleryImages.length < 8) {
    galleryImages.push({
      id: `placeholder-${galleryImages.length}`,
      imageUrl: '',
      imageAlt: 'Empty slot',
      description: 'Add your image here',
      order: galleryImages.length
    });
  }

  const handleImageLoad = (imageId: string) => {
    setImageLoadStates(prev => ({ ...prev, [imageId]: true }));
  };

  const handleImageError = (imageId: string) => {
    setImageErrors(prev => ({ ...prev, [imageId]: true }));
  };

  const truncateDescription = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

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

      {/* Gallery Grid - 2 rows × 4 columns */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {galleryImages.map((image, index) => (
            <GalleryImageCard
              key={image.id}
              image={image}
              index={index}
              isLoaded={imageLoadStates[image.id]}
              hasError={imageErrors[image.id]}
              onLoad={() => handleImageLoad(image.id)}
              onError={() => handleImageError(image.id)}
              truncateDescription={truncateDescription}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

// Gallery Image Card Component
interface GalleryImageCardProps {
  image: GalleryImage;
  index: number;
  isLoaded?: boolean;
  hasError?: boolean;
  onLoad: () => void;
  onError: () => void;
  truncateDescription: (text: string, maxLength?: number) => string;
}

const GalleryImageCard: React.FC<GalleryImageCardProps> = ({
  image,
  index,
  isLoaded,
  hasError,
  onLoad,
  onError,
  truncateDescription
}) => {
  const isEmpty = !image.imageUrl || image.id.startsWith('placeholder-');

  return (
    <div className="bg-white rounded-[20px] md:rounded-[30px] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      {/* Image Container */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {!isEmpty && !hasError ? (
          <>
            {!isLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-gray-300 border-t-[#bfd730] rounded-full animate-spin"></div>
              </div>
            )}
            <img
              src={image.imageUrl}
              alt={image.imageAlt}
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={onLoad}
              onError={onError}
              loading="lazy"
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <div className="text-center text-gray-400">
              {isEmpty ? (
                <>
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <p className="text-xs md:text-sm">Add Image</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-200 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-xs md:text-sm">Image Error</p>
                </>
              )}
            </div>
          </div>
        )}
        
      </div>

      {/* Description */}
      <div className="p-3 md:p-4">
        <p className="[font-family:'Inria_Serif',Helvetica] font-normal text-[#1d1c21] text-sm md:text-base leading-5 md:leading-6 tracking-[-0.25px] min-h-[2.5rem] md:min-h-[3rem]">
          {truncateDescription(image.description, 100)}
        </p>
      </div>
    </div>
  );
};