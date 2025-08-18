import { useState, type ReactElement } from 'react';

interface DraggableListProps<T> {
    items: T[];
    onReorder: (newItems: T[]) => void;
    renderItem: (item: T, index: number, dragHandleProps: any) => ReactElement;
}

const DraggableList = <T,>({ items, onReorder, renderItem }: DraggableListProps<T>) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [dropPosition, setDropPosition] = useState<'above' | 'below'>('below');

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', '');
        
        // Create a custom drag image that's more transparent
        const dragImage = (e.target as HTMLElement).cloneNode(true) as HTMLElement;
        dragImage.style.opacity = '0.5';
        dragImage.style.transform = 'rotate(2deg)';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedIndex !== null && draggedIndex !== index) {
            // Get the mouse position relative to the element
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const isAbove = e.clientY < midY;
            
            setDragOverIndex(index);
            setDropPosition(isAbove ? 'above' : 'below');
        }
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        
        if (draggedIndex !== null && draggedIndex !== index) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const isAbove = e.clientY < midY;
            
            setDragOverIndex(index);
            setDropPosition(isAbove ? 'above' : 'below');
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // Only clear if we're leaving the container entirely
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverIndex(null);
        }
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            const newItems = [...items];
            const draggedItem = newItems[draggedIndex];
            
            // Remove the dragged item
            newItems.splice(draggedIndex, 1);
            
            // Calculate the new insert position
            let insertIndex = dropIndex;
            
            // If we removed an item before the drop position, adjust the index
            if (draggedIndex < dropIndex) {
                insertIndex = dropIndex - 1;
            }
            
            // If dropping below the target, increment the position
            if (dropPosition === 'below') {
                insertIndex += 1;
            }
            
            // Insert the item at the new position
            newItems.splice(insertIndex, 0, draggedItem);
            
            onReorder(newItems);
        }
        
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div>
            {items.map((item, index) => {
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;
                
                const dragHandleProps = {
                    draggable: true,
                    onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
                };

                const containerProps = {
                    onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
                    onDragEnter: (e: React.DragEvent) => handleDragEnter(e, index),
                    onDragLeave: handleDragLeave,
                    onDrop: (e: React.DragEvent) => handleDrop(e, index),
                    onDragEnd: handleDragEnd,
                    className: `
                        relative transition-all duration-200
                        ${isDragging ? 'opacity-50 scale-95' : ''}
                        ${isDragOver && dropPosition === 'above' ? 'border-t-4 border-blue-500' : ''}
                        ${isDragOver && dropPosition === 'below' ? 'border-b-4 border-blue-500' : ''}
                    `.trim()
                };

                return (
                    <div key={index} {...containerProps}>
                        {renderItem(item, index, dragHandleProps)}
                    </div>
                );
            })}
        </div>
    );
};

export default DraggableList;