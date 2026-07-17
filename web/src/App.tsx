import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './pages/DashboardLayout';
import { NotificationsProvider } from './realtime/notifications';
import SalonPage from './pages/SalonPage';
import MenuPage from './pages/MenuPage';
import ProfitabilityPage from './pages/ProfitabilityPage';
import UsersPage from './pages/UsersPage';
import AdisyonPage from './pages/AdisyonPage';
import KdsPage from './pages/KdsPage';
import ReportsPage from './pages/ReportsPage';
import StockPage from './pages/StockPage';
import CariPage from './pages/CariPage';
import ReservationsPage from './pages/ReservationsPage';
import AlislarPage from './pages/AlislarPage';
import KasaPage from './pages/KasaPage';
import BelgelerPage from './pages/BelgelerPage';
import AdisyonlarPage from './pages/AdisyonlarPage';
import FeedbackPage from './pages/FeedbackPage';
import DenetimPage from './pages/DenetimPage';
import PersonelPage from './pages/PersonelPage';
import MusterilerPage from './pages/MusterilerPage';
import OngorulerPage from './pages/OngorulerPage';
import AyarlarPage from './pages/AyarlarPage';
import VeriPage from './pages/VeriPage';
import GorevlerPage from './pages/GorevlerPage';
import TavsiyelerPage from './pages/TavsiyelerPage';
import MesaiPage from './pages/MesaiPage';
import PublicMenuPage from './public/PublicMenuPage';

export default function App() {
  const { user, loading } = useAuth();

  // QR self-servis: auth'suz mobil menü (tam sayfa girişte).
  if (window.location.pathname.startsWith('/m/')) {
    return (
      <Routes>
        <Route path="/m/:token" element={<PublicMenuPage />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        Yükleniyor…
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Adisyon tam ekran (sidebar'sız), dokunmatik odaklı */}
      <Route path="/adisyon/:tableId" element={<AdisyonPage />} />
      <Route element={<NotificationsProvider><DashboardLayout /></NotificationsProvider>}>
        <Route
          index
          element={
            <Navigate to={user.role === 'MUTFAK' ? '/mutfak' : '/salon'} replace />
          }
        />
        <Route path="/salon" element={<SalonPage />} />
        <Route path="/rezervasyonlar" element={<ReservationsPage />} />
        <Route path="/mutfak" element={<KdsPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/karlilik" element={<ProfitabilityPage />} />
        <Route path="/stok" element={<StockPage />} />
        <Route path="/cari" element={<CariPage />} />
        <Route path="/kasa" element={<KasaPage />} />
        <Route path="/alislar" element={<AlislarPage />} />
        <Route path="/belgeler" element={<BelgelerPage />} />
        <Route path="/adisyonlar" element={<AdisyonlarPage />} />
        <Route path="/raporlar" element={<ReportsPage />} />
        <Route path="/geribildirim" element={<FeedbackPage />} />
        <Route path="/denetim" element={<DenetimPage />} />
        <Route path="/personel" element={<PersonelPage />} />
        <Route path="/musteriler" element={<MusterilerPage />} />
        <Route path="/ongoruler" element={<OngorulerPage />} />
        <Route path="/ayarlar" element={<AyarlarPage />} />
        <Route path="/veri" element={<VeriPage />} />
        <Route path="/gorevler" element={<GorevlerPage />} />
        <Route path="/tavsiyeler" element={<TavsiyelerPage />} />
        <Route path="/mesai" element={<MesaiPage />} />
        <Route path="/kullanicilar" element={<UsersPage />} />
        <Route
          path="*"
          element={
            <Navigate to={user.role === 'MUTFAK' ? '/mutfak' : '/salon'} replace />
          }
        />
      </Route>
    </Routes>
  );
}
