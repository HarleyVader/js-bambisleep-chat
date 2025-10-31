import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';

const TriggersDropdown = ({ isOpen, onToggle }) => {
    const { activeTriggers, allTriggers, triggerCategories, setActiveTriggers } = useChat();
    const [selectedCategory, setSelectedCategory] = useState('all');

    const handleTriggerToggle = (triggerName) => {
        const isActive = activeTriggers.includes(triggerName);
        if (isActive) {
            setActiveTriggers(activeTriggers.filter(t => t !== triggerName));
        } else {
            setActiveTriggers([...activeTriggers, triggerName]);
        }
    };

    const getFilteredTriggers = () => {
        if (selectedCategory === 'all') {
            return allTriggers;
        }
        return allTriggers.filter(trigger => trigger.category === selectedCategory);
    };

    const getCategoryColor = (category) => {
        const colors = {
            'primary': '#ff69b4',
            'physical': '#4ecdc4',
            'mental': '#a8e6cf',
            'advanced': '#ffd93d'
        };
        return colors[category] || '#ddd';
    };

    const getSafetyColor = (level) => {
        const colors = {
            'safe': '#4caf50',
            'moderate': '#ff9800',
            'intense': '#f44336'
        };
        return colors[level] || '#ddd';
    };

    return (
        <div className="dropdown-container">
            <button
                className={`dropdown-btn toggle-button ${activeTriggers.length > 0 ? 'active' : ''}`}
                data-state={activeTriggers.length > 0 ? 'on' : 'off'}
                onClick={onToggle}
            >
                <span className="status-indicator">
                    <span className={activeTriggers.length > 0 ? 'status-active' : 'status-inactive'}>●</span>
                </span>
                ✨ Triggers ({activeTriggers.length})
            </button>

            {isOpen && (
                <div className="dropdown-content triggers-content">
                    <div className="dropdown-header">
                        <h3>BambiSleep Triggers</h3>
                        <p className="active-count">Active: {activeTriggers.length} triggers</p>
                    </div>

                    <div className="category-filter">
                        <label>Category:</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="category-select"
                        >
                            <option value="all">All Categories</option>
                            {Object.keys(triggerCategories).map(category => (
                                <option key={category} value={category}>
                                    {triggerCategories[category]?.display || category}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="triggers-list">
                        {getFilteredTriggers().map((trigger) => (
                            <div key={trigger.name} className="trigger-item">
                                <label className="trigger-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={activeTriggers.includes(trigger.name)}
                                        onChange={() => handleTriggerToggle(trigger.name)}
                                    />
                                    <div className="trigger-info">
                                        <div className="trigger-header">
                                            <span className="trigger-name">{trigger.name}</span>
                                            <div className="trigger-badges">
                                                <span
                                                    className="category-badge"
                                                    style={{ backgroundColor: getCategoryColor(trigger.category) }}
                                                >
                                                    {trigger.category}
                                                </span>
                                                <span
                                                    className="safety-badge"
                                                    style={{ backgroundColor: getSafetyColor(trigger.safetyLevel) }}
                                                >
                                                    {trigger.safetyLevel}
                                                </span>
                                            </div>
                                        </div>
                                        {trigger.description && (
                                            <p className="trigger-description">{trigger.description}</p>
                                        )}
                                    </div>
                                </label>
                            </div>
                        ))}
                    </div>

                    {getFilteredTriggers().length === 0 && (
                        <div className="no-triggers">
                            <p>No triggers available in this category.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TriggersDropdown;