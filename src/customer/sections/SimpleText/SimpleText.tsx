import React from 'react';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';

interface SimpleTextProps {
  title?: string;
  body?: string;
  backgroundColor?: string;
}

export const SimpleText: React.FC<SimpleTextProps> = ({
  title = '',
  body = '',
  backgroundColor = '#ffffff',
}) => {
  return (
    <section className="w-full py-10 md:py-16 px-8" style={{ backgroundColor }}>
      <div className="max-w-3xl mx-auto">
        {title && (
          <h2
            className="[font-family:'Antonio',Helvetica] font-bold text-black text-3xl lg:text-4xl tracking-[-0.25px] leading-tight mb-6 cms-rich-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(title) }}
          />
        )}
        {body && (
          <div
            className="[font-family:'Chivo',Helvetica] font-normal text-[#1d1c21] text-base lg:text-lg leading-7 tracking-[-0.25px] cms-rich-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
          />
        )}
      </div>
    </section>
  );
};
