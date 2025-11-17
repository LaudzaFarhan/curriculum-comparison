import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useMemo,
  useCallback,
  useTransition,
} from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  collectionGroup,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
} from "firebase/storage";
import {
  PlusCircle,
  Trash2,
  FilePlus,
  BookOpen,
  Edit,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Bold,
  Italic,
  Image as ImageIcon,
  Palette,
  LogOut,
  Search,
  Filter,
  Eye,
  Edit3,
  Check,
  Users,
  Download,
  Loader2,
  ListChecks,
  Save,
  UserCheck,
  UserX,
  HelpCircle,
  MessageSquare,
  Inbox,
  RefreshCcw,
  FileClock,
  Bell,
  CalendarPlus,
  Clock, // <-- Already imported, but noting its use
  MessageCircle, // <-- Already imported, but noting its use
} from "lucide-react";

// --- FIREBASE CONFIGURATION ---
// In a real app, use environment variables for this.
// NOTE: Replace with your actual Firebase project configuration.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "curriculum-thelab-sg.firebaseapp.com",
  projectId: "curriculum-thelab-sg",
  storageBucket: "curriculum-thelab-sg.appspot.com",
  messagingSenderId: "1076175905388",
  appId: "1:1076175905388:web:be007ccc7f8800c3226e49",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- NEW: Global Activity Logger ---
/**
 * Logs an activity to the 'activityLog' collection.
 * @param {string} username - The user performing the action.
 * @param {'login' | 'logout' | 'submit_for_review'} action - The type of action.
 * @param {object} context - Optional additional data (e..g., challenge info).
 */
const logActivity = async (username, action, context = {}) => {
  if (!username) {
    console.warn("Attempted to log activity without a username.");
    return;
  }
  try {
    await addDoc(collection(db, "activityLog"), {
      username: username.toLowerCase(),
      action,
      timestamp: serverTimestamp(),
      context,
    });
  } catch (error) {
    // Non-critical error, just log to console.
    console.error("Error logging activity:", error);
  }
};

// --- SIMPLE SCRIPT-BASED AUTHENTICATION CONTEXT ---
const AppStateContext = createContext();
export const AppStateProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null); // { role, username }

  const login = async (username, password) => {
    const lowerUser = username.toLowerCase();

    // Admin login check
    if (lowerUser === "admin" && password === "calculated213") {
      const adminUser = { role: "admin", username: "admin" };
      setCurrentUser(adminUser);
      await logActivity(adminUser.username, "login"); // Log admin login
      return true;
    }

    // Dynamic teacher login check
    try {
      const teachersRef = collection(db, "teachers");
      const querySnapshot = await getDocs(teachersRef);
      const teacherUsernames = querySnapshot.docs.map((doc) =>
        doc.data().username.toLowerCase()
      );

      if (teacherUsernames.includes(lowerUser)) {
        const expectedPassword = `instructor_${lowerUser}213`;
        if (password === expectedPassword) {
          const teacherUser = { role: "teacher", username: lowerUser };
          setCurrentUser(teacherUser);
          await logActivity(teacherUser.username, "login"); // Log teacher login
          return true;
        }
      }
    } catch (error) {
      console.error("Error during teacher login check:", error);
      return false; // Deny login on error
    }

    return false;
  };

  const logout = async () => {
    // --- MODIFIED: Log activity before logging out ---
    if (currentUser) {
      await logActivity(currentUser.username, "logout");
    }
    // --- END MODIFICATION ---
    setCurrentUser(null);
  };
  const value = { currentUser, login, logout };
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};
export const useAppState = () => useContext(AppStateContext);

// --- HELPER FUNCTIONS & INITIAL DATA ---
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "Just now";
  // Handle both Firestore ServerTimestamp (object) and JS Date (ISO string)
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }
  if (typeof timestamp === "string") {
    return new Date(timestamp).toLocaleString();
  }
  return "Invalid Date";
};
const generateId = () =>
  `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const createBlankStep = () => ({ id: generateId(), content: "" });
const createBlankLevel = () => ({ steps: 0, stepDetails: [] });
const createNewChallenge = () => ({
  id: generateId(),
  challengeName: "",
  // --- MODIFIED: Replaced acknowledgedBy with new review structure ---
  acknowledgements: {}, // e.g., { "username": { status: "pending", submittedAt: ... } }
  submissionComments: {}, // e.g., { "username": "Your comment here..." }
  // --- END MODIFICATION ---
  levels: {
    easy: createBlankLevel(),
    moderate: createBlankLevel(),
    hard: createBlankLevel(),
  },
});
const createNewUnit = () => ({
  id: generateId(),
  unitNumber: "",
  unitName: "",
  challenges: [createNewChallenge()],
});
const customLevelSort = (a, b) => {
  const levelOrder = { basic: 1, intermediate: 2, advanced: 3 };
  const extractParts = (name) => {
    const lowerName = name.toLowerCase();
    const match = lowerName.match(/([a-z]+)\s*(\d+)/);
    if (match) {
      const word = match[1];
      const number = parseInt(match[2], 10);
      const order = levelOrder[word] || 99;
      return { order, number, name };
    }
    return { order: 99, number: 0, name };
  };

  const partsA = extractParts(a.name);
  const partsB = extractParts(b.name);

  if (partsA.order !== partsB.order) return partsA.order - partsB.order;
  if (partsA.number !== partsB.number) return partsA.number - partsB.number;
  return partsA.name.localeCompare(partsB.name);
};

// --- REUSABLE UI COMPONENTS ---
const Button = ({
  onClick,
  children,
  variant = "primary",
  className = "",
  disabled = false,
  title = "",
}) => {
  const baseClasses =
    "flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold transition-all duration-200 ease-in-out shadow focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-px active:translate-y-0";
  const variantClasses = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    secondary:
      "bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400",
    success:
      "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500",
    warning: "bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400",
  };
  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      title={title}>
      {children}
    </button>
  );
};
const InputField = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}) => (
  <div className="flex-1 min-w-[80px]">
    {label && (
      <label className="block text-sm font-medium text-slate-600 mb-1">
        {label}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition"
    />
  </div>
);

// --- NEW: Reusable TabButton Component ---
const TabButton = ({ tabName, label, activeTab, setActiveTab }) => (
  <button
    onClick={() => setActiveTab(tabName)}
    className={`pb-2 px-4 font-semibold ${
      activeTab === tabName
        ? "border-b-2 border-indigo-600 text-indigo-600"
        : "text-slate-500 hover:text-slate-700"
    }`}>
    {label}
  </button>
);

const Notification = ({ message, type, onClear }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClear(), 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClear]);

  if (!message) return null;

  const baseClasses =
    "fixed top-5 right-5 p-4 rounded-lg shadow-xl text-white z-[60]";
  const typeClasses = { success: "bg-emerald-500", error: "bg-red-500" };

  return <div className={`${baseClasses} ${typeClasses[type]}`}>{message}</div>;
};

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[80]">
    <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-sm animate-fade-in-up">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Confirm Action</h3>
      <p className="text-slate-600 mb-6">{message}</p>
      <div className="flex justify-end gap-4">
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="danger">
          Confirm
        </Button>
      </div>
    </div>
  </div>
);

// --- NEW: Question Modal (for Teacher) ---
const QuestionModal = ({
  challenge,
  levelId,
  levelName,
  unitId,
  unitName,
  curriculumType,
  teacherUsername,
  onCancel,
  onSubmit,
}) => {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(text, {
        levelId,
        levelName,
        curriculumType,
        unitId,
        unitName,
        challengeId: challenge.id,
        challengeName: challenge.challengeName,
      });
    } catch (err) {
      console.error("Error in submit wrapper", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg animate-fade-in-up">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">Ask a Question</h3>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">Challenge:</p>
            <p className="font-semibold text-slate-800">
              {challenge.challengeName || "Untitled Challenge"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Your Question:
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What are you having trouble with?"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition resize-none"
              rows="5"
            />
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-6">
          <Button
            onClick={onCancel}
            variant="secondary"
            disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Submit Question"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- Question List View Modal (for Admin) ---
const QuestionListViewModal = ({
  challenge,
  unitId,
  levelId,
  curriculumType,
  onClose,
}) => {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("open");

  useEffect(() => {
    if (!levelId || !unitId || !challenge.id || !curriculumType) {
      console.error("Missing IDs for question fetching");
      setIsLoading(false);
      return;
    }

    const questionsRef = collection(
      db,
      "codingLevels",
      levelId,
      curriculumType,
      unitId,
      "challenges",
      challenge.id,
      "questions"
    );

    setIsLoading(true);
    let q;
    if (activeTab === "open") {
      q = query(
        questionsRef,
        where("status", "==", "open")
        // Note: orderBy('createdAt', 'asc') might require an index
        // We will sort in-memory
      );
    } else {
      q = query(
        questionsRef,
        where("status", "==", "resolved")
        // Note: orderBy('createdAt', 'desc') might require an index
        // We will sort in-memory
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedQuestions = [];
        querySnapshot.forEach((doc) => {
          fetchedQuestions.push({ id: doc.id, ...doc.data() });
        });

        // In-memory sort
        fetchedQuestions.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return activeTab === "open" ? aTime - bTime : bTime - aTime;
        });

        setQuestions(fetchedQuestions);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching questions: ", error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [levelId, unitId, challenge.id, curriculumType, activeTab]);

  const getQuestionRef = (questionId) => {
    return doc(
      db,
      "codingLevels",
      levelId,
      curriculumType,
      unitId,
      "challenges",
      challenge.id,
      "questions",
      questionId
    );
  };

  const handleResolveQuestion = async (questionId) => {
    try {
      await updateDoc(getQuestionRef(questionId), {
        status: "resolved",
      });
    } catch (error) {
      console.error("Error resolving question: ", error);
    }
  };

  const handleUnresolveQuestion = async (questionId) => {
    try {
      await updateDoc(getQuestionRef(questionId), {
        status: "open",
      });
    } catch (error) {
      console.error("Error un-resolving question: ", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl animate-fade-in-up max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">
            Challenge Questions
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="mb-4">
          <p className="text-sm text-slate-500">Challenge:</p>
          <p className="font-semibold text-slate-800">
            {challenge.challengeName || "Untitled Challenge"}
          </p>
        </div>
        <div className="flex border-b border-slate-200 mb-4">
          <TabButton
            tabName="open"
            label="Open"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <TabButton
            tabName="resolved"
            label="Resolved"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 rounded-md">
              <CheckCircle size={32} className="mx-auto text-emerald-500" />
              <p className="mt-2 font-semibold text-slate-700">All Clear!</p>
              <p className="text-slate-500 text-sm">
                No {activeTab} questions for this challenge.
              </p>
            </div>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
                <p className="text-slate-800">{q.text}</p>
                <div className="flex justify-between items-end mt-3 pt-3 border-t border-slate-200">
                  <div className="text-sm text-slate-500">
                    <p>
                      <strong className="text-slate-600">Asker:</strong>{" "}
                      {q.teacher}
                    </p>
                    <p>
                      <strong className="text-slate-600">At:</strong>{" "}
                      {formatTimestamp(q.createdAt)}
                    </p>
                  </div>
                  {activeTab === "open" ? (
                    <Button
                      onClick={() => handleResolveQuestion(q.id)}
                      variant="success"
                      className="px-3 py-1 text-sm">
                      <Check size={16} /> Resolve
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUnresolveQuestion(q.id)}
                      variant="secondary"
                      className="px-3 py-1 text-sm">
                      <RefreshCcw size={16} /> Un-resolve
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- ALL Questions List View Modal (for Admin) ---
const AllQuestionsViewModal = ({ onClose }) => {
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("open");

  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collectionGroup(db, "questions"),
      where("status", "==", activeTab)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedQuestions = [];
        querySnapshot.forEach((doc) => {
          fetchedQuestions.push({ id: doc.id, ref: doc.ref, ...doc.data() });
        });

        fetchedQuestions.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return activeTab === "open" ? aTime - bTime : bTime - aTime;
        });

        setQuestions(fetchedQuestions);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching all questions: ", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTab]);

  const handleUpdateStatus = async (questionRef, newStatus) => {
    try {
      await updateDoc(questionRef, {
        status: newStatus,
      });
    } catch (error) {
      console.error(`Error setting status to ${newStatus}: `, error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl animate-fade-in-up max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">
            All Open Questions
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="flex border-b border-slate-200 mb-4">
          <TabButton
            tabName="open"
            label="Open"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <TabButton
            tabName="resolved"
            label="Resolved"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 rounded-md">
              <CheckCircle size={32} className="mx-auto text-emerald-500" />
              <p className="mt-2 font-semibold text-slate-700">All Clear!</p>
              <p className="text-slate-500 text-sm">
                No {activeTab} questions across the curriculum.
              </p>
            </div>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
                <div className="mb-2 pb-2 border-b border-slate-200">
                  <p className="font-semibold text-slate-800">{q.text}</p>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>
                    <strong>Level:</strong> {q.levelName || "N/A"}
                  </p>
                  <p>
                    <strong>Unit:</strong> {q.unitName || "N/A"}
                  </p>
                  <p>
                    <strong>Challenge:</strong> {q.challengeName || "N/A"}
                  </p>
                </div>
                <div className="flex justify-between items-end mt-3 pt-3 border-t border-slate-200">
                  <div className="text-sm text-slate-500">
                    <p>
                      <strong className="text-slate-600">Asker:</strong>{" "}
                      {q.teacher}
                    </p>
                    <p>
                      <strong className="text-slate-600">At:</strong>{" "}
                      {formatTimestamp(q.createdAt)}
                    </p>
                  </div>
                  {activeTab === "open" ? (
                    <Button
                      onClick={() => handleUpdateStatus(q.ref, "resolved")}
                      variant="success"
                      className="px-3 py-1 text-sm">
                      <Check size={16} /> Resolve
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpdateStatus(q.ref, "open")}
                      variant="secondary"
                      className="px-3 py-1 text-sm">
                      <RefreshCcw size={16} /> Un-resolve
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- *** NEW: ALL Tasks List View Modal (for Admin) *** ---
const AllTasksViewModal = ({ onClose }) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    setIsLoading(true);

    const q = query(
      collection(db, "tasks"),
      where("status", "==", activeTab)
      // Removed orderBy('createdAt') because Firestore might require an index
      // We will sort in-memory
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedTasks = [];
        querySnapshot.forEach((doc) => {
          fetchedTasks.push({ id: doc.id, ...doc.data() });
        });

        // Sort in-memory
        fetchedTasks.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          // pending: oldest first. completed: newest first.
          return activeTab === "pending" ? aTime - bTime : bTime - aTime;
        });

        setTasks(fetchedTasks);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching all tasks: ", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTab]);

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        status: newStatus,
        completedAt: newStatus === "completed" ? serverTimestamp() : null,
      });
    } catch (error) {
      console.error(`Error setting status to ${newStatus}: `, error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl animate-fade-in-up max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">
            All Instructor Tasks
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="flex border-b border-slate-200 mb-4">
          <TabButton
            tabName="pending"
            label="Pending"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <TabButton
            tabName="completed"
            label="Completed"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 rounded-md">
              <CheckCircle size={32} className="mx-auto text-emerald-500" />
              <p className="mt-2 font-semibold text-slate-700">All Clear!</p>
              <p className="text-slate-500 text-sm">
                No {activeTab} tasks found.
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
                <div className="mb-2 pb-2 border-b border-slate-200">
                  <h4 className="font-bold text-slate-800 text-lg">
                    {task.title}
                  </h4>
                  <p className="text-slate-600 mt-1">{task.description}</p>
                </div>

                <div className="flex justify-between items-end">
                  <div className="text-sm text-slate-500 space-y-1">
                    <p>
                      <strong className="text-slate-600">Assigned to:</strong>{" "}
                      <span className="capitalize">{task.assignedTo}</span>
                    </p>
                    <p>
                      <strong className="text-slate-600">Assigned:</strong>{" "}
                      {formatTimestamp(task.createdAt)}
                    </p>
                    {task.status === "completed" && task.completedAt && (
                      <p>
                        <strong className="text-slate-600">Completed:</strong>{" "}
                        {formatTimestamp(task.completedAt)}
                      </p>
                    )}
                  </div>

                  {activeTab === "pending" ? (
                    <Button
                      onClick={() => handleUpdateStatus(task.id, "completed")}
                      variant="success"
                      className="px-3 py-1 text-sm">
                      <Check size={16} /> Mark as Complete
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpdateStatus(task.id, "pending")}
                      variant="secondary"
                      className="px-3 py-1 text-sm">
                      <RefreshCcw size={16} /> Move to Pending
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- Activity Log Modal (for Admin) ---
const ActivityLogModal = ({ teacherUsername, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!teacherUsername) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, "activityLog"),
      where("username", "==", teacherUsername.toLowerCase())
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedLogs = [];
        querySnapshot.forEach((doc) => {
          fetchedLogs.push({ id: doc.id, ...doc.data() });
        });

        fetchedLogs.sort((a, b) => {
          const aTime = a.timestamp?.seconds || 0;
          const bTime = b.timestamp?.seconds || 0;
          return bTime - aTime; // Sort descending (newest first)
        });

        setLogs(fetchedLogs);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching activity log: ", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teacherUsername]);

  const renderLogAction = (log) => {
    switch (log.action) {
      case "login":
        return (
          <span className="font-semibold text-emerald-600">Logged In</span>
        );
      case "logout":
        return <span className="font-semibold text-red-600">Logged Out</span>;
      case "submit_for_review":
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-indigo-600">
              Submitted Challenge
            </span>
            <span className="text-xs text-slate-600 pl-2">
              -&gt; {log.context.challengeName || "N/A"} (
              {log.context.unitName || "N/A"} | {log.context.levelName || "N/A"}
              )
            </span>
          </div>
        );
      default:
        return <span className="font-semibold">{log.action}</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl animate-fade-in-up max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">
            Activity Log: <span className="capitalize">{teacherUsername}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto space-y-2 pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 rounded-md">
              <p className="mt-2 font-semibold text-slate-700">
                No Activity Found
              </p>
              <p className="text-slate-500 text-sm">
                This user has no logged activity.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-md">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row justify-between sm:items-center p-3 border-b border-slate-200 last:border-b-0">
                  <div className="mb-2 sm:mb-0">{renderLogAction(log)}</div>
                  <span className="text-sm text-slate-500 text-left sm:text-right">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- *** NEW: Assign Task Modal (for Admin) *** ---
const AssignTaskModal = ({ teacher, onClose, onAssign }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      return; // Or show an error
    }
    setIsSubmitting(true);
    try {
      await onAssign({
        title,
        description,
        assignedTo: teacher.username.toLowerCase(),
      });
      onClose(); // onAssign should handle success notification
    } catch (error) {
      console.error("Error assigning task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg animate-fade-in-up">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">
            Assign Task to{" "}
            <span className="capitalize">{teacher.username}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="space-y-4">
          <InputField
            label="Task Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Review Basic 2"
          />
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task details..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition resize-none"
              rows="5"
            />
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-6">
          <Button onClick={onClose} variant="secondary" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="primary"
            disabled={isSubmitting || !title || !description}>
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Assign Task"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- *** NEW: Teacher Task Modal (for Teacher) *** ---
const TeacherTaskModal = ({ teacherUsername, onClose }) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    if (!teacherUsername) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, "tasks"),
      where("assignedTo", "==", teacherUsername.toLowerCase())
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedTasks = [];
        querySnapshot.forEach((doc) => {
          fetchedTasks.push({ id: doc.id, ...doc.data() });
        });
        // Sort tasks by creation date
        fetchedTasks.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        setTasks(fetchedTasks);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching tasks: ", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teacherUsername]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => task.status === activeTab);
  }, [tasks, activeTab]);

  const updateTaskStatus = async (taskId, newStatus) => {
    const taskRef = doc(db, "tasks", taskId);
    try {
      await updateDoc(taskRef, {
        status: newStatus,
        completedAt: newStatus === "completed" ? serverTimestamp() : null,
      });
    } catch (error) {
      console.error("Error updating task status:", error);
      // Show notification?
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl animate-fade-in-up max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">My Tasks</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="flex border-b border-slate-200 mb-4">
          <TabButton
            tabName="pending"
            label="Pending"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
          <TabButton
            tabName="completed"
            label="Completed"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>
        <div className="flex-grow overflow-y-auto space-y-3 pr-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 rounded-md">
              <CheckCircle size={32} className="mx-auto text-emerald-500" />
              <p className="mt-2 font-semibold text-slate-700">
                No {activeTab} tasks!
              </p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
                <h4 className="font-bold text-slate-800 text-lg">
                  {task.title}
                </h4>
                <p className="text-slate-600 mt-1 mb-3">{task.description}</p>
                <div className="flex justify-between items-end pt-3 border-t border-slate-200">
                  <div className="text-sm text-slate-500">
                    <p>
                      <strong className="text-slate-600">Assigned:</strong>{" "}
                      {formatTimestamp(task.createdAt)}
                    </p>
                    {task.status === "completed" && (
                      <p>
                        <strong className="text-slate-600">Completed:</strong>{" "}
                        {formatTimestamp(task.completedAt)}
                      </p>
                    )}
                  </div>
                  {task.status === "pending" ? (
                    <Button
                      onClick={() => updateTaskStatus(task.id, "completed")}
                      variant="success"
                      className="px-3 py-1 text-sm">
                      <Check size={16} /> Mark as Complete
                    </Button>
                  ) : (
                    <Button
                      onClick={() => updateTaskStatus(task.id, "pending")}
                      variant="secondary"
                      className="px-3 py-1 text-sm">
                      <RefreshCcw size={16} /> Move to Pending
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- *** NEW: Teacher Task Icon (for Header) *** ---
const TeacherTaskIcon = () => {
  const { currentUser } = useAppState();
  const [pendingCount, setPendingCount] = useState(0);
  const [showTaskModal, setShowTaskModal] = useState(false);

  useEffect(() => {
    if (currentUser?.role !== "teacher") return;

    const q = query(
      collection(db, "tasks"),
      where("assignedTo", "==", currentUser.username.toLowerCase()),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setPendingCount(querySnapshot.size);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (currentUser?.role !== "teacher") return null;

  return (
    <>
      <button
        onClick={() => setShowTaskModal(true)}
        className="relative p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
        title="View Tasks">
        <Bell size={22} />
        {pendingCount > 0 && (
          <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center ring-2 ring-white">
            {pendingCount}
          </span>
        )}
      </button>

      {showTaskModal && (
        <TeacherTaskModal
          teacherUsername={currentUser.username}
          onClose={() => setShowTaskModal(false)}
        />
      )}
    </>
  );
};

// --- *** NEW: Feedback Modal (for Teacher) *** ---
const FeedbackModal = ({ comment, onClose }) => (
  <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
    <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md animate-fade-in-up">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
        <h3 className="text-xl font-bold text-slate-800">Trainer Feedback</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-slate-200 transition">
          <X size={24} />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto pr-2">
        <p className="text-slate-700 whitespace-pre-wrap">
          {comment || "No feedback provided."}
        </p>
      </div>
      <div className="flex justify-end gap-4 pt-6">
        <Button onClick={onClose} variant="primary">
          Close
        </Button>
      </div>
    </div>
  </div>
);

// --- *** NEW: Review Submission Modal (for Admin) *** ---
const ReviewSubmissionModal = ({ submissionData, onClose, onSaveReview }) => {
  const { challenge, username, levelId, unitId, curriculumType } =
    submissionData;
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const existingComment =
      challenge.submissionComments?.[username.toLowerCase()] || "";
    setComment(existingComment);
  }, [challenge, username]);

  const handleSave = async (status) => {
    if (status === "needs_revision" && !comment.trim()) {
      console.warn("Feedback comment is required for revision request.");
      // In a real app, show a toast or inline error
      return;
    }
    setIsSubmitting(true);
    try {
      await onSaveReview(status, comment);
      onClose();
    } catch (error) {
      console.error("Error saving review:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg animate-fade-in-up">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">
            Review Submission
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 transition"
            disabled={isSubmitting}>
            <X size={24} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">Teacher:</p>
            <p className="font-semibold text-slate-800 capitalize">
              {username}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Challenge:</p>
            <p className="font-semibold text-slate-800">
              {challenge.challengeName || "Untitled Challenge"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Feedback / Comment:
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Provide feedback for revision..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition resize-none"
              rows="5"
            />
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-6">
          <Button
            onClick={() => handleSave("needs_revision")}
            variant="warning"
            disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Request Revision"
            )}
          </Button>
          <Button
            onClick={() => handleSave("approved")}
            variant="success"
            disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Approve"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- *** NEW: Pending Reviews Modal (for Admin) *** ---
const PendingReviewsModal = ({ pendingReviews, onClose, onSelectReview }) => {
  const [filter, setFilter] = useState("");

  const filteredReviews = useMemo(() => {
    if (!filter) return pendingReviews;
    return pendingReviews.filter((review) =>
      review.username.toLowerCase().includes(filter.toLowerCase())
    );
  }, [pendingReviews, filter]);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl animate-fade-in-up max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">Pending Reviews</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="mb-4">
          <InputField
            label="Filter by Instructor"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Type instructor's name..."
          />
        </div>
        <div className="flex-grow overflow-y-auto space-y-2 pr-2">
          {filteredReviews.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 rounded-md">
              <CheckCircle size={32} className="mx-auto text-emerald-500" />
              <p className="mt-2 font-semibold text-slate-700">
                All Caught Up!
              </p>
              <p className="text-slate-500 text-sm">
                {pendingReviews.length > 0
                  ? "No submissions match your filter."
                  : "There are no pending submissions to review."}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-md">
              {filteredReviews.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row justify-between sm:items-center p-3 border-b border-slate-200 last:border-b-0">
                  <div className="mb-2 sm:mb-0">
                    <p className="font-semibold text-indigo-600 capitalize">
                      {item.username}
                    </p>
                    <p className="font-semibold text-slate-800">
                      {item.challengeName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.levelName} | {item.unitName}
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end sm:flex-shrink-0">
                    <span className="text-sm text-slate-500 mb-2">
                      {formatTimestamp(item.submittedAt)}
                    </span>
                    <Button
                      onClick={() => onSelectReview(item)}
                      variant="primary"
                      className="text-sm px-3 py-1">
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- RICH TEXT EDITOR & MODAL ---
const EditorToolbar = ({ onAction }) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-t-md border-b border-slate-200 flex-wrap">
      <button
        title="Bold"
        onClick={() => onAction("bold")}
        className="p-2 hover:bg-slate-200 rounded-md">
        <Bold size={18} />
      </button>
      <button
        title="Italic"
        onClick={() => onAction("italic")}
        className="p-2 hover:bg-slate-200 rounded-md">
        <Italic size={18} />
      </button>
      <button
        title="Heading 2"
        onClick={() => onAction("h2")}
        className="p-2 hover:bg-slate-200 rounded-md font-bold">
        H2
      </button>
      <button
        title="Add Image via URL"
        onClick={() => onAction("image")}
        className="p-2 hover:bg-slate-200 rounded-md">
        <ImageIcon size={18} />
      </button>
      <div
        title="Text Color"
        className="relative p-2 hover:bg-slate-200 rounded-md">
        <Palette size={18} />
        <input
          type="color"
          onChange={(e) => onAction("color", e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};

const StepDetailsModal = ({
  stepData,
  levelName,
  stepIndex,
  onSave,
  onCancel,
  levelId,
  unitId,
  challengeId,
  curriculumType,
}) => {
  const [content, setContent] = useState(stepData.content);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const textAreaRef = useRef(null);
  const handleSave = () => onSave({ ...stepData, content });

  useEffect(() => {
    if (stepData.content === null) {
      const fetchContent = async () => {
        setIsLoading(true);
        try {
          const stepRef = doc(
            db,
            "codingLevels",
            levelId,
            curriculumType,
            unitId,
            "challenges",
            challengeId,
            "steps",
            stepData.id
          );
          const stepDoc = await getDoc(stepRef);
          if (stepDoc.exists()) {
            setContent(stepDoc.data().content || "");
          } else {
            setContent("<p>Error: Content not found.</p>");
          }
        } catch (err) {
          console.error("Failed to fetch step content", err);
          setContent("<p>Error loading content.</p>");
        } finally {
          setIsLoading(false);
        }
      };
      fetchContent();
    }
  }, [stepData, levelId, curriculumType, unitId, challengeId]);

  const applyStyle = (style, value = null) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart,
      end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    let newContent;
    switch (style) {
      case "bold":
        newContent = `${content.substring(
          0,
          start
        )}<b>${selectedText}</b>${content.substring(end)}`;
        break;
      case "italic":
        newContent = `${content.substring(
          0,
          start
        )}<i>${selectedText}</i>${content.substring(end)}`;
        break;
      case "h2":
        newContent = `${content.substring(
          0,
          start
        )}<h2>${selectedText}</h2>${content.substring(end)}`;
        break;
      case "color":
        newContent = `${content.substring(
          0,
          start
        )}<span style="color:${value};">${selectedText}</span>${content.substring(
          end
        )}`;
        break;
      case "image":
        const url = prompt("Enter image URL:");
        if (url) {
          newContent = `${content.substring(
            0,
            start
          )}<img src="${url}" alt="Challenge image" style="max-width:100%; height:auto; border-radius:8px; margin: 0.5rem 0;" />${content.substring(
            end
          )}`;
        } else {
          return;
        }
        break;
      default:
        return;
    }
    setContent(newContent);
  };
  const handlePaste = (event) => {
    const clipboardData = event.clipboardData || window.clipboardData;
    if (!clipboardData) return;
    const items = clipboardData.items;
    let htmlItem = null;
    let imageItem = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type === "text/html") {
        htmlItem = items[i];
      }
      if (items[i].type.indexOf("image") !== -1) {
        imageItem = items[i];
      }
    }
    if (htmlItem && !imageItem) {
      event.preventDefault();
      htmlItem.getAsString((html) => {
        const sanitizedHtml = html.replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ""
        );
        const textarea = textAreaRef.current;
        if (textarea) {
          const start = textarea.selectionStart,
            end = textarea.selectionEnd;
          const newContent = `${content.substring(
            0,
            start
          )}${sanitizedHtml}${content.substring(end)}`;
          setContent(newContent);
        }
      });
      return;
    }
    if (imageItem) {
      event.preventDefault();
      const blob = imageItem.getAsFile();
      if (blob) {
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Image = e.target.result;
          const fileName = `pasted_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}.png`;
          const storageRef = ref(storage, `images/${fileName}`);
          try {
            const uploadResult = await uploadString(
              storageRef,
              base64Image,
              "data_url"
            );
            const downloadURL = await getDownloadURL(uploadResult.ref);
            const imgTag = `<img src="${downloadURL}" alt="Pasted content" style="max-width:100%; height:auto; border-radius:8px; margin: 0.5rem 0;" />`;
            const textarea = textAreaRef.current;
            if (textarea) {
              const start = textarea.selectionStart,
                end = textarea.selectionEnd;
              const newContent = `${content.substring(
                0,
                start
              )}${imgTag}${content.substring(end)}`;
              setContent(newContent);
            }
          } catch (error) {
            console.error("Error uploading image: ", error);
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsDataURL(blob);
      }
    }
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-3xl flex flex-col animate-fade-in-up max-h-[90vh]">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-xl font-bold text-slate-800">
            Edit <span className="capitalize text-indigo-600">{levelName}</span>{" "}
            Level - Step {stepIndex + 1}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-slate-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="relative flex-grow flex flex-col min-h-0">
          {isLoading ? (
            <div className="w-full flex-grow flex justify-center items-center border border-slate-300 rounded-b-md bg-slate-50">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
            </div>
          ) : (
            <>
              <EditorToolbar onAction={applyStyle} />
              <textarea
                ref={textAreaRef}
                value={content || ""}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                placeholder="Enter details for this step. You can paste images and rich text directly."
                className="w-full flex-grow px-3 py-2 bg-white border border-slate-300 rounded-b-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 transition resize-none"
                rows="50"
              />
            </>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-white/80 flex flex-col justify-center items-center">
              <Loader2 className="animate-spin text-indigo-600" size={48} />
              <p className="mt-2 text-slate-700 font-semibold">
                Uploading image...
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-4 pt-4">
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="primary">
            Save Details
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- CORE EDITOR COMPONENTS ---
const levelOrder = ["easy", "moderate", "hard"];
const StepDetailEditor = ({ stepIndex, onEditDetails }) => (
  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-md border border-slate-200">
    <span className="font-medium text-slate-600">Step {stepIndex + 1}</span>
    <Button
      onClick={onEditDetails}
      variant="secondary"
      className="px-3 py-1 text-sm">
      <Edit size={14} />
      <span>Edit Details</span>
    </Button>
  </div>
);
const ChallengeLevelEditor = ({
  levelName,
  levelData,
  onUpdate,
  onEditStepDetails,
}) => (
  <div className="flex flex-col gap-3 p-3 bg-white rounded-md border border-slate-200">
    <div className="flex items-end gap-3">
      <span className="font-semibold text-slate-700 capitalize w-20 text-left">
        {levelName}
      </span>
      <InputField
        label="Total Steps"
        type="number"
        value={levelData.steps}
        onChange={(e) => onUpdate("steps", parseInt(e.target.value, 10) || 0)}
      />
    </div>
    {levelData.stepDetails.length > 0 && (
      <div className="pl-4 border-l-2 border-slate-200 space-y-2">
        {levelData.stepDetails.map((step, index) => (
          <StepDetailEditor
            key={step.id}
            stepIndex={index}
            onEditDetails={() => onEditStepDetails(index, step)}
          />
        ))}
      </div>
    )}
  </div>
);
const ChallengeItem = ({
  challenge,
  onUpdate,
  onDelete,
  onEditStepDetails,
}) => (
  <div className="flex flex-col gap-4 p-3 bg-slate-100 rounded-lg border border-slate-200">
    <div className="flex flex-col sm:flex-row gap-3 items-start">
      <div className="flex-grow w-full">
        <InputField
          label="Challenge Name"
          value={challenge.challengeName}
          onChange={(e) => onUpdate("challengeName", e.target.value)}
          placeholder="e.g., Introduction to..."
        />
      </div>
      <Button
        onClick={onDelete}
        variant="danger"
        className="w-full sm:w-auto self-end">
        <Trash2 size={16} />
        <span className="hidden sm:inline">Delete Challenge</span>
      </Button>
    </div>
    <div className="space-y-2 pl-2 border-l-4 border-slate-300">
      {levelOrder.map((levelName) => (
        <ChallengeLevelEditor
          key={levelName}
          levelName={levelName}
          levelData={challenge.levels[levelName]}
          onUpdate={(field, value) =>
            onUpdate(`levels.${levelName}.${field}`, value)
          }
          onEditStepDetails={(stepIndex, stepData) =>
            onEditStepDetails(levelName, stepIndex, stepData)
          }
        />
      ))}
    </div>
  </div>
);

const UnitCard = ({
  unit,
  onUpdateUnit,
  onDeleteUnit,
  onAddChallenge,
  onUpdateChallenge,
  onDeleteChallenge,
  onEditChallengeDetails,
  onSaveUnit,
  isSavingUnit,
  activeChallengeIndex,
  setActiveChallengeIndex,
}) => {
  const handleAddChallenge = () => {
    const newChallengeIndex = unit.challenges.length;
    onAddChallenge();
    setActiveChallengeIndex(newChallengeIndex);
  };

  const handleDeleteChallenge = (challengeIndexToDelete) => {
    onDeleteChallenge(challengeIndexToDelete);
    if (
      challengeIndexToDelete <= activeChallengeIndex &&
      activeChallengeIndex > 0
    ) {
      setActiveChallengeIndex(activeChallengeIndex - 1);
    } else if (unit.challenges.length <= 1) {
      setActiveChallengeIndex(0);
    }
  };

  const activeChallenge = unit.challenges[activeChallengeIndex];

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 flex flex-col h-full">
      {/* Fixed Header */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <h3 className="text-lg font-bold text-slate-700 whitespace-nowrap">
            Unit Details
          </h3>
          <div className="flex-grow w-full flex flex-col md:flex-row gap-4">
            <InputField
              label="Unit Number"
              value={unit.unitNumber}
              onChange={(e) => onUpdateUnit("unitNumber", e.target.value)}
              placeholder="e.g., 1 or 2a"
            />
            <InputField
              label="Unit Name"
              value={unit.unitName}
              onChange={(e) => onUpdateUnit("unitName", e.target.value)}
              placeholder="e.g., Core Concepts"
            />
          </div>
          <div className="flex items-center gap-2 self-end md:self-center">
            <Button
              onClick={onSaveUnit}
              variant="success"
              className="p-2"
              title="Save this Unit"
              disabled={isSavingUnit}>
              {isSavingUnit ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
            </Button>
            <Button
              onClick={onDeleteUnit}
              variant="danger"
              className="p-2"
              title="Delete Unit"
              disabled={isSavingUnit}>
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-grow flex min-h-0">
        {/* Challenge Sidebar */}
        <div className="w-1/3 md:w-1/4 p-3 border-r border-slate-200 flex flex-col">
          <h4 className="font-semibold text-slate-600 mb-2 text-center">
            Challenges
          </h4>
          <div className="flex-grow space-y-2 overflow-y-auto pr-2">
            {unit.challenges.map((challenge, index) => (
              <div
                key={challenge.id}
                onClick={() => setActiveChallengeIndex(index)}
                className={`p-2 rounded-md cursor-pointer text-sm truncate border ${
                  activeChallengeIndex === index
                    ? "bg-indigo-100 text-indigo-800 font-semibold border-indigo-300"
                    : "hover:bg-slate-100 border-transparent"
                }`}>
                {`Challenge ${index + 1}: ${
                  challenge.challengeName || "Untitled"
                }`}
              </div>
            ))}
          </div>
          <Button
            onClick={handleAddChallenge}
            variant="secondary"
            className="mt-4 w-full">
            <PlusCircle size={16} /> Add Challenge
          </Button>
        </div>

        {/* Active Challenge Editor */}
        <div className="w-2/3 md:w-3/4 p-3 overflow-y-auto">
          {activeChallenge ? (
            <ChallengeItem
              key={activeChallenge.id}
              challenge={activeChallenge}
              onUpdate={(path, value) =>
                onUpdateChallenge(activeChallengeIndex, path, value)
              }
              onDelete={() => handleDeleteChallenge(activeChallengeIndex)}
              onEditStepDetails={(levelName, stepIndex, stepData) =>
                onEditChallengeDetails(
                  activeChallengeIndex,
                  levelName,
                  stepIndex,
                  stepData
                )
              }
            />
          ) : (
            <div className="text-center p-10 text-slate-500 flex flex-col items-center justify-center h-full">
              <p className="font-semibold">No challenges in this unit.</p>
              <p className="text-sm mt-1">
                Click "Add Challenge" to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
const EditorUnitSidebar = ({ units, activeIndex, onSelect, onAdd }) => (
  <div className="w-full bg-white rounded-lg p-3 flex flex-col border border-slate-200 h-[80vh]">
    <h3 className="font-bold text-center mb-2 border-b border-slate-200 pb-2 text-slate-700">
      Units
    </h3>
    <div className="space-y-1 flex-grow overflow-y-auto pr-1">
      {(units || []).map((unit, index) => (
        <div
          key={unit.id}
          onClick={() => onSelect(index)}
          className={`p-2 rounded-md cursor-pointer text-sm truncate ${
            activeIndex === index
              ? "bg-indigo-100 text-indigo-800 font-semibold"
              : "hover:bg-slate-100"
          }`}>
          {unit.unitNumber || `U${index + 1}`}:{" "}
          {unit.unitName || "Untitled Unit"}
        </div>
      ))}
    </div>
    <Button onClick={onAdd} variant="secondary" className="mt-4 w-full">
      <FilePlus size={16} /> Add Unit
    </Button>
  </div>
);
const CurriculumEditorColumn = ({
  title,
  unit,
  unitIndex,
  handlers,
  isSavingUnit,
  activeChallengeIndex,
  setActiveChallengeIndex,
  onCreateMissing,
}) => {
  if (!unit) {
    return (
      <div className="w-full lg:w-1/2 p-2 sm:p-4 bg-slate-100 rounded-lg shadow-inner flex flex-col h-[80vh]">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-4">
          {title}
        </h2>
        <div className="text-center p-10 flex flex-col items-center justify-center h-full">
          <p className="text-slate-500 mb-4">
            This unit does not exist. It may have been deleted or not yet
            created for this version.
          </p>
          {onCreateMissing && (
            <Button onClick={onCreateMissing} variant="primary">
              <PlusCircle size={16} /> Create Unit in this Version
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-1/2 p-2 sm:p-4 bg-slate-100 rounded-lg shadow-inner flex flex-col h-[80vh]">
      <h2 className="text-2xl font-bold text-center text-slate-800 mb-4">
        {title}
      </h2>
      <div className="flex-grow overflow-y-auto pr-2">
        <UnitCard
          key={unit.id}
          unit={unit}
          unitIndex={unitIndex}
          isSavingUnit={isSavingUnit}
          activeChallengeIndex={activeChallengeIndex}
          setActiveChallengeIndex={setActiveChallengeIndex}
          {...handlers}
        />
      </div>
    </div>
  );
};

// --- COMPARISON & FILTERING COMPONENTS ---
const ComparisonStepDetail = ({ step, index }) => (
  <div className="pl-4">
    <h6 className="font-semibold text-slate-800">Step {index + 1}</h6>
    {step.content ? (
      <div
        className="prose prose-sm max-w-none mt-1 text-slate-700"
        dangerouslySetInnerHTML={{ __html: step.content }}
      />
    ) : (
      <p className="text-slate-500 text-sm italic">No details for this step.</p>
    )}
  </div>
);
const ComparisonLevelDetail = ({ levelData, levelName }) => (
  <div className="pl-4 border-l-4 border-indigo-200">
    <h5 className="font-bold capitalize text-indigo-800">
      {levelName} -{" "}
      <span className="font-normal text-slate-600">
        {levelData.steps} steps
      </span>
    </h5>
    <div className="mt-2 space-y-3">
      {levelData.stepDetails.length > 0 ? (
        levelData.stepDetails.map((step, index) => (
          <ComparisonStepDetail key={step.id} step={step} index={index} />
        ))
      ) : (
        <p className="text-slate-500 text-sm mt-1">No steps defined.</p>
      )}
    </div>
  </div>
);
const AcknowledgeStatus = ({ acknowledgements = {} }) => {
  const [showAll, setShowAll] = useState(false);
  const entries = Object.entries(acknowledgements);
  if (entries.length === 0) {
    return <p className="text-xs text-slate-500">Not submitted by anyone.</p>;
  }
  const displayList = showAll ? entries : entries.slice(0, 3);
  const statusClasses = {
    pending: "text-amber-600",
    approved: "text-emerald-600",
    needs_revision: "text-red-600",
  };
  return (
    <div className="text-xs text-slate-600 space-y-1">
      {displayList.map(([username, data]) => (
        <p key={username}>
          <span className="font-semibold capitalize">{username}:</span>{" "}
          <span className={`font-semibold ${statusClasses[data.status] || ""}`}>
            {data.status?.replace("_", " ") || "unknown"}
          </span>
        </p>
      ))}
      {entries.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-indigo-500 hover:underline">
          {showAll ? "Show less" : `+${entries.length - 3} more`}
        </button>
      )}
    </div>
  );
};
const ComparisonChallenge = ({
  challenge,
  onAcknowledge,
  onAskQuestion,
  levelId,
  unitId,
  curriculumType,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAppState();
  const submissionData =
    challenge.acknowledgements?.[currentUser.username.toLowerCase()];
  const submissionStatus = submissionData?.status;
  const comment =
    challenge.submissionComments?.[currentUser.username.toLowerCase()];
  const [showFeedback, setShowFeedback] = useState(false);

  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [loadedChallenge, setLoadedChallenge] = useState(challenge);

  const fetchStepContent = useCallback(async () => {
    if (isLoadingSteps || !levelId) return;
    setIsLoadingSteps(true);
    try {
      const stepsRef = collection(
        db,
        "codingLevels",
        levelId,
        curriculumType,
        unitId,
        "challenges",
        challenge.id,
        "steps"
      );
      const stepsSnapshot = await getDocs(stepsRef);

      const stepsByDifficulty = { easy: [], moderate: [], hard: [] };
      stepsSnapshot.forEach((stepDoc) => {
        const stepData = { id: stepDoc.id, ...stepDoc.data() };
        if (stepsByDifficulty[stepData.difficulty]) {
          stepsByDifficulty[stepData.difficulty].push(stepData);
        }
      });

      setLoadedChallenge((prevLoadedChallenge) => {
        const newLevels = { ...prevLoadedChallenge.levels };
        for (const difficulty of levelOrder) {
          stepsByDifficulty[difficulty].sort(
            (a, b) => a.stepIndex - b.stepIndex
          );
          newLevels[difficulty] = {
            ...prevLoadedChallenge.levels[difficulty],
            stepDetails: stepsByDifficulty[difficulty],
          };
        }
        return { ...prevLoadedChallenge, levels: newLevels };
      });
    } catch (err) {
      console.error("Failed to fetch steps", err);
    } finally {
      setIsLoadingSteps(false);
    }
  }, [isLoadingSteps, levelId, curriculumType, unitId, challenge.id]);

  useEffect(() => {
    const hasNullContent = Object.values(loadedChallenge.levels).some((level) =>
      level.stepDetails.some((s) => s.content === null)
    );

    if (isOpen && hasNullContent && !isLoadingSteps) {
      fetchStepContent();
    }
  }, [isOpen, loadedChallenge, isLoadingSteps, fetchStepContent]);

  const renderTeacherActions = () => {
    switch (submissionStatus) {
      case "pending":
        return (
          <Button
            disabled={true}
            variant="secondary"
            className="py-1 px-3 text-sm"
            title="Waiting for admin review">
            <Clock size={16} /> Wait for Review
          </Button>
        );
      case "approved":
        return (
          <Button
            disabled={true}
            variant="success"
            className="py-1 px-3 text-sm">
            <CheckCircle size={16} /> Approved
          </Button>
        );
      case "needs_revision":
        return (
          <>
            {comment && (
              <Button
                onClick={() => setShowFeedback(true)}
                variant="secondary"
                className="py-1 px-2 text-sm"
                title="View Feedback">
                <MessageCircle size={16} />
              </Button>
            )}
            <Button
              onClick={() => onAcknowledge(challenge.id)}
              variant="warning"
              className="py-1 px-3 text-sm">
              <RefreshCcw size={16} /> Revise & Resubmit
            </Button>
          </>
        );
      default:
        // Not submitted
        return (
          <Button
            onClick={() => onAcknowledge(challenge.id)}
            variant="primary"
            className="py-1 px-3 text-sm">
            Submit
          </Button>
        );
    }
  };

  return (
    <>
      {showFeedback && (
        <FeedbackModal
          comment={comment}
          onClose={() => setShowFeedback(false)}
        />
      )}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="flex justify-between items-center p-3 text-left">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex-grow flex items-center gap-2 group">
            <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
              {challenge.challengeName || "Untitled Challenge"}
            </span>
            {isOpen ? (
              <ChevronUp size={20} className="text-slate-500" />
            ) : (
              <ChevronDown size={20} className="text-slate-500" />
            )}
          </button>
          {currentUser.role === "teacher" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={onAskQuestion}
                variant="secondary"
                className="py-1 px-2 text-sm" // Smaller padding
                title="Ask a question about this challenge">
                <HelpCircle size={16} />
              </Button>
              {renderTeacherActions()}
            </div>
          )}
        </div>
        {isOpen && (
          <div className="p-4 border-t border-slate-200 space-y-4">
            {currentUser.role === "admin" && (
              <AcknowledgeStatus
                acknowledgements={challenge.acknowledgements}
              />
            )}
            {isLoadingSteps ? (
              <div className="flex justify-center items-center h-24">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : (
              levelOrder.map((levelName) => (
                <ComparisonLevelDetail
                  key={levelName}
                  levelName={levelName}
                  levelData={loadedChallenge.levels[levelName]} // Use loadedChallenge
                />
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};
const UnifiedComparisonView = ({
  oldCurriculum,
  newCurriculum,
  onAcknowledge,
  onAskQuestion,
  levelId,
}) => {
  const allUnitIds = useMemo(() => {
    const unitSet = new Set();
    (oldCurriculum || []).forEach((u) => u.id && unitSet.add(u.id));
    (newCurriculum || []).forEach((u) => u.id && unitSet.add(u.id));
    return Array.from(unitSet);
  }, [oldCurriculum, newCurriculum]);

  return (
    <div className="space-y-6">
      {allUnitIds.map((unitId) => {
        const oldUnit = (oldCurriculum || []).find((u) => u.id === unitId);
        const newUnit = (newCurriculum || []).find((u) => u.id === unitId);

        const areNamesSame =
          oldUnit && newUnit && oldUnit.unitName === newUnit.unitName;

        return (
          <div
            key={unitId}
            className="bg-white rounded-lg shadow-md p-5 border border-slate-200">
            {areNamesSame ? (
              <h3 className="text-2xl font-bold text-indigo-700 mb-4 text-center">
                Unit {oldUnit.unitNumber}: {oldUnit.unitName}
              </h3>
            ) : null}

            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-1/2 space-y-3">
                {areNamesSame ? (
                  <h4 className="text-lg font-semibold text-center text-slate-800">
                    Old Curriculum
                  </h4>
                ) : oldUnit ? (
                  <h3 className="text-xl font-bold text-slate-800 mb-2">
                    Unit {oldUnit.unitNumber}: {oldUnit.unitName} (Old)
                  </h3>
                ) : null}
                {oldUnit ? (
                  oldUnit.challenges.map((challenge) => (
                    <ComparisonChallenge
                      key={challenge.id}
                      challenge={challenge}
                      onAcknowledge={(challengeId) =>
                        onAcknowledge(oldUnit.id, challengeId, "oldData")
                      }
                      onAskQuestion={() =>
                        onAskQuestion(
                          oldUnit.id,
                          oldUnit.unitName,
                          challenge,
                          "oldData"
                        )
                      }
                      levelId={levelId}
                      unitId={oldUnit.id}
                      curriculumType="units_old"
                    />
                  ))
                ) : (
                  <p className="text-slate-500 text-center pt-4">
                    This unit does not exist in the old curriculum.
                  </p>
                )}
              </div>
              <div className="w-full lg:w-1/2 space-y-3">
                {areNamesSame ? (
                  <h4 className="text-lg font-semibold text-center text-slate-800">
                    New Curriculum
                  </h4>
                ) : newUnit ? (
                  <h3 className="text-xl font-bold text-slate-800 mb-2">
                    Unit {newUnit.unitNumber}: {newUnit.unitName} (New)
                  </h3>
                ) : null}
                {newUnit ? (
                  newUnit.challenges.map((challenge) => (
                    <ComparisonChallenge
                      key={challenge.id}
                      challenge={challenge}
                      onAcknowledge={(challengeId) =>
                        onAcknowledge(newUnit.id, challengeId, "newData")
                      }
                      onAskQuestion={() =>
                        onAskQuestion(
                          newUnit.id,
                          newUnit.unitName,
                          challenge,
                          "newData"
                        )
                      }
                      levelId={levelId}
                      unitId={newUnit.id}
                      curriculumType="units_new"
                    />
                  ))
                ) : (
                  <p className="text-slate-500 text-center pt-4">
                    This unit does not exist in the new curriculum.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FilterControls = ({ units, onFilterChange }) => {
  const [selectedUnit, setSelectedUnit] = useState("");
  const [challengeSearch, setChallengeSearch] = useState("");
  const handleFilterChange = useMemo(() => onFilterChange, [onFilterChange]);
  useEffect(() => {
    handleFilterChange({ unit: selectedUnit, challenge: challengeSearch });
  }, [selectedUnit, challengeSearch, handleFilterChange]);
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row gap-4 items-center">
      <div className="flex items-center gap-2 text-slate-600 font-semibold">
        <Filter size={20} /> Filters:
      </div>
      <div className="flex-grow w-full sm:w-auto">
        <select
          onChange={(e) => setSelectedUnit(e.target.value)}
          value={selectedUnit}
          className="w-full p-2 border border-slate-300 rounded-md">
          <option value="">All Units</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unitNumber} - {unit.unitName}
            </option>
          ))}
        </select>
      </div>
      <div className="relative flex-grow w-full sm:w-auto">
        <InputField
          type="text"
          value={challengeSearch}
          onChange={(e) => setChallengeSearch(e.target.value)}
          placeholder="Search challenge name..."
          label=""
        />
        <Search size={18} className="absolute right-3 top-2.5 text-slate-400" />
      </div>
    </div>
  );
};
const FilteredComparisonView = ({
  levelData,
  onAcknowledge,
  onAskQuestion,
  levelId,
}) => {
  const [filters, setFilters] = useState({ unit: "", challenge: "" });
  const allUnits = useMemo(
    () => [...(levelData.oldData || []), ...(levelData.newData || [])],
    [levelData]
  );
  const uniqueUnits = useMemo(() => {
    const seen = new Set();
    return allUnits.filter((unit) => {
      if (!unit.id || seen.has(unit.id)) {
        return false;
      }
      seen.add(unit.id);
      return true;
    });
  }, [allUnits]);

  const applyFilters = (data) => {
    if (!data) return [];
    let filteredData = [...data];
    if (filters.unit) {
      filteredData = filteredData.filter((u) => u.id === filters.unit);
    }
    if (filters.challenge) {
      const searchTerm = filters.challenge.toLowerCase();
      filteredData = filteredData
        .map((unit) => {
          const filteredChallenges = unit.challenges.filter((c) =>
            c.challengeName.toLowerCase().includes(searchTerm)
          );
          return { ...unit, challenges: filteredChallenges };
        })
        .filter((unit) => unit.challenges.length > 0);
    }
    return filteredData;
  };
  const filteredOld = applyFilters(levelData.oldData);
  const filteredNew = applyFilters(levelData.newData);
  return (
    <div>
      <FilterControls units={uniqueUnits} onFilterChange={setFilters} />
      <UnifiedComparisonView
        oldCurriculum={filteredOld}
        newCurriculum={filteredNew}
        onAcknowledge={onAcknowledge}
        onAskQuestion={onAskQuestion}
        levelId={levelId}
      />
    </div>
  );
};
const SimplePreviewView = ({ oldCurriculum, newCurriculum }) => {
  const differences = useMemo(() => {
    const diffs = [];
    const newUnitsMap = new Map((newCurriculum || []).map((u) => [u.id, u]));
    const oldUnitsMap = new Map((oldCurriculum || []).map((u) => [u.id, u]));

    const allUnitIds = new Set([...newUnitsMap.keys(), ...oldUnitsMap.keys()]);

    allUnitIds.forEach((unitId) => {
      const unitDiffs = [];
      const oldUnit = oldUnitsMap.get(unitId);
      const newUnit = newUnitsMap.get(unitId);
      const unitName = oldUnit?.unitName || newUnit?.unitName;

      if (oldUnit && !newUnit) {
        unitDiffs.push({
          type: "Unit Deleted",
          challengeName: `Unit "${unitName}" was removed.`,
        });
      } else if (!oldUnit && newUnit) {
        unitDiffs.push({
          type: "Unit Added",
          challengeName: `Unit "${unitName}" was added.`,
        });
      } else if (oldUnit && newUnit) {
        const newChallengesMap = new Map(
          newUnit.challenges.map((c) => [c.challengeName, c])
        );
        const oldChallengesMap = new Map(
          oldUnit.challenges.map((c) => [c.challengeName, c])
        );
        const allChallengeNames = new Set([
          ...newChallengesMap.keys(),
          ...oldChallengesMap.keys(),
        ]);

        allChallengeNames.forEach((challengeName) => {
          if (!challengeName) return;
          const oldChallenge = oldChallengesMap.get(challengeName);
          const newChallenge = newChallengesMap.get(challengeName);

          if (oldChallenge && !newChallenge) {
            unitDiffs.push({ type: "Deleted", challengeName });
          } else if (!oldChallenge && newChallenge) {
            unitDiffs.push({ type: "Added", challengeName });
          } else if (oldChallenge && newChallenge) {
            const stepChanges = [];
            levelOrder.forEach((level) => {
              const oldSteps = oldChallenge.levels[level].steps;
              const newSteps = newChallenge.levels[level].steps;
              if (oldSteps !== newSteps) {
                stepChanges.push(
                  `${
                    level.charAt(0).toUpperCase() + level.slice(1)
                  }: ${oldSteps} -> ${newSteps}`
                );
              }
            });
            if (stepChanges.length > 0) {
              unitDiffs.push({
                type: "Modified",
                challengeName,
                details: `Steps changed: ${stepChanges.join(", ")}`,
              });
            }
          }
        });
      }

      if (unitDiffs.length > 0) {
        diffs.push({
          unitNumber: oldUnit?.unitNumber || newUnit?.unitNumber,
          unitName: unitName,
          changes: unitDiffs,
        });
      }
    });

    return diffs;
  }, [oldCurriculum, newCurriculum]);

  if (differences.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-sm border border-slate-200">
        <p className="text-center text-slate-500">
          No differences found between the old and new curriculum.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-slate-200 space-y-6">
      <h2 className="text-2xl font-bold text-center">Difference Summary</h2>
      {differences.map((unitDiff, index) => (
        <div key={index}>
          <h3 className="text-xl font-bold text-indigo-700">
            Unit {unitDiff.unitNumber}: {unitDiff.unitName}
          </h3>
          <ul className="list-disc list-inside mt-2 space-y-2">
            {unitDiff.changes.map((change, cIndex) => (
              <li key={cIndex} className="ml-4">
                <span
                  className={`font-semibold ${
                    change.type === "Added"
                      ? "text-emerald-600"
                      : change.type === "Deleted"
                      ? "text-red-600"
                      : "text-amber-600"
                  }`}>
                  {change.type}:{" "}
                </span>
                <span className="font-semibold">{change.challengeName}</span>
                {change.details && (
                  <p className="text-sm text-slate-600 ml-6">
                    {change.details}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// --- DATA FETCHING & SAVING LOGIC ---
const fetchCurriculumShell = async (levelId, curriculumType) => {
  const unitsRef = collection(db, "codingLevels", levelId, curriculumType);
  const unitsSnapshot = await getDocs(unitsRef);
  const unitsData = [];
  for (const unitDoc of unitsSnapshot.docs) {
    const unit = { id: unitDoc.id, ...unitDoc.data(), challenges: [] };
    const challengesRef = collection(unitDoc.ref, "challenges");
    const challengesSnapshot = await getDocs(challengesRef);
    for (const challengeDoc of challengesSnapshot.docs) {
      const challengeData = challengeDoc.data();
      const challenge = {
        id: challengeDoc.id,
        ...challengeData,
        levels: {
          easy: {
            steps: challengeData.steps_easy || 0,
            stepDetails: [],
          },
          moderate: {
            steps: challengeData.steps_moderate || 0,
            stepDetails: [],
          },
          hard: {
            steps: challengeData.steps_hard || 0,
            stepDetails: [],
          },
        },
      };
      unit.challenges.push(challenge);
    }
    unitsData.push(unit);
  }
  return unitsData;
};

const fetchCurriculumData = async (levelId, curriculumType) => {
  const unitsRef = collection(db, "codingLevels", levelId, curriculumType);
  const unitsSnapshot = await getDocs(unitsRef);
  const unitsData = [];
  for (const unitDoc of unitsSnapshot.docs) {
    const unit = { id: unitDoc.id, ...unitDoc.data(), challenges: [] };
    const challengesRef = collection(unitDoc.ref, "challenges");
    const challengesSnapshot = await getDocs(challengesRef);
    for (const challengeDoc of challengesSnapshot.docs) {
      const challengeData = challengeDoc.data();
      const challenge = {
        id: challengeDoc.id,
        ...challengeData,
        levels: {
          easy: createBlankLevel(),
          moderate: createBlankLevel(),
          hard: createBlankLevel(),
        },
      };
      const stepsRef = collection(challengeDoc.ref, "steps");
      const stepsSnapshot = await getDocs(stepsRef);
      const stepsByDifficulty = { easy: [], moderate: [], hard: [] };
      stepsSnapshot.forEach((stepDoc) => {
        const docData = stepDoc.data();
        const stepData = {
          id: stepDoc.id,
          difficulty: docData.difficulty,
          stepIndex: docData.stepIndex,
          content: null,
        };

        if (stepsByDifficulty[stepData.difficulty]) {
          stepsByDifficulty[stepData.difficulty].push(stepData);
        }
      });
      for (const difficulty of levelOrder) {
        stepsByDifficulty[difficulty].sort((a, b) => a.stepIndex - b.stepIndex);
        challenge.levels[difficulty] = {
          steps: challengeData[`steps_${difficulty}`] || 0,
          stepDetails: stepsByDifficulty[difficulty],
        };
      }
      unit.challenges.push(challenge);
    }
    unitsData.push(unit);
  }
  return unitsData;
};

// --- PAGES & VIEWS ---
const SimpleLoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAppState();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const success = await login(username, password);
    if (!success) {
      setError("Invalid username or password.");
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-auto text-indigo-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
            Sign in
          </h2>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <InputField
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g., admin"
          />
          <InputField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" variant="primary" className="w-full">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};
const Sidebar = ({
  levels,
  selectedLevelId,
  onSelectLevel,
  onAddLevel,
  onDeleteLevel,
  userRole,
  children,
}) => (
  <div className="w-full md:w-64 bg-white p-4 flex-shrink-0 shadow-md rounded-lg border border-slate-200 flex flex-col">
    <div>
      <h2 className="text-xl font-bold mb-4 text-slate-800">Coding Levels</h2>
      <div className="space-y-2">
        {levels.map((level) => (
          <div
            key={level.id}
            className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
              selectedLevelId === level.id
                ? "bg-indigo-100 text-indigo-800 font-semibold"
                : "text-slate-700 hover:bg-slate-100"
            }`}>
            <span onClick={() => onSelectLevel(level.id)} className="flex-grow">
              {level.name}
            </span>
            {userRole === "admin" && (
              <button
                onClick={() => onDeleteLevel(level.id)}
                className="p-1 text-red-500 hover:text-red-700 opacity-60 hover:opacity-100 transition-opacity">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {userRole === "admin" && (
        <Button
          onClick={onAddLevel}
          variant="secondary"
          className="w-full mt-6">
          Add New Level
        </Button>
      )}
    </div>
    <div className="flex-grow mt-4 pt-4 border-t border-slate-200">
      {children}
    </div>
  </div>
);

// --- Global Teacher Tracking View ---
const TeacherTrackingView = ({
  allLevels,
  teachers,
  onMutateTeachers,
  onViewLog,
  onAssignTask, // <-- NEW PROP
}) => {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingTeacherName, setEditingTeacherName] = useState("");

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacherName.trim()) return;
    onMutateTeachers("add", { username: newTeacherName.trim() });
    setNewTeacherName("");
  };

  const startEditing = (teacher) => {
    setEditingTeacherId(teacher.id);
    setEditingTeacherName(teacher.username);
  };

  const cancelEditing = () => {
    setEditingTeacherId(null);
    setEditingTeacherName("");
  };

  const handleUpdateTeacher = async (teacherId) => {
    if (!editingTeacherName.trim()) return;
    onMutateTeachers("update", {
      id: teacherId,
      username: editingTeacherName.trim(),
    });

    if (selectedTeacher && selectedTeacher.id === teacherId) {
      setSelectedTeacher((prev) => ({
        ...prev,
        username: editingTeacherName.trim(),
      }));
    }
    cancelEditing();
  };

  const handleDeleteTeacher = async (teacherId) => {
    onMutateTeachers("delete", { id: teacherId });
    if (selectedTeacher && selectedTeacher.id === teacherId) {
      setSelectedTeacher(null);
    }
  };

  const acknowledgedLevels = useMemo(() => {
    if (!selectedTeacher || !allLevels) return [];
    return allLevels
      .map((level) => {
        const acknowledgedChallenges = [];
        const checkChallenges = (curriculum) => {
          curriculum?.forEach((unit) => {
            unit.challenges?.forEach((challenge) => {
              if (
                challenge.acknowledgements?.[
                  selectedTeacher.username.toLowerCase()
                ]?.status === "approved"
              ) {
                acknowledgedChallenges.push({
                  unitName: unit.unitName,
                  challengeName: challenge.challengeName,
                });
              }
            });
          });
        };
        checkChallenges(level.oldData);
        checkChallenges(level.newData);
        return { levelName: level.name, challenges: acknowledgedChallenges };
      })
      .filter((l) => l.challenges.length > 0);
  }, [selectedTeacher, allLevels]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="md:w-1/3">
        <h3 className="text-xl font-bold mb-4 text-slate-800">Teachers</h3>
        <div className="space-y-2">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-md shadow-sm">
              {editingTeacherId === teacher.id ? (
                <div className="p-2 border-2 border-indigo-400 rounded-md shadow-md">
                  <input
                    type="text"
                    value={editingTeacherName}
                    onChange={(e) => setEditingTeacherName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleUpdateTeacher(teacher.id)
                    }
                  />
                  <div className="flex gap-2 mt-2 justify-end">
                    <Button
                      onClick={() => handleUpdateTeacher(teacher.id)}
                      variant="success"
                      className="text-xs px-2 py-1">
                      <Check size={14} />
                    </Button>
                    <Button
                      onClick={cancelEditing}
                      variant="secondary"
                      className="text-xs px-2 py-1">
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`p-3 rounded-md flex justify-between items-center transition-all ${
                    selectedTeacher?.id === teacher.id
                      ? "bg-indigo-100 text-indigo-800 ring-2 ring-indigo-300"
                      : "hover:bg-slate-50"
                  }`}>
                  <span
                    className="flex-grow cursor-pointer font-medium capitalize"
                    onClick={() => setSelectedTeacher(teacher)}>
                    {teacher.username}
                  </span>
                  <div className="flex gap-2 text-slate-500">
                    <button
                      onClick={() => onAssignTask(teacher)}
                      className="p-1 hover:text-indigo-600 transition-colors"
                      title="Assign Task">
                      <CalendarPlus size={16} />
                    </button>
                    <button
                      onClick={() => onViewLog(teacher)}
                      className="p-1 hover:text-emerald-600 transition-colors"
                      title="View Activity Log">
                      <FileClock size={16} />
                    </button>
                    <button
                      onClick={() => startEditing(teacher)}
                      className="p-1 hover:text-blue-600 transition-colors"
                      title="Edit Teacher">
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTeacher(teacher.id)}
                      className="p-1 hover:text-red-600 transition-colors"
                      title="Delete Teacher">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <form
          onSubmit={handleAddTeacher}
          className="mt-6 p-3 bg-slate-50 rounded-lg border-t-2 border-indigo-500">
          <h4 className="font-semibold text-md mb-2 text-slate-700">
            Add New Teacher
          </h4>
          <div className="flex gap-2">
            <InputField
              label=""
              value={newTeacherName}
              onChange={(e) => setNewTeacherName(e.target.value)}
              placeholder="New teacher's username"
            />
            <Button type="submit" variant="primary" className="self-end">
              <PlusCircle size={16} /> Add
            </Button>
          </div>
        </form>
      </div>
      <div className="md:w-2/3">
        <h3 className="text-xl font-bold mb-4 text-slate-800">
          Approved Content
        </h3>
        {selectedTeacher ? (
          acknowledgedLevels.length > 0 ? (
            <div className="space-y-4">
              {acknowledgedLevels.map((level) => (
                <div
                  key={level.levelName}
                  className="p-4 bg-white rounded-lg shadow-sm border border-slate-200">
                  <h4 className="font-bold text-lg text-slate-800">
                    {level.levelName}
                  </h4>
                  <ul className="list-disc list-inside mt-2 text-slate-700">
                    {level.challenges.map((ack, index) => (
                      <li key={index}>
                        <strong>{ack.challengeName}</strong> in unit:{" "}
                        {ack.unitName}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-10 bg-white rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold text-slate-600">
                No Approved Content
              </h2>
              <p className="text-slate-500 mt-2">
                This teacher has not had any challenges approved yet.
              </p>
            </div>
          )
        ) : (
          <div className="text-center p-10 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-slate-600">
              Select a Teacher
            </h2>
            <p className="text-slate-500 mt-2">
              Choose a teacher from the sidebar to see their approved content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Level-Specific Progress View ---
const ChallengeProgress = ({
  challenge,
  title,
  teacherUsernames,
  onClickTeacher,
  onViewQuestions,
  onReviewSubmission,
}) => {
  const totalTeachers = teacherUsernames.length;
  if (totalTeachers === 0) {
    return <p className="text-slate-500">No teachers found.</p>;
  }

  const submissions = challenge.acknowledgements || {};
  const pending = teacherUsernames.filter(
    (u) => submissions[u.toLowerCase()]?.status === "pending"
  );
  const approved = teacherUsernames.filter(
    (u) => submissions[u.toLowerCase()]?.status === "approved"
  );
  const needsRevision = teacherUsernames.filter(
    (u) => submissions[u.toLowerCase()]?.status === "needs_revision"
  );
  const notSubmitted = teacherUsernames.filter(
    (u) => !submissions[u.toLowerCase()]
  );

  const percentage =
    totalTeachers > 0 ? (approved.length / totalTeachers) * 100 : 0;

  const TeacherList = ({ users, onClick, isReview = false }) => (
    <ul className="list-disc list-inside ml-2 mt-2 text-sm text-slate-700">
      {users.length > 0 ? (
        users.map((name) => (
          <li key={name}>
            <button
              onClick={() => onClick(name)}
              className="text-indigo-600 hover:underline capitalize">
              {name}
            </button>
            {isReview && (
              <span className="text-xs text-slate-500">
                {" "}
                -{" "}
                {formatTimestamp(submissions[name.toLowerCase()]?.submittedAt)}
              </span>
            )}
          </li>
        ))
      ) : (
        <p className="text-slate-500 italic">None</p>
      )}
    </ul>
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <div className="flex justify-between items-start">
        <h4 className="font-semibold text-lg text-slate-800 mb-2">
          {title}: {challenge.challengeName || "Untitled Challenge"}
        </h4>
        <Button
          onClick={onViewQuestions}
          variant="secondary"
          className="text-xs px-2 py-1"
          title="View open questions for this challenge">
          <MessageSquare size={14} />
          View Questions
        </Button>
      </div>

      <div className="mt-3">
        <div className="w-full bg-slate-200 rounded-full h-2.5">
          <div
            className="bg-emerald-600 h-2.5 rounded-full transition-all"
            style={{ width: `${percentage}%` }}></div>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          {approved.length} of {totalTeachers} teachers approved (
          {percentage.toFixed(0)}%)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 mt-4">
        <div>
          <h5 className="font-semibold text-amber-600 flex items-center gap-2">
            <Clock size={18} /> Pending Review
          </h5>
          <TeacherList
            users={pending}
            onClick={onReviewSubmission}
            isReview={true}
          />
        </div>
        <div>
          <h5 className="font-semibold text-emerald-600 flex items-center gap-2">
            <UserCheck size={18} /> Approved
          </h5>
          <TeacherList users={approved} onClick={onClickTeacher} />
        </div>
        <div>
          <h5 className="font-semibold text-red-600 flex items-center gap-2">
            <UserX size={18} /> Needs Revision
          </h5>
          <TeacherList users={needsRevision} onClick={onReviewSubmission} />
        </div>
        <div>
          <h5 className="font-semibold text-slate-500 flex items-center gap-2">
            <UserX size={18} /> Not Submitted
          </h5>
          <TeacherList users={notSubmitted} onClick={onClickTeacher} />
        </div>
      </div>
    </div>
  );
};

const LevelProgressView = ({
  level,
  oldCurriculum,
  newCurriculum,
  teachers,
  onSelectTeacher,
  onViewQuestions,
  onReviewSubmission,
}) => {
  const teacherUsernames = useMemo(
    () => teachers.map((t) => t.username),
    [teachers]
  );

  const oldChallenges = useMemo(() => {
    return (oldCurriculum || []).flatMap((unit) =>
      unit.challenges.map((challenge) => ({
        ...challenge,
        unitName: unit.unitName,
        unitId: unit.id,
      }))
    );
  }, [oldCurriculum]);

  const newChallenges = useMemo(() => {
    return (newCurriculum || []).flatMap((unit) =>
      unit.challenges.map((challenge) => ({
        ...challenge,
        unitName: unit.unitName,
        unitId: unit.id,
      }))
    );
  }, [newCurriculum]);

  const handleTeacherClick = (username) => {
    const teacher = teachers.find((t) => t.username === username);
    if (teacher) {
      onSelectTeacher(teacher);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-center text-slate-800">
        Progress for: {level.name}
      </h3>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/2 space-y-4">
          <h4 className="text-xl font-semibold text-center text-slate-800">
            Old Curriculum
          </h4>
          {oldChallenges.length > 0 ? (
            oldChallenges.map((challenge) => (
              <ChallengeProgress
                key={challenge.id}
                challenge={challenge}
                title={challenge.unitName}
                teacherUsernames={teacherUsernames}
                onClickTeacher={handleTeacherClick}
                onViewQuestions={() =>
                  onViewQuestions({
                    challenge,
                    unitId: challenge.unitId,
                    curriculumType: "units_old",
                    levelId: level.id,
                  })
                }
                onReviewSubmission={(username) =>
                  onReviewSubmission({
                    challenge,
                    unitId: challenge.unitId,
                    curriculumType: "units_old",
                    levelId: level.id,
                    username,
                  })
                }
              />
            ))
          ) : (
            <p className="text-slate-500 text-center">No challenges found.</p>
          )}
        </div>
        <div className="w-full lg:w-1/2 space-y-4">
          <h4 className="text-xl font-semibold text-center text-slate-800">
            New Curriculum
          </h4>
          {newChallenges.length > 0 ? (
            newChallenges.map((challenge) => (
              <ChallengeProgress
                key={challenge.id}
                challenge={challenge}
                title={challenge.unitName}
                teacherUsernames={teacherUsernames}
                onClickTeacher={handleTeacherClick}
                onViewQuestions={() =>
                  onViewQuestions({
                    challenge,
                    unitId: challenge.unitId,
                    curriculumType: "units_new",
                    levelId: level.id,
                  })
                }
                onReviewSubmission={(username) =>
                  onReviewSubmission({
                    challenge,
                    unitId: challenge.unitId,
                    curriculumType: "units_new",
                    levelId: level.id,
                    username,
                  })
                }
              />
            ))
          ) : (
            <p className="text-slate-500 text-center">No challenges found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Individual Level-Specific Progress View ---
const IndividualLevelProgressView = ({
  level,
  oldCurriculum,
  newCurriculum,
  teacher,
  onBack,
}) => {
  const teacherUsernameLower = teacher.username.toLowerCase();

  const getProgress = (curriculum) => {
    return (curriculum || []).flatMap((unit) =>
      unit.challenges.map((challenge) => ({
        id: challenge.id,
        unitName: unit.unitName,
        challengeName: challenge.challengeName || "Untitled Challenge",
        submissionStatus:
          challenge.acknowledgements?.[teacherUsernameLower]?.status ||
          "not_submitted",
      }))
    );
  };

  const oldProgress = getProgress(oldCurriculum);
  const newProgress = getProgress(newCurriculum);

  const oldTotal = oldProgress.length;
  const oldAcknowledged = oldProgress.filter(
    (p) => p.submissionStatus === "approved"
  ).length;
  const oldPercentage = oldTotal > 0 ? (oldAcknowledged / oldTotal) * 100 : 0;

  const newTotal = newProgress.length;
  const newAcknowledged = newProgress.filter(
    (p) => p.submissionStatus === "approved"
  ).length;
  const newPercentage = newTotal > 0 ? (newAcknowledged / newTotal) * 100 : 0;

  const StatusIcon = ({ status }) => {
    switch (status) {
      case "approved":
        return (
          <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
        );
      case "pending":
        return <Clock size={20} className="text-amber-600 flex-shrink-0" />;
      case "needs_revision":
        return <RefreshCcw size={20} className="text-red-600 flex-shrink-0" />;
      case "not_submitted":
      default:
        return <X size={20} className="text-slate-400 flex-shrink-0" />;
    }
  };

  const ProgressList = ({ title, progress }) => (
    <div className="w-full lg:w-1/2 space-y-3">
      <h4 className="text-xl font-semibold text-center text-slate-800">
        {title}
      </h4>
      {progress.length > 0 ? (
        <div className="space-y-2">
          {progress.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-white rounded-md shadow-sm border border-slate-200">
              <StatusIcon status={item.submissionStatus} />
              <div className="flex-grow">
                <p className="font-semibold text-slate-700">
                  {item.challengeName}
                </p>
                <p className="text-sm text-slate-500">{item.unitName}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-center">No challenges found.</p>
      )}
    </div>
  );

  const ProgressBar = ({ title, percentage, acknowledged, total }) => (
    <div className="w-full lg:w-1/2 space-y-3">
      <h4 className="text-xl font-semibold text-center text-slate-800">
        {title} (Approved)
      </h4>
      <div className="w-full bg-slate-200 rounded-full h-2.5">
        <div
          className="bg-emerald-600 h-2.5 rounded-full transition-all"
          style={{ width: `${percentage}%` }}></div>
      </div>
      <p className="text-sm text-slate-600 mt-1 text-center">
        {acknowledged} of {total} challenges approved ({percentage.toFixed(0)}
        %)
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={onBack} variant="secondary">
          Back to Level
        </Button>
        <h3 className="text-2xl font-bold text-center text-slate-800 capitalize">
          Progress for {teacher.username} in {level.name}
        </h3>
        <div className="w-32"></div> {/* Spacer */}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <ProgressBar
          title="Old Curriculum Progress"
          percentage={oldPercentage}
          acknowledged={oldAcknowledged}
          total={oldTotal}
        />
        <ProgressBar
          title="New Curriculum Progress"
          percentage={newPercentage}
          acknowledged={newAcknowledged}
          total={newTotal}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <ProgressList title="Old Curriculum Details" progress={oldProgress} />
        <ProgressList title="New Curriculum Details" progress={newProgress} />
      </div>
    </div>
  );
};

const AdminView = () => {
  const [levels, setLevels] = useState([]);
  const [selectedLevelId, setSelectedLevelId] = useState(null);
  const [oldCurriculum, setOldCurriculum] = useState(null);
  const [newCurriculum, setNewCurriculum] = useState(null);
  const [editing, setEditing] = useState(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const [adminMode, setAdminMode] = useState("edit");
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);
  const [activeChallengeIndices, setActiveChallengeIndices] = useState({
    old: 0,
    new: 0,
  });
  const [trackingData, setTrackingData] = useState(null);
  const [isLoadingTrackingData, setIsLoadingTrackingData] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [trackingView, setTrackingView] = useState("teacher");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [viewingQuestionsModal, setViewingQuestionsModal] = useState(null);
  const [showAllQuestionsModal, setShowAllQuestionsModal] = useState(false);
  const [showAllTasksModal, setShowAllTasksModal] = useState(false); // <-- NEW STATE
  const [viewingLogModal, setViewingLogModal] = useState(null);
  const [reviewingSubmission, setReviewingSubmission] = useState(null);
  const [showPendingReviewsModal, setShowPendingReviewsModal] = useState(false);
  const [assignTaskModal, setAssignTaskModal] = useState(null);
  const [isPending, startTransition] = useTransition();

  const fetchLevels = useCallback(async () => {
    const querySnapshot = await getDocs(collection(db, "codingLevels"));
    const levelsData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    levelsData.sort(customLevelSort);
    setLevels(levelsData);
  }, []);

  const fetchTeachers = useCallback(async () => {
    setIsLoadingTeachers(true);
    try {
      const querySnapshot = await getDocs(collection(db, "teachers"));
      const teachersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTeachers(
        teachersData.sort((a, b) => a.username.localeCompare(b.username))
      );
    } catch (error) {
      console.error("Error fetching teachers:", error);
    } finally {
      setIsLoadingTeachers(false);
    }
  }, []);

  useEffect(() => {
    fetchLevels();
    fetchTeachers();
  }, [fetchLevels, fetchTeachers]);

  const loadLevelData = useCallback(async () => {
    if (!selectedLevelId) return;
    setOldCurriculum(null);
    setNewCurriculum(null);
    setLoadingMessage("Fetching curriculum structure...");
    try {
      const oldData = await fetchCurriculumData(selectedLevelId, "units_old");
      const newData = await fetchCurriculumData(selectedLevelId, "units_new");
      setOldCurriculum(oldData);
      setNewCurriculum(newData);
      setActiveUnitIndex(0);
    } catch (err) {
      console.error("Error loading level data:", err);
      setNotification({
        message: "Error loading level data.",
        type: "error",
      });
    } finally {
      setLoadingMessage("");
    }
  }, [selectedLevelId]);

  const loadLevelShellData = useCallback(async () => {
    if (!selectedLevelId) return;
    setOldCurriculum(null);
    setNewCurriculum(null);
    setLoadingMessage("Fetching progress data...");
    try {
      const oldData = await fetchCurriculumShell(selectedLevelId, "units_old");
      const newData = await fetchCurriculumShell(selectedLevelId, "units_new");
      setOldCurriculum(oldData);
      setNewCurriculum(newData);
      setActiveUnitIndex(0);
    } catch (err) {
      console.error("Error loading level shell data:", err);
      setNotification({
        message: "Error loading progress data.",
        type: "error",
      });
    } finally {
      setLoadingMessage("");
    }
  }, [selectedLevelId]);

  // --- MODIFIED: This effect now loads global tracking data ---
  const loadGlobalTrackingData = useCallback(async () => {
    // --- FIX: Only load if in track mode ---
    if (adminMode === "track") {
      setIsLoadingTrackingData(true);
      setLoadingMessage("Fetching tracking data...");
      try {
        const fullDataPromises = levels.map(async (level) => {
          const oldData = await fetchCurriculumShell(level.id, "units_old");
          const newData = await fetchCurriculumShell(level.id, "units_new");
          return { ...level, oldData, newData };
        });
        const fullData = await Promise.all(fullDataPromises);
        setTrackingData(fullData);
      } catch (error) {
        console.error("Failed to load tracking data:", error);
        setNotification({
          message: "Failed to load tracking data.",
          type: "error",
        });
      } finally {
        setIsLoadingTrackingData(false);
        setLoadingMessage("");
      }
    }
  }, [adminMode, levels]); // --- FIX: depend on adminMode ---

  useEffect(() => {
    if (selectedLevelId) {
      if (adminMode === "track") {
        loadLevelShellData();
        setTrackingView("level");
        setSelectedTeacher(null);
      } else {
        loadLevelData();
      }
    } else {
      setOldCurriculum(null);
      setNewCurriculum(null);
      if (adminMode === "track") {
        setTrackingView("teacher");
        loadGlobalTrackingData(); // Load global data when no level is selected
      }
    }
  }, [
    selectedLevelId,
    adminMode,
    loadLevelData,
    loadLevelShellData,
    loadGlobalTrackingData,
  ]);

  // --- NEW: Effect to re-load global data when adminMode switches to 'track' ---
  // This ensures "Pending Reviews" is populated
  useEffect(() => {
    if (adminMode === "track" && !selectedLevelId) {
      loadGlobalTrackingData();
    }
  }, [adminMode, selectedLevelId, loadGlobalTrackingData]);

  const pendingReviewsList = useMemo(() => {
    if (!trackingData) return [];

    const pending = [];
    trackingData.forEach((level) => {
      const processCurriculum = (curriculum, curriculumType) => {
        curriculum?.forEach((unit) => {
          unit.challenges?.forEach((challenge) => {
            if (challenge.acknowledgements) {
              Object.entries(challenge.acknowledgements).forEach(
                ([username, data]) => {
                  if (data && data.status === "pending") {
                    pending.push({
                      challenge,
                      unitId: unit.id,
                      levelId: level.id,
                      curriculumType,
                      username,
                      levelName: level.name,
                      unitName: unit.unitName,
                      challengeName: challenge.challengeName,
                      submittedAt: data.submittedAt,
                    });
                  }
                }
              );
            }
          });
        });
      };
      processCurriculum(level.oldData, "units_old");
      processCurriculum(level.newData, "units_new");
    });

    pending.sort((a, b) => {
      const aTime = a.submittedAt?.seconds || 0;
      const bTime = b.submittedAt?.seconds || 0;
      return aTime - bTime; // Oldest first
    });

    return pending;
  }, [trackingData]);

  const handleAddLevel = useCallback(async () => {
    const levelName = prompt(
      "Enter the name for the new coding level (e.g., Basic 1):"
    );
    if (levelName) {
      const levelDocRef = await addDoc(collection(db, "codingLevels"), {
        name: levelName,
      });
      const newUnit = createNewUnit();
      await setDoc(
        doc(db, "codingLevels", levelDocRef.id, "units_old", newUnit.id),
        { unitNumber: "1", unitName: "First Unit" }
      );
      await setDoc(
        doc(db, "codingLevels", levelDocRef.id, "units_new", newUnit.id),
        { unitNumber: "1", unitName: "First Unit" }
      );
      await fetchLevels();
      setSelectedLevelId(levelDocRef.id);
    }
  }, [fetchLevels]);

  const handleDeleteLevel = useCallback(
    async (levelId) => {
      setConfirmModal({
        message:
          "Are you sure you want to delete this level and all its content? This action cannot be undone.",
        onConfirm: async () => {
          await deleteDoc(doc(db, "codingLevels", levelId));
          await fetchLevels();
          if (selectedLevelId === levelId) {
            setSelectedLevelId(null);
          }
          setConfirmModal(null);
        },
      });
    },
    [fetchLevels, selectedLevelId]
  );

  const handleMutateTeachers = useCallback(
    async (action, payload) => {
      if (action === "add") {
        try {
          await addDoc(collection(db, "teachers"), {
            username: payload.username,
            role: "teacher",
          });
          fetchTeachers();
        } catch (error) {
          console.error("Error adding teacher:", error);
          setNotification({ message: "Error adding teacher.", type: "error" });
        }
      } else if (action === "update") {
        try {
          const teacherRef = doc(db, "teachers", payload.id);
          await setDoc(
            teacherRef,
            { username: payload.username },
            { merge: true }
          );
          fetchTeachers();
        } catch (error) {
          console.error("Error updating teacher:", error);
          setNotification({
            message: "Error updating teacher.",
            type: "error",
          });
        }
      } else if (action === "delete") {
        setConfirmModal({
          message: "Are you sure you want to delete this teacher?",
          onConfirm: async () => {
            try {
              await deleteDoc(doc(db, "teachers", payload.id));
              fetchTeachers();
              setConfirmModal(null);
            } catch (error) {
              console.error("Error deleting teacher:", error);
              setNotification({
                message: "Error deleting teacher.",
                type: "error",
              });
            }
          },
        });
      }
    },
    [fetchTeachers]
  );

  // --- NEW: Handle Assign Task ---
  const handleAssignTask = async (taskData) => {
    try {
      await addDoc(collection(db, "tasks"), {
        ...taskData,
        assignedBy: "admin",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setNotification({
        message: "Task assigned successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error assigning task:", error);
      setNotification({ message: "Error assigning task.", type: "error" });
    }
  };

  const addUnitToBatch = async (unit, curriculumType, batch) => {
    const { challenges, id, ...unitData } = unit;
    const unitRef = doc(
      db,
      "codingLevels",
      selectedLevelId,
      curriculumType,
      id
    );
    batch.set(unitRef, unitData);

    const existingChallengesSnap = await getDocs(
      collection(unitRef, "challenges")
    );
    const currentChallengeIds = new Set(challenges.map((c) => c.id));

    for (const challengeDoc of existingChallengesSnap.docs) {
      if (!currentChallengeIds.has(challengeDoc.id)) {
        batch.delete(challengeDoc.ref);
      }
    }

    for (const challenge of challenges) {
      const { levels, id: challengeId, ...challengeData } = challenge;
      challengeData.steps_easy = levels.easy.steps;
      challengeData.steps_moderate = levels.moderate.steps;
      challengeData.steps_hard = levels.hard.steps;
      const challengeRef = doc(unitRef, "challenges", challengeId);
      batch.set(challengeRef, challengeData);

      const existingStepsSnap = await getDocs(
        collection(challengeRef, "steps")
      );
      const currentStepIds = new Set();
      Object.values(levels).forEach((level) => {
        level.stepDetails.forEach((step) => currentStepIds.add(step.id));
      });

      existingStepsSnap.forEach((stepDoc) => {
        if (!currentStepIds.has(stepDoc.id)) {
          batch.delete(stepDoc.ref);
        }
      });

      for (const levelName of levelOrder) {
        levels[levelName].stepDetails.forEach((step, index) => {
          if (step.content !== null) {
            const { id: stepId, ...stepData } = step;
            stepData.difficulty = levelName;
            stepData.stepIndex = index;
            const stepRef = doc(challengeRef, "steps", stepId);
            batch.set(stepRef, stepData);
          }
        });
      }
    }
  };

  const handleSaveUnit = async (unitIndex, curriculumSide) => {
    setIsSavingUnit(true);
    try {
      const curriculum =
        curriculumSide === "old" ? oldCurriculum : newCurriculum;
      const unitToSave = curriculum[unitIndex];
      const curriculumType =
        curriculumSide === "old" ? "units_old" : "units_new";

      const batch = writeBatch(db);
      await addUnitToBatch(unitToSave, curriculumType, batch);
      await batch.commit();

      setNotification({ message: `Unit saved successfully!`, type: "success" });
    } catch (error) {
      console.error("Error saving unit: ", error);
      setNotification({
        message: `Error saving unit. ${error.message}`,
        type: "error",
      });
    } finally {
      setIsSavingUnit(false);
    }
  };

  const handleSaveAll = async () => {
    if (!selectedLevelId) {
      setNotification({ message: "No level selected.", type: "error" });
      return;
    }
    setIsSavingAll(true);
    try {
      const batch = writeBatch(db);

      if (oldCurriculum) {
        for (const unit of oldCurriculum) {
          await addUnitToBatch(unit, "units_old", batch);
        }
      }

      if (newCurriculum) {
        for (const unit of newCurriculum) {
          await addUnitToBatch(unit, "units_new", batch);
        }
      }

      await batch.commit();

      setNotification({
        message: "All data saved successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error saving all data: ", error);
      setNotification({
        message: `Error saving data. ${error.message}`,
        type: "error",
      });
    }
    setIsSavingAll(false);
  };

  // --- NEW: Handle saving a review from the modal ---
  const handleSaveReview = async (status, comment) => {
    if (!reviewingSubmission) return;

    const { challenge, username, levelId, unitId, curriculumType } =
      reviewingSubmission;
    const usernameLower = username.toLowerCase();

    try {
      const challengeRef = doc(
        db,
        "codingLevels",
        levelId,
        curriculumType,
        unitId,
        "challenges",
        challenge.id
      );

      const challengeDoc = await getDoc(challengeRef);
      if (!challengeDoc.exists()) {
        throw new Error("Challenge document not found.");
      }

      const currentAcks = challengeDoc.data().acknowledgements || {};
      const currentComments = challengeDoc.data().submissionComments || {};

      const submission = currentAcks[usernameLower] || {};
      currentAcks[usernameLower] = {
        ...submission,
        status: status,
        reviewedAt: serverTimestamp(),
      };
      currentComments[usernameLower] = comment;

      await updateDoc(challengeRef, {
        acknowledgements: currentAcks,
        submissionComments: currentComments,
      });

      // --- This will force the global tracking data to refetch ---
      loadGlobalTrackingData();
      // --- This will force the level-specific data to refetch ---
      if (selectedLevelId === levelId) {
        loadLevelShellData();
      }

      setReviewingSubmission(null);
      setNotification({ message: "Review saved!", type: "success" });
    } catch (error) {
      console.error("Error saving review:", error);
      setNotification({ message: "Error saving review.", type: "error" });
    }
  };
  // --- END NEW ---

  const handleSaveDetails = async (updatedStepData) => {
    if (!editing || !selectedLevelId) {
      setNotification({
        message: "Cannot save. No item selected for editing.",
        type: "error",
      });
      return;
    }

    const { unitIndex, challengeIndex, levelName, stepIndex, curriculumSide } =
      editing;
    const curriculum = curriculumSide === "old" ? oldCurriculum : newCurriculum;
    const curriculumType = curriculumSide === "old" ? "units_old" : "units_new";

    try {
      const unitId = curriculum[unitIndex].id;
      const challengeId = curriculum[unitIndex].challenges[challengeIndex].id;
      const stepId = updatedStepData.id;
      const stepRef = doc(
        db,
        "codingLevels",
        selectedLevelId,
        curriculumType,
        unitId,
        "challenges",
        challengeId,
        "steps",
        stepId
      );

      const { id, ...stepDataToSave } = updatedStepData;
      stepDataToSave.difficulty = levelName;
      stepDataToSave.stepIndex = stepIndex;
      await setDoc(stepRef, stepDataToSave, { merge: true });

      const setSide =
        curriculumSide === "old" ? setOldCurriculum : setNewCurriculum;
      setSide((prev) => {
        const newCurriculum = JSON.parse(JSON.stringify(prev));
        newCurriculum[unitIndex].challenges[challengeIndex].levels[
          levelName
        ].stepDetails[stepIndex] = updatedStepData;
        return newCurriculum;
      });
      setNotification({ message: "Step details saved!", type: "success" });
    } catch (error) {
      console.error("Error saving step details: ", error);
      setNotification({
        message: "Failed to save step details.",
        type: "error",
      });
    } finally {
      setEditing(null);
    }
  };
  const handleAddUnit = () => {
    const sharedId = generateId();
    const newUnitTemplate = {
      id: sharedId,
      unitNumber: "",
      unitName: "",
    };
    const newUnitForOld = {
      ...newUnitTemplate,
      challenges: [createNewChallenge()],
    };
    const newUnitForNew = {
      ...newUnitTemplate,
      challenges: [createNewChallenge()],
    };
    const newActiveIndex = (oldCurriculum || []).length;
    setOldCurriculum((prev) => [...(prev || []), newUnitForOld]);
    setNewCurriculum((prev) => [...(prev || []), newUnitForNew]);
    setActiveUnitIndex(newActiveIndex);
  };

  const handleCreateMissingUnit = (sideToCreateIn, unitIndex) => {
    const sourceCurriculum =
      sideToCreateIn === "new" ? oldCurriculum : newCurriculum;
    const setTargetCurriculum =
      sideToCreateIn === "new" ? setNewCurriculum : setOldCurriculum;

    const sourceUnit = sourceCurriculum[unitIndex];

    if (!sourceUnit) {
      setNotification({
        message: "Cannot create: source unit not found.",
        type: "error",
      });
      return;
    }

    const newUnit = {
      id: sourceUnit.id,
      unitNumber: sourceUnit.unitNumber,
      unitName: sourceUnit.unitName,
      challenges: [createNewChallenge()],
    };

    setTargetCurriculum((prev) => {
      const newCurriculumState = [...(prev || [])];
      newCurriculumState[unitIndex] = newUnit;
      return newCurriculumState;
    });

    setNotification({
      message: `Unit created for ${sideToCreateIn} curriculum. Press "Save All" to confirm.`,
      type: "success",
    });
  };

  const handleDeleteUnit = (unitIndex) => {
    setConfirmModal({
      message:
        "Are you sure you want to delete this unit from BOTH curricula? This will be saved on the next save.",
      onConfirm: () => {
        setOldCurriculum((prev) => prev.filter((_, i) => i !== unitIndex));
        setNewCurriculum((prev) => prev.filter((_, i) => i !== unitIndex));
        setNotification({
          message:
            'Unit removed locally. Click "Save All" to finalize on server.',
          type: "success",
        });
        setConfirmModal(null);
      },
    });
  };
  const createSideSpecificHandlers = useCallback(
    (side) => {
      const setCurriculum =
        side === "old" ? setOldCurriculum : setNewCurriculum;
      return {
        onSaveUnit: () => handleSaveUnit(activeUnitIndex, side),
        onUpdateUnit: (field, value) => {
          setCurriculum((prev) => {
            const newCurriculum = JSON.parse(JSON.stringify(prev));
            if (newCurriculum[activeUnitIndex])
              newCurriculum[activeUnitIndex][field] = value;
            return newCurriculum;
          });
        },
        onAddChallenge: () => {
          setCurriculum((prev) => {
            const newCurriculum = JSON.parse(JSON.stringify(prev));
            if (newCurriculum[activeUnitIndex])
              newCurriculum[activeUnitIndex].challenges.push(
                createNewChallenge()
              );
            return newCurriculum;
          });
        },
        onUpdateChallenge: (challengeIndex, path, value) => {
          setCurriculum((prev) => {
            const newCurriculum = JSON.parse(JSON.stringify(prev));
            if (!newCurriculum[activeUnitIndex]) return newCurriculum;
            const challenge =
              newCurriculum[activeUnitIndex].challenges[challengeIndex];
            if (path.endsWith(".steps")) {
              const [, level] = path.split(".");
              const levelObject = challenge.levels[level];
              const newStepCount = Math.max(0, parseInt(value, 10) || 0);
              const currentStepCount = levelObject.stepDetails.length;
              levelObject.steps = newStepCount;
              if (newStepCount > currentStepCount) {
                for (let i = 0; i < newStepCount - currentStepCount; i++) {
                  levelObject.stepDetails.push(createBlankStep());
                }
              } else if (newStepCount < currentStepCount) {
                levelObject.stepDetails = levelObject.stepDetails.slice(
                  0,
                  newStepCount
                );
              }
            } else {
              const pathParts = path.split(".");
              if (pathParts.length > 1) {
                let obj = challenge;
                for (let i = 0; i < pathParts.length - 1; i++) {
                  obj = obj[pathParts[i]];
                }
                obj[pathParts[pathParts.length - 1]] = value;
              } else {
                challenge[path] = value;
              }
            }
            return newCurriculum;
          });
        },
        onDeleteChallenge: (challengeIndex) => {
          setCurriculum((prev) => {
            const newCurriculum = JSON.parse(JSON.stringify(prev));
            if (newCurriculum[activeUnitIndex])
              newCurriculum[activeUnitIndex].challenges.splice(
                challengeIndex,
                1
              );
            return newCurriculum;
          });
        },
        onEditChallengeDetails: (
          challengeIndex,
          levelName,
          stepIndex,
          stepData
        ) => {
          const curriculum = side === "old" ? oldCurriculum : newCurriculum;
          const unitId = curriculum[activeUnitIndex].id;
          const challengeId =
            curriculum[activeUnitIndex].challenges[challengeIndex].id;

          setEditing({
            unitIndex: activeUnitIndex,
            challengeIndex,
            levelName,
            stepIndex,
            data: stepData,
            curriculumSide: side,
            levelId: selectedLevelId,
            unitId: unitId,
            challengeId: challengeId,
          });
        },
      };
    },
    [activeUnitIndex, oldCurriculum, newCurriculum, selectedLevelId]
  );

  const oldHandlers = useMemo(
    () => createSideSpecificHandlers("old"),
    [createSideSpecificHandlers]
  );
  const newHandlers = useMemo(
    () => createSideSpecificHandlers("new"),
    [createSideSpecificHandlers]
  );

  const renderAdminContent = () => {
    if (loadingMessage || isPending) {
      return (
        <div className="flex flex-col justify-center items-center h-64">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
          <p className="mt-4 text-slate-600">
            {loadingMessage || (isPending ? "Changing view..." : "")}
          </p>
        </div>
      );
    }

    if (!selectedLevelId && adminMode !== "track") {
      return (
        <div className="text-center p-10 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-slate-600">
            Select a Coding Level
          </h2>
          <p className="text-slate-500 mt-2">
            Choose a level from the sidebar to start editing or add a new one.
          </p>
        </div>
      );
    }

    switch (adminMode) {
      case "track":
        if (isLoadingTeachers) {
          return (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="animate-spin text-indigo-500" size={40} />
            </div>
          );
        }

        if (
          selectedLevelId &&
          trackingView === "individual" &&
          selectedTeacher
        ) {
          return (
            <IndividualLevelProgressView
              level={levels.find((l) => l.id === selectedLevelId)}
              oldCurriculum={oldCurriculum}
              newCurriculum={newCurriculum}
              teacher={selectedTeacher}
              onBack={() => setTrackingView("level")}
            />
          );
        }

        if (selectedLevelId && trackingView === "level") {
          return (
            <LevelProgressView
              level={levels.find((l) => l.id === selectedLevelId)}
              oldCurriculum={oldCurriculum}
              newCurriculum={newCurriculum}
              teachers={teachers}
              onSelectTeacher={(teacher) => {
                setSelectedTeacher(teacher);
                setTrackingView("individual");
              }}
              onViewQuestions={setViewingQuestionsModal}
              onReviewSubmission={setReviewingSubmission}
            />
          );
        }
        if (!selectedLevelId && trackingView === "teacher") {
          return (
            <TeacherTrackingView
              allLevels={trackingData}
              teachers={teachers}
              onMutateTeachers={handleMutateTeachers}
              onViewLog={(teacher) => setViewingLogModal(teacher.username)}
              onAssignTask={(teacher) => setAssignTaskModal(teacher)}
            />
          );
        }
        return (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
          </div>
        );
      case "preview":
        return (
          <FilteredComparisonView
            levelData={{ oldData: oldCurriculum, newData: newCurriculum }}
            onAcknowledge={() => {}}
            onAskQuestion={() => {}}
            levelId={selectedLevelId}
          />
        );
      case "simplePreview":
        return (
          <SimplePreviewView
            oldCurriculum={oldCurriculum}
            newCurriculum={newCurriculum}
          />
        );
      case "edit":
      default:
        return (
          <div>
            {editing && (
              <StepDetailsModal
                stepData={editing.data}
                levelName={editing.levelName}
                stepIndex={editing.stepIndex}
                onSave={handleSaveDetails}
                onCancel={() => setEditing(null)}
                levelId={editing.levelId}
                unitId={editing.unitId}
                challengeId={editing.challengeId}
                curriculumType={
                  editing.curriculumSide === "old" ? "units_old" : "units_new"
                }
              />
            )}
            {oldCurriculum && newCurriculum ? (
              <main className="flex-grow flex flex-col lg:flex-row gap-4">
                <CurriculumEditorColumn
                  title="Old Curriculum"
                  unit={oldCurriculum[activeUnitIndex]}
                  unitIndex={activeUnitIndex}
                  isSavingUnit={isSavingUnit}
                  activeChallengeIndex={activeChallengeIndices.old}
                  setActiveChallengeIndex={(index) =>
                    setActiveChallengeIndices((prev) => ({
                      ...prev,
                      old: index,
                    }))
                  }
                  handlers={{
                    ...oldHandlers,
                    onDeleteUnit: () => handleDeleteUnit(activeUnitIndex),
                  }}
                  onCreateMissing={
                    newCurriculum[activeUnitIndex]
                      ? () => handleCreateMissingUnit("old", activeUnitIndex)
                      : null
                  }
                />
                <CurriculumEditorColumn
                  title="New Curriculum"
                  unit={newCurriculum[activeUnitIndex]}
                  unitIndex={activeUnitIndex}
                  isSavingUnit={isSavingUnit}
                  activeChallengeIndex={activeChallengeIndices.new}
                  setActiveChallengeIndex={(index) =>
                    setActiveChallengeIndices((prev) => ({
                      ...prev,
                      new: index,
                    }))
                  }
                  handlers={{
                    ...newHandlers,
                    onDeleteUnit: () => handleDeleteUnit(activeUnitIndex),
                  }}
                  onCreateMissing={
                    oldCurriculum[activeUnitIndex]
                      ? () => handleCreateMissingUnit("new", activeUnitIndex)
                      : null
                  }
                />
              </main>
            ) : (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-indigo-500" size={40} />
              </div>
            )}
            <div className="flex justify-center mt-12">
              <Button
                onClick={handleSaveAll}
                variant="success"
                className="px-8 py-3 text-lg"
                disabled={isSavingAll || isSavingUnit}>
                <CheckCircle size={20} />{" "}
                {isSavingAll ? "Saving..." : "Save All Changes"}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      {reviewingSubmission && (
        <ReviewSubmissionModal
          submissionData={reviewingSubmission}
          onClose={() => setReviewingSubmission(null)}
          onSaveReview={handleSaveReview}
        />
      )}
      {showPendingReviewsModal && (
        <PendingReviewsModal
          pendingReviews={pendingReviewsList}
          onClose={() => setShowPendingReviewsModal(false)}
          onSelectReview={(item) => {
            setShowPendingReviewsModal(false);
            setReviewingSubmission(item);
          }}
        />
      )}
      {viewingQuestionsModal && (
        <QuestionListViewModal
          {...viewingQuestionsModal}
          onClose={() => setViewingQuestionsModal(null)}
        />
      )}
      {showAllQuestionsModal && (
        <AllQuestionsViewModal
          onClose={() => setShowAllQuestionsModal(false)}
        />
      )}
      {/* --- NEW MODAL RENDER --- */}
      {showAllTasksModal && (
        <AllTasksViewModal onClose={() => setShowAllTasksModal(false)} />
      )}
      {/* --- END NEW MODAL RENDER --- */}
      {viewingLogModal && (
        <ActivityLogModal
          teacherUsername={viewingLogModal}
          onClose={() => setViewingLogModal(null)}
        />
      )}
      {assignTaskModal && (
        <AssignTaskModal
          teacher={assignTaskModal}
          onClose={() => setAssignTaskModal(null)}
          onAssign={handleAssignTask}
        />
      )}
      <Notification
        message={notification.message}
        type={notification.type}
        onClear={() => setNotification({ message: "", type: "" })}
      />
      <Sidebar
        levels={levels}
        selectedLevelId={selectedLevelId}
        onSelectLevel={(id) => {
          setSelectedLevelId(id);
          setActiveUnitIndex(0);
          setActiveChallengeIndices({ old: 0, new: 0 });
        }}
        onAddLevel={handleAddLevel}
        onDeleteLevel={handleDeleteLevel}
        userRole="admin">
        {adminMode === "edit" && selectedLevelId && (
          <EditorUnitSidebar
            units={oldCurriculum}
            activeIndex={activeUnitIndex}
            onSelect={(index) => {
              setActiveUnitIndex(index);
              setActiveChallengeIndices({ old: 0, new: 0 });
            }}
            onAdd={handleAddUnit}
          />
        )}
      </Sidebar>
      <div className="flex-grow min-w-0">
        {/* --- MODIFIED HEADER SECTION --- */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
          <h2 className="text-2xl font-bold text-slate-800">
            {selectedLevelId
              ? levels.find((l) => l.id === selectedLevelId)?.name
              : "Admin Panel"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {/* --- GLOBAL BUTTONS (Always show) --- */}
            <Button
              onClick={() => setShowPendingReviewsModal(true)}
              variant="secondary"
              className="relative">
              <Clock size={16} /> Pending Reviews
              {pendingReviewsList.length > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-slate-100">
                  {pendingReviewsList.length}
                </span>
              )}
            </Button>
            <Button
              onClick={() => setShowAllQuestionsModal(true)}
              variant="secondary">
              <Inbox size={16} /> All Questions
            </Button>
            {/* --- NEW BUTTON --- */}
            <Button
              onClick={() => setShowAllTasksModal(true)}
              variant="secondary">
              <ListChecks size={16} /> Track Tasks
            </Button>
            {/* --- END NEW BUTTON --- */}
            <Button
              onClick={() => startTransition(() => setAdminMode("track"))}
              variant={adminMode === "track" ? "primary" : "secondary"}>
              <Users size={16} /> Track Progress
            </Button>

            {/* --- DIVIDER (only if level selected) --- */}
            {selectedLevelId && (
              <div className="border-l border-slate-300 h-6 my-auto mx-1"></div>
            )}

            {/* --- LEVEL-SPECIFIC BUTTONS (Only show if level selected) --- */}
            {selectedLevelId && (
              <>
                <Button
                  onClick={() => startTransition(() => setAdminMode("edit"))}
                  variant={adminMode === "edit" ? "primary" : "secondary"}>
                  <Edit3 size={16} /> Editor
                </Button>
                <Button
                  onClick={() => startTransition(() => setAdminMode("preview"))}
                  variant={adminMode === "preview" ? "primary" : "secondary"}>
                  <Eye size={16} /> Preview
                </Button>
                <Button
                  onClick={() =>
                    startTransition(() => setAdminMode("simplePreview"))
                  }
                  variant={
                    adminMode === "simplePreview" ? "primary" : "secondary"
                  }>
                  <ListChecks size={16} /> Summary
                </Button>
              </>
            )}
          </div>
        </div>
        {/* --- END MODIFIED HEADER SECTION --- */}
        {renderAdminContent()}
      </div>
    </div>
  );
};
const TeacherView = ({ pdfLibsLoaded }) => {
  const [levels, setLevels] = useState([]);
  const [selectedLevelId, setSelectedLevelId] = useState(null);
  const [levelData, setLevelData] = useState(null);
  const { currentUser } = useAppState();
  const contentRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [questionModal, setQuestionModal] = useState(null);
  const [notification, setNotification] = useState({ message: "", type: "" });

  useEffect(() => {
    const fetchLevels = async () => {
      const querySnapshot = await getDocs(collection(db, "codingLevels"));
      const levelsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      levelsData.sort(customLevelSort);
      setLevels(levelsData);
    };
    fetchLevels();
  }, []);

  useEffect(() => {
    if (levels.length > 0 && !selectedLevelId) {
      setSelectedLevelId(levels[0].id);
    }
  }, [levels, selectedLevelId]);

  useEffect(() => {
    const loadFullLevelData = async () => {
      if (!selectedLevelId) {
        setLevelData(null);
        return;
      }
      setIsLoading(true);
      const levelDoc = await getDoc(doc(db, "codingLevels", selectedLevelId));
      if (levelDoc.exists()) {
        const oldData = await fetchCurriculumData(selectedLevelId, "units_old");
        const newData = await fetchCurriculumData(selectedLevelId, "units_new");
        setLevelData({ name: levelDoc.data().name, oldData, newData });
      }
      setIsLoading(false);
    };
    loadFullLevelData();
  }, [selectedLevelId]);

  const handleAcknowledge = async (unitId, challengeId, curriculumSide) => {
    const curriculumType =
      curriculumSide === "oldData" ? "units_old" : "units_new";
    const challengeRef = doc(
      db,
      "codingLevels",
      selectedLevelId,
      curriculumType,
      unitId,
      "challenges",
      challengeId
    );

    const challengeDoc = await getDoc(challengeRef);
    if (challengeDoc.exists()) {
      const usernameLower = currentUser.username.toLowerCase();
      const currentAcks = challengeDoc.data().acknowledgements || {};
      const newStatus = "pending";
      const newSubmission = {
        status: newStatus,
        submittedAt: serverTimestamp(),
      };

      if (currentAcks[usernameLower]?.status !== newStatus) {
        currentAcks[usernameLower] = newSubmission;
        await setDoc(
          challengeRef,
          { acknowledgements: currentAcks },
          { merge: true }
        );

        // Update local state
        const updatedLevelData = { ...levelData };
        const dataSide = updatedLevelData[curriculumSide];
        const unit = dataSide.find((u) => u.id === unitId);
        const challenge = unit.challenges.find((c) => c.id === challengeId);
        challenge.acknowledgements = {
          ...currentAcks,
          [usernameLower]: {
            status: newStatus,
            submittedAt: new Date().toISOString(),
          },
        };
        setLevelData(updatedLevelData);

        await logActivity(currentUser.username, "submit_for_review", {
          levelName: levelData.name,
          unitName: unit.unitName,
          challengeName: challenge.challengeName,
          status: newStatus,
        });
      }
    }
  };

  const handleAskQuestion = (unitId, unitName, challenge, curriculumSide) => {
    const curriculumType =
      curriculumSide === "oldData" ? "units_old" : "units_new";
    setQuestionModal({
      challenge,
      unitId,
      unitName,
      curriculumType,
      levelId: selectedLevelId,
      levelName: levelData.name,
    });
  };

  const handleQuestionSubmit = async (
    text,
    {
      levelId,
      levelName,
      curriculumType,
      unitId,
      unitName,
      challengeId,
      challengeName,
    }
  ) => {
    if (!text.trim()) return;
    try {
      const questionsRef = collection(
        db,
        "codingLevels",
        levelId,
        curriculumType,
        unitId,
        "challenges",
        challengeId,
        "questions"
      );
      await addDoc(questionsRef, {
        text: text.trim(),
        teacher: currentUser.username,
        createdAt: serverTimestamp(),
        levelId: levelId,
        unitId: unitId,
        challengeId: challengeId,
        status: "open",
        levelName: levelName,
        unitName: unitName,
        challengeName: challengeName,
      });
      setQuestionModal(null);
      setNotification({ message: "Question submitted!", type: "success" });
    } catch (err) {
      console.error("Error submitting question:", err);
      setNotification({ message: "Error submitting question.", type: "error" });
    }
  };

  const handleDownloadPdf = () => {
    const input = contentRef.current;
    if (input && window.html2canvas && window.jspdf) {
      const { jsPDF } = window.jspdf;
      window.html2canvas(input, { scale: 2, useCORS: true }).then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / pdfWidth;
        const height = canvasHeight / ratio;
        let position = 0;
        let remainingHeight = height;

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, height);
        remainingHeight -= pdfHeight;

        while (remainingHeight > 0) {
          position -= pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, height);
          remainingHeight -= pdfHeight;
        }
        pdf.save(`${levelData.name}-curriculum.pdf`);
      });
    } else {
      console.warn("PDF generation library is not loaded yet.");
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <Notification
        message={notification.message}
        type={notification.type}
        onClear={() => setNotification({ message: "", type: "" })}
      />
      {questionModal && (
        <QuestionModal
          challenge={questionModal.challenge}
          unitId={questionModal.unitId}
          unitName={questionModal.unitName}
          curriculumType={questionModal.curriculumType}
          levelId={questionModal.levelId}
          levelName={questionModal.levelName}
          teacherUsername={currentUser.username}
          onCancel={() => setQuestionModal(null)}
          onSubmit={handleQuestionSubmit}
        />
      )}
      <Sidebar
        levels={levels}
        selectedLevelId={selectedLevelId}
        onSelectLevel={setSelectedLevelId}
        userRole="teacher"
      />
      <div className="flex-grow">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
          </div>
        ) : levelData ? (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <h2 className="text-2xl font-bold text-slate-800 mb-2 sm:mb-0">
                {levelData.name}
              </h2>
              <Button
                onClick={handleDownloadPdf}
                variant="secondary"
                disabled={!pdfLibsLoaded}>
                {pdfLibsLoaded ? (
                  <>
                    <Download size={16} /> Download as PDF
                  </>
                ) : (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Preparing
                    Download
                  </>
                )}
              </Button>
            </div>
            <div ref={contentRef}>
              <FilteredComparisonView
                levelData={levelData}
                onAcknowledge={handleAcknowledge}
                onAskQuestion={handleAskQuestion}
                levelId={selectedLevelId}
              />
            </div>
          </div>
        ) : (
          <div className="text-center p-10 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-slate-600">
              Select a Coding Level
            </h2>
            <p className="text-slate-500 mt-2">
              Choose a level from the sidebar to view the curriculum.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP ROUTER ---
const AppRouter = ({ pdfLibsLoaded }) => {
  const { currentUser, logout } = useAppState();
  if (!currentUser) {
    return <SimpleLoginPage />;
  }
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-screen-2xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="text-indigo-600" size={32} />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              Curriculum Comparison Tool
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs sm:text-sm text-slate-500 hidden md:block">
              Logged in as:{" "}
              <span className="font-semibold capitalize">
                {currentUser.username}
              </span>
            </p>
            <TeacherTaskIcon />
            <Button onClick={logout} variant="danger">
              <LogOut size={16} /> Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-screen-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {currentUser.role === "admin" && <AdminView />}
        {currentUser.role === "teacher" && (
          <TeacherView pdfLibsLoaded={pdfLibsLoaded} />
        )}
      </main>
      <footer className="text-center py-8 text-sm text-slate-500">
        <p>Built with React, Firebase & Tailwind CSS.</p>
      </footer>
      <style>{`@keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; } .animate-fade-in { animation: fade-in 0.5s ease-out forwards; } .prose img { border-radius: 0.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; } .prose h2 { font-size: 1.25rem; margin-top: 1em; margin-bottom: 0.5em;} .prose { line-height: 1.6; }`}</style>
    </div>
  );
};

export default function App() {
  const [pdfLibsLoaded, setPdfLibsLoaded] = useState(false);

  useEffect(() => {
    const scripts = [
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    ];

    let loadedCount = 0;

    const checkAllLoaded = () => {
      if (loadedCount === scripts.length) {
        setPdfLibsLoaded(true);
      }
    };

    scripts.forEach((src) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        loadedCount++;
        checkAllLoaded();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        loadedCount++;
        checkAllLoaded();
      };
      document.body.appendChild(script);
    });
  }, []);

  return (
    <AppStateProvider>
      <AppRouter pdfLibsLoaded={pdfLibsLoaded} />
    </AppStateProvider>
  );
}
