import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import LandingPage from '../pages/Landing'
import HomePage from '../pages/Home'
import LoginPage from '../pages/Login'
import CoursePage from '../pages/Course'
import PdfTestPage from '../pages/PdfTest'
import SettingsLayout from '../pages/setting/SettingsLayout'
import OverviewPage from '../pages/setting/OverviewPage'
import ProfilePage from '../pages/setting/ProfilePage'
import UsagePage from '../pages/setting/UsagePage'
import BillingPage from '../pages/setting/BillingPage'

export default function AppRoute() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/course/:id" element={<CoursePage />} />
        <Route path="/pdf-test" element={<PdfTestPage />} />
        <Route path="/configuracao" element={<SettingsLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="invoices" element={<Navigate to="/configuracao/billing" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}