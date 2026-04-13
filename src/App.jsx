import { useState, useRef, useEffect } from 'react';
import { Upload, X, Save, Edit2, Trash2, DownloadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Plus, Info } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Supabase Init
const SUPABASE_URL = "https://qjipcijesxlwnqdrsljl.supabase.co";
const SUPABASE_KEY = "sb_publishable_xbGNC6A3fRVrtr7YEmV8tA_EwyB2t39";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function App() {
  const [tournament, setTournament] = useState(() => {
    const saved = localStorage.getItem('karate_tournament');
    return saved ? JSON.parse(saved) : null;
  });
  const [errorMsg, setErrorMsg] = useState("");
  
  // Organization Info
  const [clubName, setClubName] = useState(() => localStorage.getItem('karate_clubName') || '');
  const [teamLeader, setTeamLeader] = useState(() => localStorage.getItem('karate_teamLeader') || '');
  const [coach1, setCoach1] = useState(() => localStorage.getItem('karate_coach1') || '');
  const [coach2, setCoach2] = useState(() => localStorage.getItem('karate_coach2') || '');
  const [coach3, setCoach3] = useState(() => localStorage.getItem('karate_coach3') || '');

  const [athletes, setAthletes] = useState(() => {
    const saved = localStorage.getItem('karate_athletes');
    return saved ? JSON.parse(saved) : [];
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState({ show: false, type: 'success', title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });
  const [eventSearch, setEventSearch] = useState('');
  const [showEventList, setShowEventList] = useState(false);

  // Persistence Effects
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem('karate_tournament', JSON.stringify(tournament));
    localStorage.setItem('karate_athletes', JSON.stringify(athletes));
    localStorage.setItem('karate_clubName', clubName);
    localStorage.setItem('karate_teamLeader', teamLeader);
    localStorage.setItem('karate_coach1', coach1);
    localStorage.setItem('karate_coach2', coach2);
    localStorage.setItem('karate_coach3', coach3);
  }, [tournament, athletes, clubName, teamLeader, coach1, coach2, coach3]);
  
  const initialAthleteState = { name: '', gender: 'male', birthDateStr: '', eventId: '', weight: '', isTeam: false };
  const [currentAthlete, setCurrentAthlete] = useState(initialAthleteState);

  const fileInputRef = useRef(null);

  const parseVietnameseDate = (str) => {
    if (!str) return null;
    const clean = str.trim();
    if (/^\d{4}$/.test(clean)) return `${clean}-01-01`; // YYYY
    const parts = clean.split(/[-\/.]/);
    if (parts.length === 3) {
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (y < 100) y += 2000;
      if (d > 31 && y <= 31) { // If typed YYYY-MM-DD
        return `${d}-${String(m).padStart(2, '0')}-${String(y).padStart(2, '0')}`;
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; // returns YYYY-MM-DD
    }
    return null;
  };

  const formatVietnameseDate = (isoString) => {
    if(!isoString) return "";
    const parts = isoString.split('-');
    if(parts.length !== 3) return isoString;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };

  const showToast = (type, title, message) => {
    setToast({ show: true, type, title, message });
    setTimeout(() => setToast(prev => ({...prev, show: false})), 4000);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmModal({ show: true, message, onConfirm });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const decoded = JSON.parse(decodeURIComponent(escape(atob(content))));
        
        if (decoded._signature !== 'KRT_KARATE_TOURNAMENT') {
          throw new Error('File không đúng định dạng Điều lệ Karate');
        }
        
        setTournament(decoded.data);
        setAthletes([]);
        setErrorMsg("");
        setEventSearch("");
        showToast('success', 'Thành công', 'Đã tải điều lệ giải đấu: ' + decoded.data.tournamentName);
      } catch (err) {
        setErrorMsg("Lỗi: File .krt không hợp lệ hoặc đã bị hỏng.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = null; // reset input
  };

  const resetApp = () => {
    showConfirm("Bạn có chắc muốn thoát giải đấu này? Dữ liệu chưa nộp sẽ bị mất.", () => {
      localStorage.removeItem('karate_tournament');
      localStorage.removeItem('karate_athletes');
      localStorage.removeItem('karate_clubName');
      localStorage.removeItem('karate_teamLeader');
      localStorage.removeItem('karate_coach1');
      localStorage.removeItem('karate_coach2');
      localStorage.removeItem('karate_coach3');
      
      setTournament(null);
      setAthletes([]);
      setClubName("");
      setTeamLeader("");
      setCoach1("");
      setCoach2("");
      setCoach3("");
      setErrorMsg("");
      setEventSearch("");
    });
  };

  const isKumite = (eventId) => {
    if(!tournament || !eventId) return false;
    const event = tournament.events.find(e => e.id === eventId);
    return event && (event.type === 'kumite' || (event.name && event.name.toLowerCase().includes('kumite')));
  };

  const getEventName = (eventId) => {
    if(!tournament) return "";
    const event = tournament.events.find(e => e.id === eventId);
    return event ? event.name : "Không xác định";
  };

  const handleEventSelect = (ev) => {
    let isTeam = currentAthlete.isTeam;
    // Auto tick "Đồng đội" if event name contains corresponding keywords
    if (ev && ev.name) {
      const nameL = ev.name.toLowerCase();
      if (nameL.includes('đồng đội') || nameL.includes('hỗn hợp')) {
        isTeam = true;
      }
    }
    setCurrentAthlete({ ...currentAthlete, eventId: ev.id, isTeam });
    setEventSearch(ev.name);
    setShowEventList(false);
  };

  const saveAthlete = (e) => {
    e.preventDefault();
    
    if(!clubName.trim()){
      showToast('error', 'Thiếu thông tin', "Vui lòng nhập Tên Câu lạc bộ / Đoàn ở mục (1) trên cùng trước khi thêm VĐV.");
      return;
    }

    if(!currentAthlete.name.trim()){
      showToast('error', 'Thông tin chưa đủ', "Vui lòng nhập đầy đủ Họ và tên VĐV.");
      return;
    }
    if(!currentAthlete.birthDateStr){
      showToast('error', 'Thông tin chưa đủ', "Vui lòng nhập Năm sinh hoặc Ngày sinh (Ví dụ: 2005 hoặc 15/05/2005).");
      return;
    }
    if(!currentAthlete.eventId){
      showToast('error', 'Thông tin chưa đủ', "Vui lòng chọn Nội dung thi đấu.");
      return;
    }

    if(isKumite(currentAthlete.eventId) && !currentAthlete.weight){
      showToast('error', 'Thiếu cân nặng', "Bạn đăng ký nội dung Đối kháng, vui lòng nhập Cân nặng thực tế.");
      return;
    }
    
    // Parse valid Date
    const isoDate = parseVietnameseDate(currentAthlete.birthDateStr);
    if (!isoDate) {
      showToast('error', 'Sai định dạng ngày', 'Vui lòng nhập Ngày sinh đúng chuẩn: DD/MM/YYYY hoặc điền 4 số Năm sinh (Tránh chữ cái).');
      return;
    }

    const athleteData = {
      ...currentAthlete,
      id: editingId || 'temp_' + Date.now().toString(36),
      eventName: getEventName(currentAthlete.eventId),
      weight: currentAthlete.weight ? parseFloat(currentAthlete.weight) : null,
      birthDate: isoDate,
      isTeam: currentAthlete.isTeam || false
    };

    if(editingId) {
      setAthletes(athletes.map(a => a.id === editingId ? athleteData : a));
    } else {
      setAthletes([...athletes, athleteData]);
    }

    setEditingId(null);
    setCurrentAthlete(initialAthleteState);
    setEventSearch('');
  };

  const editAthlete = (a) => {
    setEditingId(a.id);
    setCurrentAthlete({ ...a, birthDateStr: formatVietnameseDate(a.birthDate) });
    setEventSearch(a.eventName || '');
  };

  const removeAthlete = (id) => {
    showConfirm("Chắc chắn xóa vận động viên này khỏi danh sách?", () => {
      setAthletes(athletes.filter(a => a.id !== id));
    });
  };

  const exportExcel = () => {
    if (!clubName.trim()) {
      showToast('error', 'Cảnh báo', 'Vui lòng nhập tên Câu lạc bộ / Đoàn trước khi Xuất Excel.');
      return;
    }
    if (athletes.length === 0) {
      showToast('error', 'Cảnh báo', 'Không có dữ liệu VĐV để xuất file.');
      return;
    }

    const additionalCoaches = [coach2.trim(), coach3.trim()].filter(Boolean);
    const exportDataStr = {
      tournamentId: tournament.tournamentId,
      tournamentName: tournament.tournamentName,
      coachName: coach1.trim() || "Chưa cập nhật",
      clubName: clubName.trim(),
      teamLeaderName: teamLeader.trim(),
      additionalCoaches: additionalCoaches,
      exportTime: new Date().toISOString(),
      athletes: athletes.map(a => ({
          ...a, 
          club: clubName.trim(),
          birthYear: new Date(a.birthDate).getFullYear()
      })),
      targetRole: 'admin',
    };

    const wb = XLSX.utils.book_new();

    // Sheet 1: Thông tin chung
    const allCoaches = [exportDataStr.coachName, ...additionalCoaches].filter(Boolean);
    const infoData = [
      ["DANH SÁCH VĐV"],
      [""],
      ["Mã giải đấu:", exportDataStr.tournamentId],
      ["Tên giải đấu:", exportDataStr.tournamentName],
      ["Tên HLV:", exportDataStr.coachName],
      ["HLV phụ:", additionalCoaches.join(", ")],
      ["Tên CLB:", exportDataStr.clubName],
      ["Trưởng đoàn:", exportDataStr.teamLeaderName],
      ["Tổng số HLV:", allCoaches.length],
      ["Thời gian xuất:", new Date(exportDataStr.exportTime).toLocaleString("vi-VN")],
      ["Số VĐV:", exportDataStr.athletes.length],
      [""],
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
    XLSX.utils.book_append_sheet(wb, infoSheet, "Thông tin");

    // Sheet 2: Danh sách VĐV
    const athleteHeaders = ["STT", "Họ tên", "Ngày sinh", "Giới tính", "CLB", "Nội dung", "Cân nặng (kg)", "Hạt giống", "Đồng đội"];
    const athleteRows = exportDataStr.athletes.map((a, i) => {
      let birthDisplay = "";
      if (a.birthDate) {
        const [y, m, d] = a.birthDate.split("-");
        birthDisplay = `${d}/${m}/${y}`;
      } else if (a.birthYear) {
        birthDisplay = String(a.birthYear);
      }
      return [
        i + 1,
        a.name,
        birthDisplay,
        a.gender === "male" ? "Nam" : (a.gender === "female" ? "Nữ" : "—"),
        a.club,
        a.eventName,
        a.weight || "",
        "", // seed
        a.isTeam ? "Có" : "Không",
      ];
    });
    const athleteData = [athleteHeaders, ...athleteRows];
    const athleteSheet = XLSX.utils.aoa_to_sheet(athleteData);
    athleteSheet["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, athleteSheet, "Danh sách VĐV");

    // Sheet 3: Dữ liệu JSON (để Admin import)
    const jsonStr = JSON.stringify(exportDataStr);
    const CHUNK_SIZE = 30000;
    const jsonChunks = [];
    for (let i = 0; i < jsonStr.length; i += CHUNK_SIZE) {
      jsonChunks.push([jsonStr.substring(i, i + CHUNK_SIZE)]);
    }
    const jsonSheetContent = [["JSON_DATA_CHUNKS"], ...jsonChunks];
    const jsonSheet = XLSX.utils.aoa_to_sheet(jsonSheetContent);
    XLSX.utils.book_append_sheet(wb, jsonSheet, "Data");

    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
    XLSX.writeFile(wb, `VDV_${clubName.trim() || 'CLB'}_${ts}.xlsx`);
    showToast('success', 'Thành công', 'Đã xuất file Excel tiêu chuẩn cho BTC.');
  };

  const submitToCloud = async () => {
    if (!clubName.trim()) {
      showToast('error', 'Cảnh báo', 'Vui lòng nhập tên Câu lạc bộ / Đoàn');
      return;
    }
    if (athletes.length === 0) {
      showToast('error', 'Cảnh báo', 'Vui lòng thêm ít nhất 1 Vận động viên');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const localTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
      
      const additionalCoaches = [coach2.trim(), coach3.trim()].filter(Boolean);

      const exportData = {
        tournamentId: tournament.tournamentId,
        tournamentName: tournament.tournamentName,
        coachName: coach1.trim() || "Chưa cập nhật",
        clubName: clubName.trim(),
        teamLeaderName: teamLeader.trim(),
        additionalCoaches: additionalCoaches,
        exportTime: new Date().toISOString(),
        athletes: athletes.map(a => ({
          ...a, 
          club: clubName.trim(),
          birthYear: new Date(a.birthDate).getFullYear()
        })),
        targetRole: 'admin',
      };

      const { error } = await supabase
        .from('athlete_submissions')
        .upsert({
          tournament_id: tournament.tournamentId,
          club_name: clubName.trim(),
          data: {
            updated_at_local: localTime,
            last_updated: now.toISOString(),
            ...exportData
          },
          submitted_at: now.toISOString()
        }, { onConflict: 'tournament_id,club_name' });

      if (error) throw error;
      
      showToast('success', 'Nộp thành công!', `Đã nộp danh sách trực tiếp cho BTC!`);
    } catch (error) {
      console.error('Supabase submit error:', error);
      showToast('error', 'Lỗi mạng', error.message || "Vui lòng Xuất Excel và gửi cho BTC.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 relative">
      {/* Custom Confirm Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-slate-100">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Xác nhận</h3>
              <p className="text-slate-600 text-center text-sm">{confirmModal.message}</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button 
                onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ show: false, message: '', onConfirm: null });
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-50 transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl shadow-2xl border ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'} max-w-[90vw] sm:max-w-sm`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-500" /> : <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-500" />}
          <div>
            <h4 className={`font-bold text-sm ${toast.type === 'error' ? 'text-red-800' : 'text-emerald-800'}`}>{toast.title}</h4>
            <p className={`text-sm mt-0.5 leading-tight ${toast.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{toast.message}</p>
          </div>
          <button onClick={() => setToast(prev => ({...prev, show: false}))} className={`ml-auto p-1 rounded-md flex-shrink-0 ${toast.type === 'error' ? 'hover:bg-red-100 text-red-500' : 'hover:bg-emerald-100 text-emerald-500'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg py-3 px-4 sm:py-4 sm:px-6 sticky top-0 z-10 transition-all">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-lg sm:text-xl font-bold tracking-wide flex items-center gap-2 leading-tight">
              <Upload className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" /> <span className="truncate">ĐĂNG KÝ VĐV TRỰC TUYẾN</span>
            </h1>
            {tournament && <p className="text-blue-100 text-xs sm:text-sm mt-1 truncate max-w-full" title={tournament.tournamentName}>{tournament.tournamentName}</p>}
          </div>
          {tournament && (
            <button onClick={resetApp} className="bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-sm whitespace-nowrap">
              <X className="w-4 h-4" /> Đổi giải
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-4 sm:mt-8 px-2 sm:px-4">
        {!tournament ? (
          <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-xl text-center border border-slate-100 max-w-2xl mx-auto mt-6 sm:mt-10 animate-fade-in mx-2">
            <div className="mb-4 sm:mb-6 flex justify-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                <Upload className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Bắt đầu đăng ký</h2>
            <p className="text-sm sm:text-base text-slate-500 mb-6 sm:mb-8 px-4">Vui lòng tải lên file Điều lệ <span className="font-bold text-blue-600">(.krt)</span> do BTC cung cấp.</p>
            
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-xl transition shadow-lg shadow-blue-200 inline-flex items-center justify-center gap-3 text-base sm:text-lg w-full sm:w-auto">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" /> Chọn file .krt
              <input type="file" accept=".krt" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </label>
            {errorMsg && <div className="mt-6 text-red-500 text-sm font-medium bg-red-50 p-4 rounded-lg">{errorMsg}</div>}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6 animate-fade-in pb-10">
            {/* Form General Info */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                1. Thông tin Đơn vị
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">Tên Câu lạc bộ / Đoàn <span className="text-red-500">*</span></label>
                  <input 
                    value={clubName} 
                    onChange={e => setClubName(e.target.value)}
                    type="text" 
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                    placeholder="Ví dụ: CLB Karate Quận 1" />
                </div>
                
                <div className="sm:col-span-1 lg:col-span-1">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Trưởng đoàn</label>
                  <input 
                    value={teamLeader} 
                    onChange={e => setTeamLeader(e.target.value)}
                    type="text" 
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                    placeholder="Họ và tên" />
                </div>

                <div className="sm:col-span-1 lg:col-span-1">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">HLV Số 1 (Chính)</label>
                  <input 
                    value={coach1} 
                    onChange={e => setCoach1(e.target.value)}
                    type="text" 
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                    placeholder="Họ và tên" />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 line-clamp-1">HLV Số 2</label>
                    <input 
                      value={coach2} 
                      onChange={e => setCoach2(e.target.value)}
                      type="text" 
                      className="w-full px-2 py-2 sm:px-3 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                      placeholder="..." />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 line-clamp-1">HLV Số 3</label>
                    <input 
                      value={coach3} 
                      onChange={e => setCoach3(e.target.value)}
                      type="text" 
                      className="w-full px-2 py-2 sm:px-3 sm:py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                      placeholder="..." />
                  </div>
                </div>

              </div>
            </div>

            {/* Athletes Section */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4 border-b pb-4">
                2. Danh sách VĐV (<span className="text-blue-600">{athletes.length}</span>)
              </h3>

              {/* Add form */}
              <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200 mb-6">
                <h4 className="font-bold text-slate-700 mb-3 sm:mb-4 text-xs sm:text-sm uppercase tracking-wide flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {editingId ? 'Chỉnh sửa thông tin' : 'Thêm Vận động viên'}
                </h4>

                <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 text-amber-800 shadow-sm">
                  <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                  <p className="text-[13px] sm:text-sm leading-relaxed">
                    <strong className="font-bold text-amber-900 block mb-0.5">Lưu ý: Một VĐV đăng ký nhiều Nội dung?</strong>
                    Mỗi lượt đấu là <strong>1 dòng riêng biệt</strong>. Nếu VĐV đấu 2 nội dung (VD: Cá nhân & Đồng đội), HLV vui lòng <strong>nhập tên và bấm [Thêm VĐV] 2 lần</strong> để tạo thành 2 dòng dưới danh sách. Mục đích của ô tick Đồng Đội bên dưới chỉ để xác nhận vé thi đó là đội nhóm!
                  </p>
                </div>

                <form onSubmit={saveAthlete} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 sm:gap-4 items-end">
                  <div className="sm:col-span-2 md:col-span-5 lg:col-span-5">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Họ và tên <span className="text-red-500">*</span></label>
                    <input value={currentAthlete.name} onChange={e => setCurrentAthlete({...currentAthlete, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-md sm:rounded-lg text-sm focus:border-blue-500 outline-none" placeholder="Nguyễn Văn A" />
                  </div>
                  <div className="sm:col-span-1 md:col-span-3 lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Giới tính</label>
                    <select value={currentAthlete.gender} onChange={e => setCurrentAthlete({...currentAthlete, gender: e.target.value})} className="w-full px-3 py-2 border border-slate-300 bg-white rounded-md sm:rounded-lg text-sm focus:border-blue-500 outline-none appearance-none">
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1 md:col-span-4 lg:col-span-4">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày sinh / Năm sinh <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      value={currentAthlete.birthDateStr || ''} 
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        if (rawValue.length < (currentAthlete.birthDateStr || '').length) {
                          setCurrentAthlete({...currentAthlete, birthDateStr: rawValue});
                          return;
                        }
                        if (rawValue.includes('/')) {
                          setCurrentAthlete({...currentAthlete, birthDateStr: rawValue.replace(/[^\d/]/g, '')});
                          return;
                        }
                        let input = rawValue.replace(/[^\d]/g, '');
                        if (input.length > 8) input = input.slice(0, 8);
                        let formatted = input;
                        if (input.length > 4) {
                          formatted = `${input.slice(0, 2)}/${input.slice(2, 4)}/${input.slice(4)}`;
                        }
                        setCurrentAthlete({...currentAthlete, birthDateStr: formatted});
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md sm:rounded-lg text-sm focus:border-blue-500 outline-none placeholder:text-slate-400" 
                      placeholder="VD: 15/05/2005 hoặc 2005" 
                      autoComplete="off"
                    />
                  </div>
                  <div className="sm:col-span-2 md:col-span-8 lg:col-span-9 relative">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nội dung thi đấu <span className="text-red-500">*</span></label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 bg-white rounded-md sm:rounded-lg text-sm focus:border-blue-500 outline-none"
                      placeholder="Gõ để tìm nội dung..."
                      value={eventSearch}
                      onChange={e => {
                        setEventSearch(e.target.value);
                        setShowEventList(true);
                        setCurrentAthlete({...currentAthlete, eventId: ''});
                      }}
                      onFocus={() => setShowEventList(true)}
                      onBlur={() => setTimeout(() => setShowEventList(false), 200)}
                      title={eventSearch}
                    />
                    {showEventList && (
                      <ul className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl shadow-blue-900/5 max-h-56 overflow-y-auto">
                        {tournament.events.filter(ev => ev.name.toLowerCase().includes(eventSearch.toLowerCase())).length === 0 && (
                          <li className="p-3 text-slate-500 text-sm">Không tìm thấy nội dung nào...</li>
                        )}
                        {tournament.events.filter(ev => ev.name.toLowerCase().includes(eventSearch.toLowerCase())).map(ev => (
                          <li key={ev.id} 
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm font-medium border-b border-slate-50 last:border-0 text-slate-700 whitespace-normal leading-snug"
                              onClick={() => handleEventSelect(ev)}>
                            {ev.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="sm:col-span-1 md:col-span-4 lg:col-span-3 relative">
                    <label className="block text-xs font-semibold text-slate-600 mb-1 line-clamp-1">Cân nặng thực tế {isKumite(currentAthlete.eventId) && <span className="text-red-500">*</span>}</label>
                    <input type="number" step="0.1" value={currentAthlete.weight} onChange={e => setCurrentAthlete({...currentAthlete, weight: e.target.value})} disabled={!isKumite(currentAthlete.eventId)} className="w-full px-3 py-2 border border-slate-300 rounded-md sm:rounded-lg text-sm focus:border-blue-500 outline-none disabled:bg-slate-100" placeholder="0.0" />
                  </div>
                  
                  <div className="sm:col-span-2 md:col-span-12 flex flex-col sm:flex-row justify-between items-center gap-3 mt-3 p-3 bg-white rounded-xl border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" className="w-5 h-5 text-blue-600 rounded border-slate-300 cursor-pointer accent-blue-600" checked={currentAthlete.isTeam} onChange={e => setCurrentAthlete({...currentAthlete, isTeam: e.target.checked})} />
                      <span className="text-sm font-semibold text-slate-700">VĐV Thi đấu Đồng Đội / Hỗn Hợp</span>
                    </label>

                    <div className="flex gap-2 w-full sm:w-auto">
                      {editingId && <button type="button" onClick={() => {setEditingId(null); setCurrentAthlete(initialAthleteState); setEventSearch('');}} className="flex-1 sm:flex-none px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-md sm:rounded-lg transition font-medium justify-center flex">Hủy</button>}
                      <button type="submit" className="flex-1 sm:flex-none px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md sm:rounded-lg font-semibold shadow-sm transition flex items-center justify-center gap-2">
                         {editingId ? 'Lưu VĐV' : 'Thêm VĐV'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white scrollbar-thin scrollbar-thumb-slate-200">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-slate-100/80 text-slate-700 border-b">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 font-semibold w-12 text-center text-xs sm:text-sm">STT</th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-xs sm:text-sm">Họ và tên</th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-xs sm:text-sm">Giới tính</th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-center text-xs sm:text-sm">Năm sinh</th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-xs sm:text-sm">Nội dung</th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-center text-xs sm:text-sm w-16">Kg</th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-center text-xs sm:text-sm">Đồng Đội</th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-center text-xs sm:text-sm w-20">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {athletes.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-10 text-center text-slate-400 font-medium">Chưa có VĐV nào được thêm.</td>
                      </tr>
                    ) : (
                      athletes.map((a, i) => (
                        <tr key={a.id} className="border-b hover:bg-slate-50 border-slate-100 transition-colors">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-500 text-center">{i + 1}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 font-semibold text-slate-900">{a.name}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-600">{a.gender === 'male' ? 'Nam' : 'Nữ'}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-slate-600 text-center">{a.birthDate ? formatVietnameseDate(a.birthDate) : '---'}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 min-w-[180px]" title={a.eventName}>
                            <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold whitespace-normal inline-block leading-tight border border-blue-100">{a.eventName}</span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center font-medium opacity-80">{a.weight ? a.weight : '-'}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                            {a.isTeam ? <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold">✓ Có</span> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-center flex justify-center gap-1 sm:gap-2 mt-1">
                            <button onClick={() => editAthlete(a)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Sửa"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => removeAthlete(a.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Thống kê */}
              {athletes.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex flex-col justify-center">
                    <div className="text-[11px] text-blue-600 font-bold uppercase tracking-wider mb-0.5">Tổng lượt đấu</div>
                    <div className="text-xl sm:text-2xl font-black text-blue-800">{athletes.length}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex flex-col justify-center">
                    <div className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider mb-0.5" title="Số lượng cá nhân thực tế">Tổng VĐV</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-800">{new Set(athletes.map(a => a.name.trim().toLowerCase())).size}</div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex flex-col justify-center">
                    <div className="text-[11px] text-indigo-600 font-bold uppercase tracking-wider mb-0.5">Lượt Nam</div>
                    <div className="text-xl sm:text-2xl font-black text-indigo-800">{athletes.filter(a => a.gender === 'male').length}</div>
                  </div>
                  <div className="bg-pink-50 border border-pink-100 p-3 rounded-xl flex flex-col justify-center">
                    <div className="text-[11px] text-pink-600 font-bold uppercase tracking-wider mb-0.5">Lượt Nữ</div>
                    <div className="text-xl sm:text-2xl font-black text-pink-800">{athletes.filter(a => a.gender === 'female').length}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex flex-col justify-center">
                    <div className="text-[11px] text-amber-600 font-bold uppercase tracking-wider mb-0.5">Đồng đội</div>
                    <div className="text-xl sm:text-2xl font-black text-amber-800">{athletes.filter(a => a.isTeam).length}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
              <p className="text-xs sm:text-sm text-slate-500 text-center md:text-left italic">Xin HLV vui lòng kiểm tra thật kỳ thông tin về <span className="font-semibold">Nội dung</span> và <span className="font-semibold">Cân nặng</span> trước khi nhấn nộp!</p>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button onClick={exportExcel} className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 rounded-xl font-bold transition flex items-center justify-center gap-2">
                  <DownloadCloud className="w-5 h-5" /> Xuất Excel
                </button>
                <button onClick={submitToCloud} disabled={submitting} className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-lg shadow-blue-200/50 flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:shadow-none focus:ring-4 focus:ring-blue-100">
                  <Save className="w-5 h-5 flex-shrink-0" /> <span className="whitespace-nowrap">{submitting ? 'ĐANG XỬ LÝ...' : 'NỘP LÊN BTC'}</span>
                </button>
              </div>
            </div>
            
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
