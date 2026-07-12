import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, MessageCircle } from 'lucide-react';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQProps {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  accentColor?: string;
  faqItems?: FaqItem[];
  contactTitle?: string;
  contactDescription?: string;
  contactButtonText?: string;
  contactButtonLink?: string;
}

const defaultFaqItems: FaqItem[] = [
  {
    id: 'faq-1',
    question: '¿Cómo funciona el servicio?',
    answer: 'Nuestro servicio es completamente personalizado. Seleccionas tu plan alimenticio, nosotros preparamos tus comidas con ingredientes frescos y te las entregamos en la puerta de tu casa cada semana.'
  },
  {
    id: 'faq-2',
    question: '¿Puedo personalizar mis comidas según mis restricciones alimenticias?',
    answer: 'Sí, absolutamente. Al momento de registrarte puedes indicar alergias, intolerancias o preferencias alimenticias (vegetariano, vegano, sin gluten, etc.) y nuestro equipo las tomará en cuenta en cada preparación.'
  },
  {
    id: 'faq-3',
    question: '¿Con qué frecuencia se realizan las entregas?',
    answer: 'Las entregas se realizan semanalmente. Puedes elegir el día y horario que mejor se adapte a tu agenda al momento de realizar tu pedido.'
  },
  {
    id: 'faq-4',
    question: '¿Qué pasa si necesito cancelar o pausar mi plan?',
    answer: 'Puedes cancelar o pausar tu suscripción en cualquier momento desde tu perfil de cuenta. Solo es necesario hacerlo antes del cierre de pedidos de la semana siguiente.'
  },
  {
    id: 'faq-5',
    question: '¿Los ingredientes son frescos o congelados?',
    answer: 'Todos nuestros ingredientes son frescos y de temporada. Trabajamos con proveedores locales para garantizar la máxima calidad y frescura en cada platillo.'
  }
];

const AccordionItem: React.FC<{
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  accentColor: string;
}> = ({ item, isOpen, onToggle, accentColor }) => {
  return (
    <div
      className={`border-b border-gray-200 transition-all duration-200 ${
        isOpen ? 'bg-gray-50/60' : 'bg-white hover:bg-gray-50/40'
      }`}
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left focus:outline-none group"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span
          className="[font-family:'Chivo',Helvetica] font-semibold text-[#1e1e1e] text-base md:text-lg leading-snug flex-1 tracking-[-0.01em] group-hover:text-gray-700 transition-colors"
        >
          {item.question}
        </span>
        <span
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
          style={{ backgroundColor: isOpen ? accentColor : 'transparent', border: `2px solid ${accentColor}` }}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
            style={{ color: isOpen ? '#1e1e1e' : accentColor }}
          />
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 pb-6">
          <p className="[font-family:'Inria_Serif',Helvetica] font-normal text-[#555555] text-base leading-[1.7] tracking-[-0.01em]">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
};

export const FAQ: React.FC<FAQProps> = ({
  title = 'PREGUNTAS FRECUENTES',
  subtitle = 'Todo lo que necesitas saber sobre nuestro servicio',
  backgroundColor = '#ffffff',
  accentColor = '#bfd730',
  faqItems = defaultFaqItems,
  contactTitle = "¿No encontraste lo que buscabas?",
  contactDescription = 'Nuestro equipo está listo para ayudarte con cualquier pregunta o duda que tengas.',
  contactButtonText = 'Contáctanos',
  contactButtonLink = '/contacto'
}) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return faqItems;
    const q = searchQuery.toLowerCase();
    return faqItems.filter(
      (item) =>
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
    );
  }, [faqItems, searchQuery]);

  const handleToggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="w-full py-14 md:py-24 px-5 md:px-8 rounded-[45px]" style={{ backgroundColor }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-4xl lg:text-5xl tracking-[-0.02em] leading-tight mb-4">
            {title}
          </h2>
          <p className="[font-family:'Chivo',Helvetica] font-medium text-[#555555] text-base md:text-lg leading-relaxed tracking-[-0.01em]">
            {subtitle}
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar pregunta..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpenId(null);
            }}
            className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[#1e1e1e] [font-family:'Chivo',Helvetica] text-sm md:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-sm"
            style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
          )}
        </div>

        {/* Accordion */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <AccordionItem
                key={item.id}
                item={item}
                isOpen={openId === item.id}
                onToggle={() => handleToggle(item.id)}
                accentColor={accentColor}
              />
            ))
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="[font-family:'Chivo',Helvetica] text-gray-400 text-base">
                No se encontraron preguntas para "{searchQuery}"
              </p>
            </div>
          )}
        </div>

        {/* Result count hint when searching */}
        {searchQuery && filteredItems.length > 0 && (
          <p className="mt-3 text-center [font-family:'Chivo',Helvetica] text-sm text-gray-400">
            {filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''} encontrado{filteredItems.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Contact section */}
        <div
          className="mt-12 rounded-2xl p-8 md:p-10 text-center border border-gray-100"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-5"
            style={{ backgroundColor: accentColor }}
          >
            <MessageCircle className="w-6 h-6 text-[#1e1e1e]" />
          </div>
          <h3 className="[font-family:'Antonio',Helvetica] font-bold text-[#1e1e1e] text-2xl md:text-3xl tracking-[-0.02em] mb-3">
            {contactTitle}
          </h3>
          <p className="[font-family:'Inria_Serif',Helvetica] text-[#555555] text-base md:text-lg leading-relaxed mb-7 max-w-md mx-auto">
            {contactDescription}
          </p>
          {contactButtonLink ? (
            <a
              href={contactButtonLink}
              target={contactButtonLink.startsWith('http') ? '_blank' : undefined}
              rel={contactButtonLink.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center justify-center h-auto rounded-[100px] border border-solid border-black text-black text-base [font-family:'Chivo',Helvetica] font-semibold px-8 py-3.5 hover:opacity-80 active:scale-95 transition-all duration-200 no-underline cursor-pointer select-none"
              style={{ backgroundColor: accentColor }}
            >
              {contactButtonText}
            </a>
          ) : (
            <button
              className="inline-flex items-center justify-center h-auto rounded-[100px] border border-solid border-black text-black text-base [font-family:'Chivo',Helvetica] font-semibold px-8 py-3.5 hover:opacity-80 active:scale-95 transition-all duration-200 cursor-pointer select-none"
              style={{ backgroundColor: accentColor }}
            >
              {contactButtonText}
            </button>
          )}
        </div>

      </div>
    </section>
  );
};
