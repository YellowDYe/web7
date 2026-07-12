import React from 'react';
import { Button } from '../ui/button';
import { Plus, Trash2, MousePointerClick } from 'lucide-react';
import { ImageFieldEditor } from './ImageFieldEditor';
import type { Media } from '../../types/website';

interface ContentFieldRendererProps {
  content: Record<string, any>;
  onContentChange: (key: string, value: any) => void;
  onNestedContentChange: (parentKey: string, childKey: string, value: any) => void;
  onArrayContentChange: (key: string, index: number, field: string, value: any) => void;
  onAddArrayItem: (key: string, defaultItem: any) => void;
  onRemoveArrayItem: (key: string, index: number) => void;
  media: Media[];
  onMediaLibraryRefresh: () => void;
}

function renderMacrosEditor(
  macros: { title: string; columns: { header: string; percentage: string; percentageBgColor?: string }[]; macrosEnabled?: boolean },
  onMacrosTitleChange: (val: string) => void,
  onColumnChange: (colIndex: number, field: string, val: string) => void,
  onMacrosEnabledChange: (val: boolean) => void
) {
  const isEnabled = macros.macrosEnabled !== false;

  return (
    <div className="space-y-3 border border-gray-200 rounded-md p-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Macros Section</label>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => onMacrosEnabledChange(!isEnabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            isEnabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              isEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {isEnabled && (
        <>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Macros Title</label>
            <input
              type="text"
              value={macros.title ?? 'Macros'}
              onChange={(e) => onMacrosTitleChange(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          {(macros.columns ?? []).map((col, colIdx) => (
            <div key={colIdx} className="space-y-2 p-2 bg-white rounded border border-gray-100">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Header {colIdx + 1}</label>
                  <input
                    type="text"
                    value={col.header ?? ''}
                    onChange={(e) => onColumnChange(colIdx, 'header', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Percentage</label>
                  <input
                    type="text"
                    value={col.percentage ?? ''}
                    onChange={(e) => onColumnChange(colIdx, 'percentage', e.target.value)}
                    placeholder="50%"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Circle Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(col.percentageBgColor ?? '') ? col.percentageBgColor! : '#ffffff'}
                    onChange={(e) => onColumnChange(colIdx, 'percentageBgColor', e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border border-gray-300 flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={col.percentageBgColor ?? ''}
                    onChange={(e) => onColumnChange(colIdx, 'percentageBgColor', e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono"
                  />
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function isValidCssColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ||
    /^rgba?\(/.test(value) ||
    /^hsla?\(/.test(value) ||
    /^[a-zA-Z]+$/.test(value);
}

function isButtonTextField(key: string): boolean {
  return key === 'buttonText' || key.endsWith('ButtonText');
}

function getButtonLinkKey(textKey: string): string {
  if (textKey === 'buttonText') return 'buttonLink';
  return textKey.replace(/Text$/, 'Link');
}

function getButtonLabel(textKey: string): string {
  if (textKey === 'buttonText') return 'Button';
  const prefix = textKey.replace(/ButtonText$/, '');
  return prefix.charAt(0).toUpperCase() + prefix.slice(1) + ' Button';
}

export const ContentFieldRenderer: React.FC<ContentFieldRendererProps> = ({
  content,
  onContentChange,
  onNestedContentChange,
  onArrayContentChange,
  onAddArrayItem,
  onRemoveArrayItem,
  media,
  onMediaLibraryRefresh
}) => {
  const renderColorField = (
    key: string,
    value: string,
    onChange: (val: string) => void
  ) => {
    const pickerHex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000';
    const isValid = isValidCssColor(value);

    const handleTextBlur = (raw: string) => {
      const trimmed = raw.trim();
      if (!isValidCssColor(trimmed)) {
        onChange(/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#000000');
      }
    };

    return (
      <>
        <label className="block text-sm font-medium text-gray-700">
          {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={pickerHex}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-gray-300"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => handleTextBlur(e.target.value)}
            className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
              isValid ? 'border-gray-300' : 'border-red-400 bg-red-50'
            }`}
            placeholder="#000000"
          />
        </div>
        {!isValid && (
          <p className="text-xs text-red-500">
            Valor inválido. Use formato hex (#ffffff) o nombre de color CSS.
          </p>
        )}
      </>
    );
  };

  const renderButtonGroup = (
    textKey: string,
    textValue: string,
    linkValue: string,
    onTextChange: (val: string) => void,
    onLinkChange: (val: string) => void
  ) => {
    const isActive = textValue !== '' || linkValue !== '';
    const label = getButtonLabel(textKey);

    const handleToggle = (checked: boolean) => {
      if (!checked) {
        onTextChange('');
        onLinkChange('');
      } else {
        onTextChange('Button');
        onLinkChange('');
      }
    };

    return (
      <div className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => handleToggle(!isActive)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
              isActive ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                isActive ? 'translate-x-4.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {isActive && (
          <div className="space-y-2 pt-1">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Button Text</label>
              <input
                type="text"
                value={textValue}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="Button label"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Button Link</label>
              <input
                type="text"
                value={linkValue}
                onChange={(e) => onLinkChange(e.target.value)}
                placeholder="/page or https://..."
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderField = (key: string, value: any, parentKey?: string) => {
    if (isButtonTextField(key) && typeof value === 'string') {
      const linkKey = getButtonLinkKey(key);
      const linkValue = parentKey
        ? (content[parentKey] as Record<string, any>)?.[linkKey] ?? ''
        : content[linkKey] ?? '';

      return (
        <div key={key} className="space-y-2">
          {renderButtonGroup(
            key,
            value,
            String(linkValue),
            (val) => parentKey
              ? onNestedContentChange(parentKey, key, val)
              : onContentChange(key, val),
            (val) => parentKey
              ? onNestedContentChange(parentKey, linkKey, val)
              : onContentChange(linkKey, val)
          )}
        </div>
      );
    }

    const isButtonLinkKey = (k: string) =>
      (k === 'buttonLink' || k.endsWith('ButtonLink'));

    if (isButtonLinkKey(key)) {
      const textKey = key === 'buttonLink' ? 'buttonText' : key.replace(/Link$/, 'Text');
      if (content[textKey] !== undefined || (parentKey && (content[parentKey] as any)?.[textKey] !== undefined)) {
        return null;
      }
    }

    if (typeof value === 'string') {
      return (
        <div key={key} className="space-y-2">
          {key.toLowerCase().includes('image') ? (
            <ImageFieldEditor
              value={value}
              onChange={(newValue) => parentKey
                ? onNestedContentChange(parentKey, key, newValue)
                : onContentChange(key, newValue)
              }
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              media={media}
              onMediaLibraryRefresh={onMediaLibraryRefresh}
            />
          ) : key.toLowerCase().endsWith('color') ? (
            renderColorField(
              key,
              value,
              (val) => parentKey
                ? onNestedContentChange(parentKey, key, val)
                : onContentChange(key, val)
            )
          ) : key.includes('description') || key.includes('content') ? (
            <>
              <label className="block text-sm font-medium text-gray-700">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              <textarea
                value={value}
                onChange={(e) => parentKey
                  ? onNestedContentChange(parentKey, key, e.target.value)
                  : onContentChange(key, e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => parentKey
                  ? onNestedContentChange(parentKey, key, e.target.value)
                  : onContentChange(key, e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </>
          )}
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <div key={key} className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => parentKey
                ? onNestedContentChange(parentKey, key, e.target.checked)
                : onContentChange(key, e.target.checked)
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          </label>
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </label>
          <div className="space-y-3 border border-gray-200 rounded-md p-3">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-600">Items ({value.length})</span>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  let defaultItem;
                  if (key === 'navigationItems') {
                    defaultItem = { label: 'Nueva Página', href: '/new-page', active: false };
                  } else if (key === 'cards') {
                    defaultItem = {
                      id: `item-${Date.now()}`,
                      title: 'Nueva Tarjeta',
                      description: 'Card description',
                      backgroundColor: 'bg-white',
                      buttonText: '',
                      buttonLink: '',
                      imageUrl: ''
                    };
                  } else if (key === 'steps') {
                    defaultItem = {
                      id: `step-${Date.now()}`,
                      number: (value.length + 1).toString(),
                      title: 'Nuevo Paso',
                      description: 'Step description'
                    };
                  } else if (key === 'benefits') {
                    defaultItem = {
                      id: `benefit-${Date.now()}`,
                      title: 'Nuevo Beneficio',
                      description: 'Benefit description',
                      highlighted: false
                    };
                  } else if (key === 'items') {
                    defaultItem = {
                      id: `item-${Date.now()}`,
                      title: 'Nuevo Item',
                      description: 'Item description',
                      imageUrl: '',
                      imageAlt: 'New item image',
                      category: ''
                    };
                  } else if (key === 'images') {
                    defaultItem = {
                      id: `image-${Date.now()}`,
                      imageUrl: '',
                      imageAlt: 'Nueva imagen',
                      description: 'Image description',
                      order: value.length
                    };
                  } else if (key === 'faqItems') {
                    defaultItem = {
                      id: `faq-${Date.now()}`,
                      question: 'Nueva pregunta',
                      answer: 'Escribe aquí la respuesta a esta pregunta.'
                    };
                  } else if (key === 'slides') {
                    defaultItem = {
                      id: `slide-${Date.now()}`,
                      title: 'Nuevo Slide',
                      description: 'Descripción del slide.',
                      buttonText: '',
                      buttonLink: '',
                      leftBackgroundColor: '#ffcfe3',
                      rightBackgroundImage: ''
                    };
                  } else {
                    defaultItem = { id: `item-${Date.now()}`, name: 'Nuevo Item' };
                  }
                  onAddArrayItem(key, defaultItem);
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Item
              </Button>
            </div>
            {value.map((item, index) => (
              <div key={index} className="space-y-2 p-3 bg-gray-50 rounded">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm font-medium text-gray-600">Item {index + 1}</div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveArrayItem(key, index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                {typeof item === 'object' && item !== null ? (
                  (() => {
                    const entries = Object.entries(item);
                    const skipKeys = new Set<string>();
                    entries.forEach(([itemKey]) => {
                      if (isButtonTextField(itemKey)) {
                        skipKeys.add(getButtonLinkKey(itemKey));
                      }
                    });

                    return entries.map(([itemKey, itemValue]) => {
                      if (skipKeys.has(itemKey)) return null;

                      if (isButtonTextField(itemKey) && typeof itemValue === 'string') {
                        const linkKey = getButtonLinkKey(itemKey);
                        const linkVal = (item as Record<string, any>)[linkKey] ?? '';
                        return (
                          <div key={itemKey}>
                            {renderButtonGroup(
                              itemKey,
                              itemValue,
                              String(linkVal),
                              (val) => onArrayContentChange(key, index, itemKey, val),
                              (val) => onArrayContentChange(key, index, linkKey, val)
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={itemKey}>
                          {itemKey === 'macros' && typeof itemValue === 'object' && itemValue !== null ? (
                            <>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Macros</label>
                              {renderMacrosEditor(
                                itemValue as { title: string; columns: { header: string; percentage: string; percentageBgColor?: string }[]; macrosEnabled?: boolean },
                                (val) => onArrayContentChange(key, index, 'macros', { ...itemValue, title: val }),
                                (colIdx, field, val) => {
                                  const updatedColumns = [...(itemValue.columns ?? [])];
                                  updatedColumns[colIdx] = { ...updatedColumns[colIdx], [field]: val };
                                  onArrayContentChange(key, index, 'macros', { ...itemValue, columns: updatedColumns });
                                },
                                (val) => onArrayContentChange(key, index, 'macros', { ...itemValue, macrosEnabled: val })
                              )}
                            </>
                          ) : itemKey.toLowerCase().includes('image') ? (
                            <ImageFieldEditor
                              value={String(itemValue)}
                              onChange={(newValue) => onArrayContentChange(key, index, itemKey, newValue)}
                              label={itemKey.charAt(0).toUpperCase() + itemKey.slice(1)}
                              media={media}
                              onMediaLibraryRefresh={onMediaLibraryRefresh}
                            />
                          ) : itemKey === 'active' && typeof itemValue === 'boolean' ? (
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={itemValue}
                                onChange={(e) => onArrayContentChange(key, index, itemKey, e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-600">Active</span>
                            </label>
                          ) : typeof itemValue === 'string' && itemKey.toLowerCase().endsWith('color') ? (
                            <div className="space-y-1">
                              {renderColorField(
                                itemKey,
                                itemValue,
                                (val) => onArrayContentChange(key, index, itemKey, val)
                              )}
                            </div>
                          ) : typeof itemValue === 'string' ? (
                            <>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                {itemKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                              </label>
                              <input
                                type="text"
                                value={itemValue}
                                onChange={(e) => onArrayContentChange(key, index, itemKey, e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </>
                          ) : (
                            <input
                              type="text"
                              value={JSON.stringify(itemValue)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  onArrayContentChange(key, index, itemKey, parsed);
                                } catch {
                                  onArrayContentChange(key, index, itemKey, e.target.value);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          )}
                        </div>
                      );
                    });
                  })()
                ) : (
                  <input
                    type="text"
                    value={String(item)}
                    onChange={(e) => {
                      const newArray = [...value];
                      newArray[index] = e.target.value;
                      onContentChange(key, newArray);
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                )}
              </div>
            ))}
            {value.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                No items yet. Click "Add Item" to create the first one.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </label>
          <div className="space-y-3 border border-gray-200 rounded-md p-3">
            {Object.entries(value).map(([subKey, subValue]) =>
              renderField(subKey, subValue, key)
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={key} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </label>
        <input
          type="text"
          value={String(value)}
          onChange={(e) => onContentChange(key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  };

  const keys = Object.keys(content);
  const skipTopLevel = new Set<string>();
  keys.forEach((k) => {
    if (isButtonTextField(k)) {
      skipTopLevel.add(getButtonLinkKey(k));
    }
  });

  return (
    <div className="space-y-4">
      {keys.map((key) => {
        if (skipTopLevel.has(key)) return null;
        return renderField(key, content[key]);
      })}
    </div>
  );
};
