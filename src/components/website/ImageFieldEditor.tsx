import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { websiteService } from '../../services/websiteService';
import type { Media } from '../../types/website';

interface ImageFieldEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  media: Media[];
  onMediaLibraryRefresh: () => void;
}

export const ImageFieldEditor: React.FC<ImageFieldEditorProps> = ({
  value,
  onChange,
  label,
  media,
  onMediaLibraryRefresh
}) => {
  const [uploading, setUploading] = useState(false);
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Por favor selecciona un archivo de imagen');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('El archivo debe ser menor a 10MB');
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);
    setUploading(true);

    try {
      const altText = file.name.replace(/\.[^/.]+$/, '').replace(/-|_/g, ' ');
      const result = await websiteService.uploadMedia(file, altText);

      onChange(result.url);
      setUploadSuccess(true);
      setImageError(false);

      await onMediaLibraryRefresh();

      setTimeout(() => {
        setUploadSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setUploadError(error.message || 'Error al subir la imagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectFromLibrary = (mediaUrl: string) => {
    onChange(mediaUrl);
    setShowMediaSelector(false);
    setImageError(false);
  };

  const handleRemoveImage = () => {
    onChange('');
    setImageError(false);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      {value && !imageError ? (
        <div className="relative group">
          <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
            <img
              src={value}
              alt={label}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          </div>

          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowMediaSelector(true)}
            >
              <ImageIcon className="w-4 h-4 mr-1" />
              Cambiar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-1" />
              Subir Nueva
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleRemoveImage}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
          <div className="text-center">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm text-gray-600 mb-4">
              No hay imagen seleccionada
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-1" />
                    Subir Imagen
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowMediaSelector(true)}
              >
                <ImageIcon className="w-4 h-4 mr-1" />
                Seleccionar de Biblioteca
              </Button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {uploadError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploadSuccess && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>Imagen subida exitosamente</span>
        </div>
      )}

      {showMediaSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Seleccionar Imagen</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Elige una imagen de tu biblioteca de medios
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMediaSelector(false)}
                >
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {media.filter(item => item.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg mb-2">No hay imágenes en la biblioteca</p>
                  <p className="text-sm">Sube algunas imágenes primero usando el botón "Subir Imagen"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {media
                    .filter(item => item.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
                    .map((item) => (
                      <div
                        key={item.id}
                        className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded-lg overflow-hidden transition-all bg-gray-50 hover:shadow-lg"
                        onClick={() => handleSelectFromLibrary(item.url)}
                      >
                        <div className="aspect-square bg-gray-100 relative">
                          <img
                            src={item.url}
                            alt={item.alt_text}
                            className="w-full h-full object-cover"
                          />
                          {value === item.url && (
                            <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-xs text-gray-600 truncate">
                            {item.alt_text || 'Sin texto alternativo'}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {media.filter(item => item.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length} imágenes disponibles
                </p>
                <Button
                  variant="outline"
                  onClick={() => setShowMediaSelector(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
