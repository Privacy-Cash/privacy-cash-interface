'use client'

import { Buffer } from 'buffer';
if (typeof window !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
    (window as any).Buffer = Buffer;
}
export function BufferProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}