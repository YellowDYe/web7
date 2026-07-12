import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { resolveImageUrl } from '../../../utils/imageHelper';

interface HeroSlide {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  leftBackgroundColor: string;
  rightBackgroundImage: string;
}

interface MainHeroCarouselProps {
  slides?: HeroSlide[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
}

interface SlideViewProps {
  slide: HeroSlide;
}

const SlideView: React.FC<SlideViewProps> = ({ slide }) => {
  const [imageError, setImageError] = useState(false);
  const heroImageUrl = resolveImageUrl(slide.rightBackgroundImage);
  const bgColor = slide.leftBackgroundColor || '#ffcfe3';

  return (
    <div className="w-full relative flex-shrink-0">
      <div className="hidden md:block absolute inset-0 w-1/2 rounded-[45px_0px_0px_45px]" style={{ backgroundColor: bgColor }} />
      {heroImageUrl && !imageError ? (
        <div className="hidden md:block absolute inset-0 left-1/2 w-1/2 rounded-[0px_45px_45px_0px] overflow-hidden">
          <img
            src={heroImageUrl}
            alt="Hero background"
            className="w-full h-full object-cover object-center"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="hidden md:block absolute inset-0 left-1/2 w-1/2 rounded-[0px_45px_45px_0px]" style={{ backgroundColor: bgColor }} />
      )}

      <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col md:flex-row md:h-[712px]">
        <div
          className="w-full md:w-1/2 flex flex-col justify-center px-16 md:px-12 lg:px-20 py-6 md:py-0 rounded-t-[45px] md:rounded-none"
          style={{ backgroundColor: bgColor }}
        >
          <div className="max-w-lg mx-auto md:mx-0 text-center md:text-left">
            <h1 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-[-0.25px] leading-tight mb-4 md:mb-8">
              {slide.title}
            </h1>

            <p className="[font-family:'Inria_Serif',Helvetica] font-normal text-[#1e1e1e] text-base sm:text-lg md:text-lg lg:text-xl leading-6 sm:leading-7 md:leading-7 tracking-[-0.25px] mb-4 md:mb-12">
              {slide.description}
            </p>

            {slide.buttonLink ? (
              <a
                href={slide.buttonLink}
                target={slide.buttonLink.startsWith('http') ? '_blank' : undefined}
                rel={slide.buttonLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex items-center justify-center h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-base sm:text-lg md:text-lg lg:text-xl [font-family:'Chivo',Helvetica] font-normal px-6 sm:px-8 md:px-[30px] py-3 sm:py-4 md:py-[15px] hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 mb-4 md:mb-0 no-underline cursor-pointer select-none"
              >
                {slide.buttonText}
              </a>
            ) : slide.buttonText ? (
              <Button className="h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-base sm:text-lg md:text-lg lg:text-xl [font-family:'Chivo',Helvetica] font-normal px-6 sm:px-8 md:px-[30px] py-3 sm:py-4 md:py-[15px] hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 mb-4 md:mb-0">
                {slide.buttonText}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="w-full md:w-1/2 h-80 md:h-[712px] relative md:bg-none rounded-b-[45px] md:rounded-none overflow-hidden">
          {heroImageUrl && !imageError ? (
            <img
              src={heroImageUrl}
              alt="Hero"
              className="w-full h-full object-cover object-center md:hidden rounded-b-[45px]"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full md:hidden rounded-b-[45px]" style={{ backgroundColor: bgColor }} />
          )}
        </div>
      </div>
    </div>
  );
};

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: 'slide-1',
    title: 'COME SANO, AHORRA TIEMPO Y ALCANZA TUS METAS SIN COCINAR',
    description: 'Sabemos que estás cansado de cocinar y repetir siempre lo mismo. Con Hola Dieta comes delicioso, cuidas tu salud y te olvidas del estrés de planear.',
    buttonText: 'SELECCIONA TU PLAN',
    buttonLink: '',
    leftBackgroundColor: '#ffcfe3',
    rightBackgroundImage: '/rectangle-1.png'
  }
];

export const MainHeroCarousel: React.FC<MainHeroCarouselProps> = ({
  slides = DEFAULT_SLIDES,
  autoPlay = true,
  autoPlayInterval = 5000
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const validSlides = slides && slides.length > 0 ? slides : DEFAULT_SLIDES;
  const total = validSlides.length;

  const goTo = useCallback((index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, currentIndex]);

  const goNext = useCallback(() => {
    goTo((currentIndex + 1) % total);
  }, [currentIndex, total, goTo]);

  const goPrev = useCallback(() => {
    goTo((currentIndex - 1 + total) % total);
  }, [currentIndex, total, goTo]);

  useEffect(() => {
    if (autoPlay && total > 1) {
      autoPlayRef.current = setInterval(goNext, autoPlayInterval);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [autoPlay, autoPlayInterval, goNext, total]);

  const resetAutoPlay = () => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    if (autoPlay && total > 1) {
      autoPlayRef.current = setInterval(goNext, autoPlayInterval);
    }
  };

  const handlePrev = () => {
    goPrev();
    resetAutoPlay();
  };

  const handleNext = () => {
    goNext();
    resetAutoPlay();
  };

  const handleDotClick = (index: number) => {
    goTo(index);
    resetAutoPlay();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (total === 1) {
    return <SlideView slide={validSlides[0]} />;
  }

  return (
    <section
      className="w-full relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {validSlides.map((slide) => (
          <SlideView key={slide.id} slide={slide} />
        ))}
      </div>

      {/* Prev / Next arrows */}
      <button
        onClick={handlePrev}
        aria-label="Previous slide"
        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-[#1e1e1e]" />
      </button>

      <button
        onClick={handleNext}
        aria-label="Next slide"
        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-[#1e1e1e]" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {validSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => handleDotClick(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-6 h-2.5 bg-[#1e1e1e]'
                : 'w-2.5 h-2.5 bg-[#1e1e1e]/30 hover:bg-[#1e1e1e]/60'
            }`}
          />
        ))}
      </div>
    </section>
  );
};
