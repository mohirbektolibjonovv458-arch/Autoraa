import { lazy, ReactNode, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { AppShell } from "./components/AppShell";
import { PageSkeleton } from "./components/ui";
import Splash from "./pages/auth/Splash";
import Welcome from "./pages/auth/Welcome";
import { Login, Register } from "./pages/auth/AuthPages";
import Onboarding from "./pages/auth/Onboarding";
import Home from "./pages/Home";

const AIChat = lazy(() => import("./pages/AIChat"));
const Learn = lazy(() => import("./pages/Learn"));
const Future = lazy(() => import("./pages/Future"));
const CareerHub = lazy(() => import("./pages/career/CareerHub"));
const CareerTest = lazy(() => import("./pages/career/CareerTest"));
const CareerResult = lazy(() => import("./pages/career/CareerResult"));
const CareerDetail = lazy(() => import("./pages/career/CareerDetail"));
const Universities = lazy(() => import("./pages/catalog/Universities"));
const UniversityDetail = lazy(() => import("./pages/catalog/UniversityDetail"));
const Compare = lazy(() => import("./pages/catalog/Compare"));
const Grants = lazy(() => import("./pages/catalog/Grants"));
const GrantDetail = lazy(() => import("./pages/catalog/GrantDetail"));
const SavedGrants = lazy(() => import("./pages/catalog/SavedGrants"));
const English = lazy(() => import("./pages/english/English"));
const Lessons = lazy(() => import("./pages/english/Lessons"));
const LessonPage = lazy(() => import("./pages/english/LessonPage"));
const Vocab = lazy(() => import("./pages/english/Vocab"));
const VocabReview = lazy(() => import("./pages/english/VocabReview"));
const Writing = lazy(() => import("./pages/english/Writing"));
const Practice = lazy(() => import("./pages/practice/Practice"));
const QuizRun = lazy(() => import("./pages/practice/QuizRun"));
const Mistakes = lazy(() => import("./pages/practice/Mistakes"));
const Plan = lazy(() => import("./pages/Plan"));
const ProgressPage = lazy(() => import("./pages/Progress"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Premium = lazy(() => import("./pages/Premium"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/admin/Admin"));
const Focus = lazy(() => import("./pages/Focus"));
const Challenge = lazy(() => import("./pages/Challenge"));
const Placement = lazy(() => import("./pages/english/Placement"));

function Protected({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && !user.is_admin) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function Entry() {
  const { user, ready } = useAuth();
  const [min, setMin] = useState(true);
  useEffect(() => { const t = setTimeout(() => setMin(false), 1400); return () => clearTimeout(t); }, []);
  if (!ready || min) return <Splash />;
  if (!user) return <Navigate to="/welcome" replace />;
  return <Navigate to={user.onboarded ? "/home" : "/onboarding"} replace />;
}

const page = (el: ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Entry />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route path="/admin/*" element={<Protected admin><Suspense fallback={<div className="p-6"><PageSkeleton /></div>}><Admin /></Suspense></Protected>} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/home" element={<Home />} />
        <Route path="/ai" element={page(<AIChat />)} />
        <Route path="/ai/:id" element={page(<AIChat />)} />
        <Route path="/learn" element={page(<Learn />)} />
        <Route path="/future" element={page(<Future />)} />
        <Route path="/career" element={page(<CareerHub />)} />
        <Route path="/career/test" element={page(<CareerTest />)} />
        <Route path="/career/result/:id" element={page(<CareerResult />)} />
        <Route path="/career/:slug" element={page(<CareerDetail />)} />
        <Route path="/universities" element={page(<Universities />)} />
        <Route path="/universities/compare" element={page(<Compare />)} />
        <Route path="/universities/:id" element={page(<UniversityDetail />)} />
        <Route path="/grants" element={page(<Grants />)} />
        <Route path="/grants/saved" element={page(<SavedGrants />)} />
        <Route path="/grants/:id" element={page(<GrantDetail />)} />
        <Route path="/english" element={page(<English />)} />
        <Route path="/english/lessons" element={page(<Lessons />)} />
        <Route path="/english/lessons/:id" element={page(<LessonPage />)} />
        <Route path="/english/vocab" element={page(<Vocab />)} />
        <Route path="/english/vocab/review" element={page(<VocabReview />)} />
        <Route path="/english/writing" element={page(<Writing />)} />
        <Route path="/practice" element={page(<Practice />)} />
        <Route path="/practice/quiz/:id" element={page(<QuizRun />)} />
        <Route path="/practice/mistakes" element={page(<Mistakes />)} />
        <Route path="/plan" element={page(<Plan />)} />
        <Route path="/progress" element={page(<ProgressPage />)} />
        <Route path="/notifications" element={page(<Notifications />)} />
        <Route path="/premium" element={page(<Premium />)} />
        <Route path="/profile" element={page(<Profile />)} />
        <Route path="/settings" element={page(<Settings />)} />
        <Route path="/focus" element={page(<Focus />)} />
        <Route path="/challenge" element={page(<Challenge />)} />
        <Route path="/english/placement" element={page(<Placement />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
