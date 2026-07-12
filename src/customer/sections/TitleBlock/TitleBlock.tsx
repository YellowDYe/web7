import React from 'react';

interface TitleBlockProps {
  title?: string;
  subtitle?: string;
  alignment?: 'left' | 'center' | 'right';
  backgroundColor?: string;
}

export const TitleBlock: React.FC<TitleBlockProps> = ({
  title = "Section Title",
  subtitle = "Supporting subtitle text",
  alignment = "center",
  backgroundColor = "#ffffff",
}) => {
  const alignClass =
    alignment === 'left' ? 'text-left' :
    alignment === 'right' ? 'text-right' :
    'text-center';

  return (
    <section className="w-full py-10 md:py-16 px-8" style={{ backgroundColor }}>
      <div className={`max-w-3xl ${alignment === 'center' ? 'mx-auto' : alignment === 'right' ? 'ml-auto' : ''}`}>
        <h2 className={`[font-family:'Antonio',Helvetica] font-bold text-black text-4xl lg:text-5xl tracking-[-0.25px] leading-tight mb-4 ${alignClass}`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`[font-family:'Chivo',Helvetica] font-medium text-[#1d1c21] text-xl leading-7 tracking-[-0.25px] ${alignClass}`}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
};
