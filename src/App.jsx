import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Star, 
  Globe, 
  Library, 
  User, 
  X, 
  CheckCircle, 
  Bookmark,
  Sun,
  Moon,
  Camera,
  Info,
  ChevronRight,
  ChevronLeft,
  Target,
  Edit,
  Check
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
// Nota: Se han mantenido tus credenciales originales del archivo subido
const firebaseConfig = {
  apiKey: "AIzaSyA8U6fEY_-6Fh6VqJ5PPk1qGzTNN3Cp4Xs",
  authDomain: "temps-de-llegir-dacd5.firebaseapp.com",
  projectId: "temps-de-llegir-dacd5",
  storageBucket: "temps-de-llegir-dacd5.firebasestorage.app",
  messagingSenderId: "400970923400",
  appId: "1:400970923400:web:11f19df9f7fe3cc4590e3d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'temps-de-llegir-dacd5';

const translations = {
  ca: {
    community: "Comunitat",
    library: "Biblioteca",
    profile: "Perfil",
    search_placeholder: "Cerca un títol o autor...",
    add_book: "Afegir Llibre",
    read: "Llegit",
    pending: "Pendent",
    annual_goal: "Repte Anual",
    dark_mode: "Mode Nit",
    language: "Idioma",
    save: "Guardar",
    success: "Llibre afegit correctament!",
    empty_lib: "Encara no tens llibres. Comença a explorar!",
    rating_label: "Com valores aquest llibre?",
    editorial: "Editorial",
    isbn: "ISBN/EAN",
    synopsis: "Sinopsi",
    upload_avatar: "Canviar foto de perfil",
    review_placeholder: "Escriu la teva opinió...",
    edit_goal: "Modificar repte de lectura",
    sort_recent: "Més recents",
    sort_rating: "Millor valorats",
    sort_alpha: "Ordre alfabètic",
    reviews_count: "valoracions",
    community_opinions: "Opinions de la comunitat",
    edit_name: "Edita el teu nom",
    save_name: "Desa el nom"
  },
  es: {
    community: "Comunidad",
    library: "Biblioteca",
    profile: "Perfil",
    search_placeholder: "Busca un título o autor...",
    add_book: "Añadir Libro",
    read: "Leído",
    pending: "Pendiente",
    annual_goal: "Reto Anual",
    dark_mode: "Modo Noche",
    language: "Idioma",
    save: "Guardar",
    success: "¡Libro añadido correctamente!",
    empty_lib: "Aún no tienes libros. ¡Empieza a explorar!",
    rating_label: "¿Cómo valoras este libro?",
    editorial: "Editorial",
    isbn: "ISBN/EAN",
    synopsis: "Sinopsis",
    upload_avatar: "Cambiar foto de perfil",
    review_placeholder: "Escribe tu opinión...",
    edit_goal: "Modificar reto de lectura",
    sort_recent: "Más recientes",
    sort_rating: "Mejor valorados",
    sort_alpha: "Orden alfabético",
    reviews_count: "valoraciones",
    community_opinions: "Opiniones de la comunidad",
    edit_name: "Edita tu nombre",
    save_name: "Guarda el nombre"
  }
};

const GenericAvatar = ({ className }) => (
  <div className={`bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden ${className}`}>
    <User className="text-slate-400 dark:text-slate-500 w-1/2 h-1/2" />
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('community');
  const [lang, setLang] = useState('ca');
  const [darkMode, setDarkMode] = useState(false);
  const [myBooks, setMyBooks] = useState([]);
  const [rawFeed, setRawFeed] = useState([]); 
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [sortBy, setSortBy] = useState('recent'); 
  
  const [tempRating, setTempRating] = useState(0);
  const [tempStatus, setTempStatus] = useState(null);
  const [tempReview, setTempReview] = useState('');

  const [isEditingName, setIsEditingName] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const fileInputRef = useRef(null);
  const t = translations[lang];

  // --- AUTENTICACIÓN ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Se usa signInAnonymously como respaldo si no hay token de entorno
        await signInAnonymously(auth);
      } catch (err) { console.error("Auth error", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setNewUsername(data.username);
        if (data.lang) setLang(data.lang);
        if (data.darkMode !== undefined) setDarkMode(data.darkMode);
      } else {
        const defaultName = `Lector_${user.uid.slice(0,4)}`;
        setDoc(profileRef, { username: defaultName, annualGoal: 12, avatar: null });
        setNewUsername(defaultName);
      }
    }, (err) => console.error("Error cargando perfil", err));

    const unsubUser = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'books')), (snap) => {
      setMyBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error cargando biblioteca", err));

    const unsubPublic = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'feed')), (snap) => {
      setRawFeed(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error cargando feed público", err));

    return () => { unsubProfile(); unsubUser(); unsubPublic(); };
  }, [user]);

  // --- LÓGICA DE COMUNIDAD ---
  const communityBooks = useMemo(() => {
    const groups = {};
    rawFeed.forEach(entry => {
      const key = entry.isbn || entry.title;
      if (!groups[key]) {
        groups[key] = {
          ...entry,
          allRatings: [entry.rating],
          allReviews: entry.review ? [{ text: entry.review, user: entry.userName, avatar: entry.userAvatar, rating: entry.rating }] : [],
          latestTimestamp: entry.timestamp?.toDate() || new Date(0)
        };
      } else {
        groups[key].allRatings.push(entry.rating);
        if (entry.review) {
          groups[key].allReviews.push({ text: entry.review, user: entry.userName, avatar: entry.userAvatar, rating: entry.rating });
        }
        const entryDate = entry.timestamp?.toDate() || new Date(0);
        if (entryDate > groups[key].latestTimestamp) groups[key].latestTimestamp = entryDate;
      }
    });

    const list = Object.values(groups).map(book => {
      const avg = book.allRatings.reduce((a, b) => a + b, 0) / book.allRatings.length;
      return { ...book, averageRating: avg, totalReviews: book.allRatings.length };
    });

    if (sortBy === 'rating') return list.sort((a, b) => b.averageRating - a.averageRating);
    if (sortBy === 'alpha') return list.sort((a, b) => a.title.localeCompare(b.title));
    return list.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
  }, [rawFeed, sortBy]);

  // --- ACCIONES ---
  const handleSearch = async (queryText) => {
    if (!queryText || queryText.length < 3) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryText)}&maxResults=8`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  const updateGoal = async (increment) => {
    if (!user) return;
    const newGoal = Math.max(1, (profile?.annualGoal || 1) + increment);
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), { annualGoal: newGoal });
  };

  const saveUsername = async () => {
    if (!user || !newUsername.trim()) return;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), { username: newUsername.trim() });
    setIsEditingName(false);
  };

  const handleAvatarUpload = (e) => {
    if (!user) return;
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), { avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveBook = async () => {
    if (!user || !tempStatus) return;
    const info = selectedBook.volumeInfo;
    const bookData = {
      title: info.title,
      authors: info.authors || [],
      thumbnail: info.imageLinks?.thumbnail || '',
      publisher: info.publisher || 'N/A',
      isbn: info.industryIdentifiers?.[0]?.identifier || 'N/A',
      description: info.description || '',
      status: tempStatus,
      rating: tempStatus === 'read' ? tempRating : 0,
      review: tempStatus === 'read' ? tempReview : '',
      timestamp: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'books'), bookData);
      if (tempStatus === 'read') {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'feed'), {
          ...bookData,
          userName: profile?.username || 'Anònim',
          userAvatar: profile?.avatar || null
        });
      }
      setFeedback(t.success);
      setTimeout(() => setFeedback(null), 3000);
      resetModals();
    } catch (e) { console.error(e); }
  };

  const resetModals = () => {
    setSelectedBook(null);
    setShowSearch(false);
    setTempRating(0);
    setTempStatus(null);
    setTempReview('');
  };

  const RatingStars = ({ rating, setRating, interactive = false, showNumber = false }) => (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star}
            size={interactive ? 32 : 14}
            className={`${star <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            onClick={() => interactive && setRating(star)}
          />
        ))}
      </div>
      {showNumber && <span className="text-xs font-black text-yellow-600 dark:text-yellow-400">{rating.toFixed(1)}</span>}
    </div>
  );

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      {feedback && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl font-bold">{feedback}</div>}

      <header className={`sticky top-0 z-50 p-4 backdrop-blur-md border-b flex justify-between items-center ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg text-white"><BookOpen size={20} /></div>
          <h1 className="text-xl font-black tracking-tighter uppercase">Temps de Llegir</h1>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {profile?.avatar ? <img src={profile.avatar} className="h-9 w-9 rounded-full border-2 border-blue-500 object-cover" /> : <GenericAvatar className="h-9 w-9 rounded-full border-2 border-blue-500" />}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-28">
        {activeTab === 'community' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-black">{t.community}</h2>
              <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl">
                {['recent', 'rating', 'alpha'].map(mode => (
                  <button 
                    key={mode}
                    onClick={() => setSortBy(mode)} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === mode ? 'bg-white dark:bg-slate-700 shadow-sm' : 'opacity-50'}`}
                  >
                    {t[`sort_${mode}`]}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {communityBooks.map(b => (
                <div key={b.isbn || b.title} onClick={() => setSelectedBook({ ...b, readOnly: true, isCommunity: true })} className={`group rounded-2xl p-3 cursor-pointer transition-all hover:scale-[1.02] ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-sm border border-slate-100'}`}>
                  <img src={b.thumbnail} className="aspect-[3/4] w-full object-cover rounded-xl mb-3" />
                  <h3 className="font-bold text-sm line-clamp-1">{b.title}</h3>
                  <div className="mt-2 flex items-center justify-between">
                    <RatingStars rating={b.averageRating} showNumber />
                    <span className="text-[10px] font-bold opacity-50 uppercase">{b.totalReviews} {t.reviews_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black">{t.library}</h2>
              <button onClick={() => setShowSearch(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"><Plus size={20} /> {t.add_book}</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {myBooks.map(b => (
                <div key={b.id} onClick={() => setSelectedBook({ volumeInfo: { title: b.title, authors: b.authors, imageLinks: { thumbnail: b.thumbnail }, publisher: b.publisher, industryIdentifiers: [{ identifier: b.isbn }], description: b.description }, rating: b.rating, review: b.review, status: b.status, readOnly: true })} className={`group rounded-2xl p-3 cursor-pointer transition-all hover:scale-[1.02] ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-sm border border-slate-100'}`}>
                  <div className="relative">
                    <img src={b.thumbnail} className="aspect-[3/4] w-full object-cover rounded-xl mb-3" />
                    <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[8px] font-black uppercase ${b.status === 'read' ? 'bg-green-500' : 'bg-blue-500'} text-white`}>{b.status === 'read' ? t.read : t.pending}</div>
                  </div>
                  <h3 className="font-bold text-sm line-clamp-1">{b.title}</h3>
                  {b.status === 'read' && <RatingStars rating={b.rating} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black">{t.profile}</h2>
            <div className={`p-6 rounded-3xl ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white shadow-sm'}`}>
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="relative group">
                  {profile?.avatar ? <img src={profile.avatar} className="h-24 w-24 rounded-3xl object-cover shadow-xl" /> : <GenericAvatar className="h-24 w-24 rounded-3xl shadow-xl" />}
                  <button onClick={() => fileInputRef.current.click()} className="absolute -bottom-2 -right-2 p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:scale-110 transition-transform"><Camera size={16} /></button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </div>
                
                <div className="flex items-center gap-3">
                  {isEditingName ? (
                    <div className="flex items-center gap-2 animate-in fade-in duration-300">
                      <input 
                        autoFocus
                        type="text" 
                        value={newUsername} 
                        onChange={(e) => setNewUsername(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveUsername()}
                        className={`px-3 py-1 rounded-lg border-2 border-blue-500 outline-none font-bold ${darkMode ? 'bg-slate-800' : 'bg-white'}`}
                      />
                      <button onClick={saveUsername} className="p-2 bg-green-500 text-white rounded-lg"><Check size={18}/></button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold">{profile?.username}</h3>
                      <button onClick={() => setIsEditingName(true)} className="p-1.5 opacity-40 hover:opacity-100 hover:text-blue-500 transition-all"><Edit size={16} /></button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-blue-600 text-white shadow-lg relative">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2"><Target size={18} className="opacity-80" /> <span className="text-xs font-black uppercase opacity-80">{t.annual_goal}</span></div>
                    <span className="font-bold">{myBooks.filter(b=>b.status==='read').length} / {profile?.annualGoal}</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-6"><div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.min(100, (myBooks.filter(b=>b.status==='read').length / (profile?.annualGoal || 1)) * 100)}%` }} /></div>
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <span className="text-xs font-bold opacity-80">{t.edit_goal}</span>
                    <div className="flex items-center gap-4 bg-white/10 rounded-xl p-1">
                      <button onClick={() => updateGoal(-1)} className="p-1 hover:bg-white/20 rounded-lg"><ChevronLeft size={20}/></button>
                      <span className="font-black w-6 text-center">{profile?.annualGoal}</span>
                      <button onClick={() => updateGoal(1)} className="p-1 hover:bg-white/20 rounded-lg"><ChevronRight size={20}/></button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-500/5">
                  <div className="flex items-center gap-3"><Globe size={18} className="text-blue-500" /><span className="font-bold">{t.language}</span></div>
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className="bg-transparent font-bold outline-none cursor-pointer"><option value="ca">Català</option><option value="es">Castellano</option></select>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className={`fixed bottom-0 left-0 right-0 border-t p-4 flex justify-around items-center z-50 rounded-t-3xl backdrop-blur-lg ${darkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        {[{ id: 'community', icon: Globe, label: t.community }, { id: 'library', icon: Library, label: t.library }, { id: 'profile', icon: User, label: t.profile }].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center gap-1 transition-all ${activeTab === item.id ? 'text-blue-600 scale-110' : 'opacity-40 hover:opacity-100'}`}><item.icon size={24} /><span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span></button>
        ))}
      </nav>

      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-xl h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-6 border-b flex items-center gap-3">
              <Search className="text-blue-600" />
              <input autoFocus type="text" placeholder={t.search_placeholder} className="flex-1 bg-transparent text-lg font-bold outline-none" onChange={(e) => handleSearch(e.target.value)} />
              <button onClick={() => setShowSearch(false)} className="p-2 hover:bg-slate-500/10 rounded-full"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
              {isSearching ? <div className="col-span-2 flex justify-center py-20"><div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div> : searchResults.map(book => (
                <div key={book.id} onClick={() => setSelectedBook(book)} className={`flex gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${darkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <img src={book.volumeInfo.imageLinks?.thumbnail} className="h-20 w-14 object-cover rounded-lg shadow-sm" />
                  <div className="flex-1 min-w-0"><h4 className="font-bold text-sm line-clamp-2 leading-tight">{book.volumeInfo.title}</h4></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedBook && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-lg rounded-[2.5rem] p-8 my-8 relative animate-in slide-in-from-bottom duration-300 ${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            <button onClick={() => setSelectedBook(null)} className="absolute right-6 top-6 p-2 rounded-full hover:bg-slate-500/10"><X /></button>
            
            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              <img src={selectedBook.thumbnail || selectedBook.volumeInfo?.imageLinks?.thumbnail} className="w-32 h-48 object-cover rounded-2xl shadow-2xl self-center" />
              <div className="flex-1 space-y-2">
                <h3 className="text-2xl font-black leading-tight">{selectedBook.title || selectedBook.volumeInfo?.title}</h3>
                <p className="text-blue-600 font-bold">{(selectedBook.authors || selectedBook.volumeInfo?.authors)?.join(', ')}</p>
                <div className="pt-2 space-y-1 opacity-70 text-sm">
                  <p><strong>{t.editorial}:</strong> {selectedBook.publisher || selectedBook.volumeInfo?.publisher}</p>
                  <p><strong>{t.isbn}:</strong> {selectedBook.isbn || selectedBook.volumeInfo?.industryIdentifiers?.[0]?.identifier}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-500/5 max-h-32 overflow-y-auto text-sm leading-relaxed">
                <h4 className="font-bold flex items-center gap-2 mb-2"><Info size={16}/> {t.synopsis}</h4>
                <p className="opacity-80">{(selectedBook.description || selectedBook.volumeInfo?.description || 'Cap sinopsi disponible.').replace(/<[^>]*>?/gm, '')}</p>
              </div>

              {!selectedBook.readOnly ? (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setTempStatus('read')} className={`p-4 rounded-2xl font-bold flex flex-col items-center gap-2 transition-all border-2 ${tempStatus === 'read' ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-slate-500/20'}`}><CheckCircle /> {t.read}</button>
                    <button onClick={() => {setTempStatus('pending'); setTempRating(0);}} className={`p-4 rounded-2xl font-bold flex flex-col items-center gap-2 transition-all border-2 ${tempStatus === 'pending' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-slate-500/20'}`}><Bookmark /> {t.pending}</button>
                  </div>
                  {tempStatus === 'read' && (
                    <div className="space-y-4 animate-in slide-in-from-top-2">
                      <div className="flex flex-col items-center gap-2"><span className="text-sm font-bold opacity-70">{t.rating_label}</span><RatingStars rating={tempRating} setRating={setTempRating} interactive /></div>
                      <textarea className={`w-full p-4 rounded-2xl text-sm border-2 outline-none focus:border-blue-500 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`} placeholder={t.review_placeholder} rows="3" value={tempReview} onChange={(e) => setTempReview(e.target.value)} />
                    </div>
                  )}
                  <button disabled={!tempStatus || (tempStatus === 'read' && tempRating === 0)} onClick={saveBook} className="w-full py-5 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all">{t.save}</button>
                </div>
              ) : selectedBook.isCommunity ? (
                <div className="space-y-4">
                  <h4 className="font-black text-xs uppercase text-blue-500 tracking-wider flex items-center gap-2"><Globe size={14}/> {t.community_opinions}</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {selectedBook.allReviews?.map((rev, i) => (
                      <div key={i} className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            {rev.avatar ? <img src={rev.avatar} className="h-6 w-6 rounded-full object-cover" /> : <GenericAvatar className="h-6 w-6 rounded-full" />}
                            <span className="font-bold text-xs">{rev.user}</span>
                          </div>
                          <RatingStars rating={rev.rating} />
                        </div>
                        <p className="text-sm opacity-80 italic leading-snug">"{rev.text}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedBook.review && (
                <div className="p-4 rounded-2xl border-2 border-blue-500/20 bg-blue-500/5">
                  <div className="flex justify-between items-center mb-2"><span className="text-xs font-black uppercase text-blue-500">La teva opinió</span><RatingStars rating={selectedBook.rating} /></div>
                  <p className="text-sm italic font-medium opacity-90">"{selectedBook.review}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}