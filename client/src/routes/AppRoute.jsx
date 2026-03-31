import {  BrowserRouter, Router, Routes, Route } from 'react-router-dom'
import LandingPage from '../pages/Landing'
import HomePage from '../pages/Home'
import LoginPage from '../pages/Login'
import CoursePage from '../pages/Course'

export default function AppRoute() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/course" element={<CoursePage />} />
      </Routes>
    </BrowserRouter>
  )
}