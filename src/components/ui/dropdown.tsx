import React, { useState, useRef, useEffect, ReactNode } from 'react';
import './dropdown.css';

interface DropdownProps {
    trigger: ReactNode;
    children: ReactNode;
}

const Dropdown: React.FC<DropdownProps> = ({ trigger, children }) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="dropdown" ref={dropdownRef}>
            <div className="dropdown-trigger" onClick={toggleDropdown}>
                {trigger}
            </div>
            {isOpen && (
                <div className="dropdown-body-container">
                    <div className='dropdown-body'>
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dropdown;