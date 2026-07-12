import React, { useState, useEffect } from 'react';
import { websiteService } from '../../services/websiteService';
import type { Media } from '../../types/website';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Upload, Trash2, Copy, Check, AlertCircle, CheckCircle } from 'lucide-react';

export const MediaManager: React.FC = () => {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    mediaId: string;
    mediaName: string;
  }>({ show: false, mediaId: '', mediaName: '' });

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const mediaData = await websiteService.getMedia();
      setMedia(mediaData);
    } catch (error) {
      console.error('Error loading media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
          if (!allowedTypes.includes(file.type)) {
            throw new Error(`Tipo de archivo ${file.type} no soportado. Use: JPG, PNG, GIF, WebP o SVG.`);
          }

          const maxSize = 10 * 1024 * 1024;
          if (file.size > maxSize) {
            throw new Error(`El archivo ${file.name} es muy grande. Tamaño máximo: 10MB.`);
          }

          const altText = file.name.replace(/\.[^/.]+$/, "");
          const result = await websiteService.uploadMedia(file, altText);
          return { success: true, file: file.name, result };
        } catch (error: any) {
          console.error(`Error subiendo ${file.name}:`, error);
          return { success: false, file: file.name, error: error.message };
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const uploadResults = results.map(result =>
        result.status === 'fulfilled' ? result.value : { success: false, error: 'Error en la subida' }
      );

      const successful = uploadResults.filter(r => r.success);
      const failed = uploadResults.filter(r => !r.success);

      if (successful.length > 0) {
        await loadMedia();
      }

      if (failed.length === 0) {
        setUploadStatus({
          type: 'success',
          message: `¡${successful.length} archivo${successful.length > 1 ? 's subidos' : ' subido'} exitosamente!`
        });
      } else if (successful.length > 0) {
        setUploadStatus({
          type: 'error',
          message: `${successful.length} archivos subidos, pero ${failed.length} fallaron. Revisa la consola.`
        });
      } else {
        setUploadStatus({
          type: 'error',
          message: `Todas las subidas fallaron. Revisa la consola.`
        });
      }

      setTimeout(() => {
        setUploadStatus({ type: null, message: '' });
      }, 5000);
    } catch (error: any) {
      console.error('Error uploading files:', error);
      setUploadStatus({
        type: 'error',
        message: `Error subiendo archivos: ${error.message || 'Error desconocido'}`
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (mediaId: string) => {
    try {
      await websiteService.deleteMedia(mediaId);
      setMedia(media.filter(m => m.id !== mediaId));
      setDeleteConfirm({ show: false, mediaId: '', mediaName: '' });
      setUploadStatus({ type: 'success', message: '¡Archivo eliminado exitosamente!' });

      setTimeout(() => {
        setUploadStatus({ type: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error deleting media:', error);
      setUploadStatus({ type: 'error', message: 'Error al eliminar archivo. Intenta de nuevo.' });
      setDeleteConfirm({ show: false, mediaId: '', mediaName: '' });
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando medios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Biblioteca de Medios</h2>
        <div className="relative">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
            id="media-upload-input"
          />
          <Button disabled={uploading} className="flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Subiendo...' : 'Subir Imágenes'}</span>
          </Button>
        </div>
      </div>

      {uploadStatus.type && (
        <div className={`flex items-center space-x-2 p-4 rounded-md ${
          uploadStatus.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm">{uploadStatus.message}</span>
        </div>
      )}

      {media.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-500">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">No hay archivos de medios</p>
              <p className="text-sm">Sube algunos archivos para comenzar</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {media.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-square bg-gray-100 flex items-center justify-center relative overflow-hidden">
                {isImage(item.url) ? (
                  <>
                    <img
                      src={item.url}
                      alt={item.alt_text}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                      onLoad={(e) => {
                        console.log('Image loaded successfully:', item.url);
                        e.currentTarget.style.opacity = '1';
                      }}
                      onError={(e) => {
                        console.error('Image load error:', item.url);
                        console.error('Error details:', e);
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="text-center p-4">
                              <div class="w-12 h-12 bg-red-100 rounded-lg mx-auto mb-2 flex items-center justify-center">
                                <span class="text-red-600 text-xs">✗</span>
                              </div>
                              <p class="text-xs text-red-600">Error al cargar</p>
                            </div>
                          `;
                        }
                      }}
                      style={{ opacity: 0, transition: 'opacity 0.3s' }}
                    />
                  </>
                ) : (
                  <div className="text-center p-4">
                    <div className="w-12 h-12 bg-gray-300 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <span className="text-gray-600 text-xs font-medium">
                        {item.url.split('.').pop()?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {item.url.split('/').pop()}
                    </p>
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 truncate" title={item.alt_text}>
                    {item.alt_text || 'Sin texto alternativo'}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(item.url)}
                      className="flex-1 text-xs"
                    >
                      {copiedUrl === item.url ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          Copiar URL
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteConfirm({
                        show: true,
                        mediaId: item.id,
                        mediaName: item.alt_text || item.url.split('/').pop() || 'Archivo desconocido'
                      })}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eliminar Archivo</h3>
                <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              ¿Estás seguro de que quieres eliminar <strong>"{deleteConfirm.mediaName}"</strong>?
            </p>

            <div className="flex space-x-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm({ show: false, mediaId: '', mediaName: '' })}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteConfirm.mediaId)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Eliminar Archivo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
