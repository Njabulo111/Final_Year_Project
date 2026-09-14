import { BrowserRouter as Router, Routes, Route } from 'react-router';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { AccessPoints } from './screens/AccessPoints';
import { Analytics } from './screens/Analytics';
import { Settings } from './screens/Settings';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/access-points" element={<AccessPoints />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" richColors />
    </Router>
  );
}
