/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // 2. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image for the ${context}. ` + 
        (textFeedback 
            ? `The model responded with text: "${textFeedback}"`
            : "This can happen due to safety filters or if the request is too complex. Please try rephrasing your prompt to be more direct.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

/**
 * Generates an edited image using generative AI based on a text prompt and a specific point.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @param hotspot The {x, y} coordinates on the image to focus the edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    hotspot: { x: number, y: number }
): Promise<string> => {
    console.log('Starting generative edit at:', hotspot);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, localized edit on the provided image based on the user's request.
User Request: "${userPrompt}"
Edit Location: Focus on the area around pixel coordinates (x: ${hotspot.x}, y: ${hotspot.y}).

Editing Guidelines:
- The edit must be realistic and blend seamlessly with the surrounding area.
- The rest of the image (outside the immediate edit area) must remain identical to the original.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        }
    });
    console.log('Received response from model.', response);

    return handleApiResponse(response, 'edit');
};

/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    console.log(`Starting filter generation: ${filterPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to apply a stylistic filter to the entire image based on the user's request. Do not change the composition or content, only apply the style.
Filter Request: "${filterPrompt}"

Safety & Ethics Policy:
- Filters may subtly shift colors, but you MUST ensure they do not alter a person's fundamental race or ethnicity.
- You MUST REFUSE any request that explicitly asks to change a person's race (e.g., 'apply a filter to make me look Chinese').

Output: Return ONLY the final filtered image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and filter prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        }
    });
    console.log('Received response from model for filter.', response);
    
    return handleApiResponse(response, 'filter');
};

/**
 * Generates an image with a global adjustment applied using generative AI.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The text prompt describing the desired adjustment.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
): Promise<string> => {
    console.log(`Starting global adjustment generation: ${adjustmentPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, global adjustment to the entire image based on the user's request.
User Request: "${adjustmentPrompt}"

Editing Guidelines:
- The adjustment must be applied across the entire image.
- The result must be photorealistic.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final adjusted image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and adjustment prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        }
    });
    console.log('Received response from model for adjustment.', response);
    
    return handleApiResponse(response, 'adjustment');
};

/**
 * Automatically enhances an image's lighting, color, and sharpness.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the enhanced image.
 */
export const generateAutoEnhancedImage = async (
    originalImage: File,
): Promise<string> => {
    console.log(`Starting auto-enhance generation.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to automatically enhance this image. Subtly improve the lighting, color balance, contrast, and sharpness to make the photo look more professional and visually appealing, while keeping it natural. Do not make any stylistic changes or alter the content of the image.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final enhanced image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and auto-enhance prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        }
    });
    console.log('Received response from model for auto-enhance.', response);
    
    return handleApiResponse(response, 'auto-enhance');
};

/**
 * Upscales an image to a higher resolution using AI.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the upscaled image.
 */
export const generateUpscaledImage = async (
    originalImage: File,
): Promise<string> => {
    console.log(`Starting upscale generation.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to upscale this image. Increase its resolution and enhance its details and sharpness, making it suitable for high-quality prints. Preserve the original's content, colors, and artistic style, simply making it larger and clearer.

Output: Return ONLY the final upscaled image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and upscale prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        }
    });
    console.log('Received response from model for upscale.', response);
    
    return handleApiResponse(response, 'upscale');
};


/**
 * Generates an image from a text prompt using the Imagen model.
 * @param prompt The text prompt describing the desired image.
 * @param aspectRatio The desired aspect ratio for the image.
 * @returns A promise that resolves to the data URL of the generated image.
 */
export const generateImageFromText = async (
    prompt: string,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
): Promise<string> => {
    console.log(`Starting image generation from text with aspect ratio ${aspectRatio}: ${prompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
    });
    console.log('Received response from model for image generation.', response);

    // FIX: The `GenerateImagesResponse` type does not have `promptFeedback` and
    // the `GeneratedImage` type does not have `finishReason`. The error handling
    // logic is simplified to check for the presence of image data. API errors
    // like blocked prompts are expected to throw exceptions.
    const generatedImage = response.generatedImages?.[0];

    if (generatedImage?.image?.imageBytes) {
        const base64ImageBytes: string = generatedImage.image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    
    throw new Error(`The AI model did not return an image. This could be due to safety filters or a complex prompt. Please try again.`);
};

/**
 * Generates a new image from a text prompt and reference images.
 * @param prompt The text prompt describing the desired image.
 * @param aspectRatio The desired aspect ratio for the image.
 * @param images The reference image files.
 * @returns A promise that resolves to the data URL of the generated image.
 */
export const generateImageFromTextAndImages = async (
    prompt: string,
    aspectRatio: string,
    images: File[],
): Promise<string> => {
    console.log(`Starting image generation from text, ${images.length} images, and aspect ratio ${aspectRatio}.`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const imageParts = await Promise.all(images.map(file => fileToPart(file)));
    
    const combinedPrompt = `You are a creative AI assistant. Generate a new image based on the user's request and any reference images provided.
    
User Request: "${prompt}"

Desired Aspect Ratio: ${aspectRatio}

Please integrate the key subjects, styles, or concepts from the reference image(s) into a new, original composition that follows the user's text prompt and the desired aspect ratio. The output should be a single generated image.

Output: Return ONLY the final generated image. Do not return text.`;

    const textPart = { text: combinedPrompt };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [textPart, ...imageParts] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    console.log('Received response from model for text-and-image generation.', response);

    return handleApiResponse(response, 'text-and-image-generation');
};

export interface AnalysisResult {
    feedback: string;
    promptForEdit: string;
}

/**
 * Analyzes an image with a user query to get feedback and a suggested edit prompt.
 * @param image The image file to analyze.
 * @param userQuery The user's question about the image.
 * @returns A promise that resolves to an object containing feedback and an edit prompt.
 */
export const analyzeImage = async (
    image: File,
    userQuery: string,
): Promise<AnalysisResult> => {
    console.log(`Starting image analysis for query: ${userQuery}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const imagePart = await fileToPart(image);
    
    const systemInstruction = `You are an expert photo critic AI. Your task is to analyze the provided image based on the user's goal and provide two outputs in a structured JSON format:
1.  'userFeedback': Constructive, helpful feedback for the user written in a friendly and encouraging tone.
2.  'editPrompt': A detailed, technical prompt for an image generation AI (like Gemini 2.5 Flash Image) to apply the suggested improvements. This prompt must be self-contained and describe the exact edits needed to make the image better, focusing on photorealism and subtlety. It should describe edits to the original image, not create a new one.

User's Goal: "${userQuery}"

Analyze the image systematically. Consider composition, lighting, color, subject, focus, and overall impact in relation to the user's goal. If the image is already excellent, say so. If there are minor issues, identify them and suggest specific, actionable improvements. The 'editPrompt' should be precise enough for another AI to execute it perfectly, maintaining the original's essence (e.g., "Slightly rotate the horizon line by 1.5 degrees clockwise to make it level", "Subtly reduce the saturation of the bright red car in the background by 15% to make it less distracting", "Gently straighten the subject's tie so it hangs perfectly centered"). If no edit is necessary, 'editPrompt' should be an empty string.`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: { parts: [imagePart, { text: 'Analyze this image.' }] },
        config: {
            systemInstruction,
            thinkingConfig: { thinkingBudget: 32768 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    userFeedback: {
                        type: Type.STRING,
                        description: 'Helpful feedback for the user.',
                    },
                    editPrompt: {
                        type: Type.STRING,
                        description: 'A detailed, technical prompt for an image generation AI to apply the suggested edits. This can be an empty string if no edits are suggested.',
                    },
                },
                required: ["userFeedback", "editPrompt"],
            },
        },
    });

    console.log('Received analysis response from model.', response);

    try {
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        if (typeof parsed.userFeedback === 'string' && typeof parsed.editPrompt === 'string') {
            return {
                feedback: parsed.userFeedback,
                promptForEdit: parsed.editPrompt,
            };
        } else {
            throw new Error('Invalid JSON structure in analysis response.');
        }
    } catch (e) {
        console.error("Failed to parse JSON response from analysis model", e);
        throw new Error("The AI returned an invalid analysis format. Please try again.");
    }
};

/**
 * Applies an edit to an image based on a technical prompt from the analysis model.
 * @param originalImage The original image file.
 * @param editPrompt The technical prompt describing the desired edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const applyAnalysisPrompt = async (
    originalImage: File,
    editPrompt: string,
): Promise<string> => {
    console.log(`Applying analysis prompt: ${editPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, photorealistic edit on the provided image based on the following technical instructions. The edit must be subtle and blend seamlessly. The rest of the image must remain identical to the original.
Instructions: "${editPrompt}"

Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and analysis prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        }
    });
    console.log('Received response from model for analysis application.', response);
    
    return handleApiResponse(response, 'apply-analysis');
};