import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useMemo,
} from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
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
} from "lucide-react";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyC_I7KRMfp9Bet1RzzNkq5Iy1o6nxcjyxA",
  authDomain: "curriculum-thelab-sg.firebaseapp.com",
  projectId: "curriculum-thelab-sg",
  storageBucket: "curriculum-thelab-sg.firebasestorage.app",
  messagingSenderId: "1076175905388",
  appId: "1:1076175905388:web:be007ccc7f8800c3226e49",
  measurementId: "G-5KFFENVBF3",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- SIMPLE AUTHENTICATION CONTEXT (No Firebase Auth) ---
const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(null); // 'admin', 'teacher', or null

  // Simple login function
  const login = (username, password) => {
    if (username.toLowerCase() === "admin" && password === "calculated213") {
      setUserRole("admin");
      return true;
    }
    if (username.toLowerCase() === "teacher" && password === "thelab_5577") {
      setUserRole("teacher");
      return true;
    }
    return false;
  };

  const logout = () => {
    setUserRole(null);
  };

  const value = { userRole, login, logout };

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);

// --- HELPER FUNCTIONS & INITIAL DATA ---
const generateId = () =>
  `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const createBlankStep = () => ({ id: generateId(), content: "" });
const createBlankLevel = () => ({ steps: 0, stepDetails: [] });
const createNewChallenge = () => ({
  id: generateId(),
  challengeName: "",
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

// --- REUSABLE UI COMPONENTS ---
const Button = ({
  onClick,
  children,
  variant = "primary",
  className = "",
  disabled = false,
}) => {
  const baseClasses =
    "flex items-center justify-center gap-2 px-4 py-2 rounded-md font-semibold transition-all duration-200 ease-in-out shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-400",
    secondary:
      "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
  };
  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled}>
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
    <label className="block text-sm font-medium text-gray-600 mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition"
    />
  </div>
);

// --- RICH TEXT EDITOR & MODAL ---
const EditorToolbar = ({ onAction }) => (
  <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-t-md border-b border-gray-300 flex-wrap">
    <button
      title="Bold"
      onClick={() => onAction("bold")}
      className="p-2 hover:bg-gray-200 rounded-md">
      <Bold size={18} />
    </button>
    <button
      title="Italic"
      onClick={() => onAction("italic")}
      className="p-2 hover:bg-gray-200 rounded-md">
      <Italic size={18} />
    </button>
    <button
      title="Heading 2"
      onClick={() => onAction("h2")}
      className="p-2 hover:bg-gray-200 rounded-md font-bold">
      H2
    </button>
    <button
      title="Add Image"
      onClick={() => onAction("image")}
      className="p-2 hover:bg-gray-200 rounded-md">
      <ImageIcon size={18} />
    </button>
    <div
      title="Text Color"
      className="relative p-2 hover:bg-gray-200 rounded-md">
      <Palette size={18} />
      <input
        type="color"
        onChange={(e) => onAction("color", e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  </div>
);
const StepDetailsModal = ({
  stepData,
  levelName,
  stepIndex,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(stepData.content);
  const textAreaRef = useRef(null);
  const handleSave = () => onSave({ ...stepData, content });
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
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-3xl flex flex-col animate-fade-in-up max-h-[90vh]">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Edit <span className="capitalize text-blue-600">{levelName}</span>{" "}
            Level - Step {stepIndex + 1}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-gray-200 transition">
            <X size={24} />
          </button>
        </div>
        <div className="flex-grow flex flex-col min-h-0">
          <EditorToolbar onAction={applyStyle} />
          <textarea
            ref={textAreaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter details for this step..."
            className="w-full flex-grow px-3 py-2 bg-white border border-gray-300 rounded-b-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition resize-none"
            rows="50"
          />
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
const StepDetailEditor = ({ stepIndex, onEditDetails }) => (
  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md border">
    <span className="font-medium text-gray-600">Step {stepIndex + 1}</span>
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
  <div className="flex flex-col gap-3 p-3 bg-white rounded-md border">
    <div className="flex items-end gap-3">
      <span className="font-semibold text-gray-700 capitalize w-20 text-left">
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
      <div className="pl-4 border-l-2 border-gray-200 space-y-2">
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
  unitIndex,
  challengeIndex,
  onUpdate,
  onDelete,
  onEditStepDetails,
}) => (
  <div className="flex flex-col gap-4 p-3 bg-gray-100 rounded-lg border border-gray-200">
    <div className="flex flex-col sm:flex-row gap-3 items-start">
      <div className="flex-grow w-full">
        <InputField
          label="Challenge Name"
          value={challenge.challengeName}
          onChange={(e) =>
            onUpdate(unitIndex, challengeIndex, "challengeName", e.target.value)
          }
          placeholder="e.g., Introduction to..."
        />
      </div>
      <Button
        onClick={() => onDelete(unitIndex, challengeIndex)}
        variant="danger"
        className="w-full sm:w-auto self-end">
        <Trash2 size={16} />
        <span className="hidden sm:inline">Delete Challenge</span>
      </Button>
    </div>
    <div className="space-y-2 pl-2 border-l-4 border-gray-300">
      {Object.keys(challenge.levels).map((levelName) => (
        <ChallengeLevelEditor
          key={levelName}
          levelName={levelName}
          levelData={challenge.levels[levelName]}
          onUpdate={(field, value) =>
            onUpdate(
              unitIndex,
              challengeIndex,
              `levels.${levelName}.${field}`,
              value
            )
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
  unitIndex,
  onUpdateUnit,
  onDeleteUnit,
  onAddChallenge,
  onUpdateChallenge,
  onDeleteChallenge,
  onEditChallengeDetails,
}) => (
  <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200 space-y-4">
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-gray-200">
      <h3 className="text-lg font-bold text-gray-700 whitespace-nowrap">
        Unit Details
      </h3>
      <div className="flex-grow w-full flex flex-col sm:flex-row gap-4">
        <InputField
          label="Unit Number"
          value={unit.unitNumber}
          onChange={(e) =>
            onUpdateUnit(unitIndex, "unitNumber", e.target.value)
          }
          placeholder="e.g., 1 or 2a"
        />
        <InputField
          label="Unit Name"
          value={unit.unitName}
          onChange={(e) => onUpdateUnit(unitIndex, "unitName", e.target.value)}
          placeholder="e.g., Core Concepts"
        />
      </div>
      <Button
        onClick={() => onDeleteUnit(unitIndex)}
        variant="danger"
        className="sm:ml-4 mt-2 sm:mt-0 self-end sm:self-center">
        <Trash2 size={16} />
        <span className="hidden sm:inline">Delete Unit</span>
      </Button>
    </div>
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-600">Challenges</h4>
      {unit.challenges.map((challenge, challengeIndex) => (
        <ChallengeItem
          key={challenge.id}
          challenge={challenge}
          unitIndex={unitIndex}
          challengeIndex={challengeIndex}
          onUpdate={onUpdateChallenge}
          onDelete={onDeleteChallenge}
          onEditStepDetails={(levelName, stepIndex, stepData) =>
            onEditChallengeDetails(
              unitIndex,
              challengeIndex,
              levelName,
              stepIndex,
              stepData
            )
          }
        />
      ))}
    </div>
    <div className="pt-3 text-center">
      <Button onClick={() => onAddChallenge(unitIndex)} variant="secondary">
        <PlusCircle size={16} />
        Add Challenge
      </Button>
    </div>
  </div>
);
const CurriculumColumn = ({
  title,
  curriculum,
  setCurriculum,
  editing,
  setEditing,
}) => {
  const updateChallenge = (unitIndex, challengeIndex, path, value) => {
    setCurriculum((prev) => {
      const newCurriculum = JSON.parse(JSON.stringify(prev));
      const challenge = newCurriculum[unitIndex].challenges[challengeIndex];
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
        challenge[path] = value;
      }
      return newCurriculum;
    });
  };
  const handleEditDetails = (
    unitIndex,
    challengeIndex,
    levelName,
    stepIndex,
    stepData
  ) =>
    setEditing({
      unitIndex,
      challengeIndex,
      levelName,
      stepIndex,
      data: stepData,
    });
  const addUnit = () => setCurriculum((prev) => [...prev, createNewUnit()]);
  const deleteUnit = (unitIndex) =>
    setCurriculum((prev) => prev.filter((_, i) => i !== unitIndex));
  const updateUnit = (unitIndex, field, value) =>
    setCurriculum((prev) => {
      const newCurriculum = [...prev];
      newCurriculum[unitIndex] = {
        ...newCurriculum[unitIndex],
        [field]: value,
      };
      return newCurriculum;
    });
  const addChallenge = (unitIndex) =>
    setCurriculum((prev) => {
      const newCurriculum = [...prev];
      newCurriculum[unitIndex].challenges.push(createNewChallenge());
      return newCurriculum;
    });
  const deleteChallenge = (unitIndex, challengeIndex) =>
    setCurriculum((prev) => {
      const newCurriculum = [...prev];
      newCurriculum[unitIndex].challenges = newCurriculum[
        unitIndex
      ].challenges.filter((_, i) => i !== challengeIndex);
      return newCurriculum;
    });
  return (
    <div className="w-full lg:w-1/2 p-2 sm:p-4 bg-gray-50 rounded-2xl shadow-inner">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
        {title}
      </h2>
      <div className="space-y-6">
        {curriculum.map((unit, index) => (
          <UnitCard
            key={unit.id}
            unit={unit}
            unitIndex={index}
            onUpdateUnit={updateUnit}
            onDeleteUnit={deleteUnit}
            onAddChallenge={addChallenge}
            onUpdateChallenge={updateChallenge}
            onDeleteChallenge={deleteChallenge}
            onEditChallengeDetails={handleEditDetails}
          />
        ))}
      </div>
      <div className="mt-8 text-center">
        <Button onClick={addUnit}>
          <FilePlus size={18} /> Add New Unit
        </Button>
      </div>
    </div>
  );
};

// --- COMPARISON VIEW COMPONENTS ---
const ComparisonStepDetail = ({ step, index }) => (
  <div className="pl-4">
    <h6 className="font-semibold text-gray-800">Step {index + 1}</h6>
    {step.content ? (
      <div
        className="prose prose-sm max-w-none mt-1 text-gray-700"
        dangerouslySetInnerHTML={{ __html: step.content }}
      />
    ) : (
      <p className="text-gray-500 text-sm italic">No details for this step.</p>
    )}
  </div>
);
const ComparisonLevelDetail = ({ levelData, levelName }) => (
  <div className="pl-4 border-l-4 border-blue-200">
    <h5 className="font-bold capitalize text-blue-800">
      {levelName} -{" "}
      <span className="font-normal text-gray-600">{levelData.steps} steps</span>
    </h5>
    <div className="mt-2 space-y-3">
      {levelData.stepDetails.length > 0 ? (
        levelData.stepDetails.map((step, index) => (
          <ComparisonStepDetail key={step.id} step={step} index={index} />
        ))
      ) : (
        <p className="text-gray-500 text-sm mt-1">No steps defined.</p>
      )}
    </div>
  </div>
);
const ComparisonChallenge = ({ challenge }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-gray-100 rounded-lg border border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 text-left">
        <span className="font-semibold text-gray-800">
          {challenge.challengeName || "Untitled Challenge"}
        </span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-gray-200 space-y-4">
          {Object.keys(challenge.levels).map((levelName) => (
            <ComparisonLevelDetail
              key={levelName}
              levelName={levelName}
              levelData={challenge.levels[levelName]}
            />
          ))}
        </div>
      )}
    </div>
  );
};
const ComparisonUnit = ({ unit }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left pb-3 border-b mb-3">
        <h3 className="text-xl font-bold text-blue-700">
          Unit {unit.unitNumber}: {unit.unitName || "Untitled Unit"}
        </h3>
        {isOpen ? (
          <ChevronUp size={24} className="text-blue-700" />
        ) : (
          <ChevronDown size={24} className="text-blue-700" />
        )}
      </button>
      {isOpen && (
        <div className="space-y-3">
          {unit.challenges.length > 0 ? (
            unit.challenges.map((challenge) => (
              <ComparisonChallenge key={challenge.id} challenge={challenge} />
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">
              No challenges in this unit.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
const ComparisonView = ({ oldCurriculum, newCurriculum }) => (
  <div className="max-w-7xl mx-auto animate-fade-in">
    <div className="flex flex-col lg:flex-row gap-8">
      <div className="w-full lg:w-1/2 space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800">
          Old Curriculum
        </h2>
        {oldCurriculum.map((unit) => (
          <ComparisonUnit key={unit.id} unit={unit} />
        ))}
      </div>
      <div className="w-full lg:w-1/2 space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-800">
          New Curriculum
        </h2>
        {newCurriculum.map((unit) => (
          <ComparisonUnit key={unit.id} unit={unit} />
        ))}
      </div>
    </div>
  </div>
);

// --- PAGES & VIEWS ---
const SimpleLoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAppState();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const success = login(username, password);
    if (!success) {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-auto text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600"></p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <InputField
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin or teacher"
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

const AdminView = () => {
  const [oldCurriculum, setOldCurriculum] = useState(null);
  const [newCurriculum, setNewCurriculum] = useState(null);
  const [editing, setEditing] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Define curriculumDocRef inside the component or make it stable
  const curriculumDocRef = useMemo(() => doc(db, "curriculum", "main"), []);

  useEffect(() => {
    const fetchData = async () => {
      const docSnap = await getDoc(curriculumDocRef);
      if (docSnap.exists()) {
        setOldCurriculum(docSnap.data().oldData || [createNewUnit()]);
        setNewCurriculum(docSnap.data().newData || [createNewUnit()]);
      } else {
        setOldCurriculum([createNewUnit()]);
        setNewCurriculum([createNewUnit()]);
      }
    };
    fetchData();
  }, [curriculumDocRef]); // Add dependency here

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(curriculumDocRef, {
        oldData: oldCurriculum,
        newData: newCurriculum,
      });
      alert("Data saved successfully!");
    } catch (error) {
      console.error("Error saving document: ", error);
      alert("Error saving data. See console for details.");
    }
    setIsSaving(false);
  };

  const handleSaveDetails = (updatedStepData) => {
    if (!editing) return;
    const { unitIndex, challengeIndex, levelName, stepIndex, curriculumSide } =
      editing;
    const setSide =
      curriculumSide === "old" ? setOldCurriculum : setNewCurriculum;
    setSide((prev) => {
      const newCurriculum = JSON.parse(JSON.stringify(prev));
      newCurriculum[unitIndex].challenges[challengeIndex].levels[
        levelName
      ].stepDetails[stepIndex] = updatedStepData;
      return newCurriculum;
    });
    setEditing(null);
  };

  if (oldCurriculum === null || newCurriculum === null) {
    return <div className="text-center p-10">Loading Curriculum Data...</div>;
  }

  return (
    <div className="p-2 sm:p-6 lg:p-8">
      {editing && (
        <StepDetailsModal
          stepData={editing.data}
          levelName={editing.levelName}
          stepIndex={editing.stepIndex}
          onSave={handleSaveDetails}
          onCancel={() => setEditing(null)}
        />
      )}
      <main className="flex flex-col lg:flex-row gap-4 lg:gap-8">
        <CurriculumColumn
          title="Old Curriculum"
          curriculum={oldCurriculum}
          setCurriculum={setOldCurriculum}
          editing={editing}
          setEditing={(editData) =>
            setEditing({ ...editData, curriculumSide: "old" })
          }
        />
        <CurriculumColumn
          title="New Curriculum"
          curriculum={newCurriculum}
          setCurriculum={setNewCurriculum}
          editing={editing}
          setEditing={(editData) =>
            setEditing({ ...editData, curriculumSide: "new" })
          }
        />
      </main>
      <div className="flex flex-wrap justify-center items-center gap-4 mt-12">
        <Button
          onClick={handleSave}
          variant="success"
          className="px-8 py-3 text-lg"
          disabled={isSaving}>
          <CheckCircle size={20} />{" "}
          {isSaving ? "Saving..." : "Save Changes to Firebase"}
        </Button>
      </div>
    </div>
  );
};

const TeacherView = () => {
  const [oldCurriculum, setOldCurriculum] = useState(null);
  const [newCurriculum, setNewCurriculum] = useState(null);

  // Define curriculumDocRef inside the component or make it stable
  const curriculumDocRef = useMemo(() => doc(db, "curriculum", "main"), []);

  useEffect(() => {
    const fetchData = async () => {
      const docSnap = await getDoc(curriculumDocRef);
      if (docSnap.exists()) {
        setOldCurriculum(docSnap.data().oldData || []);
        setNewCurriculum(docSnap.data().newData || []);
      }
    };
    fetchData();
  }, [curriculumDocRef]); // Add dependency here

  if (oldCurriculum === null || newCurriculum === null) {
    return <div className="text-center p-10">Loading Curriculum Data...</div>;
  }

  return (
    <div className="p-2 sm:p-6 lg:p-8">
      <ComparisonView
        oldCurriculum={oldCurriculum}
        newCurriculum={newCurriculum}
      />
    </div>
  );
};

// --- MAIN APP ROUTER ---
const AppRouter = () => {
  const { userRole } = useAppState();
  const { logout } = useAppState();

  if (!userRole) {
    return <SimpleLoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="text-blue-600" size={32} />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                Curriculum Comparison Tool
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Logged in as:{" "}
                <span className="font-semibold capitalize">{userRole}</span>
              </p>
            </div>
          </div>
          <Button onClick={logout} variant="danger">
            <LogOut size={16} /> Logout
          </Button>
        </div>
      </header>
      <div className="max-w-7xl mx-auto">
        {userRole === "admin" && <AdminView />}
        {userRole === "teacher" && <TeacherView />}
      </div>
      <footer className="text-center py-8 text-sm text-gray-500">
        <p>Built with React, Firebase & Tailwind CSS.</p>
      </footer>
      <style>{`@keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; } .animate-fade-in { animation: fade-in 0.5s ease-out forwards; } .prose img { border-radius: 0.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; } .prose h2 { font-size: 1.25rem; margin-top: 1em; margin-bottom: 0.5em;} .prose { line-height: 1.6; }`}</style>
    </div>
  );
};

export default function App() {
  return (
    <AppStateProvider>
      <AppRouter />
    </AppStateProvider>
  );
}
