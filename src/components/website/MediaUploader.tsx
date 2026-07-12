import React, { useState } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { websiteService } from '../../services/websiteService';

interface MediaUploaderProps {
  onUploadComplete?: (mediaId: string, url: string) => void;
  accept?: string;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  onUploadComplete,
  accept = 'image/*'
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      const errorMsg = 'Por favor selecciona un archivo de imagen';
      console.error('Invalid file type:', file.type);
      setError(errorMsg);
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      const errorMsg = 'El archivo debe ser menor a 10MB';
      console.error('File too large:', file.size);
      setError(errorMsg);
      return;
    }

    setError(null);
    setSuccess(false);
    setUploading(true);
    console.log('Starting upload process...');

    try {
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('User authentication:', user ? `Authenticated as ${user.email}` : 'Not authenticated');

      if (authError || !user) {
        throw new Error('Debes iniciar sesión para subir imágenes');
      }

      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      console.log('Preview created');

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;
      console.log('Uploading to storage:', filePath);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('website-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Error al subir archivo: ${uploadError.message}`);
      }

      console.log('File uploaded to storage successfully:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('website-media')
        .getPublicUrl(filePath);

      console.log('Public URL generated:', publicUrl);

      // Save to cms_media table
      const altText = file.name.replace(/\.[^/.]+$/, '').replace(/-|_/g, ' ');
      console.log('Saving to cms_media table...');

      const media = await websiteService.createMedia({
        url: publicUrl,
        alt_text: altText
      });

      console.log('Media record created:', media);

      setSuccess(true);
      setUploading(false);

      if (onUploadComplete) {
        console.log('Calling onUploadComplete callback');
        onUploadComplete(media.id, publicUrl);
      }

      // Clear preview after 2 seconds
      setTimeout(() => {
        setSuccess(false);
        setPreview(null);
        URL.revokeObjectURL(objectUrl);
        // Reset the file input
        event.target.value = '';
        console.log('Upload complete, UI reset');
      }, 2000);

    } catch (err: any) {
      console.error('Upload error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
        fullError: err
      });

      let errorMessage = 'Error al subir la imagen';

      if (err.message.includes('autenticación') || err.message.includes('iniciar sesión')) {
        errorMessage = err.message;
      } else if (err.message.includes('bucket')) {
        errorMessage = 'Error de configuración del almacenamiento. Contacta al administrador.';
      } else if (err.message.includes('permission') || err.message.includes('policy')) {
        errorMessage = 'No tienes permisos para subir imágenes';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setUploading(false);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
    }
  };

  return (
    <div className="w-full">
      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="max-h-40 rounded-lg"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
              {success && (
                <div className="absolute inset-0 bg-green-500 bg-opacity-75 flex items-center justify-center rounded-lg">
                  <Check className="w-12 h-12 text-white" />
                </div>
              )}
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-gray-500">PNG, JPG, GIF, SVG, WebP (MAX. 10MB)</p>
            </>
          )}
        </div>
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading}
        />
      </label>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && !preview && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>Image uploaded successfully!</span>
        </div>
      )}
    </div>
  );
};
