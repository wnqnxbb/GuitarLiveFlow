import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { HomeModePage } from './pages/HomeModePage';
import { PerformPage } from './pages/PerformPage';
import { DisplayPage } from './pages/DisplayPage';
import { PracticePage } from './pages/PracticePage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeModePage />} />
        <Route path="/demo/mv" element={<HomeModePage initialMode="mv" />} />
        <Route path="/perform" element={<PerformPage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/display/:id" element={<DisplayPage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/practice/:id" element={<PracticePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/:id" element={<AdminPage />} />
        <Route path="*" element={<HomeModePage />} />
      </Routes>
    </BrowserRouter>
  );
}
