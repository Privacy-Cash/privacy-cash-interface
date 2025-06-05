'use client'
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';


export function toastSuccess(message: string, opt: { duration?: number } = {}) {
    showToastWithProgress(message, opt.duration || 4000, '#0abf3a', 'success')
}
export function toastError(message: string, opt: { duration?: number } = {}) {
    showToastWithProgress(message, opt.duration || 4000, 'red', 'error')
}

function showToastWithProgress(message: string, duration: number, color: string, type: 'success' | 'error') {
    const toastId = toast(message, {
        duration: duration,
        position: 'top-center',
        ariaProps: {
            role: 'status',
            'aria-live': 'polite',
        },
    });

    const progressBarStyle = {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        height: '4px',
        backgroundColor: `var(--hot-toast-bar-color, ${color})`,
        transition: 'width 0.1s linear',
        borderRadius: '0 0 4px 4px',
    };

    const ProgressBar = () => {
        const progressRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (!progressRef.current) return;

            progressRef.current.style.width = '100%';

            const startTime = Date.now();
            const interval = setInterval(() => {
                if (!progressRef.current) {
                    clearInterval(interval);
                    return;
                }

                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, duration - elapsed);
                const percentage = (remaining / duration) * 100;

                progressRef.current.style.width = `${percentage}%`;

                if (remaining <= 0) {
                    clearInterval(interval);
                }
            }, 16);

            return () => clearInterval(interval);
        }, [duration]);

        return (
            <div style={{ position: 'relative', width: '100%', marginTop: '8px', borderEndEndRadius: 5 }}>
                <div ref={progressRef} style={progressBarStyle} />
            </div>
        );
    };

    toast.custom(
        (t) => (
            <div
                style={{
                    minWidth: 230,
                    background: t.visible ? 'var(--hot-toast-bg, #fff)' : 'transparent',
                    borderRadius: 5,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.3s ease',
                    opacity: t.visible ? 1 : 0,
                    transform: t.visible ? 'translateY(0)' : 'translateY(-8px)',
                }}
            >
                <div style={{
                    padding: '14px 14px 4px 14px',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12
                }}>
                    <div style={{ fontSize: 16 }}>
                        {type == 'success' ?
                            <svg style={{ width: 22, height: 22, fill: color }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z" /></svg>
                            : <svg style={{ width: 22, height: 22, fill: color }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24l0 112c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-112c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z" /></svg>
                        }
                    </div>
                    <div style={{ color: '#333', fontSize: 17 }}>{message}</div>
                </div>
                <ProgressBar />
            </div>
        ),
        {
            id: toastId,
            duration: duration,
        }
    );

    return toastId;
}
