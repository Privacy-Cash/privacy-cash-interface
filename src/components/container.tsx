'use client'

import { useEffect, useRef, useState } from 'react';
import { type FC } from 'react';

const FullHeightContainer: FC<{ children: React.ReactNode }> = ({ children }) => {

    return (
        <div style={{ height: '100dvh' }} className='container'>
            {children}
        </div>
    );
};

export default FullHeightContainer;