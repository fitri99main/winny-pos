import { supabase } from './supabase';

export class ImageStorageService {
    private static BUCKET = 'product-images';

    /**
     * Upload an image to Supabase Storage from a local URI (React Native)
     */
    static async uploadImage(uri: string): Promise<string> {
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.jpg`;
        const filePath = `${fileName}`;

        // Reliable way to upload in React Native: fetch the URI as a Blob
        const response = await fetch(uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
            .from(this.BUCKET)
            .upload(filePath, blob, {
                contentType: 'image/jpeg'
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from(this.BUCKET)
            .getPublicUrl(filePath);

        return publicUrl;
    }

    /**
     * Delete an image from Supabase Storage by its public URL
     */
    static async deleteImage(url: string | null | undefined): Promise<void> {
        if (!url) return;

        try {
            // Extract the filename from the public URL
            const parts = url.split('/');
            const fileName = parts[parts.length - 1];

            if (!fileName) return;

            const { error } = await supabase.storage
                .from(this.BUCKET)
                .remove([fileName]);

            if (error) {
                console.warn('Failed to delete image from storage:', error);
            }
        } catch (error) {
            console.error('Error parsing image URL for deletion:', error);
        }
    }

    /**
     * Replace an old image with a new one from a URI
     */
    static async replaceImage(oldUrl: string | null | undefined, newUri: string): Promise<string> {
        // 1. Delete old image if it exists
        if (oldUrl) {
            await this.deleteImage(oldUrl);
        }

        // 2. Upload new image
        return await this.uploadImage(newUri);
    }
}
