'use client'
import React, { useState, useRef, useEffect, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { Icon } from './icons';
import { useAtom } from 'jotai';
import { isDepositingAtom } from '@/utils/atoms';

interface ModalProps {
    children: ReactNode;
    onClose: () => void;
    closeOnBackdropClick?: boolean;
    title: string;
}

export const Modal: React.FC<ModalProps> = ({ children, onClose, closeOnBackdropClick = true, title }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [showModal, setShowModal] = useState(false); // Controls the CSS for animation
    const [shouldRender, setShouldRender] = useState(false); // Controls if the portal content is in DOM
    const [isDepositing, setIsDepositing] = useAtom(isDepositingAtom)

    // Effect for entry animation
    useEffect(() => {
        // When the component is mounted (added to the DOM by App component)
        setShouldRender(true); // Allow ReactDOM.createPortal to render
        // A small delay to ensure the element is painted with initial styles
        // before applying the 'show' styles to trigger transition.
        const entryTimer = setTimeout(() => {
            setShowModal(true); // Trigger entry animation
        }, 10); // A very small delay (e.g., 10ms) is often sufficient

        return () => clearTimeout(entryTimer);
    }, []);

    // Function to initiate closing (start exit animation)
    const initiateClose = () => {
        if (isDepositing) {
            return
        }
        setShowModal(false); // Trigger exit animation
    };


    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node) && closeOnBackdropClick) {
                initiateClose(); // Trigger exit animation on outside click
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [closeOnBackdropClick, isDepositing]);

    // Handle transition end for exiting
    const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
        // Only unmount if it's the fade-out transition completing AND it's going hidden
        if (e.propertyName === 'opacity' && !showModal) {
            setShouldRender(false); // Remove from DOM after exit animation
            onClose(); // Call parent's onClose to update its state
        }
    };

    if (!shouldRender) {
        // Don't render anything in the portal until `shouldRender` is true
        return null;
    }

    // Render the portal content
    return ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: showModal ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0)',
                backdropFilter: showModal ? 'blur(5px)' : 'blur(0px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
                opacity: showModal ? 1 : 0, // Overall fade for backdrop and container
                transition: 'opacity 0.3s ease-out, background-color 0.3s ease-out, backdrop-filter 0.3s ease-out',
            }}
            onTransitionEnd={handleTransitionEnd} // Listen for transition end on the overlay
        >
            <div
                ref={modalRef}
                className='card'
                style={{
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 1001,
                    transform: showModal ? 'translateY(0)' : 'translateY(-20px)', // Move up for entry, down for exit
                    opacity: showModal ? 1 : 0, // Fade in for entry, fade out for exit
                    transition: 'transform 0.3s ease-out, opacity 0.3s ease-out', // Transition for modal content
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: '1.2em' }}>{title}</div>
                    <div style={{ cursor: isDepositing ? 'default' : 'pointer', color: isDepositing ? '#333' : '#ccc' }} onClick={() => {
                        if (isDepositing) {
                            return
                        }
                        initiateClose()
                    }} className={isDepositing ? '' : 'hover-zoomin'}><Icon name='close' /></div>
                </div>
                {children}
            </div>
        </div>,
        document.body
    );
};