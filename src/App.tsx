import { useEffect } from 'react';
import PortfolioEditor from './pages/PortfolioEditor'

function App() {
    useEffect(() => {
        document.body.classList.add('bg-rule-faint');
    }, [])
    
    return (
        <PortfolioEditor />
    )
};

export default App