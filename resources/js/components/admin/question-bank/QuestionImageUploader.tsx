import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Link as LinkIcon, X, Maximize2, Loader2, CheckCircle2 } from 'lucide-react';
import { getAdminAuthHeaders } from '@/services/AdminOfflineService';

interface QuestionImageUploaderProps {
    imageUrl: string | null | undefined;
    onChange: (url: string | null) => void;
    showToast?: (text: string, type?: 'success' | 'error') => void;
    label?: string;
    description?: string;
}

export default function QuestionImageUploader({
    imageUrl,
    onChange,
    showToast,
    label = 'Question Diagram / Figure (Optional)',
    description = 'Attach an illustration, graph, or diagram to this question.',
}: QuestionImageUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
    const [urlInput, setUrlInput] = useState(imageUrl || '');
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (imageUrl) {
            setUrlInput(imageUrl);
        }
    }, [imageUrl]);

    // Handle file upload (online API with offline base64 fallback)
    const processFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            showToast?.('Please upload a valid image file (PNG, JPG, WEBP, SVG)', 'error');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast?.('Image file exceeds 5MB size limit', 'error');
            return;
        }

        setIsUploading(true);

        // Attempt online upload to storage endpoint
        try {
            const formData = new FormData();
            formData.append('image', file);

            const headers = getAdminAuthHeaders();
            delete headers['Content-Type']; // Let browser set multipart boundary

            const res = await fetch('/api/v1/admin/questions/upload-image', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                if (data.url) {
                    onChange(data.url);
                    setUrlInput(data.url);
                    showToast?.('Diagram uploaded successfully', 'success');
                    setIsUploading(false);
                    return;
                }
            }
        } catch (err) {
            console.warn('Online upload unavailable, falling back to local base64 DataURL for offline mode...', err);
        }

        // Offline / client fallback: convert file to Base64 Data URL so it works offline and survives in Dexie!
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
                onChange(result);
                setUrlInput(result);
                showToast?.('Diagram saved locally (Offline mode)', 'success');
            }
            setIsUploading(false);
        };
        reader.onerror = () => {
            showToast?.('Failed to read image file', 'error');
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
        // Reset file input so user can pick the same file again if desired
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Drag and drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    // Listen for clipboard paste (Ctrl+V / Cmd+V screenshot pasting)
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    processFile(file);
                    showToast?.('Pasted image detected and attached', 'success');
                    break;
                }
            }
        }
    };

    const handleApplyUrl = () => {
        if (!urlInput.trim()) {
            onChange(null);
            return;
        }
        onChange(urlInput.trim());
        showToast?.('Image URL linked to question', 'success');
    };

    const handleRemove = () => {
        onChange(null);
        setUrlInput('');
    };

    return (
        <div
            ref={containerRef}
            onPaste={handlePaste}
            className="rounded-2xl p-4 bg-[var(--color-background)] border border-[var(--color-border)] space-y-3 transition-colors"
        >
            <div className="flex items-center justify-between">
                <div>
                    <label className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        {label}
                    </label>
                    <p className="text-[10px] text-[var(--color-muted)]">{description}</p>
                </div>

                {!imageUrl && (
                    <div className="flex items-center gap-1 bg-[var(--color-surface)] p-0.5 rounded-lg border border-[var(--color-border)] text-[10px] font-bold">
                        <button
                            type="button"
                            onClick={() => setActiveTab('upload')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                                activeTab === 'upload'
                                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            Upload / Paste
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('url')}
                            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                                activeTab === 'url'
                                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                        >
                            URL Link
                        </button>
                    </div>
                )}
            </div>

            {/* Active Image Preview Card */}
            {imageUrl ? (
                <div className="relative group p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center gap-4 shadow-xs animate-fade-in">
                    <div
                        onClick={() => setPreviewModalOpen(true)}
                        className="relative w-24 h-20 rounded-xl overflow-hidden bg-[var(--color-background)] border border-[var(--color-border)] flex items-center justify-center cursor-pointer shrink-0 group/thumb"
                    >
                        <img
                            src={imageUrl}
                            alt="Question diagram"
                            className="w-full h-full object-contain p-1"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Maximize2 className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text)] truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" />
                            <span>Diagram attached to question</span>
                        </div>
                        <p className="text-[10px] text-[var(--color-muted)] truncate">
                            {imageUrl.startsWith('data:') ? 'Local embedded image (Base64)' : imageUrl}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-[10px] font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                            >
                                Replace Image
                            </button>
                            <span className="text-[var(--color-border)]">•</span>
                            <button
                                type="button"
                                onClick={handleRemove}
                                className="text-[10px] font-bold text-[var(--color-error)] hover:underline cursor-pointer"
                            >
                                Remove
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleRemove}
                        className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-5)] transition-colors cursor-pointer"
                        title="Remove diagram"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : activeTab === 'upload' ? (
                /* Drag and drop & paste dropzone */
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    tabIndex={0}
                    className={`relative p-5 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer outline-none focus:border-[var(--color-primary)] ${
                        isDragging
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-5)] scale-[0.99]'
                            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]'
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    {isUploading ? (
                        <div className="flex flex-col items-center gap-2 py-2 text-[var(--color-primary)]">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-xs font-bold">Uploading diagram...</span>
                        </div>
                    ) : (
                        <div className="space-y-1.5 py-1">
                            <div className="w-9 h-9 mx-auto rounded-xl bg-[var(--color-primary-10)] text-[var(--color-primary)] flex items-center justify-center">
                                <Upload className="w-4 h-4" />
                            </div>
                            <div className="text-xs font-bold text-[var(--color-text)]">
                                Click to browse, drag & drop, or <span className="text-[var(--color-primary)] underline">paste screenshot (Ctrl+V)</span>
                            </div>
                            <p className="text-[10px] text-[var(--color-muted)]">
                                Supports PNG, JPG, WEBP, SVG (up to 5MB). Automatically saved offline.
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                /* External URL Input */
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-muted)]">
                            <LinkIcon className="w-3.5 h-3.5" />
                        </div>
                        <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleApplyUrl();
                                }
                            }}
                            placeholder="https://example.com/diagram.png"
                            className="w-full pl-9 pr-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-mono text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleApplyUrl}
                        className="px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                        Attach
                    </button>
                </div>
            )}

            {/* Lightbox / Zoom Modal */}
            {previewModalOpen && imageUrl && (
                <div
                    onClick={() => setPreviewModalOpen(false)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in cursor-zoom-out"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative max-w-3xl max-h-[85vh] bg-[var(--color-surface)] p-4 rounded-3xl border border-[var(--color-border)] shadow-2xl flex flex-col items-center"
                    >
                        <button
                            type="button"
                            onClick={() => setPreviewModalOpen(false)}
                            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-all cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <img
                            src={imageUrl}
                            alt="Question Diagram Large View"
                            className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
