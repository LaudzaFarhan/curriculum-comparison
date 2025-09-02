import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useMemo,
  useCallback,
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
  runTransaction,
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
} from "lucide-react";

// --- FIREBASE CONFIGURATION ---
// In a real app, use environment variables for this
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Replace with your actual config
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

// --- SIMPLE SCRIPT-BASED AUTHENTICATION CONTEXT ---
const AppStateContext = createContext();
export const AppStateProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null); // { role, username }

  const login = (username, password) => {
    const lowerUser = username.toLowerCase();
    if (lowerUser === "admin" && password === "calculated213") {
      setCurrentUser({ role: "admin", username: "admin" });
      return true;
    }
    if (
      ["teacher1", "teacher2", "teacher3"].includes(lowerUser) &&
      password === "teacher123"
    ) {
      setCurrentUser({ role: "teacher", username: lowerUser });
      return true;
    }
    return false;
  };

  const logout = () => setCurrentUser(null);
  const value = { currentUser, login, logout };
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
  acknowledgedBy: [],
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
const Notification = ({ message, type, onClear }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClear(), 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClear]);

  if (!message) return null;

  const baseClasses =
    "fixed top-5 right-5 p-4 rounded-lg shadow-xl text-white z-50 animate-fade-in";
  const typeClasses = { success: "bg-green-500", error: "bg-red-500" };

  return <div className={`${baseClasses} ${typeClasses[type]}`}>{message}</div>;
};

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
      title="Add Image via URL"
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
  const [isUploading, setIsUploading] = useState(false);
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
            alert("Failed to upload image. Please try again.");
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsDataURL(blob);
      }
    }
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
        <div className="relative flex-grow flex flex-col min-h-0">
          <EditorToolbar onAction={applyStyle} />
          <textarea
            ref={textAreaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            placeholder="Enter details for this step. You can paste images and rich text directly."
            className="w-full flex-grow px-3 py-2 bg-white border border-gray-300 rounded-b-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition resize-none"
            rows="50"
          />
          {isUploading && (
            <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col justify-center items-center">
              <Loader2 className="animate-spin text-blue-600" size={48} />
              <p className="mt-2 text-gray-700 font-semibold">
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
    <div className="space-y-2 pl-2 border-l-4 border-gray-300">
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
}) => (
  <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200 space-y-4">
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 pb-4 border-b border-gray-200">
      <h3 className="text-lg font-bold text-gray-700 whitespace-nowrap">
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
      <Button
        onClick={onSaveUnit}
        variant="success"
        className="sm:ml-4"
        disabled={isSavingUnit}>
        {isSavingUnit ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Saving...
          </>
        ) : (
          <>
            <Save size={16} /> Save this Unit
          </>
        )}
      </Button>
      <Button onClick={onDeleteUnit} variant="danger" disabled={isSavingUnit}>
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
          onUpdate={(path, value) =>
            onUpdateChallenge(challengeIndex, path, value)
          }
          onDelete={() => onDeleteChallenge(challengeIndex)}
          onEditStepDetails={(levelName, stepIndex, stepData) =>
            onEditChallengeDetails(
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
      <Button onClick={onAddChallenge} variant="secondary">
        <PlusCircle size={16} />
        Add Challenge
      </Button>
    </div>
  </div>
);
const EditorUnitSidebar = ({ units, activeIndex, onSelect, onAdd }) => (
  <div className="w-full bg-white rounded-lg p-2 flex flex-col border h-[80vh]">
    <h3 className="font-bold text-center mb-2 border-b pb-2 text-gray-700">
      Units
    </h3>
    <div className="space-y-1 flex-grow overflow-y-auto pr-1">
      {(units || []).map((unit, index) => (
        <div
          key={unit.id}
          onClick={() => onSelect(index)}
          className={`p-2 rounded-md cursor-pointer text-sm truncate ${
            activeIndex === index
              ? "bg-blue-100 text-blue-800 font-semibold"
              : "hover:bg-gray-100"
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
}) => {
  if (!unit) {
    return (
      <div className="w-full lg:w-1/2 p-2 sm:p-4 bg-gray-50 rounded-2xl shadow-inner flex flex-col h-[80vh]">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
          {title}
        </h2>
        <div className="text-center p-10 flex items-center justify-center h-full">
          <p className="text-gray-500">
            This unit does not exist. It may have been deleted or not yet
            created for this version.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-1/2 p-2 sm:p-4 bg-gray-50 rounded-2xl shadow-inner flex flex-col h-[80vh]">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
        {title}
      </h2>
      <div className="flex-grow overflow-y-auto pr-2">
        <UnitCard
          key={unit.id}
          unit={unit}
          unitIndex={unitIndex}
          isSavingUnit={isSavingUnit}
          {...handlers}
        />
      </div>
    </div>
  );
};

// --- COMPARISON & FILTERING COMPONENTS ---
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
const AcknowledgeStatus = ({ acknowledgedBy = [] }) => {
  const [showAll, setShowAll] = useState(false);
  if (acknowledgedBy.length === 0) {
    return <p className="text-xs text-gray-500">Not acknowledged by anyone.</p>;
  }
  const displayList = showAll ? acknowledgedBy : acknowledgedBy.slice(0, 2);
  return (
    <div className="text-xs text-gray-600">
      <p>Acknowledged by: {displayList.join(", ")}</p>
      {acknowledgedBy.length > 2 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-blue-500 hover:underline">
          {showAll ? "Show less" : `+${acknowledgedBy.length - 2} more`}
        </button>
      )}
    </div>
  );
};
const ComparisonChallenge = ({ challenge, onAcknowledge }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAppState();
  const isAcknowledged = challenge.acknowledgedBy?.includes(
    currentUser.username
  );

  return (
    <div className="bg-gray-100 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center p-3 text-left">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex-grow flex items-center gap-2">
          <span className="font-semibold text-gray-800">
            {challenge.challengeName || "Untitled Challenge"}
          </span>
          {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {currentUser.role === "teacher" && (
          <Button
            onClick={() => onAcknowledge(challenge.id)}
            disabled={isAcknowledged}
            variant={isAcknowledged ? "success" : "primary"}
            className="py-1 px-3 text-sm">
            {isAcknowledged ? (
              <>
                <Check size={16} /> Acknowledged
              </>
            ) : (
              "Acknowledge"
            )}
          </Button>
        )}
      </div>
      {isOpen && (
        <div className="p-4 border-t border-gray-200 space-y-4">
          {currentUser.role === "admin" && (
            <AcknowledgeStatus acknowledgedBy={challenge.acknowledgedBy} />
          )}
          {levelOrder.map((levelName) => (
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
const UnifiedComparisonView = ({
  oldCurriculum,
  newCurriculum,
  onAcknowledge,
}) => {
  const allUnitNumbers = useMemo(() => {
    const unitSet = new Set();
    (oldCurriculum || []).forEach(
      (u) => u.unitNumber && unitSet.add(u.unitNumber)
    );
    (newCurriculum || []).forEach(
      (u) => u.unitNumber && unitSet.add(u.unitNumber)
    );
    return Array.from(unitSet).sort();
  }, [oldCurriculum, newCurriculum]);

  return (
    <div className="space-y-6">
      {allUnitNumbers.map((unitNumber) => {
        const oldUnit = (oldCurriculum || []).find(
          (u) => u.unitNumber === unitNumber
        );
        const newUnit = (newCurriculum || []).find(
          (u) => u.unitNumber === unitNumber
        );

        const areNamesSame =
          oldUnit && newUnit && oldUnit.unitName === newUnit.unitName;

        return (
          <div
            key={unitNumber}
            className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
            {areNamesSame ? (
              <h3 className="text-2xl font-bold text-blue-700 mb-4 text-center">
                Unit {unitNumber}: {oldUnit.unitName}
              </h3>
            ) : null}

            <div className="flex flex-col lg:flex-row gap-8">
              <div className="w-full lg:w-1/2 space-y-3">
                {areNamesSame ? (
                  <h4 className="text-lg font-semibold text-center text-gray-800">
                    Old Curriculum
                  </h4>
                ) : oldUnit ? (
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
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
                    />
                  ))
                ) : (
                  <p className="text-gray-500 text-center pt-4">
                    This unit does not exist in the old curriculum.
                  </p>
                )}
              </div>
              <div className="w-full lg:w-1/2 space-y-3">
                {areNamesSame ? (
                  <h4 className="text-lg font-semibold text-center text-gray-800">
                    New Curriculum
                  </h4>
                ) : newUnit ? (
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
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
                    />
                  ))
                ) : (
                  <p className="text-gray-500 text-center pt-4">
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
    <div className="p-4 bg-white rounded-lg shadow-md mb-6 flex flex-col sm:flex-row gap-4 items-center">
      <div className="flex items-center gap-2 text-gray-600 font-semibold">
        <Filter size={20} /> Filters:
      </div>
      <div className="flex-grow w-full sm:w-auto">
        <select
          onChange={(e) => setSelectedUnit(e.target.value)}
          value={selectedUnit}
          className="w-full p-2 border border-gray-300 rounded-md">
          <option value="">All Units</option>
          {units.map((unit) => (
            <option key={`${unit.id}-${unit.unitName}`} value={unit.unitName}>
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
        <Search size={18} className="absolute right-3 top-2.5 text-gray-400" />
      </div>
    </div>
  );
};
const FilteredComparisonView = ({ levelData, onAcknowledge }) => {
  const [filters, setFilters] = useState({ unit: "", challenge: "" });
  const allUnits = useMemo(
    () => [...(levelData.oldData || []), ...(levelData.newData || [])],
    [levelData]
  );
  const uniqueUnits = useMemo(() => {
    const seen = new Set();
    return allUnits.filter((unit) => {
      const identifier = `${unit.unitNumber}-${unit.unitName}`;
      if (!unit.unitName || seen.has(identifier)) {
        return false;
      }
      seen.add(identifier);
      return true;
    });
  }, [allUnits]);

  const applyFilters = (data) => {
    if (!data) return [];
    let filteredData = [...data];
    if (filters.unit) {
      filteredData = filteredData.filter((u) => u.unitName === filters.unit);
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
      />
    </div>
  );
};
const SimplePreviewView = ({ oldCurriculum, newCurriculum }) => {
  const differences = useMemo(() => {
    const diffs = [];
    const newUnitsMap = new Map(
      (newCurriculum || []).map((u) => [u.unitName, u])
    );
    const oldUnitsMap = new Map(
      (oldCurriculum || []).map((u) => [u.unitName, u])
    );

    const allUnitNames = new Set([
      ...newUnitsMap.keys(),
      ...oldUnitsMap.keys(),
    ]);

    allUnitNames.forEach((unitName) => {
      const unitDiffs = [];
      const oldUnit = oldUnitsMap.get(unitName);
      const newUnit = newUnitsMap.get(unitName);

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
      } else {
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
      <div className="p-4 bg-white rounded-lg shadow-md">
        <p className="text-center text-gray-500">
          No differences found between the old and new curriculum.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-md space-y-6">
      <h2 className="text-2xl font-bold text-center">Difference Summary</h2>
      {differences.map((unitDiff, index) => (
        <div key={index}>
          <h3 className="text-xl font-bold text-blue-700">
            Unit {unitDiff.unitNumber}: {unitDiff.unitName}
          </h3>
          <ul className="list-disc list-inside mt-2 space-y-2">
            {unitDiff.changes.map((change, cIndex) => (
              <li key={cIndex} className="ml-4">
                <span
                  className={`font-semibold ${
                    change.type === "Added"
                      ? "text-green-600"
                      : change.type === "Deleted"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }`}>
                  {change.type}:{" "}
                </span>
                <span className="font-semibold">{change.challengeName}</span>
                {change.details && (
                  <p className="text-sm text-gray-600 ml-6">{change.details}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// --- DATA FETCHING & SAVING LOGIC (NEW STRUCTURE) ---
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
        const stepData = { id: stepDoc.id, ...stepDoc.data() };
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
            Sign in
          </h2>
          {/* <p className="mt-2 text-sm text-gray-600">
            Admin: admin / calculated213 <br />
            Teacher: teacher1 / teacher123
          </p> */}
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
  <div className="w-full md:w-64 bg-white p-4 flex-shrink-0 shadow-lg rounded-lg flex flex-col">
    <div>
      <h2 className="text-xl font-bold mb-4">Coding Levels</h2>
      <div className="space-y-2">
        {levels.map((level) => (
          <div
            key={level.id}
            className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${
              selectedLevelId === level.id
                ? "bg-blue-100 text-blue-800"
                : "hover:bg-gray-100"
            }`}>
            <span onClick={() => onSelectLevel(level.id)} className="flex-grow">
              {level.name}
            </span>
            {userRole === "admin" && (
              <button
                onClick={() => onDeleteLevel(level.id)}
                className="p-1 text-red-500 hover:text-red-700">
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
    <div className="flex-grow mt-4 pt-4 border-t">{children}</div>
  </div>
);
const TeacherTrackingView = ({ allLevels }) => {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const teachers = [
    { username: "teacher1", role: "teacher" },
    { username: "teacher2", role: "teacher" },
    { username: "teacher3", role: "teacher" },
  ];

  const acknowledgedLevels = useMemo(() => {
    if (!selectedTeacher || !allLevels) return [];
    return allLevels
      .map((level) => {
        const acknowledgedChallenges = [];
        const checkChallenges = (curriculum) => {
          curriculum?.forEach((unit) => {
            unit.challenges?.forEach((challenge) => {
              if (
                challenge.acknowledgedBy?.includes(selectedTeacher.username)
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
        <h3 className="text-xl font-bold mb-4">Teachers</h3>
        <div className="space-y-2">
          {teachers.map((teacher) => (
            <div
              key={teacher.username}
              onClick={() => setSelectedTeacher(teacher)}
              className={`p-3 rounded-md cursor-pointer ${
                selectedTeacher?.username === teacher.username
                  ? "bg-blue-100 text-blue-800"
                  : "bg-white hover:bg-gray-50"
              }`}>
              {teacher.username}
            </div>
          ))}
        </div>
      </div>
      <div className="md:w-2/3">
        <h3 className="text-xl font-bold mb-4">Acknowledged Content</h3>
        {selectedTeacher ? (
          acknowledgedLevels.length > 0 ? (
            <div className="space-y-4">
              {acknowledgedLevels.map((level) => (
                <div
                  key={level.levelName}
                  className="p-4 bg-white rounded-lg shadow-sm">
                  <h4 className="font-bold text-lg">{level.levelName}</h4>
                  <ul className="list-disc list-inside mt-2 text-gray-700">
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
            <p className="text-gray-500">
              This teacher has not acknowledged any challenges yet.
            </p>
          )
        ) : (
          <p className="text-gray-500">
            Select a teacher to see their progress.
          </p>
        )}
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
  const [adminMode, setAdminMode] = useState("edit"); // 'edit', 'preview', 'track', 'simplePreview'
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [activeUnitIndex, setActiveUnitIndex] = useState(0);

  const fetchLevels = useCallback(async () => {
    const querySnapshot = await getDocs(collection(db, "codingLevels"));
    const levelsData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    levelsData.sort(customLevelSort);
    setLevels(levelsData);
  }, []);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  useEffect(() => {
    const loadLevelData = async () => {
      if (!selectedLevelId) {
        setOldCurriculum(null);
        setNewCurriculum(null);
        return;
      }
      setOldCurriculum(null);
      setNewCurriculum(null);
      const oldData = await fetchCurriculumData(selectedLevelId, "units_old");
      const newData = await fetchCurriculumData(selectedLevelId, "units_new");
      setOldCurriculum(oldData);
      setNewCurriculum(newData);
      setActiveUnitIndex(0);
    };
    if (["edit", "preview", "simplePreview"].includes(adminMode)) {
      loadLevelData();
    }
  }, [selectedLevelId, adminMode]);

  const handleAddLevel = useCallback(async () => {
    const levelName = prompt(
      "Enter the name for the new coding level (e.g., Basic 1):"
    );
    if (levelName) {
      const levelDocRef = await addDoc(collection(db, "codingLevels"), {
        name: levelName,
      });
      // Also create empty subcollections to initialize the structure
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
      if (
        window.confirm(
          "Are you sure you want to delete this level and all its content? This action cannot be undone."
        )
      ) {
        // Deleting subcollections from the client-side is complex.
        // For a production app, this should be handled by a Cloud Function.
        // For now, we just delete the main document.
        await deleteDoc(doc(db, "codingLevels", levelId));
        await fetchLevels();
        if (selectedLevelId === levelId) {
          setSelectedLevelId(null);
        }
      }
    },
    [fetchLevels, selectedLevelId]
  );

  // --- BATCH SAVE LOGIC ---
  const saveUnitData = async (unit, curriculumType, batch) => {
    const { challenges, ...unitData } = unit;
    const unitRef = doc(
      db,
      "codingLevels",
      selectedLevelId,
      curriculumType,
      unit.id
    );
    batch.set(unitRef, unitData);

    // Get existing challenges and steps to find what to delete
    const existingChallengesSnap = await getDocs(
      collection(unitRef, "challenges")
    );
    const existingChallengeIds = new Set(
      existingChallengesSnap.docs.map((d) => d.id)
    );
    const currentChallengeIds = new Set(challenges.map((c) => c.id));

    for (const challengeDoc of existingChallengesSnap.docs) {
      if (!currentChallengeIds.has(challengeDoc.id)) {
        batch.delete(challengeDoc.ref); // Delete old challenges
      }
    }

    for (const challenge of challenges) {
      const { levels, id, ...challengeData } = challenge;
      challengeData.steps_easy = levels.easy.steps;
      challengeData.steps_moderate = levels.moderate.steps;
      challengeData.steps_hard = levels.hard.steps;
      const challengeRef = doc(unitRef, "challenges", id);
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
          batch.delete(stepDoc.ref); // Delete old steps
        }
      });

      for (const levelName of levelOrder) {
        levels[levelName].stepDetails.forEach((step, index) => {
          const { id: stepId, ...stepData } = step;
          stepData.difficulty = levelName;
          stepData.stepIndex = index;
          const stepRef = doc(challengeRef, "steps", stepId);
          batch.set(stepRef, stepData);
        });
      }
    }
  };

  const handleSaveUnit = async (unitIndex, curriculumSide) => {
    setIsSavingUnit(true);
    try {
      await runTransaction(db, async (transaction) => {
        const curriculum =
          curriculumSide === "old" ? oldCurriculum : newCurriculum;
        const unitToSave = curriculum[unitIndex];
        const batch = writeBatch(db); // We use a batch inside a transaction for efficiency
        await saveUnitData(
          unitToSave,
          curriculumSide === "old" ? "units_old" : "units_new",
          batch
        );
        await batch.commit(); // Commit the batch
      });
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
      /* ... */ return;
    }
    setIsSavingAll(true);
    try {
      let batches = [];
      let currentBatch = writeBatch(db);
      let writeCounter = 0;

      const processCurriculum = async (curriculum, curriculumType) => {
        if (!curriculum) return;
        for (const unit of curriculum) {
          // This is a simplified representation. For a real app,
          // you would need to count all writes inside saveUnitData.
          // For simplicity, we create a new batch per unit for Save All.
          const unitBatch = writeBatch(db);
          await saveUnitData(unit, curriculumType, unitBatch);
          batches.push(unitBatch);
        }
      };

      await processCurriculum(oldCurriculum, "units_old");
      await processCurriculum(newCurriculum, "units_new");

      for (const batch of batches) {
        await batch.commit();
      }

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
  // --- END BATCH SAVE LOGIC ---

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
    const newUnit = createNewUnit();
    setOldCurriculum((prev) => [...(prev || []), newUnit]);
    setNewCurriculum((prev) => [
      ...(prev || []),
      { ...newUnit, challenges: [createNewChallenge()] },
    ]);
    setActiveUnitIndex((oldCurriculum || []).length);
  };
  const handleDeleteUnit = (unitIndex) => {
    if (
      window.confirm(
        "Are you sure you want to delete this unit from BOTH curricula? This will be saved on the next save."
      )
    ) {
      setOldCurriculum((prev) => prev.filter((_, i) => i !== unitIndex));
      setNewCurriculum((prev) => prev.filter((_, i) => i !== unitIndex));
      setNotification({
        message:
          'Unit removed locally. Click "Save All" to finalize on server.',
        type: "success",
      });
    }
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
          setEditing({
            unitIndex: activeUnitIndex,
            challengeIndex,
            levelName,
            stepIndex,
            data: stepData,
            curriculumSide: side,
          });
        },
      };
    },
    [activeUnitIndex, oldCurriculum, newCurriculum]
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
    if (!selectedLevelId) {
      return (
        <div className="text-center p-10 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-600">
            Select a Coding Level
          </h2>
          <p className="text-gray-500 mt-2">
            Choose a level from the sidebar to start editing or add a new one.
          </p>
        </div>
      );
    }

    switch (adminMode) {
      case "track":
        return <TeacherTrackingView allLevels={levels} />;
      case "preview":
        return (
          <FilteredComparisonView
            levelData={{ oldData: oldCurriculum, newData: newCurriculum }}
            onAcknowledge={() => {}}
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
              />
            )}
            {oldCurriculum && newCurriculum ? (
              <main className="flex-grow flex flex-col lg:flex-row gap-4">
                <CurriculumEditorColumn
                  title="Old Curriculum"
                  unit={oldCurriculum[activeUnitIndex]}
                  unitIndex={activeUnitIndex}
                  isSavingUnit={isSavingUnit}
                  handlers={{
                    ...oldHandlers,
                    onDeleteUnit: () => handleDeleteUnit(activeUnitIndex),
                  }}
                />
                <CurriculumEditorColumn
                  title="New Curriculum"
                  unit={newCurriculum[activeUnitIndex]}
                  unitIndex={activeUnitIndex}
                  isSavingUnit={isSavingUnit}
                  handlers={{
                    ...newHandlers,
                    onDeleteUnit: () => handleDeleteUnit(activeUnitIndex),
                  }}
                />
              </main>
            ) : (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={40} />
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
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6">
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
          setAdminMode("edit");
        }}
        onAddLevel={handleAddLevel}
        onDeleteLevel={handleDeleteLevel}
        userRole="admin">
        {adminMode === "edit" && selectedLevelId && (
          <EditorUnitSidebar
            units={oldCurriculum}
            activeIndex={activeUnitIndex}
            onSelect={setActiveUnitIndex}
            onAdd={handleAddUnit}
          />
        )}
      </Sidebar>
      <div className="flex-grow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">
            {selectedLevelId
              ? levels.find((l) => l.id === selectedLevelId)?.name
              : "Admin Panel"}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAdminMode("track")} variant="secondary">
              <Users size={16} /> Track Progress
            </Button>
            {selectedLevelId && (
              <>
                <Button
                  onClick={() => setAdminMode("simplePreview")}
                  variant="secondary">
                  <ListChecks size={16} /> Difference Summary
                </Button>
                <Button
                  onClick={() => setAdminMode("preview")}
                  variant="secondary">
                  <Eye size={16} /> Detailed Preview
                </Button>
                {adminMode !== "edit" && (
                  <Button
                    onClick={() => setAdminMode("edit")}
                    variant="secondary">
                    <Edit3 size={16} /> Back to Editor
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
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
      const levelDoc = await getDoc(doc(db, "codingLevels", selectedLevelId));
      if (levelDoc.exists()) {
        const oldData = await fetchCurriculumData(selectedLevelId, "units_old");
        const newData = await fetchCurriculumData(selectedLevelId, "units_new");
        setLevelData({ name: levelDoc.data().name, oldData, newData });
      }
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
      const currentAcks = challengeDoc.data().acknowledgedBy || [];
      if (!currentAcks.includes(currentUser.username)) {
        await setDoc(
          challengeRef,
          { acknowledgedBy: [...currentAcks, currentUser.username] },
          { merge: true }
        );

        const updatedLevelData = { ...levelData };
        const dataSide = updatedLevelData[curriculumSide];
        const unit = dataSide.find((u) => u.id === unitId);
        const challenge = unit.challenges.find((c) => c.id === challengeId);
        challenge.acknowledgedBy = [...currentAcks, currentUser.username];
        setLevelData(updatedLevelData);
      }
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
      alert(
        "PDF generation library is not loaded yet. Please try again in a moment."
      );
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6">
      <Sidebar
        levels={levels}
        selectedLevelId={selectedLevelId}
        onSelectLevel={setSelectedLevelId}
        userRole="teacher"
      />
      <div className="flex-grow">
        {levelData ? (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
              <h2 className="text-2xl font-bold mb-2 sm:mb-0">
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
              />
            </div>
          </div>
        ) : (
          <div className="text-center p-10 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-600">
              Select a Coding Level
            </h2>
            <p className="text-gray-500 mt-2">
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
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <header className="bg-white shadow-md">
        <div className="max-w-full mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="text-blue-600" size={32} />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              Curriculum Comparison Tool
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs sm:text-sm text-gray-500 hidden md:block">
              Logged in as:{" "}
              <span className="font-semibold capitalize">
                {currentUser.role}
              </span>
            </p>
            <Button onClick={logout} variant="danger">
              <LogOut size={16} /> Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="w-[90%] mx-auto">
        {currentUser.role === "admin" && <AdminView />}
        {currentUser.role === "teacher" && (
          <TeacherView pdfLibsLoaded={pdfLibsLoaded} />
        )}
      </main>
      <footer className="text-center py-8 text-sm text-gray-500">
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
// new after editing
