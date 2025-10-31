import React, { useState } from 'react';
import TTSDropdown from './dropdowns/TTSDropdown';
import AIDropdown from './dropdowns/AIDropdown';
import TriggersDropdown from './dropdowns/TriggersDropdown';
import CollarDropdown from './dropdowns/CollarDropdown';
import BrainwaveDropdown from './dropdowns/BrainwaveDropdown';
import SpiralDropdown from './dropdowns/SpiralDropdown';

const DropdownSystem = () => {
    const [activeDropdown, setActiveDropdown] = useState(null);

    const handleDropdownToggle = (dropdownId) => {
        setActiveDropdown(activeDropdown === dropdownId ? null : dropdownId);
    };

    const closeAllDropdowns = () => {
        setActiveDropdown(null);
    };

    // Close dropdowns when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.dropdown-container')) {
                closeAllDropdowns();
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="dropdown-system">
            <div className="dropdown-row">
                <TTSDropdown
                    isOpen={activeDropdown === 'tts'}
                    onToggle={() => handleDropdownToggle('tts')}
                />

                <AIDropdown
                    isOpen={activeDropdown === 'ai'}
                    onToggle={() => handleDropdownToggle('ai')}
                />

                <TriggersDropdown
                    isOpen={activeDropdown === 'triggers'}
                    onToggle={() => handleDropdownToggle('triggers')}
                />
            </div>

            <div className="dropdown-row">
                <CollarDropdown
                    isOpen={activeDropdown === 'collar'}
                    onToggle={() => handleDropdownToggle('collar')}
                />

                <BrainwaveDropdown
                    isOpen={activeDropdown === 'brainwave'}
                    onToggle={() => handleDropdownToggle('brainwave')}
                />

                <SpiralDropdown
                    isOpen={activeDropdown === 'spiral'}
                    onToggle={() => handleDropdownToggle('spiral')}
                />
            </div>
        </div>
    );
};

export default DropdownSystem;