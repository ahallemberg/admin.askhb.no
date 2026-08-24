import { useEffect } from 'react';
import PortfolioEditor from './pages/PortfolioEditor'
import ConfirmProvider from './components/ConfirmProvider'

function App() {
    useEffect(() => {
        document.body.classList.add('bg-rule-faint');
    }, [])
    
    return (
        <ConfirmProvider>
            <PortfolioEditor />
        </ConfirmProvider>
    )
};

export default App
