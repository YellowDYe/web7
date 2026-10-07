import React, { useState } from 'react';
import { MapPin, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';
import { supabase } from '../../../config/supabase';

interface PostalCodeValidatorProps {
  title?: string;
  instructionText?: string;
  successMessage?: string;
  notFoundMessage?: string;
  backgroundColor?: string;
}

export const PostalCodeValidator: React.FC<PostalCodeValidatorProps> = ({
  title = '',
  instructionText = '',
  successMessage = 'Si tenemos entregas en tu zona',
  notFoundMessage = 'No tenemos entregas en tu zona',
  backgroundColor = '#ffffff',
}) => {
  const [postalCode, setPostalCode] = useState('');
  const [result, setResult] = useState<'found' | 'not_found' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    const code = postalCode.trim();
    if (!code) return;

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('id')
        .eq('postal_code', code)
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;

      setResult(data && data.length > 0 ? 'found' : 'not_found');
    } catch {
      setResult('not_found');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleValidate();
    }
  };

  return (
    <section className="w-full py-10 md:py-16 px-8" style={{ backgroundColor }}>
      <div className="max-w-xl mx-auto text-center">
        {title && (
          <h2
            className="[font-family:'Antonio',Helvetica] font-bold text-black text-3xl lg:text-4xl tracking-[-0.25px] leading-tight mb-4 cms-rich-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(title) }}
          />
        )}
        {instructionText && (
          <div
            className="[font-family:'Chivo',Helvetica] font-normal text-[#1d1c21] text-base lg:text-lg leading-7 tracking-[-0.25px] mb-6 cms-rich-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(instructionText) }}
          />
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <div className="relative flex-1 max-w-xs mx-auto sm:mx-0">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu codigo postal"
              maxLength={10}
              inputMode="numeric"
              className="w-full pl-11 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              disabled={loading}
            />
          </div>
          <button
            onClick={handleValidate}
            disabled={loading || !postalCode.trim()}
            className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Validando...
              </span>
            ) : (
              'Validar'
            )}
          </button>
        </div>

        {result === 'found' && (
          <div className="mt-6 flex items-center justify-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
            <span
              className="[font-family:'Chivo',Helvetica] font-medium text-green-800 text-base lg:text-lg cms-rich-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(successMessage) }}
            />
          </div>
        )}

        {result === 'not_found' && (
          <div className="mt-6 flex items-center justify-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <span
              className="[font-family:'Chivo',Helvetica] font-medium text-red-800 text-base lg:text-lg cms-rich-content"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(notFoundMessage) }}
            />
          </div>
        )}
      </div>
    </section>
  );
};
