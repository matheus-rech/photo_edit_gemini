/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, generateAutoEnhancedImage, generateImageFromText, generateUpscaledImage, generateImageFromTextAndImages } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import TextPanel from './components/TextPanel';
import LayerPanel from './components/LayerPanel';
import { UndoIcon, RedoIcon, EyeIcon, MagicWandIcon, UpscaleIcon, TextIcon, LayersIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import GenerateScreen from './components/GenerateScreen';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type AppMode = 'start' | 'generate' | 'edit';
type Tab = 'retouch' | 'adjust' | 'filters' | 'crop' | 'text' | 'layers';

export interface TextLayer {
  id: string;
  type: 'text';
  content: string;
  font: string;
  size: number;
  color: string;
  position: { x: number; y: number };
  opacity: number;
  visible: boolean;
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('start');
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const dragInfo = useRef<{ id: string | null; offset: { x: number; y: number } }>({ id: null, offset: { x: 0, y: 0 } });


  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 });
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierImageOffset, setMagnifierImageOffset] = useState({ x: 0, y: 0 });

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
    setLayers([]);
    setSelectedLayerId(null);
  }, [history, historyIndex]);
  
  const startNewHistoryWithFile = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setMode('edit');
    setLayers([]);
    setSelectedLayerId(null);
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    startNewHistoryWithFile(file);
  }, [startNewHistoryWithFile]);

  const handleGenerateImage = useCallback(async (prompt: string, aspectRatio: string, images: File[]) => {
    setIsLoading(true);
    setError(null);
    try {
        let generatedImageUrl: string;
        if (images.length > 0) {
            generatedImageUrl = await generateImageFromTextAndImages(prompt, aspectRatio, images);
        } else {
            // The service function expects a specific string literal type, so we cast here
            const validAspectRatio = aspectRatio as '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
            generatedImageUrl = await generateImageFromText(prompt, validAspectRatio);
        }
        const newImageFile = dataURLtoFile(generatedImageUrl, `generated-${Date.now()}.jpeg`);
        startNewHistoryWithFile(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate the image. ${errorMessage}`);
        console.error(err);
        setMode('generate'); // Stay on the generate screen on error
    } finally {
        setIsLoading(false);
    }
  }, [startNewHistoryWithFile]);


  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to edit.');
      return;
    }
    
    if (!prompt.trim()) {
        setError('Please enter a description for your edit.');
        return;
    }

    if (!editHotspot) {
        setError('Please click on the image to select an area to edit.');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to generate the image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply a filter to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the filter. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('No image loaded to apply an adjustment to.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to apply the adjustment. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleAutoEnhance = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to auto-enhance.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const enhancedImageUrl = await generateAutoEnhancedImage(currentImage);
        const newImageFile = dataURLtoFile(enhancedImageUrl, `enhanced-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to auto-enhance the image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleUpscale = useCallback(async () => {
    if (!currentImage) {
      setError('No image loaded to upscale.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const upscaledImageUrl = await generateUpscaledImage(currentImage);
        const newImageFile = dataURLtoFile(upscaledImageUrl, `upscaled-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to upscale the image. ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('Please select an area to crop.');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('Could not process the crop.');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);

  const handleResetCrop = useCallback(() => {
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setLayers([]);
      setSelectedLayerId(null);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setLayers([]);
      setSelectedLayerId(null);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
      setLayers([]);
      setSelectedLayerId(null);
    }
  }, [history]);

  const handleUploadNew = useCallback(() => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
      setMode('start');
  }, []);

  const handleDownload = useCallback(() => {
    const imageToDownload = new Image();
    imageToDownload.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = imageToDownload.naturalWidth;
        canvas.height = imageToDownload.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(imageToDownload, 0, 0);

        // Draw layers in reverse order (bottom to top)
        [...layers].reverse().forEach(layer => {
            if (layer.visible && layer.type === 'text') {
                ctx.globalAlpha = layer.opacity;
                ctx.font = `${layer.size}px ${layer.font}`;
                ctx.fillStyle = layer.color;
                ctx.textBaseline = 'top';
                ctx.fillText(layer.content, layer.position.x, layer.position.y);
            }
        });

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `pixshop-edit.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    imageToDownload.src = currentImageUrl!;
}, [currentImage, currentImageUrl, layers]);
  
  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      handleImageUpload(files[0]);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTab === 'retouch') {
      const img = imgRef.current;
      if (!img) return;
      
      const rect = img.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      
      setDisplayHotspot({ x: offsetX, y: offsetY });
  
      const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
      const scaleX = naturalWidth / clientWidth;
      const scaleY = naturalHeight / clientHeight;
  
      const originalX = Math.round(offsetX * scaleX);
      const originalY = Math.round(offsetY * scaleY);
  
      setEditHotspot({ x: originalX, y: originalY });
    } else {
      setSelectedLayerId(null);
    }
};

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragInfo.current.id) {
        const container = imageContainerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left - dragInfo.current.offset.x;
        const y = e.clientY - rect.top - dragInfo.current.offset.y;

        setLayers(prev => prev.map(layer =>
            layer.id === dragInfo.current.id ? { ...layer, position: { x, y } } : layer
        ));
        return;
    }
    
    if (activeTab !== 'retouch' || !imgRef.current) return;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
        setMagnifierPosition({ x: e.clientX, y: e.clientY });
        
        const offsetX = (x / rect.width) * 100;
        const offsetY = (y / rect.height) * 100;
        setMagnifierImageOffset({ x: offsetX, y: offsetY });
        setShowMagnifier(true);
    } else {
        setShowMagnifier(false);
    }
  };

  const handleMouseLeave = () => {
    setShowMagnifier(false);
    dragInfo.current.id = null;
  };

  const handleMouseUp = () => {
      dragInfo.current.id = null;
  };

  const handleLayerMouseDown = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    setSelectedLayerId(id);
    dragInfo.current.id = id;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const containerRect = imageContainerRef.current!.getBoundingClientRect();
    dragInfo.current.offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleAddTextLayer = () => {
    const newId = `layer_${Date.now()}`;
    const newLayer: TextLayer = {
        id: newId,
        type: 'text',
        content: 'Your Text Here',
        font: 'Arial',
        size: 50,
        color: '#FFFFFF',
        position: { x: 50, y: 50 },
        opacity: 1,
        visible: true,
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newId);
    setActiveTab('text');
  };

  const handleUpdateLayer = (id: string, updates: Partial<TextLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };
  
  const handleRemoveLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) {
        setSelectedLayerId(null);
    }
  };

  const handleReorderLayers = (sourceIndex: number, destIndex: number) => {
    setLayers(prev => {
        const items = Array.from(prev);
        const [reorderedItem] = items.splice(sourceIndex, 1);
        items.splice(destIndex, 0, reorderedItem);
        return items;
    });
  };

  const handleMergeLayers = () => {
    if (!currentImageUrl) return;
    setIsLoading(true);
    const imageToMerge = new Image();
    imageToMerge.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = imageToMerge.naturalWidth;
        canvas.height = imageToMerge.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsLoading(false);
          setError("Failed to create canvas context for merging.");
          return;
        }

        ctx.drawImage(imageToMerge, 0, 0);

        [...layers].reverse().forEach(layer => {
            if (layer.visible && layer.type === 'text') {
                ctx.globalAlpha = layer.opacity;
                ctx.font = `${layer.size}px ${layer.font}`;
                ctx.fillStyle = layer.color;
                ctx.textBaseline = 'top';
                ctx.fillText(layer.content, layer.position.x, layer.position.y);
            }
        });

        const dataUrl = canvas.toDataURL('image/png');
        const newImageFile = dataURLtoFile(dataUrl, `merged-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setIsLoading(false);
    };
    imageToMerge.onerror = () => {
      setIsLoading(false);
      setError("Failed to load image for merging.");
    };
    imageToMerge.src = currentImageUrl;
  };

  const selectedLayer = layers.find(l => l.id === selectedLayerId);


  const renderContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
            <p className="text-md text-red-400">{error}</p>
            <button
                onClick={() => {
                  setError(null);
                  // Go back to a safe state on error
                  if (mode === 'edit' && !currentImage) {
                    setMode('start');
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                Try Again
            </button>
          </div>
        );
    }

    if (mode === 'start') {
        return <StartScreen onFileSelect={handleFileSelect} onStartGenerate={() => setMode('generate')} />;
    }

    if (mode === 'generate') {
        return <GenerateScreen onGenerate={handleGenerateImage} isLoading={isLoading} onCancel={() => setMode('start')} />;
    }
    
    if (mode === 'edit' && !currentImageUrl) {
        // Fallback in case state is inconsistent
        return <StartScreen onFileSelect={handleFileSelect} onStartGenerate={() => setMode('generate')} />;
    }

    const imageDisplay = (
      <div 
        ref={imageContainerRef}
        className="relative" 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onClick={handleImageClick}
      >
        {originalImageUrl && (
            <img
                key={originalImageUrl}
                src={originalImageUrl}
                alt="Original"
                className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none"
            />
        )}
        <img
            ref={imgRef}
            key={currentImageUrl}
            src={currentImageUrl!}
            alt="Current"
            className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' && showMagnifier ? 'cursor-none' : ''} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
        />
        
        {/* Render Layers */}
        {layers.map(layer => (
            layer.type === 'text' && layer.visible && (
                <div
                    key={layer.id}
                    onMouseDown={(e) => handleLayerMouseDown(e, layer.id)}
                    className={`absolute select-none cursor-move p-1 border-2 ${selectedLayerId === layer.id ? 'border-blue-500 border-dashed' : 'border-transparent'}`}
                    style={{
                        left: `${layer.position.x}px`,
                        top: `${layer.position.y}px`,
                        fontFamily: layer.font,
                        fontSize: `${layer.size}px`,
                        color: layer.color,
                        opacity: layer.opacity,
                        textShadow: '0 0 5px rgba(0,0,0,0.5)',
                    }}
                >
                    {layer.content.replace(/ /g, '\u00A0')}
                </div>
            )
        ))}


        {showMagnifier && activeTab === 'retouch' && (
            <div
                className="magnifier-loupe pointer-events-none"
                style={{
                    left: `${magnifierPosition.x}px`,
                    top: `${magnifierPosition.y}px`,
                    backgroundImage: `url(${currentImageUrl})`,
                    backgroundPosition: `${magnifierImageOffset.x}% ${magnifierImageOffset.y}%`,
                }}
            ></div>
        )}
      </div>
    );
    
    // For ReactCrop, we need a single image element. We'll use the current one.
    const cropImageElement = (
      <img 
        ref={imgRef}
        key={`crop-${currentImageUrl}`}
        src={currentImageUrl!} 
        alt="Crop this image"
        className="w-full h-auto object-contain max-h-[60vh] rounded-xl"
      />
    );


    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative w-full shadow-2xl rounded-xl overflow-hidden bg-black/20">
            {isLoading && (
                <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <Spinner />
                    <p className="text-gray-300">AI is working its magic...</p>
                </div>
            )}
            
            {activeTab === 'crop' ? (
              <ReactCrop 
                crop={crop} 
                onChange={c => setCrop(c)} 
                onComplete={c => setCompletedCrop(c)}
                aspect={aspect}
                className="max-h-[60vh]"
              >
                {cropImageElement}
              </ReactCrop>
            ) : imageDisplay }

            {displayHotspot && !isLoading && activeTab === 'retouch' && (
                <div 
                    className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
                >
                    <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400"></div>
                </div>
            )}
        </div>
        
        <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 flex items-center justify-center gap-2 backdrop-blur-sm">
            {(['retouch', 'crop', 'adjust', 'filters', 'text', 'layers'] as Tab[]).map(tab => {
                const icons: Record<Tab, React.FC<{className?: string}>> = {
                    retouch: MagicWandIcon,
                    crop: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M9 12l-3 3m0 0 3 3m-3-3h12" /></svg>,
                    adjust: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.475 2.118A2.25 2.25 0 0 1 .879 16.5a3 3 0 0 1 4.242-4.242 3 3 0 0 0 4.242 0 3 3 0 0 0 0-4.242 3 3 0 0 1-4.242-4.242 3 3 0 0 1 4.242 0 3 3 0 0 1 0 4.242 3 3 0 0 0 4.242 4.242 3 3 0 0 0 5.78-1.128 2.25 2.25 0 0 1 2.475-2.118 2.25 2.25 0 0 1 .879 3.5a3 3 0 0 1-4.242 4.242 3 3 0 0 0-4.242 0 3 3 0 0 0 0 4.242Z" /></svg>,
                    filters: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="m10.343 3.94.09-.542.56-1.007 1.11-1.11a12.001 12.001 0 0 1 5.052 0c.55.103 1.02.568 1.11 1.11a12.001 12.001 0 0 1 0 5.052c-.103.55-.568 1.02-1.11 1.11a12.001 12.001 0 0 1-5.052 0c-.55-.103-1.02-.568-1.11-1.11a12.001 12.001 0 0 1 0-5.052M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" /></svg>,
                    text: TextIcon,
                    layers: LayersIcon,
                };
                const Icon = icons[tab];
                 return (
                     <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`w-full capitalize font-semibold py-3 px-4 rounded-md transition-all duration-200 text-base flex items-center justify-center ${
                            activeTab === tab 
                            ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' 
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <Icon className="w-5 h-5 mr-2" />
                        {tab}
                    </button>
                )
            })}
        </div>
        
        <div className="w-full">
            {activeTab === 'retouch' && (
                <div className="flex flex-col items-center gap-4">
                    <p className="text-md text-gray-400">
                        {editHotspot ? 'Great! Now describe your localized edit below.' : 'Hover for magnifier, click to select an area.'}
                    </p>
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-2">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={editHotspot ? "e.g., 'change my shirt color to blue'" : "First click a point on the image"}
                            className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isLoading || !editHotspot}
                        />
                        <button 
                            type="submit"
                            className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                            disabled={isLoading || !prompt.trim() || !editHotspot}
                        >
                            Generate
                        </button>
                    </form>
                </div>
            )}
            {activeTab === 'crop' && <CropPanel 
              onApplyCrop={handleApplyCrop} 
              onResetCrop={handleResetCrop}
              onSetAspect={setAspect} 
              isLoading={isLoading} 
              isApplyCropEnabled={!!completedCrop?.width && completedCrop.width > 0}
              isCropActive={!!crop?.width && crop.width > 0} 
            />}
            {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
            {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
            {activeTab === 'text' && <TextPanel
                selectedLayer={selectedLayer}
                onAddLayer={handleAddTextLayer}
                onUpdateLayer={(updates) => selectedLayerId && handleUpdateLayer(selectedLayerId, updates)}
                isLoading={isLoading}
            />}
            {activeTab === 'layers' && <LayerPanel
                layers={layers}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onUpdateLayer={handleUpdateLayer}
                onRemoveLayer={handleRemoveLayer}
                onReorderLayers={handleReorderLayers}
                onMergeLayers={handleMergeLayers}
                isLoading={isLoading}
            />}

        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
                onClick={handleAutoEnhance}
                disabled={isLoading || !currentImage}
                className="flex items-center justify-center text-center bg-gradient-to-br from-purple-600 to-indigo-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-purple-800 disabled:to-indigo-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                aria-label="Auto-enhance image"
            >
                <MagicWandIcon className="w-5 h-5 mr-2" />
                Auto-Enhance
            </button>
            <button
                onClick={handleUpscale}
                disabled={isLoading || !currentImage}
                className="flex items-center justify-center text-center bg-gradient-to-br from-orange-500 to-amber-400 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-orange-700 disabled:to-amber-600 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                aria-label="Upscale image"
            >
                <UpscaleIcon className="w-5 h-5 mr-2" />
                Upscale
            </button>
            
            <div className="h-6 w-px bg-gray-600 mx-1 hidden sm:block"></div>
            
            <button 
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="Undo last action"
            >
                <UndoIcon className="w-5 h-5 mr-2" />
                Undo
            </button>
            <button 
                onClick={handleRedo}
                disabled={!canRedo}
                className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5"
                aria-label="Redo last action"
            >
                <RedoIcon className="w-5 h-5 mr-2" />
                Redo
            </button>
            
            <div className="h-6 w-px bg-gray-600 mx-1 hidden sm:block"></div>

            {canUndo && (
              <button 
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  onTouchStart={() => setIsComparing(true)}
                  onTouchEnd={() => setIsComparing(false)}
                  className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
                  aria-label="Press and hold to see original image"
              >
                  <EyeIcon className="w-5 h-5 mr-2" />
                  Compare
              </button>
            )}

            <button 
                onClick={handleReset}
                disabled={!canUndo}
                className="text-center bg-transparent border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent"
              >
                Reset
            </button>
            <button 
                onClick={handleUploadNew}
                className="text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base"
            >
                Start Over
            </button>

            <button 
                onClick={handleDownload}
                className="flex-grow sm:flex-grow-0 ml-auto bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
            >
                Download Image
            </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
      <Header />
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center items-center`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;