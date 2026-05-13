import * as SupabaseLib from './supabase';
var supabase = SupabaseLib.supabase;

export var ImageStorageService = {
    BUCKET: 'product-images',

    /**
     * Upload an image to Supabase Storage from a local URI (React Native)
     */
    uploadImage: function(uri) {
        var self = this;
        var randomPart = Math.random().toString(36).substring(2);
        var fileName = randomPart + "-" + Date.now() + ".jpg";
        var filePath = fileName;

        return fetch(uri).then(function(response) {
            return response.blob();
        }).then(function(blob) {
            return supabase.storage
                .from(self.BUCKET)
                .upload(filePath, blob, {
                    contentType: 'image/jpeg'
                });
        }).then(function(res) {
            if (res.error) throw res.error;

            var publicRes = supabase.storage
                .from(self.BUCKET)
                .getPublicUrl(filePath);

            return publicRes.data.publicUrl;
        });
    },

    /**
     * Delete an image from Supabase Storage by its public URL
     */
    deleteImage: function(url) {
        var self = this;
        if (!url) return Promise.resolve();

        try {
            var parts = url.split('/');
            var fileName = parts[parts.length - 1];

            if (!fileName) return Promise.resolve();

            return supabase.storage
                .from(self.BUCKET)
                .remove([fileName]).then(function(res) {
                    if (res.error) {
                        console.warn('Failed to delete image from storage:', res.error);
                    }
                });
        } catch (error) {
            console.error('Error parsing image URL for deletion:', error);
            return Promise.resolve();
        }
    },

    /**
     * Replace an old image with a new one from a URI
     */
    replaceImage: function(oldUrl, newUri) {
        var self = this;
        var cleanupPromise = oldUrl ? this.deleteImage(oldUrl) : Promise.resolve();
        
        return cleanupPromise.then(function() {
            return self.uploadImage(newUri);
        });
    }
};
