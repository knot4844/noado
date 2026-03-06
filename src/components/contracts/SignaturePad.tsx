"use client";

import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
    onSave: (signatureData: string) => void;
    onCancel?: () => void;
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
    const padRef = useRef<SignatureCanvas>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    const handleClear = () => {
        if (padRef.current) {
            padRef.current.clear();
            setIsEmpty(true);
        }
    };

    const handleSave = () => {
        if (padRef.current && !padRef.current.isEmpty()) {
            // Get base64 representation of the signature on a transparent background
            const dataURL = padRef.current.getTrimmedCanvas().toDataURL('image/png');
            onSave(dataURL);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 flex justify-between items-center">
                <span className="font-bold text-neutral-900 text-sm">서명 입력 (정자체)</span>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="text-xs text-neutral-500 hover:text-neutral-900 font-medium"
                    >
                        취소
                    </button>
                )}
            </div>

            <div className="p-4">
                <div className="border border-dashed border-neutral-300 rounded-xl overflow-hidden bg-neutral-50/50 relative cursor-crosshair">
                    {/* Placeholder text visible when empty */}
                    {isEmpty && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-neutral-400 text-sm font-medium">여기에 손가락이나 마우스로 서명하세요</span>
                        </div>
                    )}
                    <SignatureCanvas
                        ref={padRef}
                        penColor="#171717"
                        canvasProps={{
                            className: 'w-full h-48',
                            style: { touchAction: 'none' } // Prevent scrolling when signing on mobile
                        }}
                        onBegin={() => setIsEmpty(false)}
                    />
                </div>

                <p className="text-[11px] text-neutral-500 mt-3 text-center mb-5">
                    * 위 서명은 전자서명법에 따라 종이 계약서의 자필 서명과 동일한 법적 효력을 갖습니다.
                </p>

                <div className="flex gap-2">
                    <button
                        onClick={handleClear}
                        className="flex-1 py-2.5 flex justify-center items-center gap-2 rounded-lg font-bold text-sm bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
                    >
                        <Eraser size={16} />
                        지우기
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isEmpty}
                        className="flex-1 py-2.5 flex justify-center items-center gap-2 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Check size={16} />
                        서명 완료
                    </button>
                </div>
            </div>
        </div>
    );
}
