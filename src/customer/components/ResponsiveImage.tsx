import React, { useState } from 'react';
import { buildSrcSet, getResizedImageUrl } from '../../utils/imageHelper';

interface ResponsiveImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string;
  widths: number[];
  sizes: string;
  quality?: number;
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  widths,
  sizes,
  quality,
  onError,
  ...rest
}) => {
  const [useOriginal, setUseOriginal] = useState(false);
  const srcSet = useOriginal ? undefined : buildSrcSet(src, widths, quality);
  const fallbackWidth = widths[Math.floor(widths.length / 2)];
  const resolvedSrc = useOriginal || !srcSet ? src : getResizedImageUrl(src, fallbackWidth, quality);

  return (
    <img
      {...rest}
      src={resolvedSrc}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      decoding={rest.decoding ?? 'async'}
      onError={(e) => {
        if (!useOriginal && srcSet) {
          setUseOriginal(true);
          return;
        }
        onError?.(e);
      }}
    />
  );
};
