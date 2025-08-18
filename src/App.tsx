import { useEffect } from 'react';
import PortfolioEditor from './pages/PortfolioEditor'

function App() {
    useEffect(() => {
        document.body.classList.add('bg-gray-100');
    }, [])
    
    return (
        <PortfolioEditor />
    )
};

export default App