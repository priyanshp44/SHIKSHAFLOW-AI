import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import TeacherLayout from './layouts/TeacherLayout'
import StudentLayout from './layouts/StudentLayout'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherClasses from './pages/teacher/TeacherClasses'
import TeacherTasks from './pages/teacher/TeacherTasks'
import TeacherAssessments from './pages/teacher/TeacherAssessments'
import AttendancePage from './pages/teacher/AttendancePage'
import ClassAnalytics from './pages/teacher/ClassAnalytics'
import AIAssistant from './pages/teacher/AIAssistant'
import ClassDetail from './pages/teacher/ClassDetail'
import InterventionPage from './pages/teacher/InterventionPage'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentClasses from './pages/student/StudentClasses'
import StudentTasks from './pages/student/StudentTasks'
import StudentAssessments from './pages/student/StudentAssessments'
import StudentAttendance from './pages/student/StudentAttendance'
import StudentAnalytics from './pages/student/StudentAnalytics'
import StudentRecommendations from './pages/student/StudentRecommendations'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="TEACHER">
            <TeacherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="classes" element={<TeacherClasses />} />
        <Route path="classes/:id" element={<ClassDetail />} />
        <Route path="tasks" element={<TeacherTasks />} />
        <Route path="assessments" element={<TeacherAssessments />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="analytics" element={<ClassAnalytics />} />
        <Route path="intervention" element={<InterventionPage />} />
        <Route path="ai" element={<AIAssistant />} />
      </Route>

      <Route
        path="/student"
        element={
          <ProtectedRoute role="STUDENT">
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="classes" element={<StudentClasses />} />
        <Route path="tasks" element={<StudentTasks />} />
        <Route path="assessments" element={<StudentAssessments />} />
        <Route path="attendance" element={<StudentAttendance />} />
        <Route path="analytics" element={<StudentAnalytics />} />
        <Route path="recommendations" element={<StudentRecommendations />} />
      </Route>
    </Routes>
  )
}
