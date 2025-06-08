'use client'

import { useEffect, useRef, useState } from 'react';
import { type FC } from 'react';

const FullHeightContainer: FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerRef = useRef(null);
    const [height, setHeight] = useState('100vh');
    useEffect(() => {
        const setTrueHeight = () => {
            if (containerRef.current) {
                setHeight(`${window.innerHeight}px`);
            }
        };

        // init height
        setTrueHeight();
        window.addEventListener('resize', setTrueHeight);

        return () => {
            window.removeEventListener('resize', setTrueHeight);
        };
    }, []);

    return (
        <div ref={containerRef} style={{ height: height }} className='container'>
            {children}
        </div>
    );
};

export default FullHeightContainer;