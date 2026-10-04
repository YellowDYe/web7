import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  ORDER_PAGE_DEFAULT_CONTENT,
  ORDER_PAGE_EDITOR_SECTIONS,
} from '../../customer/sections/CustomerOrder/orderPageContent';

interface OrderPageContentEditorProps {
  content: Record<string, any>;
  onContentChange: (key: string, value: any) => void;
}

export const OrderPageContentEditor: React.FC<OrderPageContentEditorProps> = ({ content, onContentChange }) => {
  const [openSection, setOpenSection] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Si dejas un campo vacío, se mostrará el texto original.
      </p>
      {ORDER_PAGE_EDITOR_SECTIONS.map((section, index) => {
        const isOpen = openSection === index;
        return (
          <div key={section.title} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenSection(isOpen ? null : index)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <span className="font-medium text-gray-800 text-sm">{section.title}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="p-3 space-y-3">
                {section.toggles?.map(toggle => {
                  const value = typeof content[toggle.key] === 'boolean'
                    ? content[toggle.key]
                    : ORDER_PAGE_DEFAULT_CONTENT[toggle.key];
                  return (
                    <div key={toggle.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-800 text-sm">{toggle.label}</span>
                      <button
                        type="button"
                        onClick={() => onContentChange(toggle.key, !value)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          value ? 'bg-green-500 focus:ring-green-400' : 'bg-gray-300 focus:ring-gray-400'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          value ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  );
                })}

                {section.texts.map(field => {
                  const value = typeof content[field.key] === 'string' ? content[field.key] : '';
                  const placeholder = ORDER_PAGE_DEFAULT_CONTENT[field.key];
                  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
                  return (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
                      {field.multiline ? (
                        <textarea
                          value={value}
                          placeholder={placeholder}
                          rows={3}
                          onChange={e => onContentChange(field.key, e.target.value)}
                          className={inputClass}
                        />
                      ) : (
                        <input
                          type="text"
                          value={value}
                          placeholder={placeholder}
                          onChange={e => onContentChange(field.key, e.target.value)}
                          className={inputClass}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
