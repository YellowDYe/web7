import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

interface SlidePreviewProps {
  slide: HeroSlide;
}

const SlidePreview: React.FC<SlidePreviewProps> = ({ slide }) => {
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
            <h1 className="font-antonio font-bold text-[#1e1e1e] text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-[-0.25px] leading-tight mb-4 md:mb-8">
              {slide.title}
            </h1>

            <p className="font-normal text-[#1e1e1e] text-base sm:text-lg md:text-lg lg:text-xl leading-6 sm:leading-7 md:leading-7 tracking-[-0.25px] mb-4 md:mb-12">
              {slide.description}
            </p>

            {slide.buttonText && (
              <button className="h-auto bg-[#e9ff93] rounded-[100px] border border-solid border-black text-black text-base sm:text-lg md:text-lg lg:text-xl font-normal px-6 sm:px-8 md:px-[30px] py-3 sm:py-4 md:py-[15px] hover:bg-[#d4e87a] active:scale-95 transition-all duration-200 mb-4 md:mb-0 cursor-pointer">
                {slide.buttonText}
              </button>
            )}
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
    title: 'Slide 1 Title',
    description: 'Edit this slide description to customize your message.',
    buttonText: 'Get Started',
    buttonLink: '',
    leftBackgroundColor: '#ffcfe3',
    rightBackgroundImage: ''
  },
  {
    id: 'slide-2',
    title: 'Slide 2 Title',
    description: 'Edit this slide description to customize your message.',
    buttonText: 'Learn More',
    buttonLink: '',
    leftBackgroundColor: '#bfd730',
    rightBackgroundImage: ''
  }
];

export const MainHeroCarousel: React.FC<MainHeroCarouselProps> = ({
  slides = DEFAULT_SLIDES,
  autoPlay = true,
  autoPlayInterval = 5000
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const validSlides = slides && slides.length > 0 ? slides : DEFAULT_SLIDES;
  const total = validSlides.length;

  const goPrev = () => setCurrentIndex((i) => (i - 1 + total) % total);
  const goNext = () => setCurrentIndex((i) => (i + 1) % total);

  return (
    <section className="w-full relative overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {validSlides.map((slide) => (
          <SlidePreview key={slide.id} slide={slide} />
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Previous slide"
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-[#1e1e1e]" />
          </button>

          <button
            onClick={goNext}
            aria-label="Next slide"
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/80 hover:bg-white shadow-md flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-[#1e1e1e]" />
          </button>

          <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {validSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-6 h-2.5 bg-[#1e1e1e]'
                    : 'w-2.5 h-2.5 bg-[#1e1e1e]/30 hover:bg-[#1e1e1e]/60'
                }`}
              />
            ))}
          </div>

          {/* Slide counter badge */}
          <div className="absolute top-4 right-4 z-20 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {currentIndex + 1} / {total}
          </div>
        </>
      )}
    </section>
  );
};
