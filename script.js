const { useState, useEffect, useMemo, useRef } = React;
const { initializeApp } = FirebaseApp;
const { getAuth, signInAnonymously, onAuthStateChanged } = FirebaseAuth;
const { getFirestore, collection, onSnapshot, query, doc, setDoc, addDoc, updateDoc, serverTimestamp } = FirebaseFirestore;
const { BookOpen, Search, Plus, Star, Globe, Library, User, X, CheckCircle, Bookmark, Sun, Moon, Camera, Info, ChevronRight, ChevronLeft, Target, Edit, Check } = Lucide;

// --- CONFIGURACIÓN DE FIREBASE ---
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
    community: "Comunitat", library: "Biblioteca", profile: "Perfil", search_placeholder: "Cerca un títol o autor...", add_book: "Afegir Llibre", read: "Llegit", pending: "Pendent", annual_goal: "Repte Anual", dark_mode: "Mode Nit", language: "Idioma", save: "Guardar", success: "Llibre afegit correctament!", empty_lib: "Encara no tens llibres. Comença a explorar!", rating_label: "Com valores aquest llibre?", editorial: "Editorial", isbn: "ISBN/EAN", synopsis: "Sinopsi", upload_avatar: "Canviar foto de perfil", review_placeholder: "Escriu la teva opinió...", edit_goal: "Modificar repte de lectura", sort_recent: "Més recents", sort_rating: "Millor valorats", sort_alpha: "Ordre alfabètic", reviews_count: "valoracions", community_opinions: "Opinions de la comunitat", edit_name: "Edita el teu nom", save_name: "Desa el nom"
  },
  es: {
    community: "Comunidad", library: "Biblioteca", profile: "Perfil", search_placeholder: "Busca un título o autor...", add_book: "Añadir Libro", read: "Leído", pending: "Pendiente", annual_goal: "Reto Anual", dark_mode: "Modo Noche", language: "Idioma", save: "Guardar", success: "¡Libro añadido correctamente!", empty_lib: "Aún no tienes libros. ¡Empieza a explorar!", rating_label: "¿Cómo valoras este libro?", editorial: "Editorial", isbn: "ISBN/EAN", synopsis: "Sinopsis", upload_avatar: "Cambiar foto de perfil", review_placeholder: "Escribe tu opinión...", edit_goal: "Modificar reto de lectura", sort_recent: "Más recientes", sort_rating: "Mejor valorados", sort_alpha: "Orden alfabético", reviews_count: "valoraciones", community_opinions: "Opiniones de la comunidad", edit_name: "Edita tu nombre", save_name: "Guarda el nombre"
  }
};

const GenericAvatar = ({ className }) => (
  <div className={`bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden ${className}`}>
    <User className="text-slate-400 dark:text-slate-500 w-1/2 h-1/2" />
  </div>
);

function App() {
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

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error("Auth error", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

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
    });
    const unsubUser = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'books')), (snap) => {
      setMyBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubPublic = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'feed')), (snap) => {
      setRawFeed(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubProfile(); unsubUser(); unsubPublic(); };
  }, [user]);

  const communityBooks = useMemo(() => {
    const groups = {};
    rawFeed.forEach(entry => {
      const key = entry.isbn || entry.title;
      if (!groups[key]) {
        groups[key] = { ...entry, allRatings: [entry.rating], allReviews: entry.review ? [{ text: entry.review, user: entry.userName, avatar: entry.userAvatar, rating: entry.rating }] : [], latestTimestamp: entry.timestamp?.toDate() || new Date(0) };
      } else {
        groups[key].allRatings.push(entry.rating);
        if (entry.review) groups[key].allReviews.push({ text: entry.review, user: entry.userName, avatar: entry.userAvatar, rating: entry.rating });
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
      reader.onloadend = async () => { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), { avatar: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  const saveBook = async () => {
    if (!user || !tempStatus) return;
    const info = selectedBook.volumeInfo;
    const bookData = { title: info.title, authors: info.authors || [], thumbnail: info.imageLinks?.thumbnail || '', publisher: info.publisher || 'N/A', isbn: info.industryIdentifiers?.[0]?.identifier || 'N/A', description: info.description || '', status: tempStatus, rating: tempStatus === 'read' ? tempRating : 0, review: tempStatus === 'read' ? tempReview : '', timestamp: serverTimestamp() };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'books'), bookData);
      if (tempStatus === 'read') { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'feed'), { ...bookData, userName: profile?.username || 'Anònim', userAvatar: profile?.avatar || null }); }
      setFeedback(t.success);
      setTimeout(() => setFeedback(null), 3000);
      setSelectedBook(null); setShowSearch(false); setTempRating(0); setTempStatus(null); setTempReview('');
    } catch (e) { console.error(e); }
  };

  const RatingStars = ({ rating, setRating, interactive = false, showNumber = false }) => (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={interactive ? 32 : 14} className={`${star <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'} ${interactive ? 'cursor-pointer' : ''}`} onClick={() => interactive && setRating(star)} />
        ))}
      </div>
      {showNumber && <span className="text-xs font-black">{rating.toFixed(1)}</span>}
    </div>
  );

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`sticky top-0 z-50 p-4 border-b flex justify-between items-center ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center gap-2"><div className="p-2 bg-blue-600 rounded-lg text-white"><BookOpen size={20} /></div><h1 className="text-xl font-black uppercase">Temps de Llegir</h1></div>
        <div className="flex items-center gap-3">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
          {profile?.avatar ? <img src={profile.avatar} className="h-9 w-9 rounded-full object-cover" /> : <GenericAvatar className="h-9 w-9 rounded-full" />}
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 pb-28">
        {activeTab === 'community' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black">{t.community}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {communityBooks.map(b => (
                <div key={b.isbn || b.title} onClick={() => setSelectedBook({ ...b, readOnly: true, isCommunity: true })} className="rounded-2xl p-3 bg-white dark:bg-slate-900 border">
                  <img src={b.thumbnail} className="aspect-[3/4] w-full object-cover rounded-xl mb-3" />
                  <h3 className="font-bold text-sm line-clamp-1">{b.title}</h3>
                  <RatingStars rating={b.averageRating} showNumber />
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'library' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-black">{t.library}</h2><button onClick={() => setShowSearch(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold">+ {t.add_book}</button></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {myBooks.map(b => (
                <div key={b.id} onClick={() => setSelectedBook({ volumeInfo: { title: b.title, authors: b.authors, imageLinks: { thumbnail: b.thumbnail }, publisher: b.publisher, industryIdentifiers: [{ identifier: b.isbn }], description: b.description }, rating: b.rating, review: b.review, status: b.status, readOnly: true })} className="rounded-2xl p-3 bg-white dark:bg-slate-900 border">
                  <img src={b.thumbnail} className="aspect-[3/4] w-full object-cover rounded-xl mb-3" />
                  <h3 className="font-bold text-sm">{b.title}</h3>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black">{t.profile}</h2>
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border">
              <div className="flex flex-col items-center gap-4">
                {profile?.avatar ? <img src={profile.avatar} className="h-24 w-24 rounded-3xl object-cover" /> : <GenericAvatar className="h-24 w-24 rounded-3xl" />}
                <h3 className="text-xl font-bold">{profile?.username}</h3>
                <div className="w-full p-5 rounded-2xl bg-blue-600 text-white">
                  <div className="flex justify-between mb-3"><span className="text-xs font-black uppercase">{t.annual_goal}</span><span>{myBooks.filter(b=>b.status==='read').length} / {profile?.annualGoal}</span></div>
                  <div className="flex justify-center gap-4 mt-4"><button onClick={() => updateGoal(-1)}>-</button><span className="font-black">{profile?.annualGoal}</span><button onClick={() => updateGoal(1)}>+</button></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 border-t p-4 flex justify-around bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg">
        <button onClick={() => setActiveTab('community')} className={activeTab === 'community' ? 'text-blue-600' : 'opacity-40'}><Globe /></button>
        <button onClick={() => setActiveTab('library')} className={activeTab === 'library' ? 'text-blue-600' : 'opacity-40'}><Library /></button>
        <button onClick={() => setActiveTab('profile')} className={activeTab === 'profile' ? 'text-blue-600' : 'opacity-40'}><User /></button>
      </nav>
      {showSearch && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 h-[80vh] flex flex-col">
            <input autoFocus type="text" placeholder={t.search_placeholder} className="w-full p-4 border rounded-xl mb-4 bg-transparent" onChange={(e) => handleSearch(e.target.value)} />
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4">
              {searchResults.map(book => (
                <div key={book.id} onClick={() => setSelectedBook(book)} className="p-2 border rounded-xl cursor-pointer">
                  <img src={book.volumeInfo.imageLinks?.thumbnail} className="h-20 w-14 object-cover rounded mx-auto" />
                  <p className="text-xs font-bold text-center mt-2 line-clamp-2">{book.volumeInfo.title}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSearch(false)} className="mt-4 p-2 bg-slate-200 dark:bg-slate-800 rounded-xl">Cerrar</button>
          </div>
        </div>
      )}
      {selectedBook && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-8 relative">
            <button onClick={() => setSelectedBook(null)} className="absolute right-4 top-4"><X /></button>
            <h3 className="text-xl font-black mb-4">{selectedBook.title || selectedBook.volumeInfo?.title}</h3>
            {!selectedBook.readOnly && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setTempStatus('read')} className={`p-3 border rounded-xl ${tempStatus === 'read' ? 'bg-green-500 text-white' : ''}`}>{t.read}</button>
                  <button onClick={() => setTempStatus('pending')} className={`p-3 border rounded-xl ${tempStatus === 'pending' ? 'bg-blue-500 text-white' : ''}`}>{t.pending}</button>
                </div>
                {tempStatus === 'read' && <RatingStars rating={tempRating} setRating={setTempRating} interactive />}
                <button onClick={saveBook} className="w-full p-4 bg-blue-600 text-white rounded-xl font-bold uppercase">{t.save}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
