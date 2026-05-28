// src/App.jsx
import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import LoginPage     from "./pages/LoginPage.jsx";
import SessionPage   from "./pages/SessionPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import StudentsPage  from "./pages/StudentsPage.jsx";
import HODDashboard  from "./pages/HODDashboard.jsx";
import ScanPage      from "./pages/ScanPage.jsx";
import Logo          from "./components/Logo.jsx";

const isScanPage = window.location.pathname.startsWith("/scan");

export default function App() {
  return (
    <AuthProvider>
      {isScanPage ? <ScanPage /> : <MainApp />}
    </AuthProvider>
  );
}

function MainApp() {
  const { user, logout } = useAuth();
  const [tab, setTab]    = useState("session");
  const [showWelcome, setShowWelcome] = useState(true);

  if (!user) return <LoginPage />;

  const isHOD = user.role === "hod";
  const hour  = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const initials = user.name.split(" ").map(w=>w[0]).slice(0,2).join("");

  const tabs = [
    ...(isHOD ? [{ id:"hod", label:"HOD Dashboard", icon:"📊", desc:"Full KPI overview" }] : []),
    { id:"session",   label:"Take Attendance", icon:"📋", desc:"Generate QR for class" },
    { id:"analytics", label:"Analytics",        icon:"📈", desc:"Trends & reports" },
    { id:"students",  label:"Students",         icon:"👥", desc:"Manage roster" },
  ];

  const activeTab = tabs.find(t=>t.id===tab) || tabs[0];

  return (
    <div style={S.shell}>
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <Logo size="sm" dark />
          <div style={S.collegeName}>GVP College of Medicine</div>
        </div>

        <div style={S.deptBadge}>{user.dept || "Physiology"}</div>

        <nav style={S.nav}>
          <div style={S.navSection}>Menu</div>
          {tabs.map(t => (
            <button key={t.id}
              onClick={()=>{setTab(t.id);setShowWelcome(false);}}
              style={{...S.navItem,...(!showWelcome&&tab===t.id?S.navActive:{})}}>
              <span style={S.navIcon}>{t.icon}</span>
              <div>
                <div style={S.navLabel}>{t.label}</div>
                <div style={S.navDesc}>{t.desc}</div>
              </div>
            </button>
          ))}
        </nav>

        <div style={S.sidebarTip}>
          <div style={S.tipTitle}>💡 Tip</div>
          <div style={S.tipText}>Select subject + session type before generating QR. Theory and lab are tracked separately.</div>
        </div>

        <div style={S.profCard}>
          <div style={S.avatar}>{initials}</div>
          <div style={S.profInfo}>
            <div style={S.profName}>{user.name}</div>
            <div style={S.profRole}>{user.role==="hod"?"HOD":"Professor"} · ID {user.id}</div>
          </div>
          <button onClick={logout} style={S.logoutBtn} title="Sign out">↩</button>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.topBar}>
          <div style={S.topTitle}>{showWelcome?"Dashboard":activeTab.label}</div>
          <div style={S.topRight}>
            <div style={S.topDate}>{new Date().toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>
            <div style={S.topAvatar}>{initials}</div>
          </div>
        </div>

        <div style={S.content}>
          {showWelcome ? (
            <div className="fade-up">
              <div style={S.welcomeCard}>
                <div style={S.welcomeLeft}>
                  <h2 style={S.welcomeGreeting}>{greet}, {user.name.split(" ").slice(0,3).join(" ")} 👋</h2>
                  <p style={S.welcomeSub}>What would you like to do today?</p>
                  <div style={S.welcomeMenu}>
                    {tabs.map(t => (
                      <button key={t.id} style={S.welcomeItem} onClick={()=>{setTab(t.id);setShowWelcome(false);}}>
                        <span style={S.welcomeItemIcon}>{t.icon}</span>
                        <div>
                          <div style={S.welcomeItemTitle}>{t.label}</div>
                          <div style={S.welcomeItemDesc}>{t.desc}</div>
                        </div>
                        <span style={S.welcomeArrow}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={S.welcomeRight}>
                  <div style={S.calCard}>
                    <div style={S.calDay}>{new Date().toLocaleDateString("en-IN",{weekday:"long"})}</div>
                    <div style={S.calDate}>{new Date().getDate()}</div>
                    <div style={S.calMonth}>{new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</div>
                    <div style={S.calDivider}/>
                    <div style={S.calHint}>Tap "Take Attendance" to begin today's session</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="fade-up">
              {tab==="hod"       && <HODDashboard/>}
              {tab==="session"   && <SessionPage/>}
              {tab==="analytics" && <AnalyticsPage/>}
              {tab==="students"  && <StudentsPage/>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const S = {
  shell:           {display:"flex",minHeight:"100vh",background:"#f8fafc"},
  sidebar:         {width:256,background:"var(--dv-dark)",display:"flex",flexDirection:"column",flexShrink:0},
  brand:           {padding:"20px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)"},
  collegeName:     {fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:6,fontWeight:500,letterSpacing:"0.03em"},
  deptBadge:       {margin:"10px 16px",background:"rgba(109,190,69,0.15)",color:"#6DBE45",padding:"5px 12px",borderRadius:99,fontSize:11,fontWeight:700,textAlign:"center"},
  nav:             {flex:1,padding:"12px",display:"flex",flexDirection:"column",gap:2},
  navSection:      {fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.25)",textTransform:"uppercase",letterSpacing:"0.08em",padding:"8px 8px 4px"},
  navItem:         {display:"flex",alignItems:"center",gap:10,padding:"10px 10px",borderRadius:12,border:"none",background:"transparent",cursor:"pointer",textAlign:"left",color:"rgba(255,255,255,0.6)"},
  navActive:       {background:"rgba(255,255,255,0.1)",color:"#fff"},
  navIcon:         {fontSize:18,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.08)",borderRadius:8,flexShrink:0},
  navLabel:        {fontSize:13,fontWeight:600,color:"inherit"},
  navDesc:         {fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1},
  sidebarTip:      {margin:"8px 12px",background:"rgba(109,190,69,0.1)",border:"1px solid rgba(109,190,69,0.2)",borderRadius:12,padding:"12px"},
  tipTitle:        {fontSize:12,fontWeight:700,color:"#6DBE45",marginBottom:4},
  tipText:         {fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5},
  profCard:        {display:"flex",alignItems:"center",gap:8,padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.08)"},
  avatar:          {width:34,height:34,borderRadius:"50%",background:"rgba(234,67,53,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#ea4335",flexShrink:0},
  profInfo:        {flex:1,minWidth:0},
  profName:        {fontSize:12,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  profRole:        {fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:1},
  logoutBtn:       {background:"none",border:"none",cursor:"pointer",fontSize:16,color:"rgba(255,255,255,0.3)",padding:4,flexShrink:0},
  main:            {flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"},
  topBar:          {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:56,background:"#fff",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0,zIndex:10},
  topTitle:        {fontSize:15,fontWeight:700,color:"#1e293b"},
  topRight:        {display:"flex",alignItems:"center",gap:12},
  topDate:         {fontSize:13,color:"#64748b"},
  topAvatar:       {width:32,height:32,borderRadius:"50%",background:"rgba(234,67,53,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#ea4335"},
  content:         {flex:1,padding:"24px",maxWidth:960,margin:"0 auto",width:"100%",overflowY:"auto"},
  welcomeCard:     {display:"grid",gridTemplateColumns:"1fr auto",gap:24,background:"#fff",borderRadius:24,padding:"2rem",boxShadow:"0 4px 20px rgba(0,0,0,0.06)"},
  welcomeLeft:     {},
  welcomeGreeting: {fontSize:24,fontWeight:800,color:"#1e293b",marginBottom:6},
  welcomeSub:      {fontSize:14,color:"#64748b",marginBottom:20},
  welcomeMenu:     {display:"flex",flexDirection:"column",gap:10},
  welcomeItem:     {display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"#f8fafc",border:"1.5px solid #f1f5f9",borderRadius:14,cursor:"pointer",textAlign:"left"},
  welcomeItemIcon: {fontSize:22,width:44,height:44,background:"#fff",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  welcomeItemTitle:{fontSize:14,fontWeight:700,color:"#1e293b"},
  welcomeItemDesc: {fontSize:12,color:"#64748b",marginTop:1},
  welcomeArrow:    {marginLeft:"auto",fontSize:16,color:"#cbd5e1"},
  welcomeRight:    {display:"flex",alignItems:"center"},
  calCard:         {background:"var(--dv-dark)",borderRadius:20,padding:"28px 28px",textAlign:"center",color:"#fff",minWidth:160},
  calDay:          {fontSize:11,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4},
  calDate:         {fontSize:52,fontWeight:900,lineHeight:1,marginBottom:4},
  calMonth:        {fontSize:12,color:"rgba(255,255,255,0.6)",marginBottom:16},
  calDivider:      {height:1,background:"rgba(255,255,255,0.1)",marginBottom:12},
  calHint:         {fontSize:11,color:"rgba(109,190,69,0.8)",lineHeight:1.4},
};
