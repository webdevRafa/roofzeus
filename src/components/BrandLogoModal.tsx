// src/components/BrandLogoModal.tsx
// Modal component to upload and update the organization's brand logo.
//
// This modal presents a simple interface that allows a user to select an
// image file from their computer, preview it, and upload it to Firebase
// Storage.  After a successful upload the organization's Firestore
// document is updated with the new `logoUrl`.  A cropped, square
// version of the image is generated on the client prior to upload to
// ensure consistent sizing across the application.

import { useState, useEffect } from "react";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

interface BrandLogoModalProps {
  /**
   * The ID of the active organization.  Images are stored under
   * `organizations/${orgId}/logo.png` in Firebase Storage and the
   * corresponding Firestore document is updated at
   * `organizations/${orgId}`.
   */
  orgId: string;
  /** The currently configured logo URL (if any) for preview. */
  currentLogoUrl?: string | null;
  /** Called when the modal should be closed. */
  onClose: () => void;
}

export default function BrandLogoModal({ orgId, currentLogoUrl, onClose }: BrandLogoModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When a file is selected update the preview URL.  Use URL.createObjectURL
  // for a temporary object URL.  Remember to revoke the object URL when
  // cleaned up to avoid memory leaks.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  }

  /**
   * Crop and resize the image to a 512×512 square.  This helper loads
   * the file into an Image, draws the central square portion onto a
   * canvas, and then exports it as a PNG blob.  The cropping logic
   * ensures the smallest dimension is used as the source size so that
   * rectangular logos are centered and cropped symmetrically.  This
   * method returns a promise that resolves with the PNG blob.
   */
  async function cropAndResizeImage(file: File): Promise<Blob> {
    const imageBitmap = await createImageBitmap(file);
    const size = Math.min(imageBitmap.width, imageBitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to obtain 2D context");
    }
    // Calculate source offsets to crop the image to the central square.
    const srcX = (imageBitmap.width - size) / 2;
    const srcY = (imageBitmap.height - size) / 2;
    ctx.drawImage(imageBitmap, srcX, srcY, size, size, 0, 0, 512, 512);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error("Failed to create image blob"));
        else resolve(blob);
      }, "image/png", 0.95);
    });
  }

  /**
   * Handle the upload process.  Creates a cropped version of the image
   * before uploading to Firebase Storage.  After upload the download
   * URL is retrieved and written back to Firestore under the org
   * document.  Basic error handling is included to surface failures.
   */
  async function handleUpload() {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      // Crop and resize the selected image.
      const blob = await cropAndResizeImage(file);
      // Define storage path: organizations/${orgId}/logo.png
      const storage = getStorage();
      const logoRef = storageRef(storage, `organizations/${orgId}/logo.png`);
      await uploadBytes(logoRef, blob);
      const downloadUrl = await getDownloadURL(logoRef);
      // Update Firestore document with the new logo URL.
      const db = getFirestore();
      const orgDoc = doc(db, "organizations", orgId);
      await updateDoc(orgDoc, { logoUrl: downloadUrl });
      // Clear local state and close modal.
      setFile(null);
      setPreview(null);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to upload logo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--color-overlay-rgb,0,0,0)/0.40)] backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-[rgb(var(--color-surface-rgb)/1)] p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold text-[rgb(var(--color-text-rgb)/0.94)]">Update Brand Logo</h2>
        <div className="space-y-4">
          {/* Preview area: shows existing or selected logo on light and dark backgrounds to help the user choose a high‑contrast image. */}
          <div className="grid grid-cols-2 gap-4">
            {/* Dark background preview */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-24 w-24 overflow-hidden rounded-md border border-[rgb(var(--color-border-rgb)/0.18)] bg-gray-800 flex items-center justify-center">
                {preview ? (
                  <img src={preview} alt="Logo preview" className="h-full w-full object-cover" />
                ) : currentLogoUrl ? (
                  <img src={currentLogoUrl} alt="Current logo preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400">No logo</span>
                )}
              </div>
              <span className="text-[11px] text-[rgb(var(--color-text-rgb)/0.75)]">Dark theme</span>
            </div>
            {/* Light background preview */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-24 w-24 overflow-hidden rounded-md border border-[rgb(var(--color-border-rgb)/0.18)] bg-white flex items-center justify-center">
                {preview ? (
                  <img src={preview} alt="Logo preview light" className="h-full w-full object-cover" />
                ) : currentLogoUrl ? (
                  <img src={currentLogoUrl} alt="Current logo preview light" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400">No logo</span>
                )}
              </div>
              <span className="text-[11px] text-[rgb(var(--color-text-rgb)/0.75)]">Light theme</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              aria-label="Choose brand logo"
              className="text-sm text-[rgb(var(--color-text-rgb)/0.85)]"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] px-4 py-2 text-sm font-medium text-[rgb(var(--color-text-rgb)/0.85)] hover:bg-[rgb(var(--color-surface-rgb)/0.70)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!file || uploading}
              onClick={handleUpload}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 disabled:opacity-60"
            >
              {uploading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}