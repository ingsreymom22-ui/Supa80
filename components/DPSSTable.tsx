import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Zap,
  Undo,
  Redo,
  Plus,
  Trash2,
  Calendar,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Type,
  Settings2,
  MousePointer2,
  Minus,
  Layout,
  Square,
  Quote,
  FileUp,
  FileDown,
  Loader2,
  Wand2,
  Menu,
  ChevronLeft,
  FileText,
  ChevronDown,
  ChevronRight,
  Table,
  Grid3X3,
  LayoutGrid,
  Columns,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Palette,
  Italic,
  Underline,
  Strikethrough,
  Indent,
  Outdent,
  List,
  ListOrdered,
  CheckSquare,
  MoreHorizontal,
  Download,
  Maximize2,
  Minimize2,
  Search,
  Archive,
  Folder,
  Star,
  Share2,
  Pencil,
  Lock,
  Unlock,
  ArrowRightLeft,
  GraduationCap,
  Copy,
  GripVertical,
  Ruler,
  Database,
  Check,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AppData, DPSSTopic } from "../types";
import { v4 as uuidv4 } from "uuid";
import { encodeToURLSafeBase64 } from "../services/sharingEncoder";
import { SupabaseSetupHelper } from "./SupabaseSetupHelper";
import { callNeuralEngine } from "../services/neuralEngine";
import { PAPER_STYLES } from "../src/styles/paperStyles";
// @ts-ignore
import html2pdf from "html2pdf.js";

interface DPSSTableProps {
  data: AppData;
  onUpdate: (data: AppData) => void;
  onUpdateTopic?: (updatedTopics: DPSSTopic[], topicToSave?: DPSSTopic) => void;
  onOpenSidebar?: () => void;
}

export const DPSSTable: React.FC<DPSSTableProps> = ({
  data,
  onUpdate,
  onUpdateTopic,
  onOpenSidebar,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isTableResizeLocked, setIsTableResizeLocked] = useState(true);
  const [showRuler, setShowRuler] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditorStudyPlanLoading, setIsEditorStudyPlanLoading] =
    useState(false);
  const [isEditorActionPlanLoading, setIsEditorActionPlanLoading] =
    useState(false);
  const [forceLightBg, setForceLightBg] = useState<boolean>(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<"down" | "up">("down");
  const [sharingTopicId, setSharingTopicId] = useState<string | null>(null);
  const [generatedShareLink, setGeneratedShareLink] = useState<string | null>(
    null,
  );
  const [isCopied, setIsCopied] = useState(false);
  const [sharingTopic, setSharingTopic] = useState<any | null>(null);
  const [isCloudShareLoading, setIsCloudShareLoading] = useState(false);
  const [cloudShareError, setCloudShareError] = useState<string | null>(null);
  const [showSetupHelper, setShowSetupHelper] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [isCopiedJson, setIsCopiedJson] = useState(false);

  const getTopicSizeString = (topic: any): string => {
    try {
      const bytes = JSON.stringify(topic).length;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } catch (e) {
      return "Unknown size";
    }
  };

  const isTooLargeForCloud = (topic: any): boolean => {
    try {
      const bytes = JSON.stringify(topic).length;
      return false; // No 1MB cloud limit anymore
    } catch (e) {
      return false;
    }
  };

  const downloadTopicJson = (topic: any) => {
    const blob = new Blob([JSON.stringify(topic, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.title.replace(/[^a-z0-9]/gi, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyTopicJsonToClipboard = (topic: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(topic, null, 2));
      setIsCopiedJson(true);
      setTimeout(() => setIsCopiedJson(false), 2000);
    } catch (err) {
      alert(
        "Failed to copy JSON to clipboard. Please select and copy manually.",
      );
    }
  };

  const handleImportJsonOrText = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || !parsed.title) {
        throw new Error(
          "Invalid format. The JSON must contain a 'title' field.",
        );
      }

      const cloneTopicWithNewIds = (topic: any): any => {
        const newId = uuidv4();
        return {
          ...topic,
          id: newId,
          children: topic.children
            ? topic.children.map(cloneTopicWithNewIds)
            : undefined,
        };
      };

      const clonedTopic = cloneTopicWithNewIds(parsed);
      const currentTopics = data.dpssTopics || [];
      const updatedTopics = [...currentTopics, clonedTopic];

      if (onUpdateTopic) {
        onUpdateTopic(updatedTopics, clonedTopic);
      } else {
        onUpdate({ ...data, dpssTopics: updatedTopics });
      }
      alert(`Successfully imported folder: "${clonedTopic.title}"!`);
      setIsImportModalOpen(false);
      setImportJsonText("");
    } catch (err: any) {
      alert(
        "Failed to import. " +
          (err.message ||
            "Please check that the JSON is valid and formatted correctly."),
      );
    }
  };
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [pickerOffset, setPickerOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPicker, setIsDraggingPicker] = useState(false);
  const startDragPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isDraggingPicker) {
      const handleMouseMove = (e: MouseEvent) => {
        setPickerOffset({
          x: e.clientX - startDragPos.current.x,
          y: e.clientY - startDragPos.current.y,
        });
      };
      const handleMouseUp = () => {
        setIsDraggingPicker(false);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDraggingPicker]);

  // Reset offset when selection changes significantly (like when picker initially appears)
  useEffect(() => {
    setPickerOffset({ x: 0, y: 0 });
  }, [pickerPos?.x, pickerPos?.y]);

  const [showAllTextColors, setShowAllTextColors] = useState(false);
  const [showAllHighlightColors, setShowAllHighlightColors] = useState(false);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportStyleModal, setShowExportStyleModal] = useState(false);
  const [selectedExportStyle, setSelectedExportStyle] = useState<
    | "executive"
    | "handwritten"
    | "minimalist"
    | "academic"
    | "retro"
    | "medium_bg"
    | "light_bg"
    | "no_bg"
  >("no_bg");
  const [pdfCustomHeader, setPdfCustomHeader] = useState("");
  const [pdfCustomFooter, setPdfCustomFooter] = useState("");
  const [keepRowsTogether, setKeepRowsTogether] = useState(true);
  const [pdfMargin, setPdfMargin] = useState(0.5);
  const [pdfPaperStyle, setPdfPaperStyle] = useState("none");
  const [showTableToolsMenu, setShowTableToolsMenu] = useState(false);
  const [showPageOptions, setShowPageOptions] = useState(false);

  const toggleDropdown = (
    menuName: "export" | "tableTools" | "more" | "moreTools" | "pageOptions",
  ) => {
    setShowExportMenu(menuName === "export" ? !showExportMenu : false);
    setShowTableToolsMenu(
      menuName === "tableTools" ? !showTableToolsMenu : false,
    );
    setShowMoreMenu(menuName === "more" ? !showMoreMenu : false);
    setShowMoreTools(menuName === "moreTools" ? !showMoreTools : false);
    setShowPageOptions(menuName === "pageOptions" ? !showPageOptions : false);
  };

  // Global click outside to dismiss menus
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement).closest(".z-\\[200\\]") ||
        (e.target as HTMLElement).closest(".z-\\[250\\]") ||
        (e.target as HTMLElement).closest("button")
      ) {
        return;
      }
      setShowExportMenu(false);
      setShowTableToolsMenu(false);
      setShowMoreMenu(false);
      setShowMoreTools(false);
    };
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);

  const [isToolbarHidden, setIsToolbarHidden] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("gportal_dpss_sidebar_width");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 160 && parsed <= 600) {
        return parsed;
      }
    }
    return window.innerWidth < 768 ? 200 : 300;
  });

  useEffect(() => {
    localStorage.setItem("gportal_dpss_sidebar_width", sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("dpss_plain_light", String(forceLightBg));
  }, [forceLightBg]);

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>(
    {},
  );
  const [isArchiveFolderOpen, setIsArchiveFolderOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<
    "files" | "stars" | "smart"
  >("files");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicTitle, setEditingTopicTitle] = useState<string>("");
  const [activeTableCell, setActiveTableCell] =
    useState<HTMLTableCellElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isResizing = useRef(false);
  const isResizingTableCol = useRef(false);
  const targetCellRef = useRef<HTMLTableCellElement | null>(null);
  const initialXRef = useRef(0);
  const initialWidthRef = useRef(0);
  const initialNextWidthRef = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);

  // Cross-Platform Persistent Scrollbar Trackers
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [sidebarScrollState, setSidebarScrollState] = useState({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  });

  const updateSidebarScroll = () => {
    if (sidebarScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        sidebarScrollRef.current;
      setSidebarScrollState({ scrollTop, scrollHeight, clientHeight });
    }
  };

  useEffect(() => {
    // Keep sidebar scroll info instantly synced
    updateSidebarScroll();
    // Also use multiple short delays to handle layout adjustments after content expands or loads
    const t1 = setTimeout(updateSidebarScroll, 50);
    const t2 = setTimeout(updateSidebarScroll, 150);
    const t3 = setTimeout(updateSidebarScroll, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [data, sidebarFilter, searchTerm, isSidebarOpen, expandedTopics]);

  const exportPDF = async (
    customStyle?:
      | "executive"
      | "handwritten"
      | "minimalist"
      | "academic"
      | "retro"
      | "medium_bg"
      | "light_bg"
      | "no_bg",
  ) => {
    if (!editorRef.current) return;
    const findTopicLocal = (
      items: DPSSTopic[],
      id: string,
    ): DPSSTopic | null => {
      for (const item of items) {
        if (item.id === id) return item;
        if (item.children && item.children.length > 0) {
          const found = findTopicLocal(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    const activeTopic = (selectedTopicId
      ? findTopicLocal(data?.dpssTopics || [], selectedTopicId)
      : null) || { title: "Notes" };

    const styleToUse = customStyle || selectedExportStyle || "executive";

    // Settings
    const settings = data.settings || {
      fontSize: 12,
      fontFamily: "'Inter', sans-serif",
    };
    const paperStyleToUse =
      styleToUse === "no_bg"
        ? "none"
        : pdfPaperStyle !== "none"
          ? pdfPaperStyle
          : (activeTopic as any).paperStyle || settings.paperStyle || "none";
    const selectedPaper =
      PAPER_STYLES.find((s) => s.id === paperStyleToUse) || PAPER_STYLES[0];

    // CSS background generator for paper styling
    let paperBackgroundCss = "";
    if (paperStyleToUse === "ruled") {
      paperBackgroundCss = `
        #pdf-export-body, #pdf-export-container {
          background-color: #ffffff !important;
          background-image: linear-gradient(#e2e8f0 1.5px, transparent 1.5px) !important;
          background-size: 100% 2.25rem !important;
        }
      `;
    } else if (paperStyleToUse === "grid") {
      paperBackgroundCss = `
        #pdf-export-body, #pdf-export-container {
          background-color: #ffffff !important;
          background-image: 
            linear-gradient(#f1f5f9 1px, transparent 1px) !important,
            linear-gradient(90deg, #f1f5f9 1px, transparent 1px) !important;
          background-size: 1.5rem 1.5rem !important;
        }
      `;
    } else if (paperStyleToUse === "dots") {
      paperBackgroundCss = `
        #pdf-export-body, #pdf-export-container {
          background-color: #ffffff !important;
          background-image: radial-gradient(#cbd5e1 2px, transparent 2px) !important;
          background-size: 1.5rem 1.5rem !important;
        }
      `;
    } else if (paperStyleToUse === "stars") {
      paperBackgroundCss = `
        #pdf-export-body, #pdf-export-container {
          background-color: #f5f3ff !important;
          background-image: 
            radial-gradient(rgba(99, 102, 241, 0.15) 1.5px, transparent 1.5px) !important,
            radial-gradient(rgba(139, 92, 246, 0.1) 2px, transparent 2px) !important;
          background-size: 2rem 2rem, 3.5rem 3.5rem !important;
        }
      `;
    } else if (paperStyleToUse === "engineering") {
      paperBackgroundCss = `
        #pdf-export-body, #pdf-export-container {
          background-color: #f0f9ff !important;
          background-image: 
            linear-gradient(rgba(14, 165, 233, 0.1) 1px, transparent 1px) !important,
            linear-gradient(90deg, rgba(14, 165, 233, 0.1) 1px, transparent 1px) !important;
          background-size: 1rem 1rem !important;
        }
      `;
    } else if (paperStyleToUse === "isometric") {
      paperBackgroundCss = `
        #pdf-export-body, #pdf-export-container {
          background-color: #ffffff !important;
          background-image: 
            linear-gradient(30deg, #f1f5f9 12%, transparent 12.5%, transparent 87%, #f1f5f9 87.5%, #f1f5f9),
            linear-gradient(150deg, #f1f5f9 12%, transparent 12.5%, transparent 87%, #f1f5f9 87.5%, #f1f5f9),
            linear-gradient(30deg, #f1f5f9 12%, transparent 12.5%, transparent 87%, #f1f5f9 87.5%, #f1f5f9),
            linear-gradient(150deg, #f1f5f9 12%, transparent 12.5%, transparent 87%, #f1f5f9 87.5%, #f1f5f9),
            linear-gradient(60deg, #e2e8f0 25%, transparent 25.5%, transparent 75%, #e2e8f0 75%, #e2e8f0),
            linear-gradient(60deg, #e2e8f0 25%, transparent 25.5%, transparent 75%, #e2e8f0 75%, #e2e8f0) !important;
          background-size: 40px 70px !important;
        }
      `;
    } else if (paperStyleToUse === "none") {
      paperBackgroundCss = `
        #pdf-export-body, #pdf-export-container {
          background-image: none !important;
        }
      `;
    }

    // Theme values based on style
    let bgColor = "#ffffff";
    let textColor = "#2c3e50";
    let primaryColor = "#1f3a52";
    let accentColor = "#3b82f6";
    let headerBorder = `3px solid ${accentColor}`;
    let fontImports = "";
    let fontFamilyRule = "'Inter', 'Segoe UI', Arial, sans-serif";

    let isDarkStyle = false;
    let customHeaderHtml = "";
    let customFooterHtml = "";
    let customContentStyles = "";

    if (styleToUse === "handwritten") {
      bgColor = "#fffdf5"; // ivory paper
      textColor = "#4a2c11"; // brownish text
      primaryColor = "#a16207"; // deep warm amber h1
      accentColor = "#f59e0b";
      headerBorder = "2px dashed #b45309";
      fontImports = `@import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');`;
      fontFamilyRule = "'Architects Daughter', cursive, sans-serif";

      customHeaderHtml = `
        <div style="margin-bottom: 25px; border-bottom: ${headerBorder}; padding-bottom: 12px; text-align: center; font-family: ${fontFamilyRule};">
          <div style="font-size: 13pt; color: ${primaryColor}; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px;">✍️ HANDWRITTEN LOG JOURNAL</div>
          <h1 style="font-size: 26pt; font-weight: normal; color: ${primaryColor}; margin: 5px 0;">${activeTopic.title}</h1>
          <p style="font-size: 10pt; color: #7c2d12; margin-top: 5px; font-style: italic;">Scribbled on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
      `;

      customContentStyles = `
        .note-content { font-family: ${fontFamilyRule} !important; font-size: 13.5pt !important; line-height: 1.8 !important; }
        .note-content h1, .note-content h2, .note-content h3 { font-family: ${fontFamilyRule} !important; color: ${primaryColor} !important; font-weight: normal !important; text-transform: none !important; }
        .note-content h1, .note-content h2 { font-size: 20pt !important; border-bottom: 1px dashed #d97706 !important; padding-bottom: 5px !important; }
        .note-content h3 { font-size: 16pt !important; }
        .note-content p { margin-bottom: 14pt !important; }
        .note-content table { border: 2px solid #b45309 !important; border-radius: 4px !important; }
        .note-content th, .note-content td { border: 1px dashed #b45309 !important; font-family: ${fontFamilyRule} !important; color: ${textColor} !important; padding: 8px !important; }
        .note-content th { background-color: #fef3c7 !important; color: #78350f !important; }
        /* Add a faint lined notebook design to the whole page */
        #pdf-export-body {
          background-image: linear-gradient(#fcd34d 1px, transparent 1px) !important;
          background-size: 100% 2.4em !important;
        }
      `;
    } else if (styleToUse === "minimalist") {
      bgColor = "#fcfcfc"; // cool porcelain
      textColor = "#1e293b";
      primaryColor = "#0f172a";
      accentColor = "#64748b";
      headerBorder = "1px solid #e2e8f0";
      fontImports = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;1,400&display=swap');`;
      fontFamilyRule = "'Lora', Georgia, 'Times New Roman', serif";

      customHeaderHtml = `
        <div style="margin-bottom: 45px; border-bottom: ${headerBorder}; padding-bottom: 30px; text-align: left; font-family: 'Playfair Display', serif;">
          <p style="font-size: 8pt; color: #8e9cae; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 4px;">D O C U M E N T • S T U D Y</p>
          <h1 style="font-size: 30pt; font-weight: 400; color: ${primaryColor}; margin: 0; font-style: italic; letter-spacing: -0.5px;">${activeTopic.title}</h1>
          <p style="font-size: 9pt; color: #94a3b8; margin-top: 15px; font-weight: 300; letter-spacing: 1px;">GENESIS ARCHIVE • ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}</p>
        </div>
      `;

      customContentStyles = `
        .note-content { font-family: 'Lora', Georgia, serif !important; font-size: 11.5pt !important; line-height: 1.75 !important; letter-spacing: 0.2px !important; }
        .note-content h1, .note-content h2, .note-content h3 { font-family: 'Playfair Display', serif !important; color: ${primaryColor} !important; font-weight: 700 !important; font-style: italic !important; }
        .note-content h1, .note-content h2 { font-size: 18pt !important; border-bottom: none !important; margin-top: 30pt !important; margin-bottom: 10pt !important; }
        .note-content h3 { font-size: 14pt !important; margin-top: 20pt !important; }
        .note-content p { margin-bottom: 15pt !important; text-align: justify !important; }
        .note-content table { border-collapse: separate !important; border-spacing: 0 !important; width: 100% !important; margin: 30px 0 !important; }
        .note-content th, .note-content td { border: none !important; border-bottom: 1px solid #e2e8f0 !important; padding: 12px 10px !important; color: ${textColor} !important; font-family: 'Lora', serif !important; }
        .note-content th { font-family: 'Playfair Display', serif !important; font-weight: bold !important; font-style: italic !important; background-color: transparent !important; border-bottom: 2px solid #0f172a !important; color: #0f172a !important; }
        .synthesis-card-wrapper, .qa-board-wrapper { border: none !important; border-left: 2px solid #0f172a !important; border-radius: 0 !important; padding: 10px 0 10px 20px !important; background-color: transparent !important; margin: 25px 0 !important; }
      `;
    } else if (styleToUse === "academic") {
      bgColor = "#ffffff";
      textColor = "#000000";
      primaryColor = "#000000";
      accentColor = "#000000";
      headerBorder = "1px solid #000000";
      fontImports = `@import url('https://fonts.googleapis.com/css2?family=Libertinus+Serif:ital,wght@0,400;0,700;1,400&display=swap');`;
      fontFamilyRule = "'Times New Roman', Times, 'Libertinus Serif', serif";

      customHeaderHtml = `
        <div style="text-align: center; margin-bottom: 40px; font-family: ${fontFamilyRule}; padding-bottom: 15px; border-bottom: 4px double #000;">
          <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">JOURNAL OF ADVANCED META-LEARNING AND HUMAN PERFORMANCE</div>
          <div style="font-size: 9pt; font-style: italic; color: #555; margin-bottom: 15px;">Volume XI, Spec. Issue • Published ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
          <h1 style="font-size: 24pt; font-weight: bold; color: #000; margin: 10px 0; font-family: ${fontFamilyRule};">${activeTopic.title.toUpperCase()}</h1>
          <div style="font-size: 10.5pt; margin-top: 10px; font-weight: bold; letter-spacing: 0.5px;">Strategic Master Portfolio & Research Dossier</div>
        </div>
      `;

      customFooterHtml = `
        <div style="margin-top: 40px; border-top: 1px solid #000000; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5pt; color: #333333; font-family: ${fontFamilyRule};">
          <div>PEAK PERFORMANCE LEARNING METHODOLOGY DOCUMENT</div>
          <div style="font-weight: bold;">DOCUMENT WRAPPER REFERENCE • PAGE 1</div>
          <div>CONFIDENTIAL RESEARCH ARCHIVE</div>
        </div>
      `;

      customContentStyles = `
        .note-content { font-family: ${fontFamilyRule} !important; font-size: 11pt !important; line-height: 1.6 !important; text-align: justify !important; }
        .note-content h1, .note-content h2, .note-content h3 { font-family: ${fontFamilyRule} !important; color: #000000 !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 13pt !important; margin-top: 25pt !important; margin-bottom: 8pt !important; letter-spacing: 0.5px !important; }
        .note-content h1 { border-bottom: 1px solid #000000 !important; padding-bottom: 3px !important; }
        .note-content p { margin-bottom: 12pt !important; text-indent: 24pt !important; }
        .note-content p:first-of-type { text-indent: 0 !important; }
        .note-content table { border: 1px solid #000000 !important; margin: 25px 0 !important; }
        .note-content th, .note-content td { border: 1px solid #000000 !important; padding: 10px !important; font-family: ${fontFamilyRule} !important; color: #000000 !important; }
        .note-content th { background-color: #f2f2f2 !important; text-transform: uppercase !important; font-weight: bold !important; font-size: 9.5pt !important; }
        .synthesis-card-wrapper, .qa-board-wrapper { border: 1px solid #000000 !important; border-radius: 0 !important; background-color: #fafafa !important; padding: 15px !important; margin: 20px 0 !important; }
      `;
    } else if (styleToUse === "retro") {
      isDarkStyle = true;
      bgColor = "#030712"; // space black
      textColor = "#10b981"; // vibrant cyperpunk green (phosphor)
      primaryColor = "#34d399"; // light cyber-green
      accentColor = "#059669";
      headerBorder = "1px dashed #10b981";
      fontImports = `@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap');`;
      fontFamilyRule = "'Fira Code', monospace";

      customHeaderHtml = `
        <div style="margin-bottom: 35px; border: 1px solid ${textColor}; padding: 20px; font-family: ${fontFamilyRule}; background-color: #0b1329;">
          <div style="display: flex; justify-content: space-between; font-size: 8pt; color: #64748b; margin-bottom: 10px; font-weight: bold;">
            <span>[SYS.STATUS: COMPILING]</span>
            <span>PORT_ADDR: 0x3A4F9</span>
            <span>SECURE_LINK: YES</span>
          </div>
          <h1 style="font-size: 22pt; font-weight: bold; color: ${primaryColor}; margin: 5px 0; font-family: ${fontFamilyRule}; text-transform: uppercase; letter-spacing: -1px;">> ${activeTopic.title}</h1>
          <div style="font-size: 9pt; color: #10b981; margin-top: 10px; border-top: 1px dashed #10b981; padding-top: 8px;">
            STAMP_DATE: [${new Date().toISOString()}] // RECORDS_EXPORT_V1.C
          </div>
        </div>
      `;

      customContentStyles = `
        .note-content { font-family: ${fontFamilyRule} !important; font-size: 10.5pt !important; line-height: 1.6 !important; }
        .note-content h1, .note-content h2, .note-content h3 { font-family: ${fontFamilyRule} !important; color: ${primaryColor} !important; font-weight: bold !important; text-transform: uppercase !important; }
        .note-content h1:before, .note-content h2:before { content: ":: " !important; }
        .note-content h3:before { content: "> " !important; }
        .note-content h1, .note-content h2 { font-size: 15pt !important; border-bottom: 1px dashed #10b981 !important; padding-bottom: 3px !important; margin-top: 25pt !important; }
        .note-content h3 { font-size: 12pt !important; }
        .note-content p { margin-bottom: 12pt !important; color: #a7f3d0 !important; }
        .note-content table { border: 1px solid #10b981 !important; border-collapse: collapse !important; background-color: #090e1a !important; }
        .note-content th, .note-content td { border: 1px solid #059669 !important; padding: 10px !important; font-family: ${fontFamilyRule} !important; color: #a7f3d0 !important; }
        .note-content th { background-color: #0c2017 !important; color: #34d399 !important; font-weight: bold !important; text-transform: uppercase !important; }
        .synthesis-card-wrapper, .qa-board-wrapper { border: 1px dashed #10b981 !important; border-radius: 4px !important; background-color: #04100c !important; color: #10b981 !important; padding: 15px !important; }
        .paper-dots, .paper-grid, .paper-ruled { background-color: #070d19 !important; border: 1px dashed #1e293b !important; }
      `;
    } else if (styleToUse === "medium_bg") {
      bgColor = "#94a3b8"; // professional medium slate background
      textColor = "#0f172a"; // dark text for high contrast
      accentColor = "#10b981";
      fontFamilyRule = "'Inter', system-ui, -apple-system, sans-serif";

      customHeaderHtml = `
        <div style="margin-bottom: 12px; border-bottom: 2px solid ${accentColor}; padding-bottom: 8px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="font-size: 8pt; font-weight: 950; color: #1e293b; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 4px; font-family: 'Inter', sans-serif;">Identity Mastery System (Medium Background)</div>
          <h1 style="font-size: 18pt; font-weight: 900; color: #010614; margin: 0; padding: 0; line-height: 1.15; letter-spacing: -0.025em; text-align: center; font-family: 'Inter', sans-serif;">${activeTopic.title}</h1>
          <p style="font-size: 8.5pt; color: #1e293b; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; font-weight: 700; margin-bottom: 0; font-family: 'Inter', sans-serif;">Performance Documentation • ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
      `;

      customContentStyles = `
        .note-content { line-height: 1.5; font-size: 11pt; color: ${textColor} !important; }
        .note-content p { margin-bottom: 6pt; }
        .note-content h1, .note-content h2, .note-content h3 { font-weight: 800; color: #0f172a !important; margin-top: 10pt; margin-bottom: 5pt; }
        .note-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .note-content th, .note-content td { border: 1px solid #64748b; padding: 8px; color: ${textColor} !important; }
        .synthesis-card-wrapper, .qa-board-wrapper { 
          border: 1.5px solid #475569 !important; 
          background-color: #cbd5e1 !important; 
          border-radius: 12px !important; 
          padding: 12px 14px !important; 
          margin: 8px 0 !important; 
          color: ${textColor} !important;
          box-shadow: none !important;
        }
        .paper-dots, .paper-grid, .paper-ruled, .paper-engineering { 
          background-image: none !important; 
          background-color: #cbd5e1 !important; 
          border: 1px solid #475569 !important; 
          border-radius: 10px !important; 
          padding: 12px !important; 
        }
      `;
    } else if (styleToUse === "light_bg") {
      bgColor = "#f1f5f9"; // beautiful morning light gray-slate
      textColor = "#1e293b"; // dark text
      accentColor = "#10b981";
      fontFamilyRule = "'Inter', system-ui, -apple-system, sans-serif";

      customHeaderHtml = `
        <div style="margin-bottom: 12px; border-bottom: 2px solid ${accentColor}; padding-bottom: 8px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="font-size: 8pt; font-weight: 950; color: ${accentColor}; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 4px; font-family: 'Inter', sans-serif;">Identity Mastery System (Light Background)</div>
          <h1 style="font-size: 18pt; font-weight: 900; color: #010614; margin: 0; padding: 0; line-height: 1.15; letter-spacing: -0.025em; text-align: center; font-family: 'Inter', sans-serif;">${activeTopic.title}</h1>
          <p style="font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; font-weight: 700; margin-bottom: 0; font-family: 'Inter', sans-serif;">Performance Documentation • ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
      `;

      customContentStyles = `
        .note-content { line-height: 1.5; font-size: 11pt; color: ${textColor} !important; }
        .note-content p { margin-bottom: 6pt; }
        .note-content h1, .note-content h2, .note-content h3 { font-weight: 800; color: #010614 !important; margin-top: 10pt; margin-bottom: 5pt; }
        .note-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .note-content th, .note-content td { border: 1px solid #cbd5e1; padding: 8px; color: ${textColor} !important; }
        .synthesis-card-wrapper, .qa-board-wrapper { 
          border: 1.5px solid #cbd5e1 !important; 
          background-color: #f8fafc !important; 
          border-radius: 12px !important; 
          padding: 12px 14px !important; 
          margin: 8px 0 !important; 
          color: ${textColor} !important;
          box-shadow: none !important;
        }
        .paper-dots, .paper-grid, .paper-ruled, .paper-engineering { 
          background-image: none !important; 
          background-color: #f8fafc !important; 
          border: 1px solid #cbd5e1 !important; 
          border-radius: 10px !important; 
          padding: 12px !important; 
        }
      `;
    } else if (styleToUse === "no_bg") {
      bgColor = "#ffffff"; // pure white
      textColor = "#000000"; // black text
      accentColor = "#10b981";
      fontFamilyRule = "'Inter', system-ui, -apple-system, sans-serif";

      customHeaderHtml = `
        <div style="margin-bottom: 12px; border-bottom: 2px solid ${accentColor}; padding-bottom: 8px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="font-size: 8pt; font-weight: 950; color: #000000; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 4px; font-family: 'Inter', sans-serif;">Identity Mastery System (No Background)</div>
          <h1 style="font-size: 18pt; font-weight: 900; color: #000000; margin: 0; padding: 0; line-height: 1.15; letter-spacing: -0.025em; text-align: center; font-family: 'Inter', sans-serif;">${activeTopic.title}</h1>
          <p style="font-size: 8.5pt; color: #000000; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; font-weight: 700; margin-bottom: 0; font-family: 'Inter', sans-serif;">Performance Documentation • ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
      `;

      customContentStyles = `
        .note-content { line-height: 1.5; font-size: 11pt; color: #000000 !important; }
        .note-content p { margin-bottom: 6pt; }
        .note-content h1, .note-content h2, .note-content h3 { font-weight: 800; color: #000000 !important; margin-top: 10pt; margin-bottom: 5pt; }
        .note-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        .note-content th, .note-content td { border: 1px solid #cbd5e1; padding: 8px; color: #000000 !important; }
        .synthesis-card-wrapper, .qa-board-wrapper { 
          border: 1.5px solid #cbd5e1 !important; 
          background-color: #ffffff !important; 
          border-radius: 12px !important; 
          padding: 12px 14px !important; 
          margin: 8px 0 !important; 
          color: #000000 !important;
          box-shadow: none !important;
        }
        .paper-dots, .paper-grid, .paper-ruled, .paper-engineering { 
          background-image: none !important; 
          background-color: #ffffff !important; 
          border: 1px solid #cbd5e1 !important; 
          border-radius: 10px !important; 
          padding: 12px !important; 
        }
      `;
    } else {
      // Classic Executive (Default)
      bgColor = "#ffffff";
      textColor = "#1e293b";
      accentColor = "#0284c7";
      fontFamilyRule = "'Inter', 'Segoe UI', Arial, sans-serif";

      customHeaderHtml = `
        <div style="margin-bottom: 12px; border-bottom: 2px solid ${accentColor}; padding-bottom: 8px;">
          <h1 style="font-size: 18pt; font-weight: 900; color: #0f172a; margin: 0; line-height: 1.2;">${activeTopic.title}</h1>
          <p style="font-size: 8.5pt; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 0;">Strategic Notes Export • ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        </div>
      `;

      customContentStyles = `
        .note-content h1, .note-content h2 { font-size: 14pt; font-weight: 900; margin-top: 14pt; margin-bottom: 6pt; color: #0369a1; }
        .note-content h3 { font-size: 12pt; font-weight: 800; margin-top: 10pt; margin-bottom: 5pt; color: #1e293b; }
        .note-content p { margin-bottom: 6pt; }
        .paper-dots, .paper-grid, .paper-ruled, .paper-engineering { background-image: none !important; background-color: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 10px !important; padding: 12px !important; }
        .synthesis-card-wrapper, .qa-board-wrapper { border: 1.5px solid #e2e8f0 !important; border-radius: 12px !important; padding: 12px 14px !important; margin: 8px 0 !important; background-color: #f8fafc !important; color: #1e293b !important; }
        table { width: 100% !important; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #e2e8f0; padding: 8px; }
        th { background-color: #f8fafc; font-weight: bold; color: #000000; }
      `;
    }

    // Create a robust container for export with fixed layout width
    const exportContainer = document.createElement("div");
    exportContainer.id = "pdf-export-body";
    exportContainer.style.position = "relative";
    exportContainer.style.zIndex = "999999";
    exportContainer.style.pointerEvents = "none";
    exportContainer.style.width = "1200px";
    exportContainer.style.boxSizing = "border-box";
    exportContainer.style.padding = "20px";
    exportContainer.style.backgroundColor = bgColor;
    exportContainer.style.color = textColor;
    exportContainer.style.fontFamily = fontFamilyRule;

    exportContainer.innerHTML = `
      ${customHeaderHtml}
      <div class="note-content" style="line-height: 1.5; font-size: 11pt;">
        ${editorRef.current.innerHTML}
      </div>
      ${customFooterHtml}
      <style>
        ${fontImports ? fontImports : ""}
        @page {
          size: A4 landscape;
          margin: 0 !important;
        }
        body {
          background-color: ${bgColor} !important;
          color: ${textColor} !important;
          font-family: ${fontFamilyRule} !important;
          -webkit-font-smoothing: antialiased;
        }
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid;
          break-after: avoid;
        }
        
        /* Prevent slicing lines of text and elements horizontally during page break */
        p, li, blockquote, pre,
        h1, h2, h3, h4, h5, h6,
        .note-content > p {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        
        .synthesis-card-wrapper, .qa-board-wrapper, blockquote {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        tr, th, td, table {
          page-break-inside: ${keepRowsTogether ? "avoid" : "auto"} !important;
          break-inside: ${keepRowsTogether ? "avoid" : "auto"} !important;
        }

        /* Ensure overflow is visible so words are never clipped or horizontally sliced */
        table, tr, td, th, .table-scroll-container, .synthesis-card-wrapper, .qa-board-wrapper, blockquote, p, pre, div, span {
          overflow: visible !important;
          box-shadow: none !important;
        }

        ${paperBackgroundCss}

        /* Force readable background and dark texts for all light and medium themes during export */
        ${
          styleToUse !== "retro"
            ? `
          #pdf-export-body, #pdf-export-container, .note-content, .export-content {
            background-color: ${bgColor} !important;
            background: ${bgColor} !important;
            color: ${textColor} !important;
          }
          /* Overrides to prevent unreadable dark backgrounds and pure black backgrounds in exported elements */
          .note-content [class*="bg-[#0"],
          .note-content [class*="bg-[#1"],
          .note-content [class*="bg-[#2"],
          .note-content [class*="bg-[#3"],
          .note-content [class*="bg-[#a" ${styleToUse === "no_bg" ? "" : ', .note-content [class*="bg-[#a"'}],
          .note-content [class*="bg-[#b" ${styleToUse === "no_bg" ? "" : ', .note-content [class*="bg-[#b"'}],
          .note-content [class*="bg-[#c" ${styleToUse === "no_bg" ? "" : ', .note-content [class*="bg-[#c"'}],
          .note-content [class*="bg-[#d" ${styleToUse === "no_bg" ? "" : ', .note-content [class*="bg-[#d"'}],
          .note-content [class*="bg-[#e" ${styleToUse === "no_bg" ? "" : ', .note-content [class*="bg-[#e"'}],
          .note-content [class*="bg-[#f" ${styleToUse === "no_bg" ? "" : ', .note-content [class*="bg-[#f"'}],
          .note-content [class*="bg-slate-7"],
          .note-content [class*="bg-slate-8"],
          .note-content [class*="bg-slate-9"],
          .note-content [class*="bg-zinc-7"],
          .note-content [class*="bg-zinc-8"],
          .note-content [class*="bg-zinc-9"],
          .note-content [class*="bg-stone-7"],
          .note-content [class*="bg-stone-8"],
          .note-content [class*="bg-stone-9"],
          .note-content [class*="bg-neutral-7"],
          .note-content [class*="bg-neutral-8"],
          .note-content [class*="bg-neutral-9"],
          .note-content [class*="bg-gray-7"],
          .note-content [class*="bg-gray-8"],
          .note-content [class*="bg-gray-9"],
          .note-content [class*="bg-[#0f172a]"],
          .note-content [class*="bg-[#0b1329]"],
          .note-content [class*="bg-black"],
          .note-content [style*="background-color: #0"],
          .note-content [style*="background-color: #1"],
          .note-content [style*="background-color: #2"],
          .note-content [style*="background-color: #3"],
          .note-content [style*="background-color:#0"],
          .note-content [style*="background-color:#1"],
          .note-content [style*="background-color:#2"],
          .note-content [style*="background-color:#3"],
          .note-content [style*="background-color: rgb(0"],
          .note-content [style*="background-color: rgb(1"],
          .note-content [style*="background-color: rgb(2"],
          .note-content [style*="background-color: rgb(3"],
          .note-content [style*="background-color:rgb(0"],
          .note-content [style*="background-color:rgb(1"],
          .note-content [style*="background-color:rgb(2"],
          .note-content [style*="background-color:rgb(3"],
          .note-content [style*="background: #0"],
          .note-content [style*="background: #1"],
          .note-content [style*="background: #2"],
          .note-content [style*="background: #3"],
          .note-content [style*="background:#0"],
          .note-content [style*="background:#1"],
          .note-content [style*="background:#2"],
          .note-content [style*="background:#3"],
          .note-content [style*="background:black"],
          .note-content [style*="background-color:black"],
          .note-content [style*="background: black"],
          .note-content [style*="background-color: black"] {
            background-color: ${styleToUse === "no_bg" ? "transparent" : styleToUse === "medium_bg" ? "#cbd5e1" : "#f1f5f9"} !important;
            background: ${styleToUse === "no_bg" ? "transparent" : styleToUse === "medium_bg" ? "#cbd5e1" : "#f1f5f9"} !important;
            color: #000000 !important;
            border-color: ${styleToUse === "medium_bg" ? "#64748b" : "#cbd5e1"} !important;
          }

          /* Ensure texts inside overridden dark containers are perfectly readable */
          .note-content [class*="bg-[#0"] *, .note-content [class*="bg-[#1"] *, 
          .note-content [class*="bg-[#2"] *, .note-content [class*="bg-[#3"] *, 
          .note-content [class*="bg-slate-7"] *, .note-content [class*="bg-slate-8"] *, .note-content [class*="bg-slate-9"] *,
          .note-content [class*="bg-zinc-7"] *, .note-content [class*="bg-zinc-8"] *, .note-content [class*="bg-zinc-9"] *,
          .note-content [class*="bg-stone-7"] *, .note-content [class*="bg-stone-8"] *, .note-content [class*="bg-stone-9"] *,
          .note-content [class*="bg-neutral-7"] *, .note-content [class*="bg-neutral-8"] *, .note-content [class*="bg-neutral-9"] *,
          .note-content [class*="bg-gray-7"] *, .note-content [class*="bg-gray-8"] *, .note-content [class*="bg-gray-9"] *,
          .note-content [class*="bg-black"] *,
          .note-content [style*="background-color: #0"] *,
          .note-content [style*="background-color: #1"] *,
          .note-content [style*="background-color: #2"] *,
          .note-content [style*="background-color: #3"] *,
          .note-content [style*="background-color: black"] * {
            color: #000000 !important;
          }

          .synthesis-card-wrapper, .qa-board-wrapper, blockquote, pre {
            background-color: ${styleToUse === "medium_bg" ? "#cbd5e1" : "#f8fafc"} !important;
            background: ${styleToUse === "medium_bg" ? "#cbd5e1" : "#f8fafc"} !important;
            color: #1e293b !important;
            border-color: #cbd5e1 !important;
          }
          .synthesis-card-wrapper *, .qa-board-wrapper *, blockquote *, pre * {
            color: #1e293b !important;
          }
          .synthesis-card-wrapper div[style*="background-color: #ffffff"], 
          .synthesis-card-wrapper div[style*="background-color: rgb(255, 255, 255)"],
          .qa-board-wrapper div[style*="background-color: #ffffff"],
          .qa-board-wrapper div[style*="background-color: rgb(255, 255, 255)"] {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #1e293b !important;
          }
        `
            : ""
        }

        .flex { display: flex !important; }
        .grid { display: grid !important; }

        /* Compress massive tailwind paddings, margins, and gaps for elegant PDF output sheets */
        .note-content [class*="p-8"], .note-content [class*="p-12"], .note-content [class*="p-10"], .note-content [class*="p-6"], .note-content [class*="p-16"],
        .note-content [class*="py-8"], .note-content [class*="py-12"], .note-content [class*="py-10"], .note-content [class*="py-16"],
        .note-content [class*="px-8"], .note-content [class*="px-12"], .note-content [class*="px-10"] {
          padding: 12px 14px !important;
        }
        .note-content [class*="my-8"], .note-content [class*="my-12"], .note-content [class*="my-10"], .note-content [class*="my-16"] {
          margin-top: 8px !important;
          margin-bottom: 8px !important;
        }
        .note-content [class*="mt-8"], .note-content [class*="mt-12"], .note-content [class*="mt-10"], .note-content [class*="mt-16"] {
          margin-top: 8px !important;
        }
        .note-content [class*="mb-8"], .note-content [class*="mb-12"], .note-content [class*="mb-10"], .note-content [class*="mb-16"] {
          margin-bottom: 8px !important;
        }
        .note-content [class*="gap-8"], .note-content [class*="gap-12"], .note-content [class*="gap-10"], .note-content [class*="gap-6"] {
          gap: 12px !important;
        }
        .note-content [class*="space-y-8"] > :not([hidden]) ~ :not([hidden]),
        .note-content [class*="space-y-12"] > :not([hidden]) ~ :not([hidden]),
        .note-content [class*="space-y-6"] > :not([hidden]) ~ :not([hidden]) {
          margin-top: 8px !important;
        }

        ${customContentStyles}
      </style>
    `;

    const marginMm = pdfMargin * 25.4;
    const opt = {
      margin: [marginMm, marginMm, marginMm, marginMm] as [
        number,
        number,
        number,
        number,
      ],
      filename: `${activeTopic.title || "Notes"}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1200,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: bgColor,
      },
      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "landscape" as const,
      },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    // Show full-screen loading spinner/overlay to hide the print generation process
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(15, 23, 42, 0.95)";
    overlay.style.color = "#ffffff";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999999";
    overlay.style.fontFamily = "'Inter', sans-serif";
    overlay.innerHTML = `
      <div style="text-align: center;">
        <div style="margin-bottom: 20px; font-size: 20px; font-weight: 900; tracking: tight;">GENERATING DOCUMENT PDF...</div>
        <div style="font-size: 13px; color: #94a3b8; font-weight: bold; margin-bottom: 20px;">Applying your selected theme styling: "${styleToUse.toUpperCase()}"</div>
        <div style="display: inline-block; width: 32px; height: 32px; border: 4px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(overlay);

    const originalScrollY = window.scrollY || window.pageYOffset || 0;
    const originalScrollX = window.scrollX || window.pageXOffset || 0;
    window.scrollTo(0, 0);

    // Disable dark mode temporarily so elements are laid out in pristine light mode forms
    const isDarkActive = document.documentElement.classList.contains("dark");
    if (isDarkActive && styleToUse !== "retro") {
      document.documentElement.classList.remove("dark");
    }

    document.body.appendChild(exportContainer);

    // Give browser brief window to layout and paint the added container
    await new Promise((resolve) => setTimeout(resolve, 150));

    // To prevent html2canvas from crash-looping or hanging on modern CSS stylesheet rules (e.g. Tailwind v4 variables, container queries),
    // we temporarily disable all external stylesheets during PDF rendering. High-z-index dark overlay hides any content flicker.
    const disabledSheets: (HTMLStyleElement | HTMLLinkElement)[] = [];
    try {
      Array.from(
        document.querySelectorAll('style, link[rel="stylesheet"]'),
      ).forEach((sheet) => {
        if (
          sheet instanceof HTMLStyleElement ||
          sheet instanceof HTMLLinkElement
        ) {
          if (
            !exportContainer.contains(sheet) &&
            !overlay.contains(sheet) &&
            (sheet as any).disabled !== true
          ) {
            (sheet as any).disabled = true;
            disabledSheets.push(sheet);
          }
        }
      });
    } catch (err) {
      console.warn("Could not disable style sheets during PDF render:", err);
    }

    try {
      const pdfWorker = html2pdf().set(opt).from(exportContainer).toPdf();

      await pdfWorker
        .get("pdf")
        .then((pdf) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);

            pdf.setFontSize(8.5);
            pdf.setTextColor(115, 115, 115); // Neutral medium gray

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            if (pdfCustomHeader && pdfCustomHeader.trim() !== "") {
              pdf.text(pdfCustomHeader.trim(), 8, 6);
            }

            if (pdfCustomFooter && pdfCustomFooter.trim() !== "") {
              pdf.text(pdfCustomFooter.trim(), 8, pageHeight - 4);
            }

            const pageText = `Page ${i} of ${totalPages}`;
            const pageTextWidth = pdf.getTextWidth(pageText);
            pdf.text(pageText, pageWidth - 8 - pageTextWidth, pageHeight - 4);
          }
        })
        .save();
    } catch (e) {
      console.error(e);
      alert("Export failed.");
    } finally {
      // Re-enable dark mode if it was temporarily disabled
      if (isDarkActive && styleToUse !== "retro") {
        document.documentElement.classList.add("dark");
      }
      // Restore all disabled sheets
      disabledSheets.forEach((sheet) => {
        try {
          (sheet as any).disabled = false;
        } catch (err) {
          console.error("Error restoring stylesheet:", err);
        }
      });
      document.body.removeChild(exportContainer);
      document.body.removeChild(overlay);
      window.scrollTo(originalScrollX, originalScrollY);
    }
  };

  const exportWord = () => {
    try {
      if (!editorRef.current) return;
      const findTopicLocal = (
        items: DPSSTopic[],
        id: string,
      ): DPSSTopic | null => {
        for (const item of items) {
          if (item.id === id) return item;
          if (item.children && item.children.length > 0) {
            const found = findTopicLocal(item.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const activeTopic = (selectedTopicId
        ? findTopicLocal(data?.dpssTopics || [], selectedTopicId)
        : null) || { title: "Notes" };

      const settings = data.settings || {
        fontSize: 12,
        fontFamily: "'Inter', sans-serif",
      };
      const paperStyle =
        (activeTopic as any).paperStyle || settings.paperStyle || "none";
      const selectedPaper =
        PAPER_STYLES.find((s) => s.id === paperStyle) || PAPER_STYLES[0];

      const isDark =
        selectedPaper.id === "stars" ||
        selectedPaper.id === "none-dark" ||
        selectedPaper.id === "none";
      const bgColor = isDark ? "#0f172a" : "#ffffff";
      const textColor = isDark ? "#f8fafc" : "#334155";

      const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: A4;
            margin: 1in;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: ${textColor};
            background-color: ${bgColor};
            margin: 0;
            padding: 0;
          }
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            break-after: avoid;
            color: ${isDark ? "#38bdf8" : "#0f172a"};
          }
          p, li {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr, table, .synthesis-card-wrapper, .qa-board-wrapper {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          h1 { color: ${isDark ? "#38bdf8" : "#0f172a"}; font-size: 26pt; font-weight: bold; border-bottom: 2pt solid #0369a1; padding-bottom: 10pt; margin-bottom: 20pt; }
          h2 { color: #0369a1; font-size: 18pt; margin-top: 25pt; border-left: 4pt solid #0369a1; padding-left: 10pt; }
          h3 { color: ${isDark ? "#e2e8f0" : "#1e293b"}; font-size: 14pt; margin-top: 15pt; font-weight: bold; }
          p { margin-bottom: 10pt; line-height: 1.5; }
          .synthesis-card-wrapper, .qa-board-wrapper { 
            border: 1pt solid ${isDark ? "#334155" : "#cbd5e1"}; 
            padding: 15pt; 
            margin: 15pt 0; 
            background-color: ${isDark ? "#1e293b" : "#f8fafc"};
            border-radius: 10pt;
            color: ${textColor};
          }
          table { width: 100% !important; border-collapse: collapse; margin: 15pt 0; }
          th, td { border: 1pt solid ${isDark ? "#334155" : "#e2e8f0"}; padding: 8pt; text-align: left; }
          th { background-color: ${isDark ? "#1e293b" : "#f1f5f9"}; font-weight: bold; color: ${isDark ? "#ffffff" : "#000000"}; }
          .paper-dots, .paper-grid, .paper-ruled, .paper-engineering {
            background-color: ${isDark ? "#1e293b" : "#f8fafc"} !important;
            border: 1px solid ${isDark ? "#334155" : "#e2e8f0"} !important;
            padding: 15px !important;
          }
        </style>
      </head>
      <body style="background-color: ${bgColor}; color: ${textColor}; margin: 0; padding: 0;">
        <h1>${activeTopic.title}</h1>
        ${editorRef.current.innerHTML}
      </body>
      </html>
    `;

      const blob = new Blob(["\ufeff", header], {
        type: "application/vnd.ms-word;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("target", "_blank");
      link.download = `${activeTopic.title || "Notes"}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("MS Word Export failed:", e);
      alert("Note export to MS Word failed. Please try again.");
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(160, Math.min(e.clientX - 10, 600));
      setSidebarWidth(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing.current) return;
      if (e.touches && e.touches.length > 0) {
        const clientX = e.touches[0].clientX;
        const maxMobileWidth = Math.min(600, window.innerWidth - 45);
        const newWidth = Math.max(160, Math.min(clientX - 10, maxMobileWidth));
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "default";
    };

    const handleTouchEnd = () => {
      isResizing.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const colors = [
    { name: "Yellow", value: "#fef3c7" },
    { name: "Green", value: "#dcfce7" },
    { name: "Blue", value: "#dbeafe" },
    { name: "Pink", value: "#fce7f3" },
    { name: "Orange", value: "#ffedd5" },
    { name: "Red", value: "#fee2e2" },
    { name: "Purple", value: "#f3e8ff" },
    { name: "Teal", value: "#ccfbf1" },
    { name: "Cyan", value: "#cffafe" },
    { name: "Lime", value: "#ecfccb" },
    { name: "Amber", value: "#fef3c7" },
    { name: "Rose", value: "#ffe4e6" },
    { name: "Black", value: "#000000" },
    { name: "White", value: "#ffffff" },
    { name: "Clear", value: "transparent" },
  ];

  const textColors = [
    { name: "Slate", value: "#334155" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Green", value: "#22c55e" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Purple", value: "#a855f7" },
    { name: "Fuchsia", value: "#d946ef" },
    { name: "Pink", value: "#ec4899" },
    { name: "Rose", value: "#f43f5e" },
    { name: "Clear", value: "transparent" },
  ];

  const fontFamilies = [
    { name: "Modern", value: "Inter" },
    { name: "Display (Growth)", value: "Space Grotesk" },
    { name: "Elegant", value: "Playfair Display" },
    { name: "Technical", value: "JetBrains Mono" },
    { name: "Handwritten", value: "cursive" },
  ];

  const dpssSettings = data.settings || {
    fontSize: 12,
    fontFamily: "'Inter', sans-serif",
  };
  const textFontFamily = dpssSettings.textFontFamily || dpssSettings.fontFamily;
  const textFontSize = Math.max(
    16,
    dpssSettings.textFontSize || dpssSettings.fontSize || 16,
  );
  const tableBorderThickness =
    dpssSettings.tableBorderThickness !== undefined
      ? dpssSettings.tableBorderThickness
      : 2;
  const tableBorderColor = dpssSettings.tableBorderColor || "#334155";
  const findTopicLocally = (
    items: DPSSTopic[],
    id: string,
  ): DPSSTopic | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findTopicLocally(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  const activeTopic = selectedTopicId
    ? findTopicLocally(data?.dpssTopics || [], selectedTopicId)
    : null;
  const paperStyle =
    (activeTopic as any)?.paperStyle || dpssSettings.paperStyle || "none";
  const selectedPaper =
    PAPER_STYLES.find((s) => s.id === paperStyle) || PAPER_STYLES[0];

  const filterTopics = (items: DPSSTopic[]): DPSSTopic[] => {
    if (!Array.isArray(items)) return [];
    return items
      .filter((t) => t && !t.deletedAt)
      .map((t) => ({
        ...t,
        title: typeof t.title === "string" ? t.title : "New Topic",
        content: typeof t.content === "string" ? t.content : "",
        alignment: t.alignment || "left",
        children: t.children ? filterTopics(t.children) : [],
      }));
  };

  const filterActiveTopics = (items: DPSSTopic[]): DPSSTopic[] => {
    if (!Array.isArray(items)) return [];
    return items
      .filter((t) => t && !t.deletedAt && !t.isArchived)
      .map((t) => ({
        ...t,
        title: typeof t.title === "string" ? t.title : "New Topic",
        content: typeof t.content === "string" ? t.content : "",
        alignment: t.alignment || "left",
        children: t.children ? filterActiveTopics(t.children) : [],
      }));
  };

  const getArchivedRootTopics = (items: DPSSTopic[]): DPSSTopic[] => {
    if (!Array.isArray(items)) return [];
    const archived: DPSSTopic[] = [];
    const traverse = (list: DPSSTopic[]) => {
      list.forEach((t) => {
        if (t && !t.deletedAt && t.isArchived) {
          archived.push({
            ...t,
            children: t.children ? filterActiveTopics(t.children) : [],
          });
        } else if (t && t.children) {
          traverse(t.children);
        }
      });
    };
    traverse(items);
    return archived;
  };

  const topics = React.useMemo(() => {
    return filterTopics(data.dpssTopics || []);
  }, [data.dpssTopics]);

  const activeTopics = React.useMemo(() => {
    return filterActiveTopics(data.dpssTopics || []);
  }, [data.dpssTopics]);

  const archivedTopics = React.useMemo(() => {
    return getArchivedRootTopics(data.dpssTopics || []);
  }, [data.dpssTopics]);

  const filterTopicsBySearch = (
    items: DPSSTopic[],
    searchStr: string,
  ): DPSSTopic[] => {
    if (!searchStr) return items;
    const cleanSearch = searchStr.toLowerCase().trim();

    return items
      .map((item) => {
        const isMatched = item.title.toLowerCase().includes(cleanSearch);
        const filteredChildren = item.children
          ? filterTopicsBySearch(item.children, searchStr)
          : [];

        if (isMatched || filteredChildren.length > 0) {
          return {
            ...item,
            children: filteredChildren,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  };

  const filteredTopics = React.useMemo(() => {
    return filterTopicsBySearch(activeTopics, searchTerm);
  }, [activeTopics, searchTerm]);

  // Scoring and sorting logic for the Smart Show feature
  const smartSortedTopics = React.useMemo(() => {
    const getTopicScore = (t: DPSSTopic): number => {
      const content = t.content || "";
      // Weigh pending checkboxes highly (completed or default unchecked)
      const incompleteCount = (content.match(/⬜|\[\s*\]/g) || []).length;
      const totalChecklists = (content.match(/⬜|✅|\[\s*\]|\[x\]/gi) || [])
        .length;
      const contentLen = content.length;
      const attachmentsCount = (t.attachments || []).length;

      return (
        incompleteCount * 30 +
        totalChecklists * 5 +
        contentLen * 0.02 +
        attachmentsCount * 15
      );
    };

    const sortRecursively = (items: DPSSTopic[]): DPSSTopic[] => {
      return [...items]
        .map((t) => ({
          ...t,
          children: t.children ? sortRecursively(t.children) : [],
        }))
        .sort((a, b) => getTopicScore(b) - getTopicScore(a));
    };

    return sortRecursively(activeTopics);
  }, [activeTopics]);

  const filteredSmartTopics = React.useMemo(() => {
    return filterTopicsBySearch(smartSortedTopics, searchTerm);
  }, [smartSortedTopics, searchTerm]);

  const filteredArchivedTopics = React.useMemo(() => {
    return filterTopicsBySearch(archivedTopics, searchTerm);
  }, [archivedTopics, searchTerm]);

  // Auto-expand matched topics when searching
  useEffect(() => {
    if (searchTerm) {
      const autoExpand = (items: DPSSTopic[]) => {
        const expanded: Record<string, boolean> = {};
        const traverse = (itemList: DPSSTopic[]) => {
          itemList.forEach((item) => {
            if (item.children && item.children.length > 0) {
              const matchInDescendants = (i: DPSSTopic): boolean => {
                if (i.title.toLowerCase().includes(searchTerm.toLowerCase()))
                  return true;
                return i.children ? i.children.some(matchInDescendants) : false;
              };
              if (item.children.some(matchInDescendants)) {
                expanded[item.id] = true;
              }
            }
            if (item.children) traverse(item.children);
          });
        };
        traverse(activeTopics);
        setExpandedTopics((prev) => ({ ...prev, ...expanded }));
      };
      autoExpand(activeTopics);
    }
  }, [searchTerm, activeTopics]);

  const handleSelection = () => {
    const selection = window.getSelection();
    // Check if selecting inside a table cell
    setTimeout(checkActiveTableCell, 10);

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // Ensure the selection is within our editor
      if (
        editorRef.current &&
        editorRef.current.contains(range.commonAncestorContainer)
      ) {
        savedRange.current = range.cloneRange();

        const container = range.commonAncestorContainer;
        const cardElement =
          container.nodeType === Node.TEXT_NODE
            ? container.parentElement?.closest(
                ".synthesis-card-wrapper, .qa-board-wrapper",
              )
            : (container as HTMLElement).closest?.(
                ".synthesis-card-wrapper, .qa-board-wrapper",
              );

        if (
          selection &&
          !selection.isCollapsed &&
          selection.toString().trim().length > 0
        ) {
          const rect = range.getBoundingClientRect();
          let x = rect.left + rect.width / 2;
          let y = rect.top - 50;
          if ((rect.width === 0 || rect.height === 0) && cardElement) {
            const cardRect = (
              cardElement as HTMLElement
            ).getBoundingClientRect();
            x = cardRect.left + cardRect.width / 2;
            y = cardRect.top - 40;
          }
          setPickerPos({ x, y });
        } else {
          setPickerPos(null);
        }
      }
    } else {
      // Don't clear immediately if we're clicking the picker
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          setPickerPos(null);
        }
      }, 100);
    }
  };

  const getCellResizeTarget = (
    clientX: number,
    cell: HTMLTableCellElement,
    threshold: number = 8,
  ) => {
    if (isTableResizeLocked) return null;
    const rect = cell.getBoundingClientRect();
    if (Math.abs(clientX - rect.right) <= threshold) {
      return cell;
    }
    if (Math.abs(clientX - rect.left) <= threshold) {
      return cell.previousElementSibling as HTMLTableCellElement | null;
    }
    return null;
  };

  const hexToRgba = (hex: string, opacity: number) => {
    let c = hex.replace("#", "");
    if (c.length === 3) {
      c = c
        .split("")
        .map((x) => x + x)
        .join("");
    }
    if (c.length === 6) {
      const r = parseInt(c.substring(0, 2), 16);
      const g = parseInt(c.substring(2, 4), 16);
      const b = parseInt(c.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
    }
    return hex;
  };

  const checkActiveTableCell = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const parentEl =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : (container as HTMLElement);
      const cell = parentEl?.closest("td, th") as HTMLTableCellElement | null;
      if (cell && editorRef.current?.contains(cell)) {
        setActiveTableCell(cell);
        return;
      }
    }
    setActiveTableCell(null);
  };

  const addRow = (position: "above" | "below") => {
    if (!activeTableCell) return;
    const cell = activeTableCell;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row?.closest("table");
    if (!table) return;

    ensureTableColgroup(table);
    const colgroup = table.querySelector("colgroup");
    const colsCount = colgroup
      ? colgroup.querySelectorAll("col").length
      : row.cells.length;

    const rowIndex = Array.from(table.rows).indexOf(row);
    const targetIdx = position === "above" ? rowIndex : rowIndex + 1;
    const newRow = table.insertRow(targetIdx);

    for (let c = 0; c < colsCount; c++) {
      const newCell = newRow.insertCell(-1);
      const sourceCell =
        row.cells[c] || row.cells[row.cells.length - 1] || cell;
      newCell.style.cssText = sourceCell.style.cssText;
      (newCell as HTMLElement).style.width = ""; // Let colgroup handle width permanently

      if (c === 0 && position === "below") {
        const previousRowsCount = Array.from(table.rows).filter(
          (r) => !r.closest("thead"),
        ).length;
        newCell.innerHTML = previousRowsCount.toString();
        (newCell as HTMLElement).style.fontWeight = "800";
        (newCell as HTMLElement).style.textAlign = "center";
      } else {
        newCell.innerHTML = "&nbsp;";
      }
    }

    if (editorRef.current && selectedTopic) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const addColumn = (position: "left" | "right") => {
    if (!activeTableCell) return;
    const cell = activeTableCell;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row?.closest("table");
    if (!table) return;

    ensureTableColgroup(table);
    const colgroup = table.querySelector("colgroup");
    if (!colgroup) return;

    const cellsInRow = Array.from(row.cells);
    const clickedCellIdx = cellsInRow.indexOf(cell);
    let colIdx = 0;
    for (let i = 0; i < clickedCellIdx; i++) {
      colIdx += parseInt(cellsInRow[i].getAttribute("colspan") || "1", 10);
    }
    colIdx += parseInt(cell.getAttribute("colspan") || "1", 10) - 1;

    // Add col in colgroup
    const colToInsertBefore =
      colgroup.children[position === "left" ? colIdx : colIdx + 1];
    const newCol = document.createElement("col");
    newCol.style.width = "100px";
    if (colToInsertBefore) {
      colgroup.insertBefore(newCol, colToInsertBefore);
    } else {
      colgroup.appendChild(newCol);
    }

    // Add cell in every row inside this table
    Array.from(table.rows).forEach((r) => {
      // If it's the <thead> header row spanning all cols, adjust colspan
      const headerCell = r.querySelector("th[colspan]");
      if (headerCell) {
        const currentColspan = parseInt(
          headerCell.getAttribute("colspan") || "1",
          10,
        );
        headerCell.setAttribute("colspan", (currentColspan + 1).toString());
        return;
      }

      // Find the cell index corresponding to colIdx
      let cellIndexToInsert = 0;
      let accumulatedCols = 0;
      const rowCells = Array.from(r.cells);
      for (let i = 0; i < rowCells.length; i++) {
        const span = parseInt(rowCells[i].getAttribute("colspan") || "1", 10);
        if (accumulatedCols + span > colIdx) {
          cellIndexToInsert = position === "left" ? i : i + 1;
          break;
        }
        accumulatedCols += span;
        cellIndexToInsert = i + 1;
      }

      const newCell = r.insertCell(cellIndexToInsert);
      const sourceCell = rowCells[0] || cell;
      newCell.style.cssText = sourceCell.style.cssText;
      (newCell as HTMLElement).style.width = "";
      newCell.innerHTML = "&nbsp;";
    });

    if (editorRef.current && selectedTopic) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const deleteTableElement = (type: "row" | "col") => {
    if (!activeTableCell) return;
    const cell = activeTableCell;
    const row = cell.parentElement as HTMLTableRowElement;
    const table = row?.closest("table");
    if (!table) return;

    if (type === "row") {
      const rowIndex = Array.from(table.rows).indexOf(row);
      // Don't delete header row
      if (row.closest("thead")) return;
      table.deleteRow(rowIndex);
      setActiveTableCell(null);
    } else {
      ensureTableColgroup(table);
      const colgroup = table.querySelector("colgroup");
      if (!colgroup) return;

      const cellsInRow = Array.from(row.cells);
      const clickedCellIdx = cellsInRow.indexOf(cell);
      let colIdx = 0;
      for (let i = 0; i < clickedCellIdx; i++) {
        colIdx += parseInt(cellsInRow[i].getAttribute("colspan") || "1", 10);
      }
      colIdx += parseInt(cell.getAttribute("colspan") || "1", 10) - 1;

      // Delete <col> in colgroup
      if (colgroup.children[colIdx]) {
        colgroup.removeChild(colgroup.children[colIdx]);
      }

      // Delete cell from every row
      Array.from(table.rows).forEach((r) => {
        const headerCell = r.querySelector("th[colspan]");
        if (headerCell) {
          const currentColspan = Math.max(
            1,
            parseInt(headerCell.getAttribute("colspan") || "1", 10) - 1,
          );
          headerCell.setAttribute("colspan", currentColspan.toString());
          return;
        }

        let cellIndexToDelete = -1;
        let accumulatedCols = 0;
        const rowCells = Array.from(r.cells);
        for (let i = 0; i < rowCells.length; i++) {
          const span = parseInt(rowCells[i].getAttribute("colspan") || "1", 10);
          if (accumulatedCols <= colIdx && colIdx < accumulatedCols + span) {
            cellIndexToDelete = i;
            break;
          }
          accumulatedCols += span;
        }

        if (cellIndexToDelete !== -1) {
          r.deleteCell(cellIndexToDelete);
        }
      });
      setActiveTableCell(null);
    }

    if (editorRef.current && selectedTopic) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const applyTextColor = (
    color: string,
    selectionProvided: boolean = false,
  ) => {
    const selection = window.getSelection();
    if (!selection) return;

    if (!selectionProvided) {
      if (!savedRange.current) return;
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }

    if (color === "transparent") {
      document.execCommand("removeFormat", false, undefined);
    } else {
      document.execCommand("foreColor", false, color);
    }

    if (selectedTopic?.id && editorRef.current) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }

    // Cleanup
    selection.removeAllRanges();
    if (!selectionProvided) {
      savedRange.current = null;
      setPickerPos(null);
    }
  };

  const applyColor = (color: string, selectionProvided: boolean = false) => {
    const selection = window.getSelection();
    if (!selection) return;

    if (!selectionProvided) {
      if (!savedRange.current) return;
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }

    if (color === "transparent") {
      document.execCommand("removeFormat", false, undefined);
    } else {
      document.execCommand("backColor", false, color);
    }

    if (selectedTopic?.id && editorRef.current) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }

    // Cleanup
    selection.removeAllRanges();
    if (!selectionProvided) {
      savedRange.current = null;
      setPickerPos(null);
    }
  };

  const updateGlobalSettings = (updates: any) => {
    onUpdate({
      ...data,
      settings: { ...dpssSettings, ...updates },
    });
  };

  const findTopic = (items: DPSSTopic[], id: string): DPSSTopic | null => {
    if (!Array.isArray(items)) return null;
    for (const item of items) {
      if (!item) continue;
      if (String(item.id) === String(id)) return item;
      if (item.children) {
        const found = findTopic(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findRootTopic = (
    items: DPSSTopic[],
    childId: string,
  ): DPSSTopic | null => {
    if (!Array.isArray(items)) return null;
    for (const item of items) {
      if (!item) continue;
      if (String(item.id) === String(childId)) return item;
      const found = findTopic(item.children || [], childId);
      if (found) return item;
    }
    return null;
  };

  const addTopic = (parentId?: string) => {
    const newTopic: DPSSTopic = {
      id: uuidv4(),
      title: "New Topic",
      content: "",
      alignment: "left",
    };
    const updateTopics = (items: DPSSTopic[]): DPSSTopic[] => {
      if (!parentId) return [...items, newTopic];
      return items.map((item) => {
        if (item.id === parentId)
          return { ...item, children: [...(item.children || []), newTopic] };
        if (item.children)
          return { ...item, children: updateTopics(item.children) };
        return item;
      });
    };
    const updated = updateTopics(data.dpssTopics || []);
    if (onUpdateTopic) {
      if (!parentId) {
        onUpdateTopic(updated, newTopic);
      } else {
        const root = findRootTopic(updated, parentId);
        onUpdateTopic(updated, root || undefined);
      }
    } else {
      onUpdate({ ...data, dpssTopics: updated });
    }
    setSelectedTopicId(newTopic.id);
    if (parentId) {
      setExpandedTopics((prev) => ({ ...prev, [parentId]: true }));
    }
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const getParentId = (
    items: DPSSTopic[],
    childId: string,
    parentId: string | null = null,
  ): string | null => {
    for (const item of items) {
      if (item.id === childId) return parentId;
      if (item.children) {
        const found = getParentId(item.children, childId, item.id);
        if (found) return found;
      }
    }
    return null;
  };

  const duplicateTopic = (id: string) => {
    const cloneNode = (node: DPSSTopic): DPSSTopic => {
      return {
        ...node,
        id: uuidv4(),
        children: node.children ? node.children.map(cloneNode) : undefined,
      };
    };

    const targetTopic = findTopic(data.dpssTopics || [], id);
    if (!targetTopic) return;

    const cloned = cloneNode(targetTopic);
    cloned.title = `${cloned.title} - Copy`;

    const updateTopics = (items: DPSSTopic[]): DPSSTopic[] => {
      const index = items.findIndex((item) => item.id === id);
      if (index !== -1) {
        const newItems = [...items];
        newItems.splice(index + 1, 0, cloned);
        return newItems;
      }
      return items.map((item) => {
        if (item.children)
          return { ...item, children: updateTopics(item.children) };
        return item;
      });
    };

    const parentId = getParentId(data.dpssTopics || [], id);
    const updated = updateTopics(data.dpssTopics || []);

    if (onUpdateTopic) {
      if (!parentId) {
        onUpdateTopic(updated, cloned);
      } else {
        const root = findRootTopic(updated, parentId);
        onUpdateTopic(updated, root || undefined);
      }
    } else {
      onUpdate({ ...data, dpssTopics: updated });
    }
  };

  const deleteTopic = (id: string) => {
    const checkLockStatus = (
      items: DPSSTopic[],
      targetId: string,
      parentLocked = false,
    ): { found: boolean; isLocked: boolean } => {
      if (!Array.isArray(items)) return { found: false, isLocked: false };
      for (const item of items) {
        if (!item) continue;
        const currentLocked = parentLocked || item.isLocked || false;
        if (String(item.id) === String(targetId)) {
          return { found: true, isLocked: currentLocked };
        }
        if (item.children) {
          const res = checkLockStatus(item.children, targetId, currentLocked);
          if (res.found) return res;
        }
      }
      return { found: false, isLocked: false };
    };

    const findTopicById = (
      items: DPSSTopic[],
      targetId: string,
    ): DPSSTopic | null => {
      for (const item of items) {
        if (String(item.id) === String(targetId)) return item;
        if (item.children) {
          const found = findTopicById(item.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const status = checkLockStatus(data.dpssTopics || [], id);
    const targetTopic = findTopicById(data.dpssTopics || [], id);

    // Auto-skip confirmation for newly created empty topics
    const isEmptyNewTopic =
      targetTopic &&
      (targetTopic.title.trim() === "" ||
        targetTopic.title.toLowerCase() === "new topic") &&
      (!targetTopic.content ||
        targetTopic.content.trim() === "" ||
        targetTopic.content === "<p><br></p>") &&
      (!targetTopic.children || targetTopic.children.length === 0);

    if (status.isLocked) {
      const userInput = prompt(
        `This folder/document is LOCKED.\nTo delete it, you must type the word "Delete" exactly:`,
      );
      if (userInput !== "Delete") {
        if (userInput !== null)
          alert("Incorrect verification word. Deletion cancelled.");
        return;
      }
    } else if (!isEmptyNewTopic) {
      if (
        !confirm(
          "Move this topic to the Recycle Bin? (You can restore it later from the Recycle Bin)",
        )
      ) {
        return;
      }
    }

    const markDeleted = (items: DPSSTopic[]): DPSSTopic[] => {
      if (!Array.isArray(items)) return items;
      return items.map((item) => {
        if (!item) return item;
        if (String(item.id) === String(id))
          return {
            ...item,
            deleted: true,
            deletedAt: new Date().toISOString(),
          } as any;
        if (item.children)
          return { ...item, children: markDeleted(item.children as any[]) };
        return item;
      });
    };
    const updatedData = markDeleted(data.dpssTopics || []);
    const root = findRootTopic(data.dpssTopics || [], id); // Find root in old data to know which doc to update

    const updatedRoot = root ? findRootTopic(updatedData, root.id) : null;

    if (onUpdateTopic) {
      onUpdateTopic(updatedData, updatedRoot || undefined);
    } else {
      onUpdate({ ...data, dpssTopics: updatedData });
    }
    if (selectedTopicId === id) {
      setSelectedTopicId(null);
    }
  };

  const updateTopic = (id: string, updates: Partial<DPSSTopic>) => {
    const updateItems = (items: DPSSTopic[]): DPSSTopic[] => {
      if (!Array.isArray(items)) return items;
      return items.map((item) => {
        if (!item) return item;
        if (item.id === id) return { ...item, ...updates };
        if (item.children)
          return { ...item, children: updateItems(item.children as any[]) };
        return item;
      });
    };
    const updated = updateItems(data.dpssTopics || []);
    const root = findRootTopic(updated, id);
    if (onUpdateTopic) {
      onUpdateTopic(updated, root || undefined);
    } else {
      onUpdate({ ...data, dpssTopics: updated });
    }
  };

  const handleMoveTopicUpDown = (id: string, direction: "up" | "down") => {
    const parentId = getParentId(data.dpssTopics || [], id);
    const siblings = parentId
      ? findRootTopic(data.dpssTopics || [], parentId)?.children || []
      : data.dpssTopics || [];

    if (siblings.length <= 1) return;

    const index = siblings.findIndex((s) => s.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === siblings.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newSiblings = [...siblings];
    const [moved] = newSiblings.splice(index, 1);
    newSiblings.splice(targetIndex, 0, moved);

    const updateSiblings = (items: DPSSTopic[]): DPSSTopic[] => {
      if (!Array.isArray(items)) return items;
      if (!parentId) return newSiblings;
      return items.map((item) => {
        if (!item) return item;
        if (item.id === parentId) return { ...item, children: newSiblings };
        if (item.children)
          return { ...item, children: updateSiblings(item.children as any[]) };
        return item;
      });
    };

    const updated = updateSiblings(data.dpssTopics || []);
    onUpdate({ ...data, dpssTopics: updated });
  };

  const [draggedTopicId, setDraggedTopicId] = useState<string | null>(null);
  const [dragOverTopicId, setDragOverTopicId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    setDraggedTopicId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedTopicId === targetId) return;

    let position = "inside";
    if (targetId) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y < rect.height * 0.25) {
        position = "before";
      } else if (y > rect.height * 0.75) {
        position = "after";
      }
    }

    const newTarget = targetId ? `${targetId}-${position}` : "null-inside";
    if (dragOverTopicId !== newTarget) {
      setDragOverTopicId(newTarget);
    }
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetId === null) {
      setDragOverTopicId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    const dropState = dragOverTopicId || "";
    setDragOverTopicId(null);

    const sourceId = e.dataTransfer.getData("text/plain") || draggedTopicId;
    if (!sourceId || sourceId === targetId) {
      setDraggedTopicId(null);
      return;
    }

    let position = "inside";
    if (dropState.endsWith("-before")) position = "before";
    else if (dropState.endsWith("-after")) position = "after";

    const findSpecificTopic = (
      items: DPSSTopic[],
      searchId: string,
    ): DPSSTopic | null => {
      if (!Array.isArray(items)) return null;
      for (const item of items) {
        if (!item) continue;
        if (String(item.id) === String(searchId)) return item;
        if (item.children) {
          const found = findSpecificTopic(item.children, searchId);
          if (found) return found;
        }
      }
      return null;
    };

    // Recursive search to ensure we're not dropping a parent into its own child
    const isChildOf = (parentId: string, tId: string): boolean => {
      const topic = findSpecificTopic(data.dpssTopics || [], parentId);
      if (!topic || !topic.children) return false;
      return topic.children.some(
        (c) => String(c.id) === String(tId) || isChildOf(String(c.id), tId),
      );
    };

    if (targetId && isChildOf(sourceId, targetId)) {
      alert("Cannot move a folder into its own sub-folder!");
      setDraggedTopicId(null);
      return;
    }

    const topicToMove = findSpecificTopic(data.dpssTopics || [], sourceId);
    if (!topicToMove) {
      setDraggedTopicId(null);
      return;
    }

    // 1. Remove from old position
    const removeTopic = (items: DPSSTopic[]): DPSSTopic[] => {
      return items
        .filter((item) => String(item.id) !== String(sourceId))
        .map((item) => ({
          ...item,
          children: item.children ? removeTopic(item.children) : undefined,
        }));
    };

    let updated = removeTopic(data.dpssTopics || []);

    // 2. Add to new position
    const addTopicToTarget = (items: DPSSTopic[]): DPSSTopic[] => {
      if (targetId === null) {
        return [...items, topicToMove];
      }

      const newItems: DPSSTopic[] = [];
      for (const item of items) {
        if (String(item.id) === String(targetId)) {
          if (position === "before") {
            newItems.push(topicToMove);
            newItems.push({
              ...item,
              children: item.children
                ? addTopicToTarget(item.children)
                : undefined,
            });
          } else if (position === "after") {
            newItems.push({
              ...item,
              children: item.children
                ? addTopicToTarget(item.children)
                : undefined,
            });
            newItems.push(topicToMove);
          } else {
            newItems.push({
              ...item,
              children: [...(item.children || []), topicToMove],
            });
          }
        } else {
          newItems.push({
            ...item,
            children: item.children
              ? addTopicToTarget(item.children)
              : undefined,
          });
        }
      }
      return newItems;
    };

    updated = addTopicToTarget(updated);
    onUpdate({ ...data, dpssTopics: updated });
    setDraggedTopicId(null);
  };

  const handleShareTopic = (topic: any) => {
    if (
      editorRef.current &&
      selectedTopic &&
      String(selectedTopic.id) === String(topic.id)
    ) {
      // Save current screen text immediately into state BEFORE opening slide / share menu
      const updatedTopic = { ...topic, content: editorRef.current.innerHTML };
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
      setSharingTopic(updatedTopic);
    } else {
      setSharingTopic(topic);
    }
    setGeneratedShareLink(null);
    setCloudShareError(null);
    setIsCloudShareLoading(false);
  };

  const handleGenerateUniversalLink = () => {
    if (!sharingTopic) return;
    try {
      const payload = {
        ownerName: "Chanthy",
        type: "note-taking",
        title: sharingTopic.title,
        payload: sharingTopic,
      };

      const storedUser = localStorage.getItem("dps_user");
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          payload.ownerName = u.name || "Chanthy";
        } catch (e) {}
      }

      const encoded = encodeToURLSafeBase64(payload);
      const link =
        window.location.origin +
        window.location.pathname +
        "?sharedData=" +
        encoded;
      setGeneratedShareLink(link);
      setCloudShareError(null);
    } catch (err) {
      setCloudShareError("Failed to generate Universal Link.");
    }
  };

  const handleGenerateCloudLink = async () => {
    if (!sharingTopic) return;
    setIsCloudShareLoading(true);
    setCloudShareError(null);
    setGeneratedShareLink(null);

    const storedUser = localStorage.getItem("dps_user");
    let userName = "Chanthy";
    let userId = "unknown";
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        userName = u.name || "Chanthy";
        userId = u.uid || "unknown";
      } catch (e) {}
    }

    try {
      const { createSharedNote } = await import("../services/supabase");
      const shareId = await createSharedNote(
        userId,
        userName,
        "note-taking",
        sharingTopic.title,
        sharingTopic,
      );
      const link =
        window.location.origin + window.location.pathname + "?share=" + shareId;
      setGeneratedShareLink(link);
    } catch (error: any) {
      console.error("Supabase sharing failed:", error);
      setCloudShareError(
        `Failed to create cloud link. Error: ${error.message || String(error)}.`,
      );
    } finally {
      setIsCloudShareLoading(false);
    }
  };

  const moveTopicToSelfLearning = async (topicToMove: DPSSTopic) => {
    if (topicToMove.isLocked) {
      const userInput = prompt(
        `This folder/document is LOCKED.\nTo move it, you must type the word "Move" exactly:`,
      );
      if (userInput !== "Move") {
        if (userInput !== null)
          alert("Incorrect verification word. Move cancelled.");
        return;
      }
    } else {
      if (!confirm("Move this folder/document to Self-Learning? OK / Cancel")) {
        return;
      }
    }

    const markDeleted = (items: DPSSTopic[]): DPSSTopic[] => {
      if (!Array.isArray(items)) return items;
      return items.map((item) => {
        if (!item) return item;
        if (item.id === topicToMove.id)
          return {
            ...item,
            deleted: true,
            deletedAt: new Date().toISOString(),
          } as any;
        if (item.children)
          return { ...item, children: markDeleted(item.children as any[]) };
        return item;
      });
    };
    const updatedDpssTopics = markDeleted(data.dpssTopics || []);

    const cloneTopicWithNewIds = (topic: any): any => {
      const newId = uuidv4();
      return {
        ...topic,
        id: newId,
        children: topic.children
          ? topic.children.map(cloneTopicWithNewIds)
          : undefined,
      };
    };
    const clonedTopic = cloneTopicWithNewIds(topicToMove);

    const currentSLTopics = data.selfLearningTopics || [];
    const updatedSLTopics = [...currentSLTopics, clonedTopic];

    const root = findRootTopic(data.dpssTopics || [], topicToMove.id);
    const updatedRoot = root ? findRootTopic(updatedDpssTopics, root.id) : null;

    // Always use onUpdate to ensure both topic arrays are saved to state
    onUpdate({
      ...data,
      dpssTopics: updatedDpssTopics,
      selfLearningTopics: updatedSLTopics,
    });

    if (selectedTopicId === topicToMove.id) {
      setSelectedTopicId(null);
    }

    import("../services/supabase").then(({ saveTopic }) => {
      const storedUser = localStorage.getItem("dps_user");
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          if (u.uid) {
            saveTopic(u.uid, clonedTopic, "selfLearning");

            const root = findRootTopic(data.dpssTopics || [], topicToMove.id);
            if (root) {
              const updatedRoot = findRootTopic(updatedDpssTopics, root.id);
              if (updatedRoot) saveTopic(u.uid, updatedRoot, "dpss");
            }
          }
        } catch (e) {}
      }
    });
  };

  const selectedTopic = selectedTopicId
    ? findTopic(topics, selectedTopicId)
    : null;

  /* Re-implemented handleFileUpload */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedTopic) return;
    const file = files[0];

    setIsUploading(true);
    try {
      const { uploadFile } = await import("../services/supabase");
      const storedUser = localStorage.getItem("dps_user");
      let userId = "anon";
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          userId = u.uid || "anon";
        } catch (e) {}
      }

      const publicUrl = await uploadFile(userId, file);

      let html = "";
      if (!publicUrl) {
        // If Supabase upload fails (e.g. no bucket), fall back to Data URL with warning
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (
            file.size > 500 * 1024 &&
            !confirm(
              "This file is too large for local-only storage and will NOT sync across devices. Continue?",
            )
          ) {
            setIsUploading(false);
            return;
          }

          if (file.type.startsWith("image/")) {
            html = `<div style="margin: 15px 0; text-align: center;"><img src="${dataUrl}" alt="uploaded image" style="max-width: 100%; max-height: 400px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" /></div><p><br></p>`;
          } else if (file.type.startsWith("video/")) {
            html = `<div contenteditable="false" style="margin: 15px 0; text-align: center;"><video controls src="${dataUrl}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);"></video></div><p><br></p>`;
          } else if (file.type.startsWith("audio/")) {
            html = `<div contenteditable="false" style="margin: 15px 0; text-align: center; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 50px;"><audio controls src="${dataUrl}" style="width: 100%; outline: none;"></audio></div><p><br></p>`;
          } else {
            html = `<div contenteditable="false" style="margin: 15px 0; padding: 12px 16px; background: rgba(255, 237, 213, 0.8); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; display: inline-block;"><a href="${dataUrl}" download="${file.name}" target="_blank" rel="noopener noreferrer" style="color: #f97316; font-weight: bold; text-decoration: none;">📎 Open/Download: ${file.name}</a></div><p><br></p>`;
          }
          insertContent(html);
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      // Success cloud upload
      if (file.type.startsWith("image/")) {
        html = `<div style="margin: 15px 0; text-align: center;"><img src="${publicUrl}" alt="uploaded image" style="max-width: 100%; max-height: 400px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" /></div><p><br></p>`;
      } else if (file.type.startsWith("video/")) {
        html = `<div contenteditable="false" style="margin: 15px 0; text-align: center;"><video controls src="${publicUrl}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);"></video></div><p><br></p>`;
      } else if (file.type.startsWith("audio/")) {
        html = `<div contenteditable="false" style="margin: 15px 0; text-align: center; background: rgba(255,255,255,0.4); padding: 15px; border-radius: 50px;"><audio controls src="${publicUrl}" style="width: 100%; outline: none;"></audio></div><p><br></p>`;
      } else {
        html = `<div contenteditable="false" style="margin: 15px 0; padding: 12px 16px; background: rgba(255, 237, 213, 0.8); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; display: inline-block;"><a href="${publicUrl}" download="${file.name}" target="_blank" rel="noopener noreferrer" style="color: #f97316; font-weight: bold; text-decoration: none;">📎 Open/Download: ${file.name}</a></div><p><br></p>`;
      }
      insertContent(html);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Check your internet connection.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const insertContent = (html: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      }
      document.execCommand("insertHTML", false, html);
      if (selectedTopic) {
        updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
      }
    }
  };

  const insertDate = () => {
    if (!selectedTopic) return;
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const formattedDate = `<span style="color: #f59e0b; font-weight: 800; font-family: sans-serif; display: inline-block;">${dateStr}</span>`;

    let inserted = false;
    const sel = window.getSelection();
    if (editorRef.current && sel) {
      const activeRange =
        (sel.rangeCount > 0 ? sel.getRangeAt(0) : null) || savedRange.current;
      if (
        activeRange &&
        editorRef.current.contains(activeRange.commonAncestorContainer)
      ) {
        editorRef.current.focus();
        sel.removeAllRanges();
        sel.addRange(activeRange);
        activeRange.deleteContents();

        const el = document.createElement("span");
        el.innerHTML = formattedDate;

        const frag = document.createDocumentFragment();
        let node;
        let lastNode;
        while ((node = el.firstChild)) {
          lastNode = frag.appendChild(node);
        }
        activeRange.insertNode(frag);

        if (lastNode) {
          const newRange = activeRange.cloneRange();
          newRange.setStartAfter(lastNode);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          savedRange.current = newRange;
        }
        inserted = true;
      }
    }

    if (!inserted && editorRef.current) {
      const currentContent = editorRef.current.innerHTML || "";
      const spacing = currentContent.trim().length > 0 ? " &nbsp; " : "";
      const newContent = currentContent + spacing + formattedDate;
      editorRef.current.innerHTML = newContent;
      updateTopic(selectedTopic.id, { content: newContent });
    } else if (editorRef.current) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const insertSynthesisCard = (theme = "blue") => {
    if (!selectedTopic) return;
    const configs: Record<
      string,
      { border: string; bg: string; title: string; desc: string; inner: string }
    > = {
      blue: {
        border: "#bfdbfe",
        bg: "#f0f7ff",
        title: "#1d4ed8",
        desc: "#1e3a8a",
        inner: "#bfdbfe",
      },
      emerald: {
        border: "#bbf7d0",
        bg: "#f0fdf4",
        title: "#047857",
        desc: "#064e3b",
        inner: "#bbf7d0",
      },
      rose: {
        border: "#fecdd3",
        bg: "#fff1f2",
        title: "#be123c",
        desc: "#881337",
        inner: "#fecdd3",
      },
      gold: {
        border: "#fef08a",
        bg: "#fefce8",
        title: "#a16207",
        desc: "#713f12",
        inner: "#fef08a",
      },
      violet: {
        border: "#ddd6fe",
        bg: "#f5f3ff",
        title: "#6d28d9",
        desc: "#4c1d95",
        inner: "#ddd6fe",
      },
      orange: {
        border: "#fed7aa",
        bg: "#fff7ed",
        title: "#c2410c",
        desc: "#7c2d12",
        inner: "#fed7aa",
      },
      teal: {
        border: "#99f6e4",
        bg: "#f0fdfa",
        title: "#0f766e",
        desc: "#115e59",
        inner: "#99f6e4",
      },
      fuchsia: {
        border: "#f5d0fe",
        bg: "#fdf4ff",
        title: "#a21caf",
        desc: "#701a75",
        inner: "#f5d0fe",
      },
      sky: {
        border: "#bae6fd",
        bg: "#f0f9ff",
        title: "#0369a1",
        desc: "#0c4a6e",
        inner: "#bae6fd",
      },
      slate: {
        border: "#cbd5e1",
        bg: "#f8fafc",
        title: "#334155",
        desc: "#0f172a",
        inner: "#cbd5e1",
      },
    };
    const c = configs[theme] || configs.blue;

    const cardHtml = `
<div class="synthesis-card-wrapper" style="border: 1.5px solid ${c.border} !important; background-color: ${c.bg} !important; background: ${c.bg} !important; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.04); text-align: left;">
  <div style="font-weight: 955; color: ${c.title} !important; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    SYNTHESIS & ACTION PLAN
  </div>
  <div style="font-size: 12px; color: ${c.desc} !important; font-weight: 750; margin-bottom: 12px; line-height: 1.5;">
    Based on the 7-day audit, define one "Friction Rule" (e.g., "No gaming before 8 PM" or "Delete mobile apps on weekdays") to regain control over your attention.
  </div>
  <div style="background-color: #ffffff !important; background: #ffffff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 14px; min-height: 70px; color: #0f172a !important; font-size: 13px;" class="synthesis-box">
    &nbsp;
  </div>
</div>
<p><br></p>
`;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand("insertHTML", false, cardHtml);
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const insertQABoard = (theme = "slate") => {
    if (!selectedTopic) return;
    const configs: Record<
      string,
      { border: string; bg: string; title: string; desc: string; inner: string }
    > = {
      slate: {
        border: "#e2e8f0",
        bg: "#f8fafc",
        title: "#475569",
        desc: "#64748b",
        inner: "#cbd5e1",
      },
      emerald: {
        border: "#bbf7d0",
        bg: "#f0fdf4",
        title: "#047857",
        desc: "#059669",
        inner: "#86efac",
      },
      indigo: {
        border: "#c7d2fe",
        bg: "#f5f7ff",
        title: "#4338ca",
        desc: "#4f46e5",
        inner: "#a5b4fc",
      },
      amber: {
        border: "#fde68a",
        bg: "#fefce8",
        title: "#b45309",
        desc: "#d97706",
        inner: "#fcd34d",
      },
      purple: {
        border: "#e9d5ff",
        bg: "#faf5ff",
        title: "#7e22ce",
        desc: "#9333ea",
        inner: "#d8b4fe",
      },
      rose: {
        border: "#fecdd3",
        bg: "#fff1f2",
        title: "#be123c",
        desc: "#e11d48",
        inner: "#fda4af",
      },
      sky: {
        border: "#bae6fd",
        bg: "#f0f9ff",
        title: "#0369a1",
        desc: "#0284c7",
        inner: "#7dd3fc",
      },
      teal: {
        border: "#99f6e4",
        bg: "#f0fdfa",
        title: "#0f766e",
        desc: "#0d9488",
        inner: "#5eead4",
      },
      orange: {
        border: "#fed7aa",
        bg: "#fff7ed",
        title: "#c2410c",
        desc: "#ea580c",
        inner: "#fdba74",
      },
      cyan: {
        border: "#a5f3fc",
        bg: "#ecfeff",
        title: "#0e7490",
        desc: "#0891b2",
        inner: "#67e8f9",
      },
    };
    const c = configs[theme] || configs.slate;

    const qaHtml = `
<div class="qa-board-wrapper" style="border: 1.5px solid ${c.border} !important; background-color: ${c.bg} !important; background: ${c.bg} !important; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(148, 163, 184, 0.03); text-align: left;">
  <div style="font-weight: 955; color: ${c.title} !important; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    CRITICAL QUESTION & ANSWER BOARD
  </div>
  <div style="font-size: 11px; color: ${c.desc} !important; font-weight: 600; margin-bottom: 14px;">
    Use this modular layout to establish friction, debug your behaviors, and verify progression criteria.
  </div>
  <div style="display: grid; grid-template-columns: 1fr; gap: 14px;">
    <div style="background-color: #ffffff !important; background: #ffffff !important; border: 1px solid ${c.inner} !important; border-radius: 14px; padding: 14px;">
      <div style="font-weight: 800; color: #0f172a !important; font-size: 11px; margin-bottom: 6px; text-transform: uppercase;">Question or Core Prompt</div>
      <div style="font-size: 12px; color: #475569 !important; font-style: italic; margin-bottom: 10px; border-bottom: 1px dashed #e2e8f0 !important; padding-bottom: 6px;">
        Define your prompt here (e.g., "What was the single biggest trigger today?")
      </div>
      <div style="min-height: 40px; font-size: 13px; color: #0f172a !important;" class="qa-box">
        Write your response here...
      </div>
    </div>
  </div>
</div>
<p><br></p>
`;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand("insertHTML", false, qaHtml);
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const insertBrainstormCard = (theme = "violet") => {
    if (!selectedTopic) return;
    const configs: Record<
      string,
      { border: string; bg: string; title: string; desc: string; inner: string }
    > = {
      violet: {
        border: "#ddd6fe",
        bg: "#f5f3ff",
        title: "#6d28d9",
        desc: "#4c1d95",
        inner: "#ddd6fe",
      },
      emerald: {
        border: "#bbf7d0",
        bg: "#f0fdf4",
        title: "#047857",
        desc: "#064e3b",
        inner: "#bbf7d0",
      },
      rose: {
        border: "#fecdd3",
        bg: "#fff1f2",
        title: "#be123c",
        desc: "#881337",
        inner: "#fecdd3",
      },
      blue: {
        border: "#bfdbfe",
        bg: "#f0f7ff",
        title: "#1d4ed8",
        desc: "#1e3a8a",
        inner: "#bfdbfe",
      },
      gold: {
        border: "#fef08a",
        bg: "#fefce8",
        title: "#a16207",
        desc: "#713f12",
        inner: "#fef08a",
      },
      slate: {
        border: "#cbd5e1",
        bg: "#f8fafc",
        title: "#334155",
        desc: "#475569",
        inner: "#cbd5e1",
      },
      indigo: {
        border: "#c7d2fe",
        bg: "#eef2ff",
        title: "#4338ca",
        desc: "#312e81",
        inner: "#c7d2fe",
      },
      amber: {
        border: "#fde68a",
        bg: "#fffbeb",
        title: "#b45309",
        desc: "#78350f",
        inner: "#fde68a",
      },
      sky: {
        border: "#bae6fd",
        bg: "#f0f9ff",
        title: "#0369a1",
        desc: "#0c4a6e",
        inner: "#bae6fd",
      },
      teal: {
        border: "#99f6e4",
        bg: "#f0fdfa",
        title: "#0f766e",
        desc: "#115e59",
        inner: "#99f6e4",
      },
      fuchsia: {
        border: "#f5d0fe",
        bg: "#fdf4ff",
        title: "#a21caf",
        desc: "#701a75",
        inner: "#f5d0fe",
      },
      orange: {
        border: "#fed7aa",
        bg: "#fff7ed",
        title: "#c2410c",
        desc: "#7c2d12",
        inner: "#fed7aa",
      },
    };
    const c = configs[theme] || configs.violet;

    const brainstormHtml = `
<div class="brainstorm-card-wrapper" style="border: 1.5px solid ${c.border} !important; background-color: ${c.bg} !important; background: ${c.bg} !important; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(109, 40, 217, 0.04); text-align: left;">
  <div style="font-weight: 955; color: ${c.title} !important; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    💡 BRAINSTORM & INSIGHT MAP
  </div>
  <div style="font-size: 12px; color: ${c.desc} !important; font-weight: 700; margin-bottom: 12px; line-height: 1.5;">
    Map out your main ideas and key takeaways in a structured brainstorm grid below.
  </div>
  <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
    <div style="background-color: #ffffff !important; background: #ffffff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 50px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Core Concept / Anchor</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="brainstorm-box">Core study question/theme goes here...</div>
    </div>
    <div style="background-color: #ffffff !important; background: #ffffff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 50px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Key Insights / Solutions</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="brainstorm-box">Actions, triggers, or concepts to apply...</div>
    </div>
  </div>
</div>
<p><br></p>
`;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand("insertHTML", false, brainstormHtml);
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const insertThreeColumnGrid = (theme = "emerald") => {
    if (!selectedTopic) return;
    const configs: Record<
      string,
      { border: string; bg: string; title: string; desc: string; inner: string }
    > = {
      emerald: {
        border: "#bbf7d0",
        bg: "#f0fdf4",
        title: "#047857",
        desc: "#064e3b",
        inner: "#86efac",
      },
      rose: {
        border: "#fecdd3",
        bg: "#fff1f2",
        title: "#be123c",
        desc: "#881337",
        inner: "#fda4af",
      },
      blue: {
        border: "#bfdbfe",
        bg: "#f0f7ff",
        title: "#1d4ed8",
        desc: "#1e3a8a",
        inner: "#93c5fd",
      },
      slate: {
        border: "#cbd5e1",
        bg: "#f8fafc",
        title: "#334155",
        desc: "#475569",
        inner: "#cbd5e1",
      },
      violet: {
        border: "#ddd6fe",
        bg: "#f5f3ff",
        title: "#6d28d9",
        desc: "#4c1d95",
        inner: "#c4b5fd",
      },
      gold: {
        border: "#fef08a",
        bg: "#fefce8",
        title: "#a16207",
        desc: "#713f12",
        inner: "#fde047",
      },
      indigo: {
        border: "#c7d2fe",
        bg: "#eef2ff",
        title: "#4338ca",
        desc: "#312e81",
        inner: "#a5b4fc",
      },
      amber: {
        border: "#fde68a",
        bg: "#fffbeb",
        title: "#b45309",
        desc: "#78350f",
        inner: "#fcd34d",
      },
      sky: {
        border: "#bae6fd",
        bg: "#f0f9ff",
        title: "#0369a1",
        desc: "#0c4a6e",
        inner: "#7dd3fc",
      },
      teal: {
        border: "#99f6e4",
        bg: "#f0fdfa",
        title: "#0f766e",
        desc: "#115e59",
        inner: "#5eead4",
      },
      fuchsia: {
        border: "#f5d0fe",
        bg: "#fdf4ff",
        title: "#a21caf",
        desc: "#701a75",
        inner: "#f0abfc",
      },
      orange: {
        border: "#fed7aa",
        bg: "#fff7ed",
        title: "#c2410c",
        desc: "#7c2d12",
        inner: "#fdba74",
      },
    };
    const c = configs[theme] || configs.emerald;

    const html = `
<div class="three-col-wrapper" style="border: 1.5px solid ${c.border} !important; background-color: ${c.bg} !important; background: ${c.bg} !important; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.04); text-align: left;">
  <div style="font-weight: 955; color: ${c.title} !important; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    📊 3-COLUMN ANALYTICAL FRAMEWORK
  </div>
  <div style="font-size: 12px; color: ${c.desc} !important; font-weight: 700; margin-bottom: 12px; line-height: 1.5;">
    Deconstruct your concept into three fundamental pillars, phases, or perspectives.
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;">
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Pillar 1/Phase 1</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="col-box">Detail point 1...</div>
    </div>
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Pillar 2/Phase 2</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="col-box">Detail point 2...</div>
    </div>
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Pillar 3/Phase 3</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="col-box">Detail point 3...</div>
    </div>
  </div>
</div>
<p><br></p>
`;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand("insertHTML", false, html);
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const insertFourColumnGrid = (theme = "emerald") => {
    if (!selectedTopic) return;
    const configs: Record<
      string,
      { border: string; bg: string; title: string; desc: string; inner: string }
    > = {
      emerald: {
        border: "#bbf7d0",
        bg: "#f0fdf4",
        title: "#047857",
        desc: "#064e3b",
        inner: "#86efac",
      },
      rose: {
        border: "#fecdd3",
        bg: "#fff1f2",
        title: "#be123c",
        desc: "#881337",
        inner: "#fda4af",
      },
      blue: {
        border: "#bfdbfe",
        bg: "#f0f7ff",
        title: "#1d4ed8",
        desc: "#1e3a8a",
        inner: "#93c5fd",
      },
      slate: {
        border: "#cbd5e1",
        bg: "#f8fafc",
        title: "#334155",
        desc: "#475569",
        inner: "#cbd5e1",
      },
      violet: {
        border: "#ddd6fe",
        bg: "#f5f3ff",
        title: "#6d28d9",
        desc: "#4c1d95",
        inner: "#c4b5fd",
      },
      gold: {
        border: "#fef08a",
        bg: "#fefce8",
        title: "#a16207",
        desc: "#713f12",
        inner: "#fde047",
      },
      indigo: {
        border: "#c7d2fe",
        bg: "#eef2ff",
        title: "#4338ca",
        desc: "#312e81",
        inner: "#a5b4fc",
      },
      amber: {
        border: "#fde68a",
        bg: "#fffbeb",
        title: "#b45309",
        desc: "#78350f",
        inner: "#fcd34d",
      },
      sky: {
        border: "#bae6fd",
        bg: "#f0f9ff",
        title: "#0369a1",
        desc: "#0c4a6e",
        inner: "#7dd3fc",
      },
      teal: {
        border: "#99f6e4",
        bg: "#f0fdfa",
        title: "#0f766e",
        desc: "#115e59",
        inner: "#5eead4",
      },
      fuchsia: {
        border: "#f5d0fe",
        bg: "#fdf4ff",
        title: "#a21caf",
        desc: "#701a75",
        inner: "#f0abfc",
      },
      orange: {
        border: "#fed7aa",
        bg: "#fff7ed",
        title: "#c2410c",
        desc: "#7c2d12",
        inner: "#fdba74",
      },
    };
    const c = configs[theme] || configs.emerald;

    const html = `
<div class="four-col-wrapper" style="border: 1.5px solid ${c.border} !important; background-color: ${c.bg} !important; background: ${c.bg} !important; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.04); text-align: left;">
  <div style="font-weight: 955; color: ${c.title} !important; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    📈 4-COLUMN STRATEGIC EXECUTION MATRIX
  </div>
  <div style="font-size: 12px; color: ${c.desc} !important; font-weight: 700; margin-bottom: 12px; line-height: 1.5;">
    Map out four crucial steps, quadrants, or resources for strategic execution.
  </div>
  <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;">
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Quadrant 1</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="col-box">Detail point 1...</div>
    </div>
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Quadrant 2</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="col-box">Detail point 2...</div>
    </div>
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Quadrant 3</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="col-box">Detail point 3...</div>
    </div>
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid ${c.inner} !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: ${c.title} !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Quadrant 4</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="col-box">Detail point 4...</div>
    </div>
  </div>
</div>
<p><br></p>
`;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand("insertHTML", false, html);
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const insertProsConsCard = (theme = "emerald") => {
    if (!selectedTopic) return;
    const configs: Record<
      string,
      { border: string; bg: string; title: string; desc: string; inner: string }
    > = {
      emerald: {
        border: "#bbf7d0",
        bg: "#f0fdf4",
        title: "#047857",
        desc: "#064e3b",
        inner: "#86efac",
      },
      rose: {
        border: "#fecdd3",
        bg: "#fff1f2",
        title: "#be123c",
        desc: "#881337",
        inner: "#fda4af",
      },
      blue: {
        border: "#bfdbfe",
        bg: "#f0f7ff",
        title: "#1d4ed8",
        desc: "#1e3a8a",
        inner: "#93c5fd",
      },
      slate: {
        border: "#cbd5e1",
        bg: "#f8fafc",
        title: "#334155",
        desc: "#475569",
        inner: "#cbd5e1",
      },
      violet: {
        border: "#ddd6fe",
        bg: "#f5f3ff",
        title: "#6d28d9",
        desc: "#4c1d95",
        inner: "#c4b5fd",
      },
      gold: {
        border: "#fef08a",
        bg: "#fefce8",
        title: "#a16207",
        desc: "#713f12",
        inner: "#fde047",
      },
      indigo: {
        border: "#c7d2fe",
        bg: "#eef2ff",
        title: "#4338ca",
        desc: "#312e81",
        inner: "#a5b4fc",
      },
      amber: {
        border: "#fde68a",
        bg: "#fffbeb",
        title: "#b45309",
        desc: "#78350f",
        inner: "#fcd34d",
      },
      sky: {
        border: "#bae6fd",
        bg: "#f0f9ff",
        title: "#0369a1",
        desc: "#0c4a6e",
        inner: "#7dd3fc",
      },
      teal: {
        border: "#99f6e4",
        bg: "#f0fdfa",
        title: "#0f766e",
        desc: "#115e59",
        inner: "#5eead4",
      },
      fuchsia: {
        border: "#f5d0fe",
        bg: "#fdf4ff",
        title: "#a21caf",
        desc: "#701a75",
        inner: "#f0abfc",
      },
      orange: {
        border: "#fed7aa",
        bg: "#fff7ed",
        title: "#c2410c",
        desc: "#7c2d12",
        inner: "#fdba74",
      },
    };
    const c = configs[theme] || configs.emerald;

    const prosConsHtml = `
<div class="pros-cons-wrapper" style="border: 1.5px solid ${c.border} !important; background-color: ${c.bg} !important; background: ${c.bg} !important; border-radius: 20px; padding: 20px; margin: 18px 0; font-family: sans-serif; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.04); text-align: left;">
  <div style="font-weight: 955; color: ${c.title} !important; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 6px;">
    ⚖️ PROS & CONS / BEHAVIORAL TRADEOFF
  </div>
  <div style="font-size: 12px; color: ${c.desc} !important; font-weight: 700; margin-bottom: 12px; line-height: 1.5;">
    Analyze the positive gains versus friction points, costs, or cognitive loads of this specific change.
  </div>
  <div style="display: grid; grid-template-columns: 1fr; gap: 12px;">
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid #bbf7d0 !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: #047857 !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Green Light: Benefits (+)</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="pros-box">List 2-3 positive impact gains or friction decreases here...</div>
    </div>
    <div style="background-color: #fff !important; background: #fff !important; border: 1.5px solid #fecdd3 !important; border-radius: 12px; padding: 12px; min-height: 60px;">
      <div style="font-weight: 800; color: #be123c !important; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Red Flag: Friction / Cost (-)</div>
      <div style="font-size: 13px; color: #0f172a !important;" class="cons-box">List potential drawbacks, resistance points, or triggers here...</div>
    </div>
  </div>
</div>
<p><br></p>
`;

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand("insertHTML", false, prosConsHtml);
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const getActiveCardElement = (): {
    element: HTMLElement;
    type: "synthesis" | "qa";
  } | null => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const element =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement?.closest(
              ".synthesis-card-wrapper, .qa-board-wrapper",
            )
          : (container as HTMLElement).closest?.(
              ".synthesis-card-wrapper, .qa-board-wrapper",
            );

      if (element) {
        const isSynth = element.classList.contains("synthesis-card-wrapper");
        return {
          element: element as HTMLElement,
          type: isSynth ? "synthesis" : "qa",
        };
      }
    }
    return null;
  };

  const applyCardColor = (
    element: HTMLElement,
    type: "synthesis" | "qa",
    theme: string,
  ) => {
    if (type === "synthesis") {
      const configs: Record<
        string,
        {
          border: string;
          bg: string;
          header: string;
          desc: string;
          innerBorder: string;
        }
      > = {
        blue: {
          border: "#bfdbfe",
          bg: "#f0f7ff",
          header: "#1d4ed8",
          desc: "#1e3a8a",
          innerBorder: "#bfdbfe",
        },
        emerald: {
          border: "#bbf7d0",
          bg: "#f0fdf4",
          header: "#047857",
          desc: "#064e3b",
          innerBorder: "#bbf7d0",
        },
        rose: {
          border: "#fecdd3",
          bg: "#fff1f2",
          header: "#be123c",
          desc: "#881337",
          innerBorder: "#fecdd3",
        },
        gold: {
          border: "#fef08a",
          bg: "#fefce8",
          header: "#a16207",
          desc: "#713f12",
          innerBorder: "#fef08a",
        },
        violet: {
          border: "#ddd6fe",
          bg: "#f5f3ff",
          header: "#6d28d9",
          desc: "#4c1d95",
          innerBorder: "#ddd6fe",
        },
        orange: {
          border: "#fed7aa",
          bg: "#fff7ed",
          header: "#c2410c",
          desc: "#7c2d12",
          innerBorder: "#fed7aa",
        },
        teal: {
          border: "#99f6e4",
          bg: "#f0fdfa",
          header: "#0f766e",
          desc: "#115e59",
          innerBorder: "#99f6e4",
        },
        fuchsia: {
          border: "#f5d0fe",
          bg: "#fdf4ff",
          header: "#a21caf",
          desc: "#701a75",
          innerBorder: "#f5d0fe",
        },
        sky: {
          border: "#bae6fd",
          bg: "#f0f9ff",
          header: "#0369a1",
          desc: "#0c4a6e",
          innerBorder: "#bae6fd",
        },
        slate: {
          border: "#cbd5e1",
          bg: "#f8fafc",
          header: "#334155",
          desc: "#0f172a",
          innerBorder: "#cbd5e1",
        },
      };
      const c = configs[theme];
      if (c) {
        element.style.setProperty("border-color", c.border, "important");
        element.style.setProperty("background-color", c.bg, "important");
        element.style.setProperty("background", c.bg, "important");

        const headerDiv = element.children[0] as HTMLElement;
        if (headerDiv) headerDiv.style.color = c.header;

        const descDiv = element.children[1] as HTMLElement;
        if (descDiv) descDiv.style.color = c.desc;

        const innerBox = element.querySelector(".synthesis-box") as HTMLElement;
        if (innerBox) {
          innerBox.style.borderColor = c.innerBorder;
        }
      }
    } else if (type === "qa") {
      const configs: Record<
        string,
        {
          border: string;
          bg: string;
          header: string;
          desc: string;
          innerBorder: string;
        }
      > = {
        slate: {
          border: "#e2e8f0",
          bg: "#f8fafc",
          header: "#475569",
          desc: "#64748b",
          innerBorder: "#cbd5e1",
        },
        emerald: {
          border: "#bbf7d0",
          bg: "#f0fdf4",
          header: "#047857",
          desc: "#059669",
          innerBorder: "#86efac",
        },
        indigo: {
          border: "#c7d2fe",
          bg: "#f5f7ff",
          header: "#4338ca",
          desc: "#4f46e5",
          innerBorder: "#a5b4fc",
        },
        amber: {
          border: "#fde68a",
          bg: "#fefce8",
          header: "#b45309",
          desc: "#d97706",
          innerBorder: "#fcd34d",
        },
        purple: {
          border: "#e9d5ff",
          bg: "#faf5ff",
          header: "#7e22ce",
          desc: "#9333ea",
          innerBorder: "#d8b4fe",
        },
        rose: {
          border: "#fecdd3",
          bg: "#fff1f2",
          header: "#be123c",
          desc: "#e11d48",
          innerBorder: "#fda4af",
        },
        sky: {
          border: "#bae6fd",
          bg: "#f0f9ff",
          header: "#0369a1",
          desc: "#0284c7",
          innerBorder: "#7dd3fc",
        },
        teal: {
          border: "#99f6e4",
          bg: "#f0fdfa",
          header: "#0f766e",
          desc: "#0d9488",
          innerBorder: "#5eead4",
        },
        orange: {
          border: "#fed7aa",
          bg: "#fff7ed",
          header: "#c2410c",
          desc: "#ea580c",
          innerBorder: "#fdba74",
        },
        cyan: {
          border: "#a5f3fc",
          bg: "#ecfeff",
          header: "#0e7490",
          desc: "#0891b2",
          innerBorder: "#67e8f9",
        },
      };
      const c = configs[theme];
      if (c) {
        element.style.setProperty("border-color", c.border, "important");
        element.style.setProperty("background-color", c.bg, "important");
        element.style.setProperty("background", c.bg, "important");

        const headerDiv = element.children[0] as HTMLElement;
        if (headerDiv) headerDiv.style.color = c.header;

        const descDiv = element.children[1] as HTMLElement;
        if (descDiv) descDiv.style.color = c.desc;

        const innerBoxes = element.querySelectorAll(
          'div[style*="background-color: #ffffff"], div[style*="background-color: rgb(255, 255, 255)"], .qa-box',
        );
        innerBoxes.forEach((box) => {
          const hBox = box as HTMLElement;
          hBox.style.borderColor = c.innerBorder;
        });
      }
    }

    if (selectedTopic?.id && editorRef.current) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [tableConfig, setTableConfig] = useState({
    rows: 5,
    cols: 2,
    hasHeader: true,
    theme: "#f97316",
    headerTitle: "New Table",
    gridOpacity: 100,
    gridStyle: "theme-solid",
  });

  const insertSmartTable = () => {
    const { rows, cols, hasHeader, theme, headerTitle, gridOpacity } =
      tableConfig;
    const styleType = (tableConfig.gridStyle || "theme-solid") as
      | "theme-solid"
      | "theme-open"
      | "black-solid"
      | "black-open";
    const borderRgba = styleType.startsWith("theme")
      ? hexToRgba(theme, gridOpacity)
      : `rgba(51, 65, 85, ${gridOpacity / 100})`;

    let tableBorderCss = `border: 2.5px solid ${borderRgba} !important;`;
    if (styleType.endsWith("-open")) {
      tableBorderCss = "border: none !important;";
    }

    // Outer scrollable container to support phone bar horizontally
    let html = `<p><br></p><div class="table-scroll-container" style="overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; border-radius: 12px; margin: 8px 0 16px 0; border: ${styleType.endsWith("-open") ? "none" : `1px solid ${borderRgba}`};">`;
    html += `<table style="width: 100%; border-collapse: collapse; ${tableBorderCss} font-size: 14px; border-radius: 12px; overflow: hidden; display: table; table-layout: fixed;">`;

    html += "<colgroup>";
    for (let c = 0; c < cols; c++) {
      const isFirstCol = c === 0;
      const colWidth = isFirstCol
        ? "60px"
        : `${Math.floor((100 - 10) / (cols - 1 || 1))}%`;
      html += `<col style="width: ${colWidth};">`;
    }
    html += "</colgroup>";

    if (hasHeader) {
      let headerBorderCss = `border: 2px solid ${borderRgba} !important;`;
      if (styleType.endsWith("-open")) {
        headerBorderCss = `border: none !important; border-bottom: 2px solid ${borderRgba} !important;`;
      }
      html += `<thead><tr style="background-color: ${theme}; color: white;">
        <th colspan="${cols}" style="padding: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; ${headerBorderCss}">${headerTitle}</th>
      </tr></thead>`;
    }

    html += "<tbody>";
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        const isFirstCol = c === 0;
        let cellBorderCss = `border: 2px solid ${borderRgba} !important;`;
        if (styleType.endsWith("-open")) {
          cellBorderCss = `border: none !important; border-bottom: 2px solid ${borderRgba} !important;`;
          if (c < cols - 1) {
            cellBorderCss += ` border-right: 2px solid ${borderRgba} !important;`;
          }
        }
        const cellStyle = `padding: 12px; ${cellBorderCss} min-height: 24px; transition: background 0.2s;`;
        const content = isFirstCol ? (r + 1).toString() : "";
        const textAlign = isFirstCol ? "center" : "left";
        html += `<td style="${cellStyle} text-align: ${textAlign}; font-weight: ${isFirstCol ? "800" : "500"};">${content}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table></div><p><br></p>";

    if (editorRef.current) {
      editorRef.current.focus();
      if (savedRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedRange.current);
      }
      document.execCommand("insertHTML", false, html);
      setIsTableModalOpen(false);
    }
  };

  const manageTable = (
    action:
      | "row-above"
      | "row-below"
      | "col-left"
      | "col-right"
      | "delete-row"
      | "delete-col",
  ) => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return;

    const cell = (selection.anchorNode as HTMLElement).closest?.(
      "td, th",
    ) as HTMLTableCellElement;
    if (!cell) return;

    const row = cell.parentElement as HTMLTableRowElement;
    const table = row.closest("table") as HTMLTableElement;
    if (!table) return;

    const rowIndex = row.rowIndex;
    const colIndex = cell.cellIndex;

    if (action === "row-above") {
      const newRow = table.insertRow(rowIndex);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.style.cssText = row.cells[i].style.cssText;
        newCell.innerHTML = "&nbsp;";
      }
    } else if (action === "row-below") {
      const newRow = table.insertRow(rowIndex + 1);
      for (let i = 0; i < row.cells.length; i++) {
        const newCell = newRow.insertCell(i);
        newCell.style.cssText = row.cells[i].style.cssText;
        newCell.innerHTML = "&nbsp;";
      }
    } else if (action === "col-left") {
      for (let i = 0; i < table.rows.length; i++) {
        const r = table.rows[i];
        if (r.cells[0].colSpan > 1) continue; // Skip header spanned rows
        const newCell = r.insertCell(colIndex);
        newCell.style.cssText = cell.style.cssText;
        newCell.innerHTML = "&nbsp;";
      }
    } else if (action === "col-right") {
      for (let i = 0; i < table.rows.length; i++) {
        const r = table.rows[i];
        if (r.cells[0].colSpan > 1) continue; // Skip header spanned rows
        const newCell = r.insertCell(colIndex + 1);
        newCell.style.cssText = cell.style.cssText;
        newCell.innerHTML = "&nbsp;";
      }
    } else if (action === "delete-row") {
      table.deleteRow(rowIndex);
    } else if (action === "delete-col") {
      for (let i = 0; i < table.rows.length; i++) {
        const r = table.rows[i];
        if (r.cells[0].colSpan > 1) continue;
        if (r.cells.length > colIndex) {
          r.deleteCell(colIndex);
        }
      }
    }

    if (editorRef.current) {
      updateTopic(selectedTopic!.id, { content: editorRef.current.innerHTML });
    }
  };

  const enhanceWithAI = async () => {
    if (!selectedTopic || isAILoading) return;

    const selection = window.getSelection();
    let selectedText = "";
    let range: Range | null = null;
    let isSelectionMode = false;

    // Try to get range from active input selection first
    let r: Range | null = null;
    if (selection && selection.rangeCount > 0) {
      const activeRange = selection.getRangeAt(0);
      if (
        editorRef.current &&
        editorRef.current.contains(activeRange.commonAncestorContainer) &&
        !activeRange.collapsed &&
        activeRange.toString().trim().length > 0
      ) {
        r = activeRange;
      }
    }

    // Fall back to savedRange.current if active selection got blurred or cleared
    if (!r && savedRange.current) {
      if (
        editorRef.current &&
        editorRef.current.contains(
          savedRange.current.commonAncestorContainer,
        ) &&
        !savedRange.current.collapsed &&
        savedRange.current.toString().trim().length > 0
      ) {
        r = savedRange.current;
      }
    }

    if (r) {
      selectedText = r.toString().trim();
      if (selectedText.length > 0) {
        range = r;
        isSelectionMode = true;
      }
    }

    if (!isSelectionMode) {
      const confirmAll = window.confirm(
        "💡 Tip: To keep your old lessons and summary, highlight (select) a specific paragraph or sentence first to enhance ONLY that selected part.\n\n" +
          "You currently haven't highlighted any text. Do you want to proceed and AI-enhance the ENTIRE note?",
      );
      if (!confirmAll) return;
    }

    setIsAILoading(true);
    try {
      let promptText = "";
      if (isSelectionMode) {
        promptText = `Enhance ONLY this selected part of the note. Improve clarity, fix spelling/grammar, structure cleanly, and expand slightly if helpful. Return the improved version as HTML formatted snippet. Output ONLY valid HTML formatted text without any markdown or code block wrappers. IMPORTANT: Ensure any layout elements use 'w-full' to span the full width. Do NOT use fixed width containers or centered wrappers like 'max-w-md' or 'mx-auto'. Selected text: ${selectedText}`;
      } else {
        promptText = `Enhance this note. Improve structure, fix grammar, and expand slightly if it helps clarity. Return HTML formatted string only. IMPORTANT: Ensure any layout elements use 'w-full' to span the full width. Do NOT use fixed width containers or centered wrappers like 'max-w-md' or 'mx-auto'. Current content: ${selectedTopic.content}`;
      }

      const result = await callNeuralEngine(
        "gemini-3-flash-preview",
        promptText,
        "You are a helpful note-taking assistant. Output ONLY valid HTML formatted text.",
      );
      let improved = result.text.trim();
      improved = improved
        .replace(/^`{3}(html)?\n?/i, "")
        .replace(/`{3}$/, "")
        .trim();

      if (isSelectionMode && range && selection) {
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("insertHTML", false, improved);

        if (editorRef.current) {
          updateTopic(selectedTopic.id, {
            content: editorRef.current.innerHTML,
          });
        }
      } else {
        updateTopic(selectedTopic.id, { content: improved });
        if (editorRef.current) {
          editorRef.current.innerHTML = improved;
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to enhance content with AI.");
    } finally {
      setIsAILoading(false);
    }
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    setTimeout(checkActiveTableCell, 10);
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute("href");
      const download = anchor.getAttribute("download");

      if (href) {
        const link = document.createElement("a");
        link.href = href;
        if (download) link.download = download;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }

    if (
      target.classList?.contains("task-checkbox") &&
      target.getAttribute("contenteditable") === "false"
    ) {
      const text = target.innerText.trim();
      const toggles: Record<string, string> = {
        "⬜": "✅",
        "✅": "⬜",
        "[ ]": "[x]",
        "[x]": "[ ]",
        "🔳": "✅",
        "⚪": "🟢",
        "🟢": "⚪",
        "🔴": "🟢",
        "❎": "✅",
        "✓": "✗",
        "✗": "✓",
      };
      if (toggles[text]) {
        target.innerText = toggles[text];
        if (selectedTopic?.id && editorRef.current) {
          updateTopic(selectedTopic.id, {
            content: editorRef.current.innerHTML,
          });
        }
      }
    }
  };

  const focusAndSelectCell = (targetCell: HTMLTableCellElement) => {
    targetCell.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(targetCell);
      range.collapse(false); // Place cursor at the end
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const ensureTableColgroup = (table: HTMLTableElement) => {
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      let maxCols = 0;
      Array.from(table.rows).forEach((row) => {
        let cellsCount = 0;
        Array.from(row.cells).forEach((cell) => {
          cellsCount += parseInt(cell.getAttribute("colspan") || "1", 10);
        });
        if (cellsCount > maxCols) {
          maxCols = cellsCount;
        }
      });

      if (maxCols > 0) {
        colgroup = document.createElement("colgroup");
        const regularRow = Array.from(table.rows).find((row) => {
          let cCount = 0;
          Array.from(row.cells).forEach((cell) => {
            cCount += parseInt(cell.getAttribute("colspan") || "1", 10);
          });
          return cCount === maxCols;
        });

        for (let i = 0; i < maxCols; i++) {
          const col = document.createElement("col");
          let colWidth = "150px";
          if (regularRow && regularRow.cells[i]) {
            colWidth = `${regularRow.cells[i].getBoundingClientRect().width}px`;
          }
          col.style.width = colWidth;
          colgroup.appendChild(col);
        }
        table.insertBefore(colgroup, table.firstChild);
      }
    }

    Array.from(table.querySelectorAll("td, th")).forEach((cell) => {
      const colSpan = parseInt(cell.getAttribute("colspan") || "1", 10);
      if (colSpan === 1) {
        (cell as HTMLElement).style.width = "";
      }
    });
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    setTimeout(checkActiveTableCell, 20);
    if (e.key === "Enter") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const activeNode = selection.anchorNode;
        if (activeNode) {
          const parentEl =
            activeNode.nodeType === Node.ELEMENT_NODE
              ? (activeNode as HTMLElement)
              : activeNode.parentElement;
          const li = parentEl?.closest("li");
          if (li) {
            const checklistSpan = li.querySelector(
              ".task-checkbox",
            ) as HTMLElement | null;
            if (checklistSpan) {
              const marker = checklistSpan.innerText || "⬜";
              const checkText = li.innerText.replace(marker, "").trim();
              if (checkText === "") {
                // Return to normal paragraph - exit the checklist!
                e.preventDefault();
                const parentUl = li.parentElement;
                if (parentUl) {
                  const newBlock = document.createElement("div");
                  newBlock.innerHTML = "<br>";
                  if (parentUl.nextSibling) {
                    parentUl.parentElement?.insertBefore(
                      newBlock,
                      parentUl.nextSibling,
                    );
                  } else {
                    parentUl.parentElement?.appendChild(newBlock);
                  }
                  li.remove();
                  if (parentUl.children.length === 0) {
                    parentUl.remove();
                  }
                  const newRange = document.createRange();
                  newRange.selectNodeContents(newBlock);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                  setTimeout(() => {
                    updateTopic(selectedTopic.id, {
                      content: editorRef.current?.innerHTML || "",
                    });
                  }, 10);
                }
                return;
              }

              // Otherwise create a new checklist item with same marker
              e.preventDefault();
              const newLi = document.createElement("li");
              newLi.style.display = "flex";
              newLi.style.gap = "8px";
              newLi.style.alignItems = "flex-start";

              const newCheckbox = document.createElement("span");
              newCheckbox.contentEditable = "false";
              newCheckbox.className = "task-checkbox";
              newCheckbox.style.cursor = "pointer";
              newCheckbox.style.userSelect = "none";
              newCheckbox.innerText = marker;

              newLi.appendChild(newCheckbox);

              const textNode = document.createTextNode("");
              newLi.appendChild(textNode);

              const parentUl = li.parentElement;
              if (parentUl) {
                parentUl.insertBefore(newLi, li.nextSibling);

                const newRange = document.createRange();
                newRange.setStartAfter(newCheckbox);
                newRange.setEndAfter(newCheckbox);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);

                setTimeout(() => {
                  updateTopic(selectedTopic.id, {
                    content: editorRef.current?.innerHTML || "",
                  });
                }, 10);
              }
              return;
            }
          }
        }
      }
    }
    if (e.key === "Tab") {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const activeNode = selection.anchorNode;
      if (!activeNode) return;

      const parentEl =
        (activeNode as any).parentElement ||
        (activeNode.parentNode as HTMLElement | null);
      const activeEl =
        activeNode.nodeType === Node.ELEMENT_NODE
          ? (activeNode as HTMLElement)
          : parentEl;
      const cell = activeEl?.closest?.("td, th") as HTMLTableCellElement | null;
      if (cell) {
        // Prevent browser's default behavior of inserting a tab character or shifting focus out of the editor.
        e.preventDefault();

        const row = cell.parentElement as HTMLTableRowElement | null;
        if (!row) return;
        const table = row.closest("table") as HTMLTableElement | null;
        if (!table) return;

        // Find all cells (td, th) in the table
        const cells = Array.from(
          table.querySelectorAll("td, th"),
        ) as HTMLTableCellElement[];
        const currentIndex = cells.indexOf(cell);

        if (e.shiftKey) {
          // Navigate to previous cell
          if (currentIndex > 0) {
            const prevCell = cells[currentIndex - 1];
            focusAndSelectCell(prevCell);
          }
        } else {
          // Navigate to next cell or append new row if on final cell
          if (currentIndex < cells.length - 1) {
            const nextCell = cells[currentIndex + 1];
            focusAndSelectCell(nextCell);
          } else {
            // Last cell of table! Ensure colgroup is initialized & active style is derived seamlessly
            ensureTableColgroup(table);
            const colgroup = table.querySelector("colgroup");
            const colCount = colgroup
              ? colgroup.querySelectorAll("col").length
              : row.cells.length;

            const newRow = table.insertRow(-1); // Appends at current end
            const newCells: HTMLTableCellElement[] = [];

            for (let c = 0; c < colCount; c++) {
              const newCell = newRow.insertCell(-1);
              const sourceCell =
                row.cells[c] || row.cells[row.cells.length - 1] || cell;
              newCell.style.cssText = sourceCell.style.cssText;
              newCell.style.width = ""; // Let colgroup handle width permanently!

              if (c === 0) {
                const previousRowsCount = Array.from(table.rows).filter(
                  (r) => !r.closest("thead"),
                ).length;
                newCell.innerHTML = previousRowsCount.toString();
                newCell.style.fontWeight = "800";
                newCell.style.textAlign = "center";
              } else {
                newCell.innerHTML = "<br>"; // Placeholder for cursor focus
              }
              newCells.push(newCell);
            }

            if (newCells.length > 0) {
              setTimeout(() => {
                focusAndSelectCell(newCells[0]);
              }, 10);
            }

            if (editorRef.current && selectedTopic) {
              updateTopic(selectedTopic.id, {
                content: editorRef.current.innerHTML,
              });
            }
          }
        }
      } else {
        // Check if we are inside a QA Board
        const qaBoard = activeEl?.closest(
          ".qa-board-wrapper",
        ) as HTMLElement | null;
        if (qaBoard) {
          e.preventDefault();
          const gridContainer =
            qaBoard.querySelector('div[style*="display: grid"]') ||
            qaBoard.querySelector('div[style*="display:grid"]');
          if (gridContainer) {
            const lastCard =
              gridContainer.lastElementChild as HTMLElement | null;
            if (lastCard) {
              const newCard = lastCard.cloneNode(true) as HTMLElement;

              const promptTitleEl = newCard.querySelector(
                'div[style*="font-style: italic"]',
              ) as HTMLElement | null;
              if (promptTitleEl) {
                promptTitleEl.innerText = "Define your prompt here...";
              }
              const qaBoxEl = newCard.querySelector(
                ".qa-box",
              ) as HTMLElement | null;
              if (qaBoxEl) {
                qaBoxEl.innerHTML = "Write your response here...";
              }
              gridContainer.appendChild(newCard);

              setTimeout(() => {
                if (qaBoxEl) {
                  const range = document.createRange();
                  range.selectNodeContents(qaBoxEl);
                  range.collapse(true);
                  const sel = window.getSelection();
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                  qaBoxEl.focus();
                }
              }, 10);

              if (editorRef.current && selectedTopic) {
                updateTopic(selectedTopic.id, {
                  content: editorRef.current.innerHTML,
                });
              }
            }
          }
        }

        // Check if we are inside a Brainstorm Map
        const brainstormBoard = activeEl?.closest(
          ".brainstorm-card-wrapper",
        ) as HTMLElement | null;
        if (brainstormBoard) {
          e.preventDefault();
          const gridContainer =
            brainstormBoard.querySelector('div[style*="display: grid"]') ||
            brainstormBoard.querySelector('div[style*="display:grid"]');
          if (gridContainer) {
            const lastCard =
              gridContainer.lastElementChild as HTMLElement | null;
            if (lastCard) {
              const newCard = lastCard.cloneNode(true) as HTMLElement;
              const boxEl = newCard.querySelector(
                ".brainstorm-box",
              ) as HTMLElement | null;
              if (boxEl) {
                boxEl.innerHTML = "Add insight...";
              }
              const titleEl = newCard.querySelector(
                'div[style*="font-size: 11px"]',
              ) as HTMLElement | null;
              if (titleEl) {
                titleEl.innerText = "New Insight / Consideration";
              }
              gridContainer.appendChild(newCard);
              setTimeout(() => {
                if (boxEl) {
                  const range = document.createRange();
                  range.selectNodeContents(boxEl);
                  range.collapse(true);
                  const sel = window.getSelection();
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                  boxEl.focus();
                }
              }, 10);
              if (editorRef.current && selectedTopic) {
                updateTopic(selectedTopic.id, {
                  content: editorRef.current.innerHTML,
                });
              }
            }
          }
        }

        // Check if we are inside a Pros & Cons Grid (which also has a grid column system)
        const prosconsBoard = activeEl?.closest(
          ".pros-cons-wrapper",
        ) as HTMLElement | null;
        if (prosconsBoard) {
          e.preventDefault();
          const pGridContainer =
            prosconsBoard.querySelector('div[style*="display: grid"]') ||
            prosconsBoard.querySelector('div[style*="display:grid"]');
          if (pGridContainer) {
            const currentBox = activeEl?.closest(".pros-box, .cons-box");
            if (currentBox) {
              // Clone the entire grid setup, wait, a grid column in Pros Cons is actually just 2 columns but with varying rows?
              // Ah, wait. The pros cons is simply 2 columns of children! Wait, let's look at pros cons html.
              const isChild = !!pGridContainer;
              if (isChild) {
                const greenBox =
                  pGridContainer.children[pGridContainer.children.length - 2];
                const redBox =
                  pGridContainer.children[pGridContainer.children.length - 1];

                if (greenBox && redBox) {
                  const newGreenBox = greenBox.cloneNode(true) as HTMLElement;
                  const greenEl = newGreenBox.querySelector(
                    ".pros-box",
                  ) as HTMLElement | null;
                  if (greenEl) {
                    greenEl.innerHTML = "List positive aspect...";
                  }
                  if (
                    newGreenBox.querySelector('div[style*="font-size: 11px"]')
                  ) {
                    (
                      newGreenBox.querySelector(
                        'div[style*="font-size: 11px"]',
                      ) as HTMLElement
                    ).innerText = "ADDITIONAL PROS (+)";
                  }

                  const newRedBox = redBox.cloneNode(true) as HTMLElement;
                  const redEl = newRedBox.querySelector(
                    ".cons-box",
                  ) as HTMLElement | null;
                  if (redEl) {
                    redEl.innerHTML = "List drawback...";
                  }
                  if (
                    newRedBox.querySelector('div[style*="font-size: 11px"]')
                  ) {
                    (
                      newRedBox.querySelector(
                        'div[style*="font-size: 11px"]',
                      ) as HTMLElement
                    ).innerText = "ADDITIONAL CONS (-)";
                  }

                  pGridContainer.appendChild(newGreenBox);
                  pGridContainer.appendChild(newRedBox);

                  setTimeout(() => {
                    if (greenEl) {
                      const range = document.createRange();
                      range.selectNodeContents(greenEl);
                      range.collapse(true);
                      const sel = window.getSelection();
                      sel?.removeAllRanges();
                      sel?.addRange(range);
                      greenEl.focus();
                    }
                  }, 10);

                  if (editorRef.current && selectedTopic) {
                    updateTopic(selectedTopic.id, {
                      content: editorRef.current.innerHTML,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  const parseMarkdownTableToHtml = (text: string): string | null => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) return null;

    // A Markdown table must contain '|' and at least one line with dashes/separators or multiple pipe lines
    const isTable = lines.some(
      (l) =>
        l.includes("|-") ||
        l.includes("-|") ||
        l.match(/\|?\s*:\s*-+\s*:\s*\|/),
    );
    const hasPipe = lines[0].includes("|");
    if (!isTable && !hasPipe) return null;

    let html = `<div class="table-scroll-container" style="overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; border-radius: 12px; margin: 8px 0 16px 0; border: 1px solid currentColor;">`;
    html += `<table style="width: 100%; border-collapse: collapse; border: 1.5px solid currentColor; font-size: 14px; border-radius: 12px; overflow: hidden; display: table;">`;

    let inHeader = true;
    let headers: string[] = [];
    const rows: string[][] = [];

    for (const line of lines) {
      if (line.match(/\|?\s*[:\-]+\s*\|\s*[:\-]+/)) {
        inHeader = false;
        continue;
      }
      const cells = line.split("|").map((c) => c.trim());
      if (cells[0] === "") cells.shift();
      if (cells[cells.length - 1] === "") cells.pop();

      if (cells.length === 0) continue;

      if (inHeader && headers.length === 0) {
        headers = cells;
      } else {
        rows.push(cells);
      }
    }

    if (headers.length === 0 && rows.length > 0) {
      const first = rows.shift();
      if (first) headers = first;
    }

    if (headers.length > 0) {
      html += `<thead><tr style="background-color: var(--theme-color, #cbd5e1); color: inherit;">`;
      for (const h of headers) {
        html += `<th style="padding: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border: 1.5px solid currentColor;">${h}</th>`;
      }
      html += `</tr></thead>`;
    }

    html += "<tbody>";
    for (const row of rows) {
      html += "<tr>";
      for (let i = 0; i < headers.length; i++) {
        // If row has fewer elements, pad with empty string
        let cellContent = row[i] || "";
        // Convert any raw '<br>' text to actual tags
        cellContent = cellContent
          .replace(/&lt;br\s*\/?&gt;/gi, "<br/>")
          .replace(/<br\s*\/?>/gi, "<br/>");
        html += `<td style="padding: 12px; border: 1.5px solid currentColor; min-height: 24px; transition: background 0.2s; text-align: left; font-weight: 500; font-size: 13px;">${cellContent}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table></div><p><br></p>";
    return html;
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const plainText = e.clipboardData.getData("text/plain").trim();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    // 1. Check if plain text is a markdown table
    if (
      plainText &&
      plainText.includes("|") &&
      (plainText.includes("|-") ||
        plainText.includes("-|") ||
        plainText.split("\n").some((l) => l.trim().startsWith("|")))
    ) {
      const tableHtml = parseMarkdownTableToHtml(plainText);
      if (tableHtml) {
        const div = document.createElement("div");
        div.innerHTML = tableHtml;
        range.insertNode(div);

        const newRange = document.createRange();
        newRange.setStartAfter(div);
        newRange.setEndAfter(div);
        sel.removeAllRanges();
        sel.addRange(newRange);

        if (editorRef.current && selectedTopic) {
          updateTopic(selectedTopic.id, {
            content: editorRef.current.innerHTML,
          });
        }
        return;
      }
    }

    // 2. Process any rich HTML to preserve formatting like bold, italic, color, and tables
    if (html) {
      const div = document.createElement("div");
      div.innerHTML = html;

      const allElements = div.querySelectorAll("*");
      allElements.forEach((el: any) => {
        if (el.style) {
          el.style.position = "";
          el.style.top = "";
          el.style.left = "";
          el.style.float = "";
        }
      });

      const fragment = document.createDocumentFragment();
      while (div.firstChild) {
        fragment.appendChild(div.firstChild);
      }

      const lastNode = fragment.lastChild;
      range.insertNode(fragment);

      if (lastNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(lastNode);
        newRange.setEndAfter(lastNode);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }

      if (editorRef.current && selectedTopic) {
        updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
      }
      return;
    }

    // 3. Fallback to clean plain text
    const textNode = document.createTextNode(
      plainText || e.clipboardData.getData("text/plain"),
    );
    range.insertNode(textNode);

    const newRange = document.createRange();
    newRange.setStartAfter(textNode);
    newRange.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(newRange);

    if (editorRef.current && selectedTopic) {
      updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML });
    }
  };

  const handleEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isResizingTableCol.current) return;

    const target = e.target as HTMLElement;
    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    if (cell) {
      const resizeTarget = getCellResizeTarget(e.clientX, cell, 8);
      if (resizeTarget) {
        cell.style.cursor = "col-resize";
      } else {
        cell.style.cursor = "";
      }
    }
  };

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const clickedCell = target.closest("td, th") as HTMLTableCellElement | null;
    if (!clickedCell) return;

    const cell = getCellResizeTarget(e.clientX, clickedCell, 8);
    if (cell) {
      e.preventDefault();

      const row = cell.parentElement as HTMLTableRowElement;
      const table = row?.closest("table");
      if (!table) return;

      table.style.tableLayout = "fixed";
      ensureTableColgroup(table);

      const colgroup = table.querySelector("colgroup");
      if (!colgroup) return;
      const cols = Array.from(colgroup.querySelectorAll("col"));

      const cellsInRow = Array.from(row.cells);
      const clickedCellIdx = cellsInRow.indexOf(cell);
      let colIdx = 0;
      for (let i = 0; i < clickedCellIdx; i++) {
        colIdx += parseInt(cellsInRow[i].getAttribute("colspan") || "1", 10);
      }
      colIdx += parseInt(cell.getAttribute("colspan") || "1", 10) - 1;

      const targetCol = cols[colIdx];
      if (!targetCol) return;

      isResizingTableCol.current = true;
      targetCellRef.current = cell;
      initialXRef.current = e.clientX;
      initialWidthRef.current = targetCol.getBoundingClientRect().width;

      const initialColWidths = cols.map((c) => c.getBoundingClientRect().width);

      const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
        if (isResizingTableCol.current && targetCol) {
          const deltaX = moveEvent.clientX - initialXRef.current;
          const newWidth = Math.max(30, initialWidthRef.current + deltaX);

          targetCol.style.width = `${newWidth}px`;

          let totalTableWidth = 0;
          cols.forEach((col, idx) => {
            if (idx === colIdx) {
              totalTableWidth += newWidth;
            } else {
              totalTableWidth +=
                initialColWidths[idx] || col.getBoundingClientRect().width;
            }
          });
          table.style.width = `${totalTableWidth}px`;
        }
      };

      const handleGlobalMouseUp = () => {
        isResizingTableCol.current = false;
        targetCellRef.current = null;

        window.removeEventListener("mousemove", handleGlobalMouseMove);
        window.removeEventListener("mouseup", handleGlobalMouseUp);

        if (editorRef.current && selectedTopic) {
          updateTopic(selectedTopic.id, {
            content: editorRef.current.innerHTML,
          });
        }
      };

      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
  };

  const handleEditorTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Disable touch resizing to prevent table/column layout messiness and allow easy text editing on touch/mobile devices
    return;
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const target = touch.target as HTMLElement;
    const clickedCell = target.closest("td, th") as HTMLTableCellElement | null;
    if (clickedCell) {
      const cell = getCellResizeTarget(touch.clientX, clickedCell, 22);
      if (cell) {
        e.preventDefault();

        const row = cell.parentElement as HTMLTableRowElement;
        const table = row?.closest("table");
        if (!table) return;

        table.style.tableLayout = "fixed";
        ensureTableColgroup(table);

        const colgroup = table.querySelector("colgroup");
        if (!colgroup) return;
        const cols = Array.from(colgroup.querySelectorAll("col"));

        const cellsInRow = Array.from(row.cells);
        const clickedCellIdx = cellsInRow.indexOf(cell);
        let colIdx = 0;
        for (let i = 0; i < clickedCellIdx; i++) {
          colIdx += parseInt(cellsInRow[i].getAttribute("colspan") || "1", 10);
        }
        colIdx += parseInt(cell.getAttribute("colspan") || "1", 10) - 1;

        const targetCol = cols[colIdx];
        if (!targetCol) return;

        isResizingTableCol.current = true;
        targetCellRef.current = cell;
        initialXRef.current = touch.clientX;
        initialWidthRef.current = targetCol.getBoundingClientRect().width;

        const initialColWidths = cols.map(
          (c) => c.getBoundingClientRect().width,
        );

        const handleGlobalTouchMove = (moveEvt: TouchEvent) => {
          if (
            isResizingTableCol.current &&
            targetCol &&
            moveEvt.touches.length > 0
          ) {
            const t = moveEvt.touches[0];
            const deltaX = t.clientX - initialXRef.current;
            const newWidth = Math.max(30, initialWidthRef.current + deltaX);

            targetCol.style.width = `${newWidth}px`;

            let totalTableWidth = 0;
            cols.forEach((col, idx) => {
              if (idx === colIdx) {
                totalTableWidth += newWidth;
              } else {
                totalTableWidth +=
                  initialColWidths[idx] || col.getBoundingClientRect().width;
              }
            });
            table.style.width = `${totalTableWidth}px`;
          }
        };

        const handleGlobalTouchEnd = () => {
          isResizingTableCol.current = false;
          targetCellRef.current = null;

          window.removeEventListener("touchmove", handleGlobalTouchMove);
          window.removeEventListener("touchend", handleGlobalTouchEnd);

          if (editorRef.current && selectedTopic) {
            updateTopic(selectedTopic.id, {
              content: editorRef.current.innerHTML,
            });
          }
        };

        window.addEventListener("touchmove", handleGlobalTouchMove, {
          passive: false,
        });
        window.addEventListener("touchend", handleGlobalTouchEnd);
      }
    }
  };

  const generateEditorPlan = async (type: "action" | "study") => {
    if (!selectedTopic) return;
    if (isEditorActionPlanLoading || isEditorStudyPlanLoading) return;

    let selectedText = "";
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      selectedText = sel.toString().trim();
    }

    // Fallback to full content if selection is empty or less than 10 chars
    const contentToUse =
      selectedText.length > 10
        ? selectedText
        : editorRef.current
          ? editorRef.current.innerText || editorRef.current.textContent || ""
          : "";

    if (!contentToUse.trim()) {
      alert("No content available to generate a plan from.");
      return;
    }

    if (type === "action") {
      setIsEditorActionPlanLoading(true);
    } else {
      setIsEditorStudyPlanLoading(true);
    }

    try {
      let prompt = "";
      if (type === "action") {
        prompt = `Generate a highly practical, step-by-step Action Plan based strictly on the following excerpt/lesson: "${contentToUse}". 
      Include daily routines, specific micro-habits, friction-reduction techniques, obstacles handling, and measurable criteria for success. Follow the style of Tony Robbins and Brendon Burchard AI styling.
      Use professional HTML formatting, beautifully styled with Tailwind CSS.
      STYLING AND CONTRAST MANDATES:
      - ALWAYS wrap the top main heading (title) and description subtitle in a beautifully styled, centered block (e.g., div with text-center or items-center justify-center) to ensure it centers elegantly in the layout, exactly as in the professional template screenshots.
      - Use an elegant, professional light-colored theme.
      - NEVER use dark or black backgrounds (like bg-black, bg-gray-900, bg-slate-900) for any panels, structural blocks, or cards. ALWAYS use crisp, light colors.
      - DO NOT default to or always use blue (or sky-blue or cyan) colors. You can use ANY premium colors (e.g., emerald green, warm amber, violet, terracotta/rust, plum, rose-brown), but keep it varied and professional.
      - Contrast is critical: Make sure all text, numbers, list items, description paragraphs, and table/grid contents use highly readable deep charcoal/slate styles (e.g., text-slate-800, text-stone-900, or matching deep colors). NEVER use white, light-gray, or washed-out light text inside white/light cards or panels.
      - Use clean, light borders (e.g., border-slate-200, border-stone-200) instead of thick dark backgrounds.
      - For columns and grids, use clear, distinct borders or light shadows for clean alignment.
      - IMPORTANT: Use 'w-full' or 'max-w-full' for all structural wrappers, tables, and block container elements. The content must span the entire full width of the view. Do NOT use fixed width classes like 'max-w-md', 'max-w-xl', 'max-w-2xl' or centered fixed wrappers like 'mx-auto'. Make the layout fluid and full-width.
      - CARD AND NUMBERED LIST LAYOUTS: To save horizontal space in columns, do NOT use a two-column flex-row style (e.g., 'flex items-start gap-4') for card numbers/circles. Instead, use a floated inline layout where the circular number/badge has 'float: left; margin-right: 12px; margin-bottom: 6px;' (or class="float-left mr-3 mb-1.5"). This guarantees that lines of text flow seamlessly next to and wrap UNDERNEATH the circular number, using the full width of the card.
      Do NOT wrap in markdown code blocks like \`\`\`html, just output raw, polished HTML directly. Do NOT include html, head, or body tags.`;
      } else {
        prompt = `Generate a comprehensive Study Plan based strictly on the following excerpt/lesson: "${contentToUse}".
      Include spaced repetition schedules, active recall strategies, core concept breakdowns, and deep learning techniques. Follow the style of Tony Robbins and Brendon Burchard AI styling.
      Use professional HTML formatting, beautifully styled with Tailwind CSS.
      STYLING AND CONTRAST MANDATES:
      - ALWAYS wrap the top main heading (title) and description subtitle in a beautifully styled, centered block (e.g., div with text-center or items-center justify-center) to ensure it centers elegantly in the layout.
      - Use an elegant, professional light-colored theme.
      - NEVER use dark or black backgrounds (like bg-black, bg-gray-900, bg-slate-900) for any panels, structural blocks, or cards. ALWAYS use crisp, light colors.
      - DO NOT default to or always use blue colors. Use ANY premium colors (e.g., emerald green, warm amber, violet, terracotta/rust, plum, rose-brown), but keep it varied and professional.
      - Contrast is critical: Make sure all text, numbers, list items, description paragraphs, and table/grid contents use highly readable deep charcoal/slate styles (e.g., text-slate-800, text-stone-900).
      - Use clean, light borders (e.g., border-slate-200, border-stone-200) instead of thick dark backgrounds.
      - For columns and grids, use clear, distinct borders or light shadows for clean alignment.
      - IMPORTANT: Use 'w-full' or 'max-w-full' for all structural wrappers, tables, and block container elements. The content must span the entire full width of the view.
      - CARD AND NUMBERED LIST LAYOUTS: To save horizontal space in columns, use a floated inline layout where the circular number/badge has 'float: left; margin-right: 12px; margin-bottom: 6px;' (or class="float-left mr-3 mb-1.5").
      Do NOT wrap in markdown code blocks like \`\`\`html, just output raw, polished HTML directly. Do NOT include html, head, or body tags.`;
      }

      const result = await callNeuralEngine(
        "gemini-3-flash-preview",
        prompt,
        "You are an expert performance psychologist and high-performance coach. Output ONLY valid HTML.",
      );

      let htmlOutput = result.text.trim();
      htmlOutput = htmlOutput
        .replace(/^`{3}(html)?\n?/i, "")
        .replace(/`{3}$/, "")
        .trim();

      const planTitle = type === "action" ? "⚡ Action Plan" : "🪄 Study Plan";
      htmlOutput =
        `<div class="mb-4 text-center"><h2 class="text-2xl font-black text-slate-800 tracking-tight">${planTitle}</h2></div>` +
        htmlOutput;

      // Append to the editor
      if (editorRef.current && selectedTopic) {
        let currentHTML = editorRef.current.innerHTML;
        const divider =
          '<div class="my-8 h-px bg-slate-200/60 w-full" contenteditable="false" data-separator="true"></div><br/>';

        editorRef.current.innerHTML = currentHTML + divider + htmlOutput;
        updateTopic(selectedTopic.id, { content: editorRef.current.innerHTML }); // Trigger auto save

        // Scroll to the bottom
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.scrollTop = editorRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate plan.");
    } finally {
      if (type === "action") {
        setIsEditorActionPlanLoading(false);
      } else {
        setIsEditorStudyPlanLoading(false);
      }
    }
  };

  const getTopicStyles = (id: string, isSelected: boolean) => {
    const hash = id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      {
        text: "text-orange-850 dark:text-orange-400 font-bold",
        bg: "bg-orange-500/5",
        border: "border-orange-500/20",
        activeBg: "bg-orange-500/15 border-orange-500/40",
        indicator: "bg-orange-500",
        iconColor: "text-orange-500",
        hover: "hover:bg-orange-500/10",
      },
      {
        text: "text-indigo-800 dark:text-indigo-400 font-bold",
        bg: "bg-indigo-500/5",
        border: "border-indigo-500/20",
        activeBg: "bg-indigo-500/15 border-indigo-500/40",
        indicator: "bg-indigo-500",
        iconColor: "text-indigo-500",
        hover: "hover:bg-indigo-500/10",
      },
      {
        text: "text-emerald-800 dark:text-emerald-400 font-bold",
        bg: "bg-emerald-500/5",
        border: "border-emerald-500/20",
        activeBg: "bg-emerald-500/15 border-emerald-500/40",
        indicator: "bg-emerald-500",
        iconColor: "text-emerald-500",
        hover: "hover:bg-emerald-500/10",
      },
      {
        text: "text-amber-800 dark:text-amber-400 font-bold",
        bg: "bg-amber-500/5",
        border: "border-amber-500/20",
        activeBg: "bg-amber-500/15 border-amber-500/40",
        indicator: "bg-amber-500",
        iconColor: "text-amber-500",
        hover: "hover:bg-amber-500/10",
      },
      {
        text: "text-rose-800 dark:text-rose-400 font-bold",
        bg: "bg-rose-500/5",
        border: "border-rose-500/20",
        activeBg: "bg-rose-500/15 border-rose-500/40",
        indicator: "bg-rose-500",
        iconColor: "text-rose-500",
        hover: "hover:bg-rose-500/10",
      },
      {
        text: "text-sky-800 dark:text-sky-400 font-bold",
        bg: "bg-sky-500/5",
        border: "border-sky-500/20",
        activeBg: "bg-sky-500/15 border-sky-500/40",
        indicator: "bg-sky-500",
        iconColor: "text-sky-500",
        hover: "hover:bg-sky-500/10",
      },
      {
        text: "text-purple-800 dark:text-purple-400 font-bold",
        bg: "bg-purple-500/5",
        border: "border-purple-500/20",
        activeBg: "bg-purple-500/15 border-purple-50 border-purple-500/40",
        indicator: "bg-purple-500",
        iconColor: "text-purple-500",
        hover: "hover:bg-purple-500/10",
      },
      {
        text: "text-teal-800 dark:text-teal-400 font-bold",
        bg: "bg-teal-500/5",
        border: "border-teal-500/20",
        activeBg: "bg-teal-500/15 border-teal-500/40",
        indicator: "bg-teal-500",
        iconColor: "text-teal-500",
        hover: "hover:bg-teal-500/10",
      },
    ];
    return colors[hash % colors.length];
  };

  const renderTopic = (topic: DPSSTopic, depth = 0): React.ReactNode => {
    if (!topic || topic.deletedAt) return null;
    const isSelected = selectedTopicId === topic.id;
    const style = getTopicStyles(topic.id, isSelected);
    const hasChildren = topic.children && topic.children.length > 0;
    const isExpanded = !!expandedTopics[topic.id];

    return (
      <div
        key={topic.id}
        style={{ marginLeft: `${depth * 8}px` }}
        className="transition-all duration-200"
      >
        <div
          draggable={!topic.isLocked}
          onDragStart={(e) => handleDragStart(e, topic.id)}
          onDragOver={(e) => handleDragOver(e, topic.id)}
          onDrop={(e) => handleDrop(e, topic.id)}
          onDragEnd={() => {
            setDraggedTopicId(null);
            setDragOverTopicId(null);
          }}
          onClick={() => {
            setSelectedTopicId(topic.id);
            setOpenMenuId(null);
            if (window.innerWidth < 768) {
              setIsSidebarOpen(false);
            }
            if (hasChildren) {
              setExpandedTopics((prev) => ({
                ...prev,
                [topic.id]: !prev[topic.id],
              }));
            }
          }}
          className={`relative group flex items-center justify-between p-2 my-1 rounded-xl cursor-pointer border transition-all select-none ${openMenuId === topic.id ? "z-[100]" : "z-10"} ${
            isSelected
              ? `${style.activeBg} ${style.border} ${style.text} shadow-sm scale-[1.01]`
              : `bg-white/40 dark:bg-slate-900/10 ${style.border} ${style.text} hover:scale-[1.01] hover:bg-white/70`
          } ${draggedTopicId === topic.id ? "opacity-30" : "opacity-100"} ${
            dragOverTopicId === `${topic.id}-before`
              ? "border-t-2 border-orange-500 scale-[1.01]"
              : ""
          } ${
            dragOverTopicId === `${topic.id}-after`
              ? "border-b-2 border-orange-500 scale-[1.01]"
              : ""
          } ${
            dragOverTopicId === `${topic.id}-inside`
              ? "ring-2 ring-orange-500 rounded-xl bg-orange-50/50 dark:bg-orange-900/20 scale-[1.01]"
              : ""
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {!topic.isLocked && (
              <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors shrink-0 flex items-center justify-center p-1 -ml-1">
                <GripVertical size={14} />
              </div>
            )}
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedTopics((prev) => ({
                    ...prev,
                    [topic.id]: !prev[topic.id],
                  }));
                }}
                className="p-0.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 shrink-0 text-slate-500"
              >
                {isExpanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
              </button>
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.indicator} ml-1.5`}
              />
            )}

            {editingTopicId === topic.id ? (
              <input
                type="text"
                value={editingTopicTitle}
                onChange={(e) => setEditingTopicTitle(e.target.value)}
                onBlur={() => {
                  if (editingTopicTitle.trim()) {
                    updateTopic(topic.id, { title: editingTopicTitle.trim() });
                  }
                  setEditingTopicId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (editingTopicTitle.trim()) {
                      updateTopic(topic.id, {
                        title: editingTopicTitle.trim(),
                      });
                    }
                    setEditingTopicId(null);
                  } else if (e.key === "Escape") {
                    setEditingTopicId(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-[12px] bg-white text-slate-800 px-1 py-0.5 rounded border border-slate-300 outline-none flex-1 min-w-0"
                autoFocus
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTopicId(topic.id);
                  setEditingTopicTitle(topic.title);
                }}
                className="font-bold text-[12px] truncate flex-1 min-w-0 flex items-center gap-1.5"
                title={topic.title}
              >
                {topic.title}
                {topic.isLocked && (
                  <Lock size={10} className="text-slate-400 shrink-0" />
                )}
              </span>
            )}
          </div>

          <div className="flex gap-1 shrink-0">
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (openMenuId === topic.id) {
                    setOpenMenuId(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const spaceAbove = rect.top;
                    if (spaceBelow < 260 && spaceAbove > spaceBelow) {
                      setMenuPlacement("up");
                    } else {
                      setMenuPlacement("down");
                    }
                    setOpenMenuId(topic.id);
                  }
                }}
                className={`p-1.5 rounded transition-all flex items-center ${openMenuId === topic.id ? "bg-slate-300/60 dark:bg-slate-700 text-slate-800 dark:text-slate-200" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"}`}
                title="More Options"
              >
                <MoreHorizontal size={15} />
              </button>

              {openMenuId === topic.id && (
                <div
                  className={`absolute right-0 ${menuPlacement === "up" ? "bottom-full mb-2" : "top-full mt-2"} bg-white dark:bg-slate-800 shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 py-1.5 flex flex-col min-w-[160px] z-[100] max-h-[250px] md:max-h-none overflow-y-auto custom-scrollbar`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex px-2 pb-1 gap-1 border-b border-slate-100 dark:border-slate-700 mb-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveTopicUpDown(topic.id, "up");
                        setOpenMenuId(null);
                      }}
                      className="flex-1 py-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveTopicUpDown(topic.id, "down");
                        setOpenMenuId(null);
                      }}
                      className="flex-1 py-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addTopic(topic.id);
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
                  >
                    <Plus size={14} className="text-emerald-500" />
                    Add Sub-topic
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTopicId(topic.id);
                      setEditingTopicTitle(topic.title);
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
                  >
                    <Pencil size={14} className="text-emerald-500" />
                    Edit Title
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTopic(topic.id, { isArchived: !topic.isArchived });
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
                  >
                    <Star
                      size={14}
                      className={
                        topic.isArchived ? "text-amber-500" : "text-slate-400"
                      }
                      fill={topic.isArchived ? "currentColor" : "none"}
                    />
                    {topic.isArchived ? "Unfavorite" : "Favorite"}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTopic(topic.id, { isLocked: !topic.isLocked });
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
                  >
                    {topic.isLocked ? (
                      <Lock size={14} className="text-red-500" />
                    ) : (
                      <Unlock size={14} className="text-blue-500" />
                    )}
                    {topic.isLocked ? "Unlock Document" : "Lock from Deletion"}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateTopic(topic.id);
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
                  >
                    <Copy size={14} className="text-teal-500" />
                    Duplicate
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareTopic(topic);
                      setOpenMenuId(null);
                    }}
                    disabled={sharingTopicId === topic.id}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs disabled:opacity-40"
                  >
                    <Share2
                      size={14}
                      className={
                        sharingTopicId === topic.id
                          ? "animate-spin text-orange-500"
                          : "text-orange-500"
                      }
                    />
                    Share
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveTopicToSelfLearning(topic);
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
                  >
                    <ArrowRightLeft size={14} className="text-indigo-500" />
                    Move to Self-Learning
                  </button>

                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                      deleteTopic(topic.id);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-colors text-xs"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-dashed border-slate-200 dark:border-slate-800 ml-2.5 pl-1.5">
            {topic.children!.map((child) => renderTopic(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (editorRef.current && selectedTopic) {
      let content = selectedTopic.content || "";
      // Dynamically strip narrow constraints from old generated text so they span full width
      content = content.replace(
        /max-width:\s*\d+(px|rem|em|vw|%)/gi,
        "max-width: 100%",
      );
      content = content.replace(
        /width:\s*\d+(px|rem|em)(?![^;]*%!important)/gi,
        "width: 100%",
      );
      content = content.replace(/margin:\s*0\s+auto/gi, "margin: 0");
      content = content.replace(
        /max-w-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)/g,
        "max-w-full",
      );
      content = content.replace(/\bmx-auto\b/g, "");

      if (editorRef.current.innerHTML !== content) {
        if (document.activeElement !== editorRef.current) {
          editorRef.current.innerHTML = content;
        }
      }
    }
  }, [selectedTopic?.id, selectedTopic?.content]);

  return (
    <div className="flex flex-col md:flex-row h-full md:h-full w-full p-0 gap-0 overflow-hidden relative">
      {/* Sidebar with Fonts - Mobile Slide-in Logic */}
      <div
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : "0px" }}
        className={`
          fixed md:relative inset-y-0 left-0 z-50 md:z-30
          bg-white/95 md:bg-white/10 backdrop-blur-3xl md:backdrop-blur-md 
          rounded-r-3xl md:rounded-3xl shrink-0 transition-all duration-300 transform
          ${
            isSidebarOpen
              ? "p-3 md:p-6 border-r md:border border-white/20 translate-x-0 opacity-100 flex flex-col gap-3 md:gap-4 max-[767px]:landscape:gap-2 relative select-none"
              : "p-0 border-none -translate-x-full pointer-events-none opacity-0 select-none hidden overflow-hidden shadow-none md:hidden w-0"
          }
        `}
      >
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h2 className="text-xl font-black text-slate-800 tracking-tight whitespace-nowrap">
            Note-taking
          </h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        {/* Unifed Scrollable Column wrapped with a relative container for persistent custom touchscreen scrollbar */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={sidebarScrollRef}
            onScroll={updateSidebarScroll}
            className="flex-1 overflow-y-auto pr-8 space-y-3 max-[767px]:landscape:space-y-2.5 hide-native-scrollbar flex flex-col min-h-0 overscroll-contain pb-24 touch-pan-y w-[87%] md:w-full"
          >
            <div className="flex flex-col gap-2.5 shrink-0">
              {/* Equal sized Action Buttons Grid */}
              <div className="grid grid-cols-2 gap-2 w-full animate-in fade-in">
                <button
                  onClick={() => {
                    addTopic();
                  }}
                  className="py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl text-[10px] font-black flex items-center justify-center gap-1.5 hover:from-orange-600 hover:to-orange-700 shadow-xl shadow-orange-500/20 active:scale-95 transition-all whitespace-nowrap"
                >
                  <Plus size={14} /> Add Topic
                </button>

                <button
                  onClick={() => {
                    setIsImportModalOpen(true);
                  }}
                  className="py-2.5 bg-sky-600 text-white rounded-2xl text-[10px] font-black flex items-center justify-center gap-1 hover:bg-sky-700 shadow-xl shadow-sky-500/20 active:scale-95 transition-all whitespace-nowrap"
                  title="Import Topic Folder from JSON or Clipboard"
                >
                  <FileUp size={14} /> Import
                </button>
              </div>

              {/* Search Bar placed under action buttons */}
              <div className="relative w-full">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Files / Stars / Smart Segmented Tab Control in ONE line right under Search */}
              <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-2xl w-full border border-slate-200/40 dark:border-slate-800/40 gap-0.5">
                <button
                  onClick={() => setSidebarFilter("files")}
                  className={`flex-grow flex items-center justify-center gap-1 py-1.5 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    sidebarFilter === "files"
                      ? "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm font-black"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                  title="All active files & folders"
                >
                  <Folder
                    size={11}
                    className={
                      sidebarFilter === "files"
                        ? "text-orange-500"
                        : "text-slate-400"
                    }
                  />
                  <span>Files</span>
                  <span
                    className={`px-1 py-0.5 rounded-full text-[8px] font-semibold scale-90 ${sidebarFilter === "files" ? "bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400" : "bg-slate-200 dark:bg-slate-800/80 text-slate-600"}`}
                  >
                    {activeTopics.length}
                  </span>
                </button>

                <button
                  onClick={() => setSidebarFilter("stars")}
                  className={`flex-grow flex items-center justify-center gap-1 py-1.5 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    sidebarFilter === "stars"
                      ? "bg-amber-500 dark:bg-amber-600 text-white shadow-sm font-black"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                  title="Favorite / starred topics"
                >
                  <Star
                    size={11}
                    fill={sidebarFilter === "stars" ? "currentColor" : "none"}
                    className={
                      sidebarFilter === "stars"
                        ? "text-white"
                        : "text-amber-500"
                    }
                  />
                  <span>Stars</span>
                  <span
                    className={`px-1 py-0.5 rounded-full text-[8px] font-semibold scale-90 ${sidebarFilter === "stars" ? "bg-amber-600 text-white" : "bg-amber-100 dark:bg-amber-900/40 text-amber-750 text-amber-700"}`}
                  >
                    {archivedTopics.length}
                  </span>
                </button>

                <button
                  onClick={() => setSidebarFilter("smart")}
                  className={`flex-grow flex items-center justify-center gap-1 py-1.5 rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    sidebarFilter === "smart"
                      ? "bg-gradient-to-r from-indigo-505 to-purple-650 text-white bg-indigo-600 dark:bg-indigo-650 shadow-sm font-black"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-705 dark:hover:text-slate-305"
                  }`}
                  title="Smart Show: Prioritizes active checklists, attachments, and detailed notes"
                >
                  <Wand2
                    size={11}
                    className={
                      sidebarFilter === "smart"
                        ? "text-white"
                        : "text-indigo-550 text-indigo-500"
                    }
                  />
                  <span>Smart</span>
                </button>
              </div>
            </div>

            {/* Active Folder/Stars/Smart contents based on current filter selection */}
            {sidebarFilter === "files" ? (
              <div
                className={`space-y-1 min-h-[50px] outline-none rounded-xl transition-all ${dragOverTopicId === null && draggedTopicId ? "ring-2 ring-orange-400/50 bg-orange-50/30" : ""}`}
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={(e) => handleDragLeave(e, null)}
                onDrop={(e) => handleDrop(e, null)}
              >
                {filteredTopics.length > 0 ? (
                  filteredTopics.map((t) => renderTopic(t))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400 select-none">
                    {searchTerm
                      ? "No matching note topics found"
                      : "No active note topics yet"}
                  </div>
                )}
              </div>
            ) : sidebarFilter === "smart" ? (
              <div className="space-y-1 min-h-[50px] outline-none rounded-xl transition-all">
                <div className="text-[9px] font-black text-indigo-500 dark:text-indigo-400/80 uppercase tracking-widest pl-1 mb-2 flex items-center gap-1">
                  <span>✨ Smart Show: Active Task Priorities</span>
                </div>
                {filteredSmartTopics.length > 0 ? (
                  filteredSmartTopics.map((t) => renderTopic(t))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400 select-none">
                    {searchTerm
                      ? "No matching smart topics"
                      : "No active notes block found"}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 pl-0.5">
                {filteredArchivedTopics.length > 0 ? (
                  filteredArchivedTopics.map((t) => renderTopic(t))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400 select-none">
                    {searchTerm
                      ? "No matching favorite topics"
                      : "Stars is empty"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom Simulated Scrollbar (Always visible on touchscreens & mobile platforms) */}
          {(() => {
            const canScrollSidebar =
              sidebarScrollState.scrollHeight >
                sidebarScrollState.clientHeight &&
              sidebarScrollState.clientHeight > 0;
            if (!canScrollSidebar) return null;

            const containerHeight = sidebarScrollState.clientHeight;
            const thumbHeight = Math.max(
              32,
              Math.round(
                (containerHeight / sidebarScrollState.scrollHeight) *
                  containerHeight,
              ),
            );
            const maxScrollTop =
              sidebarScrollState.scrollHeight - containerHeight;
            const percent =
              maxScrollTop > 0
                ? sidebarScrollState.scrollTop / maxScrollTop
                : 0;
            const thumbOffset = Math.round(
              percent * (containerHeight - thumbHeight),
            );

            const handlePointerDown = (e: React.PointerEvent) => {
              e.preventDefault();
              const startY = e.clientY;
              const startScrollTop = sidebarScrollState.scrollTop;

              const handlePointerMove = (moveEvent: PointerEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const scrollRatio =
                  sidebarScrollState.scrollHeight / containerHeight;
                if (sidebarScrollRef.current) {
                  sidebarScrollRef.current.scrollTop =
                    startScrollTop + deltaY * scrollRatio;
                }
              };

              const handlePointerUp = () => {
                document.removeEventListener("pointermove", handlePointerMove);
                document.removeEventListener("pointerup", handlePointerUp);
              };

              document.addEventListener("pointermove", handlePointerMove);
              document.addEventListener("pointerup", handlePointerUp);
            };

            return (
              <div className="absolute right-[13%] md:right-1 top-1 bottom-1 w-3 bg-slate-200/50 dark:bg-slate-800/60 rounded-full z-[100] flex justify-center py-1 overflow-visible">
                <div
                  onPointerDown={handlePointerDown}
                  className="w-full bg-gradient-to-b from-orange-400 via-purple-500 to-green-500 rounded-full cursor-grab active:cursor-grabbing hover:opacity-100 opacity-90 transition-opacity touch-none shadow-sm"
                  style={{
                    height: `${thumbHeight}px`,
                    transform: `translateY(${Math.max(0, thumbOffset)}px)`,
                  }}
                />
              </div>
            );
          })()}
        </div>

        {/* Resizable drag handle (Touch + Mouse friendly) */}
        {isSidebarOpen && (
          <div
            className="absolute top-0 bottom-0 right-0 w-3 cursor-col-resize z-50 flex items-center justify-center group/resize-handle select-none touch-none touch-pan-y"
            onMouseDown={(e) => {
              e.preventDefault();
              isResizing.current = true;
              document.body.style.cursor = "col-resize";
            }}
            onTouchStart={() => {
              isResizing.current = true;
            }}
          >
            {/* Visual handle indicator bar */}
            <div className="h-10 w-1 rounded-full bg-slate-350 dark:bg-slate-700 opacity-40 group-hover/resize-handle:opacity-100 group-active/resize-handle:opacity-100 group-hover/resize-handle:bg-orange-500 group-active/resize-handle:bg-orange-500 transition-all shadow-sm" />
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div
        className={`flex-1 bg-transparent rounded-3xl p-4 md:p-6 border border-white/20 relative overflow-hidden flex flex-col ${!isSidebarOpen ? "w-full" : "hidden md:flex"}`}
      >
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed left-20 top-4 z-[100] md:absolute md:left-20 md:top-4 md:z-[100] p-3 bg-orange-500 text-white rounded-xl shadow-lg hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center"
          >
            <Menu size={24} />
          </button>
        )}
        {selectedTopic ? (
          <div className="space-y-4 h-full flex flex-col">
            <div className="flex items-center gap-2 md:gap-4 px-2 mt-2 md:mt-0">
              {!isSidebarOpen && <div className="w-12 md:hidden shrink-0" />}{" "}
              {/* Spacer for the absolute menu button */}
              <input
                value={selectedTopic.title}
                onChange={(e) =>
                  updateTopic(selectedTopic.id, { title: e.target.value })
                }
                className={`flex-1 text-2xl md:text-4xl font-black text-slate-900 border-slate-300 bg-white/40 backdrop-blur-sm shadow-sm drop-shadow-sm outline-none p-2 border-b-2 focus:border-orange-500 focus:text-slate-900 focus:bg-white focus:shadow-md transition-all min-w-0 text-center uppercase tracking-wide rounded-t-xl`}
                placeholder="Topic Title..."
              />
              <button
                onClick={() => setIsToolbarHidden(!isToolbarHidden)}
                className={`p-2 shrink-0 ${isToolbarHidden ? "bg-orange-100 text-orange-600 hover:bg-orange-200" : "bg-white/50 text-slate-500 hover:bg-white"} rounded-xl transition-all shadow-sm`}
                title={
                  isToolbarHidden
                    ? "Show Toolbar"
                    : "Full Screen (Hide Toolbar)"
                }
              >
                {isToolbarHidden ? (
                  <Minimize2 size={18} />
                ) : (
                  <Maximize2 size={18} />
                )}
              </button>
            </div>

            {!isToolbarHidden && (
              <div className="flex flex-col gap-1.5 md:gap-2 p-1.5 md:p-2 border-b border-[rgba(255,255,255,0.2)] sticky top-0 bg-white/30 backdrop-blur-xl z-20 rounded-xl overflow-hidden shrink-0">
                <div className="flex gap-1.5 md:gap-2 items-center overflow-x-auto hide-scrollbar pb-0.5 min-w-0">
                  <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0 items-center">
                    <select
                      onChange={(e) => {
                        const font = e.target.value;
                        const selection = window.getSelection();
                        if (
                          selection &&
                          selection.rangeCount > 0 &&
                          !selection.isCollapsed
                        ) {
                          const range = selection.getRangeAt(0);
                          const span = document.createElement("span");
                          span.style.fontFamily = font;
                          try {
                            span.appendChild(range.extractContents());
                            range.insertNode(span);
                            selection.removeAllRanges();
                            const newRange = document.createRange();
                            newRange.selectNodeContents(span);
                            selection.addRange(newRange);
                          } catch {
                            document.execCommand("styleWithCSS", false, "true");
                            document.execCommand("fontName", false, font);
                          }
                          if (editorRef.current && selectedTopic) {
                            updateTopic(selectedTopic.id, {
                              content: editorRef.current.innerHTML,
                            });
                          }
                          const el = document.activeElement as HTMLElement;
                          el?.dispatchEvent(
                            new Event("input", { bubbles: true }),
                          );
                        }
                      }}
                      className="bg-white px-2 py-1 rounded text-[10px] font-bold border-none outline-none cursor-pointer hover:bg-slate-50 transition-colors"
                      title="Font Family"
                    >
                      {fontFamilies.map((f) => (
                        <option
                          key={f.value}
                          value={f.value}
                          style={{ fontFamily: f.value }}
                        >
                          {f.name}
                        </option>
                      ))}
                    </select>

                    <div className="w-px h-6 bg-black/5 mx-1" />

                    <select
                      onChange={(e) => {
                        const size = e.target.value;
                        const selection = window.getSelection();
                        if (
                          selection &&
                          selection.rangeCount > 0 &&
                          !selection.isCollapsed
                        ) {
                          const range = selection.getRangeAt(0);
                          const span = document.createElement("span");
                          span.style.fontSize = `${size}px`;
                          try {
                            span.appendChild(range.extractContents());
                            range.insertNode(span);
                            selection.removeAllRanges();
                            const newRange = document.createRange();
                            newRange.selectNodeContents(span);
                            selection.addRange(newRange);
                          } catch {
                            document.execCommand("styleWithCSS", false, "true");
                            document.execCommand("fontSize", false, "3");
                          }
                          if (editorRef.current && selectedTopic) {
                            updateTopic(selectedTopic.id, {
                              content: editorRef.current.innerHTML,
                            });
                          }
                          const el = document.activeElement as HTMLElement;
                          el?.dispatchEvent(
                            new Event("input", { bubbles: true }),
                          );
                        }
                      }}
                      className="bg-white px-2 py-1 rounded text-[10px] font-bold border-none outline-none cursor-pointer hover:bg-slate-50 transition-colors w-14"
                      title="Font Size"
                    >
                      {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map(
                        (s) => (
                          <option key={s} value={s}>
                            {s}px
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="h-6 w-px bg-white/30 mx-1 shrink-0" />

                  <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                    <button
                      className="p-1.5 hover:bg-white rounded transition-colors text-slate-700"
                      title="Add Box"
                      onClick={() => {
                        const html = `<div style="border: 2px solid #e2e8f0; padding: 20px; border-radius: 16px; margin: 15px 0; background: rgba(255,255,255,0.3);">Box Content...</div><p><br></p>`;
                        document.execCommand("insertHTML", false, html);
                      }}
                    >
                      <Square size={16} />
                    </button>

                    <button
                      className="p-1.5 hover:bg-white rounded transition-colors text-slate-700"
                      title="Add Callout Block"
                      onClick={() => {
                        const html = `<div style="background: rgba(248,250,252,0.8); border-left: 6px solid #64748b; padding: 16px; border-radius: 8px; margin: 15px 0; font-style: italic; color: #334155;">Block information...</div><p><br></p>`;
                        document.execCommand("insertHTML", false, html);
                      }}
                    >
                      <Quote size={16} />
                    </button>

                    <button
                      className="p-1.5 hover:bg-white rounded transition-colors text-slate-700"
                      title="Add Divider"
                      onClick={() => {
                        const html = `<hr style="border: none; border-top: 2px solid rgba(0,0,0,0.1); margin: 25px 0;"><p><br></p>`;
                        document.execCommand("insertHTML", false, html);
                      }}
                    >
                      <Minus size={16} />
                    </button>

                    <button
                      className="p-1.5 hover:bg-white rounded transition-colors text-slate-700"
                      title="Add 2-Column Grid"
                      onClick={() => {
                        const html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;"><div style="border: 1px dashed rgba(0,0,0,0.1); padding: 15px; border-radius: 12px;">Column 1</div><div style="border: 1px dashed rgba(0,0,0,0.1); padding: 15px; border-radius: 12px;">Column 2</div></div><p><br></p>`;
                        document.execCommand("insertHTML", false, html);
                      }}
                    >
                      <Layout size={16} />
                    </button>

                    <button
                      className="p-1.5 hover:bg-orange-500 hover:text-white rounded transition-all text-slate-700 font-bold flex items-center gap-1 px-2"
                      title="Smart Table Builder"
                      onClick={() => setIsTableModalOpen(true)}
                    >
                      <Table size={16} />
                      <span className="hidden sm:inline text-[10px] uppercase">
                        Table
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-1.5 md:gap-2 items-center overflow-x-auto hide-scrollbar pt-0.5 border-t border-white/20 mt-0.5 min-w-0">

                <div className="h-6 w-px bg-white/30 mx-1" />

                <select
                  value={selectedTopic.paperStyle || "none"}
                  onChange={(e) =>
                    updateTopic(selectedTopic.id, {
                      paperStyle: e.target.value,
                    })
                  }
                  className="bg-white/40 px-2 py-1.5 rounded-lg text-[10px] font-bold border-none outline-none cursor-pointer hover:bg-white/60 transition-colors uppercase shrink-0"
                  title="Topic Paper Style"
                >
                  <option value="none">Default Paper</option>
                  {PAPER_STYLES.filter((p) => p.id !== "none").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {selectedTopic.content &&
                  selectedTopic.content.includes("-col-wrapper") && (
                    <div
                      className="flex items-center gap-1 bg-white/40 px-2 py-1.5 rounded-lg shrink-0"
                      title="Adjust spacing between grid columns"
                    >
                      <Columns size={12} className="text-slate-600" />
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="4"
                        value={selectedTopic.gridSpacing ?? 12}
                        onChange={(e) =>
                          updateTopic(selectedTopic.id, {
                            gridSpacing: parseInt(e.target.value),
                          })
                        }
                        className="w-16 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                <button
                  onClick={() => toggleDropdown("moreTools")}
                  className={`p-1.5 rounded-lg font-black text-[10px] uppercase transition-all flex items-center gap-1 ${showMoreTools ? "bg-orange-500 text-white shadow-lg" : "bg-white/40 text-slate-600 hover:bg-white/60"}`}
                >
                  <Settings2
                    size={14}
                    className={showMoreTools ? "animate-spin-slow" : ""}
                  />
                  {showMoreTools ? (
                    <span className="hidden sm:inline">Hide</span>
                  ) : (
                    <span className="hidden sm:inline">More</span>
                  )}
                </button>

                <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      document.execCommand("undo");
                    }}
                    className="p-1.5 hover:bg-white rounded text-slate-600 transition-colors"
                    title="Undo"
                  >
                    <Undo size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      document.execCommand("redo");
                    }}
                    className="p-1.5 hover:bg-white rounded text-slate-600 transition-colors"
                    title="Redo"
                  >
                    <Redo size={14} />
                  </button>
                </div>

                <button
                  onClick={enhanceWithAI}
                  onMouseDown={(e) => e.preventDefault()}
                  disabled={isAILoading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-600 shadow-sm transition-colors disabled:opacity-50 font-sans"
                  title="Highlight/select some text first to only enhance that selection, or do not select anything to enhance the entire note."
                >
                  {isAILoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wand2 size={14} />
                  )}
                  <span className="hidden sm:inline">AI Enhance</span>
                </button>

                <div className="h-6 w-px bg-white/30 mx-1" />

                <div className="relative z-[203]">
                  <button
                    onClick={() => toggleDropdown("pageOptions")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shrink-0 ${showPageOptions ? "bg-orange-500 border-orange-600 text-white shadow-md" : "bg-white/40 border-white/20 text-slate-700 hover:bg-white/60"}`}
                    title="Page & View Options"
                  >
                    <Settings2
                      size={14}
                      className={showPageOptions ? "animate-spin-slow" : ""}
                    />
                    <span className="hidden sm:inline">Options</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-200 ${showPageOptions ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showPageOptions && (
                    <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 flex flex-col gap-2 z-[300] animate-in slide-in-from-top-2 duration-150">
                      <div className="px-2 py-1 text-[10px] font-black text-slate-400 border-b border-slate-50 uppercase tracking-wider">
                        Display & Tools
                      </div>

                      <button
                        onClick={() => {
                          setIsTableResizeLocked(!isTableResizeLocked);
                          setShowPageOptions(false);
                        }}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          {isTableResizeLocked ? (
                            <Lock size={14} className="text-slate-400" />
                          ) : (
                            <Unlock size={14} className="text-orange-500" />
                          )}
                          <span className="text-xs font-bold text-slate-700">
                            Column Resizing
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isTableResizeLocked ? "bg-slate-100 text-slate-500" : "bg-orange-100 text-orange-600"}`}
                        >
                          {isTableResizeLocked ? "Locked" : "Unlocked"}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setShowRuler(!showRuler);
                          setShowPageOptions(false);
                        }}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Ruler
                            size={14}
                            className={
                              showRuler ? "text-orange-600" : "text-slate-400"
                            }
                          />
                          <span className="text-xs font-bold text-slate-700">
                            Ruler Guides
                          </span>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${showRuler ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500"}`}
                        >
                          {showRuler ? "ON" : "OFF"}
                        </span>
                      </button>

                      <div className="h-px bg-slate-100 my-0.5" />

                      <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                        <FileUp size={14} className="text-blue-500" />
                        <span className="text-xs font-bold text-slate-700">
                          Upload File
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,image/*,audio/*,video/*"
                          onChange={(e) => {
                            handleFileUpload(e);
                            setShowPageOptions(false);
                          }}
                          className="hidden"
                        />
                      </label>

                      {selectedTopic && (
                        <button
                          onClick={() => {
                            handleShareTopic(selectedTopic);
                            setShowPageOptions(false);
                          }}
                          disabled={sharingTopicId === selectedTopic.id}
                          className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-xl text-slate-700 transition-colors w-full"
                        >
                          <Share2
                            size={14}
                            className={`text-orange-500 ${sharingTopicId === selectedTopic.id ? "animate-spin" : ""}`}
                          />
                          <span className="text-xs font-bold">Share Topic</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setForceLightBg(!forceLightBg);
                          setShowPageOptions(false);
                        }}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors w-full"
                      >
                        <div className="flex items-center gap-2">
                          <GraduationCap
                            size={14}
                            className={
                              forceLightBg
                                ? "text-emerald-500"
                                : "text-slate-400"
                            }
                          />
                          <span className="text-xs font-bold text-slate-700">
                            Plain Light Mode
                          </span>
                        </div>
                        <div
                          className={`w-8 h-4 rounded-full relative transition-colors ${forceLightBg ? "bg-emerald-500" : "bg-slate-200"}`}
                        >
                          <div
                            className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${forceLightBg ? "left-4.5" : "left-0.5"}`}
                          />
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-6 w-px bg-white/30 mx-1" />

                {showMoreTools && (
                  <div className="flex items-center gap-1.5 md:gap-2 shrink-0 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="h-6 w-px bg-white/30 mx-1 shrink-0" />
                    <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                      <div className="relative group/list z-[150] hover:z-[300]">
                        <button
                          className="p-1.5 hover:bg-white rounded transition-colors text-slate-700 font-bold text-xs flex items-center gap-1"
                          title="Bullets"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <List size={14} />{" "}
                          <span className="text-[10px]">▼</span>
                        </button>
                        <div className="absolute hidden group-hover/list:grid grid-cols-5 gap-1 top-full left-0 bg-white shadow-xl border border-slate-200 p-2 rounded-xl z-[9999] w-[180px]">
                          {(
                            selectedTopic?.customBullets || [
                              "•",
                              "🌹",
                              "⭐",
                              "🚗",
                              "❤️",
                              "✅",
                              "✨",
                              "🔥",
                              "🔮",
                              "🍃",
                              "🎵",
                              "👑",
                              "☀️",
                              "🌙",
                              "💎",
                            ]
                          ).map((marker) => (
                            <button
                              key={marker}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={() => {
                                document.execCommand("insertUnorderedList");
                                if (marker !== "•") {
                                  setTimeout(() => {
                                    const sel = window.getSelection();
                                    if (sel && sel.rangeCount > 0) {
                                      const parentEl =
                                        sel.anchorNode?.nodeType ===
                                        Node.ELEMENT_NODE
                                          ? (sel.anchorNode as HTMLElement)
                                          : sel.anchorNode?.parentElement;
                                      const ul = parentEl?.closest?.("ul");
                                      if (ul) {
                                        (
                                          ul as HTMLElement
                                        ).style.listStyleType = `"${marker} "`;
                                      }
                                    }
                                    updateTopic(selectedTopic.id, {
                                      content:
                                        editorRef.current?.innerHTML || "",
                                    });
                                  }, 10);
                                }
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-center text-sm"
                            >
                              {marker}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="relative group/list2 z-[150] hover:z-[300]">
                        <button
                          className="p-1.5 hover:bg-white rounded transition-colors text-slate-700 font-bold text-xs flex items-center gap-1"
                          title="Numbers"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <ListOrdered size={14} />{" "}
                          <span className="text-[10px]">▼</span>
                        </button>
                        <div className="absolute hidden group-hover/list2:flex flex-col gap-1 top-full left-0 bg-white shadow-xl border border-slate-200 p-2 rounded-xl z-[9999] w-[120px]">
                          {[
                            { n: "1.", t: "decimal" },
                            { n: "1)", t: "ol" },
                            { n: "1-", t: "ol" },
                            { n: "I.", t: "upper-roman" },
                            { n: "i.", t: "lower-roman" },
                            { n: "A.", t: "upper-alpha" },
                            { n: "a.", t: "lower-alpha" },
                            { n: "①", t: "ol" },
                          ].map((marker) => (
                            <button
                              key={marker.n}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={() => {
                                document.execCommand("insertOrderedList");
                                setTimeout(() => {
                                  const sel = window.getSelection();
                                  if (sel && sel.rangeCount > 0) {
                                    let node = sel.anchorNode;
                                    while (
                                      node &&
                                      node.nodeName !== "OL" &&
                                      node.nodeName !== "DIV"
                                    ) {
                                      node = node.parentNode;
                                    }
                                    if (node && node.nodeName === "OL") {
                                      if (marker.t === "ol") {
                                        (
                                          node as HTMLElement
                                        ).style.listStyleType = "decimal";
                                      } else {
                                        (
                                          node as HTMLElement
                                        ).style.listStyleType = marker.t;
                                      }
                                    }
                                  }
                                  updateTopic(selectedTopic.id, {
                                    content: editorRef.current?.innerHTML || "",
                                  });
                                }, 10);
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-left text-xs font-bold"
                            >
                              {marker.n} Type
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="relative group/list3 z-[150] hover:z-[300]">
                        <button
                          className="p-1.5 hover:bg-white rounded transition-colors text-slate-700 font-bold text-xs flex items-center gap-1"
                          title="Checklist"
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <CheckSquare size={14} />{" "}
                          <span className="text-[10px]">▼</span>
                        </button>
                        <div className="absolute hidden group-hover/list3:grid grid-cols-2 gap-1 top-full left-0 bg-white shadow-xl border border-slate-200 p-2 rounded-xl z-[9999] w-[140px]">
                          {(
                            selectedTopic?.customChecklists || [
                              "⬜",
                              "[ ]",
                              "🔳",
                              "⚪",
                              "🔴",
                              "❎",
                              "✓",
                            ]
                          ).map((marker, idx) => (
                            <button
                              key={idx}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={() => {
                                document.execCommand("insertUnorderedList");
                                setTimeout(() => {
                                  const sel = window.getSelection();
                                  if (sel && sel.rangeCount > 0) {
                                    const parentEl =
                                      sel.anchorNode?.nodeType ===
                                      Node.ELEMENT_NODE
                                        ? (sel.anchorNode as HTMLElement)
                                        : sel.anchorNode?.parentElement;
                                    const ul = parentEl?.closest?.("ul");
                                    if (ul) {
                                      (ul as HTMLElement).style.listStyleType =
                                        "none";
                                      (ul as HTMLElement).style.paddingLeft =
                                        "20px";

                                      const li = parentEl?.closest?.("li");
                                      if (li) {
                                        (li as HTMLElement).style.display =
                                          "flex";
                                        (li as HTMLElement).style.gap = "8px";
                                        (li as HTMLElement).style.alignItems =
                                          "flex-start";

                                        // Remove any pre-existing task-checkbox inside this li to avoid stacking
                                        const existingCh =
                                          li.querySelector(".task-checkbox");
                                        if (existingCh) {
                                          existingCh.remove();
                                        }

                                        const checkboxSpan =
                                          document.createElement("span");
                                        checkboxSpan.contentEditable = "false";
                                        checkboxSpan.className =
                                          "task-checkbox";
                                        checkboxSpan.style.cursor = "pointer";
                                        checkboxSpan.style.userSelect = "none";
                                        checkboxSpan.innerText = marker;

                                        li.insertBefore(
                                          checkboxSpan,
                                          li.firstChild,
                                        );
                                      }
                                    }
                                  }
                                  updateTopic(selectedTopic.id, {
                                    content: editorRef.current?.innerHTML || "",
                                  });
                                }, 10);
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-center text-xs"
                              dangerouslySetInnerHTML={{ __html: marker }}
                            ></button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="h-6 w-px bg-white/30 mx-1" />

                    <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                      <button
                        className="p-1.5 hover:bg-white rounded transition-colors"
                        title="Outdent"
                        onClick={() => document.execCommand("outdent")}
                      >
                        <Outdent size={14} />
                      </button>
                      <button
                        className="p-1.5 hover:bg-white rounded transition-colors"
                        title="Indent"
                        onClick={() => document.execCommand("indent")}
                      >
                        <Indent size={14} />
                      </button>
                    </div>

                    <div className="h-6 w-px bg-white/30 mx-1" />

                    <div className="flex gap-1 bg-white/40 p-1 rounded-lg shrink-0">
                      <button
                        className="p-1.5 hover:bg-white rounded transition-colors"
                        title="Align Left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          document.execCommand("justifyLeft");
                          updateTopic(selectedTopic.id, {
                            content: editorRef.current?.innerHTML || "",
                          });
                        }}
                      >
                        <AlignLeft size={16} />
                      </button>
                      <button
                        className="p-1.5 hover:bg-white rounded transition-colors"
                        title="Align Center"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          document.execCommand("justifyCenter");
                          updateTopic(selectedTopic.id, {
                            content: editorRef.current?.innerHTML || "",
                          });
                        }}
                      >
                        <AlignCenter size={16} />
                      </button>
                      <button
                        className="p-1.5 hover:bg-white rounded transition-colors"
                        title="Align Right"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          document.execCommand("justifyRight");
                          updateTopic(selectedTopic.id, {
                            content: editorRef.current?.innerHTML || "",
                          });
                        }}
                      >
                        <AlignRight size={16} />
                      </button>
                    </div>

                    <div className="h-6 w-px bg-white/30 mx-1" />

                    {/* Table Tools Dropdown */}
                    <div className="relative z-[200]">
                      <button
                        onClick={() => toggleDropdown("tableTools")}
                        className="flex items-center gap-1.5 px-2 py-1 bg-white/40 hover:bg-white text-slate-700 rounded-lg text-xs font-bold transition-all"
                        title="Table Tools"
                      >
                        <Grid3X3 size={14} className="text-orange-600" />
                        <span className="hidden sm:inline">Table Tools</span>
                        <ChevronDown
                          size={12}
                          className={`transition-transform duration-200 ${showTableToolsMenu ? "rotate-180" : ""}`}
                        />
                      </button>

                      {showTableToolsMenu && (
                        <div className="absolute right-0 top-full mt-2 z-[250] w-52 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                          {activeTableCell ? (
                            <>
                              <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                Word-Style Controls
                              </div>
                              <div className="grid grid-cols-2 gap-1 col-span-2">
                                <button
                                  onClick={() => {
                                    addRow("above");
                                    setShowTableToolsMenu(false);
                                  }}
                                  className="flex items-center gap-1.5 p-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                >
                                  <ArrowUp
                                    size={12}
                                    className="text-orange-500"
                                  />
                                  Row Up
                                </button>
                                <button
                                  onClick={() => {
                                    addRow("below");
                                    setShowTableToolsMenu(false);
                                  }}
                                  className="flex items-center gap-1.5 p-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                >
                                  <ArrowDown
                                    size={12}
                                    className="text-orange-500"
                                  />
                                  Row Down
                                </button>
                                <button
                                  onClick={() => {
                                    addColumn("left");
                                    setShowTableToolsMenu(false);
                                  }}
                                  className="flex items-center gap-1.5 p-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                >
                                  <ArrowLeft
                                    size={12}
                                    className="text-orange-500"
                                  />
                                  Col Left
                                </button>
                                <button
                                  onClick={() => {
                                    addColumn("right");
                                    setShowTableToolsMenu(false);
                                  }}
                                  className="flex items-center gap-1.5 p-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                >
                                  <ArrowRight
                                    size={12}
                                    className="text-orange-500"
                                  />
                                  Col Right
                                </button>
                              </div>
                              <div className="h-px bg-slate-100 my-0.5" />
                              <div className="grid grid-cols-2 gap-1 col-span-2">
                                <button
                                  onClick={() => {
                                    deleteTableElement("row");
                                    setShowTableToolsMenu(false);
                                  }}
                                  className="flex items-center gap-1.5 p-1.5 hover:bg-red-50 text-red-600 rounded-xl transition-colors font-bold text-xs"
                                >
                                  <Trash2 size={12} className="text-red-500" />
                                  Del Row
                                </button>
                                <button
                                  onClick={() => {
                                    deleteTableElement("col");
                                    setShowTableToolsMenu(false);
                                  }}
                                  className="flex items-center gap-1.5 p-1.5 hover:bg-red-50 text-red-600 rounded-xl transition-colors font-bold text-xs"
                                >
                                  <Trash2
                                    size={12}
                                    className="text-red-500 rotate-90"
                                  />
                                  Del Col
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="p-3 text-center text-xs text-slate-500 font-bold leading-relaxed">
                              <Grid3X3
                                size={20}
                                className="mx-auto mb-2 text-slate-400"
                              />
                              💡 Click inside any table first to add/delete rows
                              & columns!
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  <div className="relative z-[200]">
                    <button
                      onClick={() => toggleDropdown("export")}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all font-sans"
                      title="Export notes"
                    >
                      <Download size={14} />
                      Export
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 ${showExportMenu ? "rotate-180" : ""}`}
                      />
                    </button>

                    {showExportMenu && (
                      <div className="absolute right-0 top-full mt-2 z-[250] w-[180px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 flex flex-col gap-1 animate-in slide-in-from-top-2 duration-150">
                        <button
                          onClick={() => {
                            exportWord();
                            setShowExportMenu(false);
                          }}
                          className="flex items-center justify-between w-full text-left px-3 py-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl transition-colors font-bold text-xs"
                        >
                          <span className="flex items-center gap-2">
                            <FileText size={14} className="text-blue-500" /> MS
                            Word (.doc)
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setShowExportStyleModal(true);
                            setShowExportMenu(false);
                          }}
                          className="flex items-center justify-between w-full text-left px-3 py-2 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-xl transition-colors font-bold text-xs"
                        >
                          <span className="flex items-center gap-2">
                            <FileDown size={14} className="text-red-500" /> PDF
                            Document
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Table Tools Dropdown */}
                  <div className="relative z-[200]">
                    <button
                      onClick={() => toggleDropdown("tableTools")}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all font-sans"
                      title="Table Tools"
                    >
                      <Grid3X3 size={14} className="text-orange-600" />
                      Table Tools
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 ${showTableToolsMenu ? "rotate-180" : ""}`}
                      />
                    </button>

                    {showTableToolsMenu && (
                      <div className="absolute left-0 top-full mt-2 z-[250] w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150">
                        {activeTableCell ? (
                          <>
                            <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Word-Style Controls
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                onClick={() => {
                                  addRow("above");
                                  setShowTableToolsMenu(false);
                                }}
                                className="flex items-center gap-1.5 p-2 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                title="Insert Row Above"
                              >
                                <ArrowUp
                                  size={12}
                                  className="text-orange-500"
                                />
                                Row Above
                              </button>
                              <button
                                onClick={() => {
                                  addRow("below");
                                  setShowTableToolsMenu(false);
                                }}
                                className="flex items-center gap-1.5 p-2 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                title="Insert Row Below"
                              >
                                <ArrowDown
                                  size={12}
                                  className="text-orange-500"
                                />
                                Row Below
                              </button>
                              <button
                                onClick={() => {
                                  addColumn("left");
                                  setShowTableToolsMenu(false);
                                }}
                                className="flex items-center gap-1.5 p-2 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                title="Insert Column Left"
                              >
                                <ArrowLeft
                                  size={12}
                                  className="text-orange-500"
                                />
                                Col Left
                              </button>
                              <button
                                onClick={() => {
                                  addColumn("right");
                                  setShowTableToolsMenu(false);
                                }}
                                className="flex items-center gap-1.5 p-2 hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-xl transition-colors font-bold text-xs"
                                title="Insert Column Right"
                              >
                                <ArrowRight
                                  size={12}
                                  className="text-orange-500"
                                />
                                Col Right
                              </button>
                            </div>
                            <div className="h-px bg-slate-100 my-0.5" />
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                onClick={() => {
                                  deleteTableElement("row");
                                  setShowTableToolsMenu(false);
                                }}
                                className="flex items-center gap-1.5 p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors font-bold text-xs"
                                title="Delete Row"
                              >
                                <Trash2 size={12} className="text-red-500" />
                                Delete Row
                              </button>
                              <button
                                onClick={() => {
                                  deleteTableElement("col");
                                  setShowTableToolsMenu(false);
                                }}
                                className="flex items-center gap-1.5 p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors font-bold text-xs"
                                title="Delete Column"
                              >
                                <Trash2
                                  size={12}
                                  className="text-red-500 rotate-90"
                                />
                                Delete Col
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-500 font-bold leading-relaxed">
                            <Grid3X3
                              size={20}
                              className="mx-auto mb-2 text-slate-400"
                            />
                            💡 Click inside any table first to add/delete rows &
                            columns!
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Formatting tools etc handled elsewhere or already visible */}
                  <div className="relative z-[200]">
                    <button
                      onClick={() => toggleDropdown("more")}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition-all font-sans"
                      title="More Actions & Layouts"
                    >
                      <MoreHorizontal size={14} />
                      More
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 ${showMoreMenu ? "rotate-180" : ""}`}
                      />
                    </button>

                    {showMoreMenu && (
                      <>
                        {/* Backdrop overlay only visible on touch/mobile viewports to dismiss */}
                        <div
                          className="md:hidden fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-[999]"
                          onClick={() => setShowMoreMenu(false)}
                        />

                        <div className="fixed md:absolute inset-x-4 bottom-4 md:bottom-auto md:inset-x-auto md:right-0 md:top-full md:mt-2 z-[1000] md:w-[225px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 flex flex-col gap-4 animate-in slide-in-from-bottom-5 md:slide-in-from-top-2 duration-150 max-h-[60vh] md:max-h-[350px] overflow-y-auto custom-scrollbar">
                          <div className="flex items-center justify-between px-2 py-1.5 bg-indigo-50/50 dark:bg-indigo-950/25 rounded-md gap-2 select-none">
                            <span className="text-[9px] font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                              <Wand2
                                size={11}
                                className="text-indigo-500 animate-pulse"
                              />{" "}
                              Smart Show
                            </span>
                            <input
                              type="checkbox"
                              checked={sidebarFilter === "smart"}
                              onChange={(e) =>
                                setSidebarFilter(
                                  e.target.checked ? "smart" : "files",
                                )
                              }
                              className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-400 border-slate-300 cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase text-indigo-400 tracking-wider mb-2 flex items-center gap-1.5">
                              <Wand2 size={12} className="text-indigo-500" />
                              AI Assist
                            </div>
                            <button
                              onClick={() => {
                                enhanceWithAI();
                                setShowMoreMenu(false);
                              }}
                              disabled={isAILoading}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-50 text-indigo-700 rounded-xl transition-all font-black text-[11px] uppercase tracking-wider"
                            >
                              {isAILoading ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Wand2 size={12} />
                              )}
                              AI Enhance Note
                            </button>
                          </div>

                          <div className="h-px bg-slate-100" />

                          <div>
                            <div className="text-[10px] font-black uppercase text-blue-400 tracking-wider mb-2 flex items-center gap-1.5">
                              <FileUp size={12} className="text-blue-500" />
                              Media & Files
                            </div>
                            <button
                              onClick={() => {
                                fileInputRef.current?.click();
                                setShowMoreMenu(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 text-blue-700 rounded-xl transition-all font-black text-[11px] uppercase tracking-wider"
                            >
                              <FileUp size={12} />
                              Upload File
                            </button>
                          </div>

                          <div className="h-px bg-slate-100" />

                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                              <Layout size={12} className="text-slate-500" />
                              Insert Synthesis Card
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[
                                {
                                  key: "blue",
                                  color: "bg-blue-500",
                                  border: "border-blue-200",
                                  bg: "bg-blue-50",
                                  name: "Blue",
                                },
                                {
                                  key: "emerald",
                                  color: "bg-emerald-500",
                                  border: "border-emerald-200",
                                  bg: "bg-emerald-50",
                                  name: "Emerald",
                                },
                                {
                                  key: "rose",
                                  color: "bg-rose-500",
                                  border: "border-rose-200",
                                  bg: "bg-rose-50",
                                  name: "Rose",
                                },
                                {
                                  key: "gold",
                                  color: "bg-yellow-400",
                                  border: "border-yellow-200",
                                  bg: "bg-yellow-50",
                                  name: "Gold",
                                },
                                {
                                  key: "violet",
                                  color: "bg-purple-500",
                                  border: "border-purple-200",
                                  bg: "bg-purple-50",
                                  name: "Violet",
                                },
                                {
                                  key: "orange",
                                  color: "bg-orange-500",
                                  border: "border-orange-200",
                                  bg: "bg-orange-50",
                                  name: "Orange",
                                },
                                {
                                  key: "teal",
                                  color: "bg-teal-500",
                                  border: "border-teal-200",
                                  bg: "bg-teal-50",
                                  name: "Teal",
                                },
                                {
                                  key: "fuchsia",
                                  color: "bg-fuchsia-500",
                                  border: "border-fuchsia-200",
                                  bg: "bg-fuchsia-50",
                                  name: "Fuchsia",
                                },
                                {
                                  key: "sky",
                                  color: "bg-sky-500",
                                  border: "border-sky-200",
                                  bg: "bg-sky-50",
                                  name: "Sky",
                                },
                                {
                                  key: "slate",
                                  color: "bg-slate-500",
                                  border: "border-slate-300",
                                  bg: "bg-slate-50",
                                  name: "Slate",
                                },
                              ].map((theme) => (
                                <button
                                  key={theme.key}
                                  onClick={() => {
                                    insertSynthesisCard(theme.key);
                                    setShowMoreMenu(false);
                                  }}
                                  className={`w-7 h-7 rounded-full border ${theme.border} ${theme.bg} flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-in zoom-in-50 duration-200`}
                                  title={`${theme.name} Synthesis Card`}
                                >
                                  <span
                                    className={`w-3 h-3 rounded-full ${theme.color}`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-slate-100" />

                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                              <CheckSquare
                                size={12}
                                className="text-slate-600"
                              />
                              Insert Q&A Board
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[
                                {
                                  key: "slate",
                                  color: "bg-slate-500",
                                  border: "border-slate-200",
                                  bg: "bg-slate-50",
                                  name: "Slate",
                                },
                                {
                                  key: "emerald",
                                  color: "bg-emerald-500",
                                  border: "border-emerald-200",
                                  bg: "bg-emerald-50",
                                  name: "Emerald",
                                },
                                {
                                  key: "indigo",
                                  color: "bg-indigo-500",
                                  border: "border-indigo-200",
                                  bg: "bg-indigo-50",
                                  name: "Indigo",
                                },
                                {
                                  key: "amber",
                                  color: "bg-amber-500",
                                  border: "border-amber-200",
                                  bg: "bg-amber-50",
                                  name: "Amber",
                                },
                                {
                                  key: "purple",
                                  color: "bg-purple-500",
                                  border: "border-purple-200",
                                  bg: "bg-purple-50",
                                  name: "Purple",
                                },
                                {
                                  key: "rose",
                                  color: "bg-rose-500",
                                  border: "border-rose-200",
                                  bg: "bg-rose-50",
                                  name: "Rose",
                                },
                                {
                                  key: "sky",
                                  color: "bg-sky-500",
                                  border: "border-sky-200",
                                  bg: "bg-sky-50",
                                  name: "Sky",
                                },
                                {
                                  key: "teal",
                                  color: "bg-teal-500",
                                  border: "border-teal-200",
                                  bg: "bg-teal-50",
                                  name: "Teal",
                                },
                                {
                                  key: "orange",
                                  color: "bg-orange-500",
                                  border: "border-orange-200",
                                  bg: "bg-orange-50",
                                  name: "Orange",
                                },
                                {
                                  key: "cyan",
                                  color: "bg-cyan-500",
                                  border: "border-cyan-200",
                                  bg: "bg-cyan-50",
                                  name: "Cyan",
                                },
                              ].map((theme) => (
                                <button
                                  key={theme.key}
                                  onClick={() => {
                                    insertQABoard(theme.key);
                                    setShowMoreMenu(false);
                                  }}
                                  className={`w-7 h-7 rounded-full border ${theme.border} ${theme.bg} flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-in zoom-in-50 duration-200`}
                                  title={`${theme.name} Q&A Board`}
                                >
                                  <span
                                    className={`w-3 h-3 rounded-full ${theme.color}`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-slate-100" />

                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                              <Zap size={12} className="text-purple-500" />
                              Insert Brainstorm Map
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[
                                {
                                  key: "blue",
                                  color: "bg-blue-500",
                                  border: "border-blue-200",
                                  bg: "bg-blue-50",
                                  name: "Blue",
                                },
                                {
                                  key: "emerald",
                                  color: "bg-emerald-500",
                                  border: "border-emerald-200",
                                  bg: "bg-emerald-50",
                                  name: "Emerald",
                                },
                                {
                                  key: "rose",
                                  color: "bg-rose-500",
                                  border: "border-rose-200",
                                  bg: "bg-rose-50",
                                  name: "Rose",
                                },
                                {
                                  key: "gold",
                                  color: "bg-yellow-400",
                                  border: "border-yellow-200",
                                  bg: "bg-yellow-50",
                                  name: "Gold",
                                },
                                {
                                  key: "violet",
                                  color: "bg-purple-500",
                                  border: "border-purple-200",
                                  bg: "bg-purple-50",
                                  name: "Violet",
                                },
                                {
                                  key: "orange",
                                  color: "bg-orange-500",
                                  border: "border-orange-200",
                                  bg: "bg-orange-50",
                                  name: "Orange",
                                },
                                {
                                  key: "teal",
                                  color: "bg-teal-500",
                                  border: "border-teal-200",
                                  bg: "bg-teal-50",
                                  name: "Teal",
                                },
                                {
                                  key: "fuchsia",
                                  color: "bg-fuchsia-500",
                                  border: "border-fuchsia-200",
                                  bg: "bg-fuchsia-50",
                                  name: "Fuchsia",
                                },
                                {
                                  key: "sky",
                                  color: "bg-sky-500",
                                  border: "border-sky-200",
                                  bg: "bg-sky-50",
                                  name: "Sky",
                                },
                                {
                                  key: "slate",
                                  color: "bg-slate-500",
                                  border: "border-slate-300",
                                  bg: "bg-slate-50",
                                  name: "Slate",
                                },
                                {
                                  key: "indigo",
                                  color: "bg-indigo-500",
                                  border: "border-indigo-200",
                                  bg: "bg-indigo-50",
                                  name: "Indigo",
                                },
                                {
                                  key: "amber",
                                  color: "bg-amber-500",
                                  border: "border-amber-200",
                                  bg: "bg-amber-50",
                                  name: "Amber",
                                },
                              ].map((theme) => (
                                <button
                                  key={theme.key}
                                  onClick={() => {
                                    insertBrainstormCard(theme.key);
                                    setShowMoreMenu(false);
                                  }}
                                  className={`w-7 h-7 rounded-full border ${theme.border} ${theme.bg} flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-in zoom-in-50 duration-200`}
                                  title={`${theme.name} Brainstorm Map`}
                                >
                                  <span
                                    className={`w-3 h-3 rounded-full ${theme.color}`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-slate-100" />

                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                              <Columns size={12} className="text-emerald-500" />
                              Insert Pros & Cons Grid
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[
                                {
                                  key: "emerald",
                                  color: "bg-emerald-500",
                                  border: "border-emerald-200",
                                  bg: "bg-emerald-50",
                                  name: "Emerald",
                                },
                                {
                                  key: "rose",
                                  color: "bg-rose-500",
                                  border: "border-rose-200",
                                  bg: "bg-rose-50",
                                  name: "Rose",
                                },
                                {
                                  key: "blue",
                                  color: "bg-blue-500",
                                  border: "border-blue-200",
                                  bg: "bg-blue-50",
                                  name: "Blue",
                                },
                                {
                                  key: "slate",
                                  color: "bg-slate-500",
                                  border: "border-slate-300",
                                  bg: "bg-slate-50",
                                  name: "Slate",
                                },
                                {
                                  key: "violet",
                                  color: "bg-purple-500",
                                  border: "border-purple-200",
                                  bg: "bg-purple-50",
                                  name: "Violet",
                                },
                                {
                                  key: "gold",
                                  color: "bg-yellow-400",
                                  border: "border-yellow-200",
                                  bg: "bg-yellow-50",
                                  name: "Gold",
                                },
                                {
                                  key: "orange",
                                  color: "bg-orange-500",
                                  border: "border-orange-200",
                                  bg: "bg-orange-50",
                                  name: "Orange",
                                },
                                {
                                  key: "teal",
                                  color: "bg-teal-500",
                                  border: "border-teal-200",
                                  bg: "bg-teal-50",
                                  name: "Teal",
                                },
                                {
                                  key: "fuchsia",
                                  color: "bg-fuchsia-500",
                                  border: "border-fuchsia-200",
                                  bg: "bg-fuchsia-50",
                                  name: "Fuchsia",
                                },
                                {
                                  key: "sky",
                                  color: "bg-sky-500",
                                  border: "border-sky-200",
                                  bg: "bg-sky-50",
                                  name: "Sky",
                                },
                                {
                                  key: "indigo",
                                  color: "bg-indigo-500",
                                  border: "border-indigo-200",
                                  bg: "bg-indigo-50",
                                  name: "Indigo",
                                },
                                {
                                  key: "amber",
                                  color: "bg-amber-500",
                                  border: "border-amber-200",
                                  bg: "bg-amber-50",
                                  name: "Amber",
                                },
                              ].map((theme) => (
                                <button
                                  key={theme.key}
                                  onClick={() => {
                                    insertProsConsCard(theme.key);
                                    setShowMoreMenu(false);
                                  }}
                                  className={`w-7 h-7 rounded-full border ${theme.border} ${theme.bg} flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-in zoom-in-50 duration-200`}
                                  title={`${theme.name} Pros & Cons Grid`}
                                >
                                  <span
                                    className={`w-3 h-3 rounded-full ${theme.color}`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-slate-100" />

                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                              <LayoutGrid size={12} className="text-blue-500" />
                              Insert 3-Column Framework
                            </div>
                            <div className="grid grid-cols-5 gap-1.5 mb-4">
                              {[
                                {
                                  key: "emerald",
                                  color: "bg-emerald-500",
                                  border: "border-emerald-200",
                                  bg: "bg-emerald-50",
                                  name: "Emerald",
                                },
                                {
                                  key: "rose",
                                  color: "bg-rose-500",
                                  border: "border-rose-200",
                                  bg: "bg-rose-50",
                                  name: "Rose",
                                },
                                {
                                  key: "blue",
                                  color: "bg-blue-500",
                                  border: "border-blue-200",
                                  bg: "bg-blue-50",
                                  name: "Blue",
                                },
                                {
                                  key: "slate",
                                  color: "bg-slate-500",
                                  border: "border-slate-300",
                                  bg: "bg-slate-50",
                                  name: "Slate",
                                },
                                {
                                  key: "violet",
                                  color: "bg-purple-500",
                                  border: "border-purple-200",
                                  bg: "bg-purple-50",
                                  name: "Violet",
                                },
                                {
                                  key: "gold",
                                  color: "bg-yellow-400",
                                  border: "border-yellow-200",
                                  bg: "bg-yellow-50",
                                  name: "Gold",
                                },
                                {
                                  key: "orange",
                                  color: "bg-orange-500",
                                  border: "border-orange-200",
                                  bg: "bg-orange-50",
                                  name: "Orange",
                                },
                                {
                                  key: "teal",
                                  color: "bg-teal-500",
                                  border: "border-teal-200",
                                  bg: "bg-teal-50",
                                  name: "Teal",
                                },
                                {
                                  key: "fuchsia",
                                  color: "bg-fuchsia-500",
                                  border: "border-fuchsia-200",
                                  bg: "bg-fuchsia-50",
                                  name: "Fuchsia",
                                },
                                {
                                  key: "sky",
                                  color: "bg-sky-500",
                                  border: "border-sky-200",
                                  bg: "bg-sky-50",
                                  name: "Sky",
                                },
                              ].map((theme) => (
                                <button
                                  key={theme.key}
                                  onClick={() => {
                                    insertThreeColumnGrid(theme.key);
                                    setShowMoreMenu(false);
                                  }}
                                  className={`w-7 h-7 rounded-full border ${theme.border} ${theme.bg} flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-in zoom-in-50 duration-200`}
                                  title={`${theme.name} 3-Column Framework`}
                                >
                                  <span
                                    className={`w-3 h-3 rounded-full ${theme.color}`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-slate-100" />

                          <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                              <Grid3X3 size={12} className="text-purple-500" />
                              Insert 4-Column Matrix
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[
                                {
                                  key: "emerald",
                                  color: "bg-emerald-500",
                                  border: "border-emerald-200",
                                  bg: "bg-emerald-50",
                                  name: "Emerald",
                                },
                                {
                                  key: "rose",
                                  color: "bg-rose-500",
                                  border: "border-rose-200",
                                  bg: "bg-rose-50",
                                  name: "Rose",
                                },
                                {
                                  key: "blue",
                                  color: "bg-blue-500",
                                  border: "border-blue-200",
                                  bg: "bg-blue-50",
                                  name: "Blue",
                                },
                                {
                                  key: "slate",
                                  color: "bg-slate-500",
                                  border: "border-slate-300",
                                  bg: "bg-slate-50",
                                  name: "Slate",
                                },
                                {
                                  key: "violet",
                                  color: "bg-purple-500",
                                  border: "border-purple-200",
                                  bg: "bg-purple-50",
                                  name: "Violet",
                                },
                                {
                                  key: "gold",
                                  color: "bg-yellow-400",
                                  border: "border-yellow-200",
                                  bg: "bg-yellow-50",
                                  name: "Gold",
                                },
                                {
                                  key: "orange",
                                  color: "bg-orange-500",
                                  border: "border-orange-200",
                                  bg: "bg-orange-50",
                                  name: "Orange",
                                },
                                {
                                  key: "teal",
                                  color: "bg-teal-500",
                                  border: "border-teal-200",
                                  bg: "bg-teal-50",
                                  name: "Teal",
                                },
                                {
                                  key: "fuchsia",
                                  color: "bg-fuchsia-500",
                                  border: "border-fuchsia-200",
                                  bg: "bg-fuchsia-50",
                                  name: "Fuchsia",
                                },
                                {
                                  key: "sky",
                                  color: "bg-sky-500",
                                  border: "border-sky-200",
                                  bg: "bg-sky-50",
                                  name: "Sky",
                                },
                              ].map((theme) => (
                                <button
                                  key={theme.key}
                                  onClick={() => {
                                    insertFourColumnGrid(theme.key);
                                    setShowMoreMenu(false);
                                  }}
                                  className={`w-7 h-7 rounded-full border ${theme.border} ${theme.bg} flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-in zoom-in-50 duration-200`}
                                  title={`${theme.name} 4-Column Matrix`}
                                >
                                  <span
                                    className={`w-3 h-3 rounded-full ${theme.color}`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={insertDate}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm transition-colors min-w-[56px]"
                    title="Insert Date at Cursor"
                  >
                    <Calendar size={14} />{" "}
                    <span className="text-[9px] leading-none font-bold whitespace-nowrap">Date</span>
                  </button>

                  <button
                    onClick={() => generateEditorPlan("action")}
                    disabled={
                      isEditorActionPlanLoading || isEditorStudyPlanLoading
                    }
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 shadow-sm transition-colors disabled:opacity-50 min-w-[56px]"
                    title="Generate Action Plan below selected text"
                  >
                    {isEditorActionPlanLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Zap size={14} />
                    )}
                    <span className="text-[9px] leading-none font-bold whitespace-nowrap">Action Plan</span>
                  </button>

                  <button
                    onClick={() => generateEditorPlan("study")}
                    disabled={
                      isEditorActionPlanLoading || isEditorStudyPlanLoading
                    }
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 shadow-sm transition-colors disabled:opacity-50 min-w-[56px]"
                    title="Generate Study Plan below selected text"
                  >
                    {isEditorStudyPlanLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Wand2 size={14} />
                    )}
                    <span className="text-[9px] leading-none font-bold whitespace-nowrap">Study Plan</span>
                  </button>
                </div>
                </div>
              </div>
            )}

            {pickerPos &&
              (() => {
                const activeCard = getActiveCardElement();
                return (
                  <div
                    className="fixed z-50 bg-white/95 backdrop-blur p-2.5 rounded-2xl shadow-2xl border border-slate-100 flex gap-3 animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 items-center select-none"
                    style={{
                      left: pickerPos.x + pickerOffset.x,
                      top: pickerPos.y + pickerOffset.y,
                      transform: "translateX(-50%)",
                      cursor: isDraggingPicker ? "grabbing" : "grab",
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if ((e.target as HTMLElement).tagName !== "BUTTON") {
                        setIsDraggingPicker(true);
                        startDragPos.current = {
                          x: e.clientX - pickerOffset.x,
                          y: e.clientY - pickerOffset.y,
                        };
                      }
                    }}
                  >
                    {activeCard && (
                      <>
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Card Color
                          </span>
                          <div className="grid grid-cols-5 gap-1">
                            {activeCard.type === "synthesis" ? (
                              <>
                                {[
                                  {
                                    key: "blue",
                                    color: "bg-blue-500",
                                    name: "Blue (Default)",
                                  },
                                  {
                                    key: "emerald",
                                    color: "bg-emerald-500",
                                    name: "Emerald",
                                  },
                                  {
                                    key: "rose",
                                    color: "bg-rose-500",
                                    name: "Rose",
                                  },
                                  {
                                    key: "gold",
                                    color: "bg-yellow-400",
                                    name: "Gold",
                                  },
                                  {
                                    key: "violet",
                                    color: "bg-purple-500",
                                    name: "Violet",
                                  },
                                  {
                                    key: "orange",
                                    color: "bg-orange-500",
                                    name: "Orange",
                                  },
                                  {
                                    key: "teal",
                                    color: "bg-teal-500",
                                    name: "Teal",
                                  },
                                  {
                                    key: "fuchsia",
                                    color: "bg-fuchsia-500",
                                    name: "Fuchsia",
                                  },
                                  {
                                    key: "sky",
                                    color: "bg-sky-500",
                                    name: "Sky",
                                  },
                                  {
                                    key: "slate",
                                    color: "bg-slate-500",
                                    name: "Slate",
                                  },
                                ].map((theme) => (
                                  <button
                                    key={theme.key}
                                    onClick={() =>
                                      applyCardColor(
                                        activeCard.element,
                                        "synthesis",
                                        theme.key,
                                      )
                                    }
                                    className={`w-5 h-5 rounded-full border border-black/10 ${theme.color} hover:scale-115 transition-all`}
                                    title={theme.name}
                                  />
                                ))}
                              </>
                            ) : (
                              <>
                                {[
                                  {
                                    key: "slate",
                                    color: "bg-slate-500",
                                    name: "Slate (Default)",
                                  },
                                  {
                                    key: "emerald",
                                    color: "bg-emerald-500",
                                    name: "Emerald",
                                  },
                                  {
                                    key: "indigo",
                                    color: "bg-indigo-500",
                                    name: "Indigo",
                                  },
                                  {
                                    key: "amber",
                                    color: "bg-amber-500",
                                    name: "Amber",
                                  },
                                  {
                                    key: "purple",
                                    color: "bg-purple-500",
                                    name: "Purple",
                                  },
                                  {
                                    key: "rose",
                                    color: "bg-rose-500",
                                    name: "Rose",
                                  },
                                  {
                                    key: "sky",
                                    color: "bg-sky-500",
                                    name: "Sky",
                                  },
                                  {
                                    key: "teal",
                                    color: "bg-teal-500",
                                    name: "Teal",
                                  },
                                  {
                                    key: "orange",
                                    color: "bg-orange-500",
                                    name: "Orange",
                                  },
                                  {
                                    key: "cyan",
                                    color: "bg-cyan-500",
                                    name: "Cyan",
                                  },
                                ].map((theme) => (
                                  <button
                                    key={theme.key}
                                    onClick={() =>
                                      applyCardColor(
                                        activeCard.element,
                                        "qa",
                                        theme.key,
                                      )
                                    }
                                    className={`w-5 h-5 rounded-full border border-black/10 ${theme.color} hover:scale-115 transition-all`}
                                    title={theme.name}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="w-px h-5 bg-slate-200 self-center" />
                      </>
                    )}

                    <div className="flex gap-2 items-center">
                      <Palette size={14} className="text-slate-400 shrink-0" />
                      <div className="flex gap-1 flex-wrap items-center">
                        {(showAllTextColors
                          ? textColors
                          : textColors.slice(0, 6)
                        ).map((color) => (
                          <button
                            key={color.value}
                            className={`w-5 h-5 rounded-full border border-black/5 hover:scale-110 transition-transform cursor-pointer shrink-0 ${color.value === "transparent" ? "bg-slate-100 flex items-center justify-center" : ""}`}
                            style={{
                              backgroundColor:
                                color.value === "transparent"
                                  ? "transparent"
                                  : color.value,
                            }}
                            onClick={() => applyTextColor(color.value)}
                            title={color.name}
                          >
                            {color.value === "transparent" && (
                              <span className="text-[8px] font-black opacity-40">
                                ✕
                              </span>
                            )}
                          </button>
                        ))}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAllTextColors(!showAllTextColors);
                          }}
                          className="text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 bg-slate-100/80 hover:bg-slate-100 px-1.5 py-0.5 rounded-md transition-all shrink-0 ml-1 cursor-pointer"
                          title={
                            showAllTextColors ? "Show Less" : "Show More Colors"
                          }
                        >
                          {showAllTextColors ? "Less" : "More+"}
                        </button>
                      </div>
                    </div>
                    <div className="w-px h-5 bg-slate-200 self-center shrink-0" />
                    <div className="flex gap-2 items-center">
                      <Highlighter
                        size={14}
                        className="text-slate-400 shrink-0"
                      />
                      <div className="flex gap-1 flex-wrap items-center">
                        {(showAllHighlightColors
                          ? colors
                          : colors.slice(0, 6)
                        ).map((color) => (
                          <button
                            key={color.value}
                            className={`w-5 h-5 rounded-full border border-black/5 hover:scale-110 transition-transform cursor-pointer shrink-0 ${color.value === "transparent" ? "bg-slate-100 flex items-center justify-center" : ""}`}
                            style={{
                              backgroundColor:
                                color.value === "transparent"
                                  ? "transparent"
                                  : color.value,
                            }}
                            onClick={() => applyColor(color.value)}
                            title={color.name}
                          >
                            {color.value === "transparent" && (
                              <span className="text-[8px] font-black opacity-40">
                                ✕
                              </span>
                            )}
                          </button>
                        ))}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAllHighlightColors(!showAllHighlightColors);
                          }}
                          className="text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 bg-slate-100/80 hover:bg-slate-100 px-1.5 py-0.5 rounded-md transition-all shrink-0 ml-1 cursor-pointer"
                          title={
                            showAllHighlightColors
                              ? "Show Less"
                              : "Show More Colors"
                          }
                        >
                          {showAllHighlightColors ? "Less" : "More+"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            {(() => {
              const editorTextColor = "#1e293b";
              const editorHeaderColor = "#0f172a";
              const editorBorderColor = "#cbd5e1";
              const editorCardBgColor = forceLightBg
                ? "#ffffff"
                : "rgba(255, 255, 255, 0.95)";

              const activeTextFontFamily =
                selectedTopic?.textFontFamily || textFontFamily;
              const activeTextFontSize =
                selectedTopic?.textFontSize || textFontSize;
              const activeHeaderFontFamily =
                selectedTopic?.headerFontFamily || "Space Grotesk";
              const activeHeaderFontSize = selectedTopic?.headerFontSize || 20;

              return (
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                       .hide-native-scrollbar {
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                        overflow-y: scroll !important;
                        -webkit-overflow-scrolling: touch !important;
                      }
                      .hide-native-scrollbar::-webkit-scrollbar {
                        display: none !important;
                        width: 0 !important;
                        height: 0 !important;
                      }

                      .custom-scrollbar {
                        overflow-y: scroll !important;
                        -webkit-overflow-scrolling: auto !important;
                      }
                      .custom-scrollbar::-webkit-scrollbar {
                        -webkit-appearance: none !important;
                        width: 10px !important;
                        height: 10px !important;
                        display: block !important;
                      }
                      .custom-scrollbar::-webkit-scrollbar-track {
                        background: rgba(34, 197, 94, 0.08) !important;
                        border-radius: 10px !important;
                      }
                      .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: linear-gradient(180deg, #39ff14 0%, #22c55e 50%, #047857 100%) !important;
                        border-radius: 10px !important;
                        border: 2px solid transparent !important;
                        background-clip: padding-box !important;
                        min-height: 48px !important;
                      }
                      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: linear-gradient(180deg, #5dfd2d 0%, #16a34a 50%, #065f46 100%) !important;
                        box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
                      }

                      .editor-scrollbar {
                        overflow-y: scroll !important;
                        -webkit-overflow-scrolling: touch !important;
                      }
                      .editor-scrollbar::-webkit-scrollbar {
                        -webkit-appearance: none !important;
                        width: 8px !important;
                        display: block !important;
                      }
                      .editor-scrollbar::-webkit-scrollbar-track {
                        background: rgba(249, 115, 22, 0.05) !important;
                        border-radius: 8px !important;
                        margin-top: 24px;
                        margin-bottom: 24px;
                      }
                      .editor-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(249, 115, 22, 0.4) !important;
                        border-radius: 8px !important;
                        min-height: 40px !important;
                      }
                      .editor-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(249, 115, 22, 0.7) !important;
                      }

                      .editor-content {
                        color: ${editorTextColor};
                        font-family: "${activeTextFontFamily}", sans-serif !important;
                        font-size: ${activeTextFontSize}px !important;
                      }
                      
                      .editor-content p, 
                      .editor-content li, 
                      .editor-content div {
                        color: ${editorTextColor};
                        font-family: "${activeTextFontFamily}", sans-serif !important;
                        font-size: ${activeTextFontSize}px !important;
                      }
                      
                      .editor-content h1, 
                      .editor-content h2, 
                      .editor-content h3, 
                      .editor-content h4, 
                      .editor-content h5, 
                      .editor-content h6 {
                        color: ${editorHeaderColor} !important;
                        font-family: "${activeHeaderFontFamily}", sans-serif !important;
                        font-size: ${activeHeaderFontSize}px !important;
                        font-weight: 850 !important;
                      }
                      
                      .editor-content table {
                        border-collapse: collapse !important;
                        width: 100%;
                      }

                      .editor-content th, 
                      .editor-content td {
                        border: 1.5px solid ${editorBorderColor};
                        padding: 12px 14px;
                      }
                      
                      /* Lightbox styling to guarantee that custom templates (study plan, action plan) have a gorgeous light design on any background */
                      .editor-content .study-plan-card,
                      .editor-content .action-plan-card {
                        border: 2px solid ${editorBorderColor} !important;
                        background-color: ${editorCardBgColor} !important;
                        background: ${editorCardBgColor} !important;
                        color: ${editorTextColor} !important;
                        border-radius: 16px !important;
                        padding: 18px !important;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
                      }

                      /* Synthesis Cards and QA Boards use the user-selected theme colors for their backgrounds, borders, and main layout natively! */
                      .editor-content .synthesis-card-wrapper, 
                      .editor-content .qa-board-wrapper {
                        color: ${editorTextColor} !important;
                        border-radius: 20px !important;
                        padding: 20px !important;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03) !important;
                        margin: 18px 0 !important;
                      }

                      .editor-content .three-col-wrapper > div:nth-child(3),
                      .editor-content .four-col-wrapper > div:nth-child(3) {
                        gap: ${selectedTopic?.gridSpacing ?? 12}px !important;
                      }

                      .editor-content .study-plan-card h1,
                      .editor-content .study-plan-card h2,
                      .editor-content .study-plan-card h3,
                      .editor-content .action-plan-card h1,
                      .editor-content .action-plan-card h2,
                      .editor-content .action-plan-card h3 {
                        color: ${editorHeaderColor} !important;
                      }

                      .editor-content .study-plan-card p, 
                      .editor-content .study-plan-card li, 
                      .editor-content .study-plan-card div,
                      .editor-content .action-plan-card p, 
                      .editor-content .action-plan-card li, 
                      .editor-content .action-plan-card div {
                        color: ${editorTextColor} !important;
                      }

                      /* Ensure unstyled spans inside template cards are readable, while preserving custom highlighted/colored texts */
                      .editor-content .study-plan-card span:not([style*="color"]):not([style*="background-color"]),
                      .editor-content .action-plan-card span:not([style*="color"]):not([style*="background-color"]) {
                        color: ${editorTextColor} !important;
                      }

                      /* Strip ALL dark backgrounds from AI generated layout containers */
                      .editor-content [class*="bg-black"],
                      .editor-content [class*="bg-gray-8"],
                      .editor-content [class*="bg-gray-9"],
                      .editor-content [class*="bg-slate-8"],
                      .editor-content [class*="bg-slate-9"],
                      .editor-content [class*="bg-zinc-8"],
                      .editor-content [class*="bg-zinc-9"],
                      .editor-content [class*="bg-stone-8"],
                      .editor-content [class*="bg-stone-9"],
                      .editor-content [class*="bg-[#0"],
                      .editor-content [class*="bg-[#1"],
                      .editor-content [class*="bg-[#2"],
                      .editor-content [class*="bg-[#3]"] {
                        background-color: ${editorCardBgColor} !important;
                        background: ${editorCardBgColor} !important;
                        color: ${editorTextColor} !important;
                        border: 1.5px solid ${editorBorderColor} !important;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
                      }

                      .editor-content [class*="bg-black"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-gray-8"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-gray-9"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-slate-8"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-slate-9"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-zinc-8"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-zinc-9"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-stone-8"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-stone-9"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-[#0"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-[#1"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-[#2"] *:not([style*="color"]):not([style*="background-color"]),
                      .editor-content [class*="bg-[#3"] * {
                        color: ${editorTextColor} !important;
                      }

                      .editor-content a {
                        color: #f97316 !important;
                        text-decoration: underline !important;
                        font-weight: 700 !important;
                      }

                      /* Restore borders for pasted tables! Tailwind removes all borders. */
                      .editor-content table {
                        border-collapse: collapse !important;
                        width: 100%;
                      }
                      .editor-content table,
                      .editor-content th,
                      .editor-content td {
                        border: 1px solid #cbd5e1;
                      }

                      .editor-content ul {
                        list-style-type: disc;
                        padding-left: 20px !important;
                        margin-bottom: 10px !important;
                      }
                      .editor-content ol {
                        list-style-type: decimal;
                        padding-left: 20px !important;
                        margin-bottom: 10px !important;
                      }

                      /* Custom overrides when Plain Light Paper Mode is forced by the user */
                      ${
                        forceLightBg
                          ? `
                        .editor-content {
                          background-color: #fcfdfd !important;
                          background-image: none !important;
                          color: #1e293b !important;
                        }
                        
                        /* Re-enforce highlighted span background and color when in Plain Light Mode */
                        .editor-content [style*="background-color"] {
                          color: inherit !important;
                        }
                        
                        /* Ensure the card themes inside Plain Light look perfect */
                        .editor-content .study-plan-card,
                        .editor-content .action-plan-card,
                        .editor-content .synthesis-card-wrapper,
                        .editor-content .qa-board-wrapper,
                        .editor-content [class*="bg-slate-7"],
                        .editor-content [class*="bg-slate-8"],
                        .editor-content [class*="bg-slate-9"],
                        .editor-content [class*="bg-zinc-7"],
                        .editor-content [class*="bg-zinc-8"],
                        .editor-content [class*="bg-zinc-9"],
                        .editor-content [class*="bg-stone-7"],
                        .editor-content [class*="bg-stone-8"],
                        .editor-content [class*="bg-stone-9"],
                        .editor-content [class*="bg-neutral-7"],
                        .editor-content [class*="bg-neutral-8"],
                        .editor-content [class*="bg-neutral-9"],
                        .editor-content [class*="bg-gray-7"],
                        .editor-content [class*="bg-gray-8"],
                        .editor-content [class*="bg-gray-9"],
                        .editor-content [class*="bg-black"],
                        .editor-content [class*="bg-[#0"],
                        .editor-content [class*="bg-[#1"],
                        .editor-content [class*="bg-[#2"],
                        .editor-content [class*="bg-[#3"] {
                          background-color: #ffffff !important;
                          background: #ffffff !important;
                          border: 1.5px solid #e2e8f0 !important;
                          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
                        }
                      `
                          : ""
                      }
                    `,
                  }}
                />
              );
            })()}

            {/* Relative Wrapper for Editor + Ruler Guides */}
            <div className="relative flex flex-col w-full flex-1 min-h-0">
              {/* Modern Word-style Horizontal Page Ruler */}
              {showRuler && (
                <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-2 mb-3 select-none font-mono text-[9px] text-slate-400 flex flex-col gap-1.5 shadow-inner animate-in fade-in slide-in-from-top-1 duration-200 shrink-0">
                  <div className="relative h-6 flex items-end">
                    {/* 0 to 100% Horizontal Ticks */}
                    <div className="absolute inset-0 flex justify-between px-6">
                      {Array.from({ length: 21 }).map((_, i) => {
                        const percent = i * 5;
                        const isMajor = i % 5 === 0;
                        return (
                          <div
                            key={i}
                            className="flex flex-col items-center flex-1 relative h-full"
                          >
                            <div
                              className={`w-px bg-slate-300 ${isMajor ? "h-3.5 bg-slate-400" : "h-1.5"}`}
                            />
                            {isMajor && (
                              <span className="absolute bottom-0 text-[8px] font-black tracking-tighter text-slate-450">
                                {i === 0 ? "L" : i === 20 ? "R" : `${i * 5}`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Left/Right Safe Page Margin Guidelines sliders like in Google Docs */}
                    <div
                      className="absolute left-[5%] bottom-[2px] w-2.5 h-2.5 bg-orange-500 rounded-b-sm border-t border-orange-300 shadow-sm cursor-help transition-all"
                      title="Left Page Margin Guide (Alignment Rail)"
                    />
                    <div
                      className="absolute right-[5%] bottom-[2px] w-2.5 h-2.5 bg-orange-500 rounded-b-sm border-t border-orange-300 shadow-sm cursor-help transition-all"
                      title="Right Page Margin Guide (Alignment Rail)"
                    />
                  </div>
                  <div className="text-[8px] font-black tracking-widest text-slate-400 uppercase text-center leading-none">
                    Document Grid Guideline Rails Enabled
                  </div>
                </div>
              )}

              {/* Vertical Guideline Rails Overlay indicating page boundaries */}
              {showRuler && (
                <>
                  <div
                    className="absolute top-12 bottom-0 left-[32px] w-px border-l-2 border-dashed border-orange-500/20 pointer-events-none z-10"
                    title="Left Align Guide"
                  />
                  <div
                    className="absolute top-12 bottom-0 right-[32px] w-px border-r-2 border-dashed border-orange-500/20 pointer-events-none z-10"
                    title="Right Align Guide"
                  />
                </>
              )}

              <div
                ref={editorRef}
                contentEditable={true}
                onClick={handleEditorClick}
                onPaste={handleEditorPaste}
                onMouseUp={handleSelection}
                onKeyUp={handleSelection}
                onKeyDown={handleEditorKeyDown}
                onMouseMove={handleEditorMouseMove}
                onMouseDown={handleEditorMouseDown}
                onTouchStart={handleEditorTouchStart}
                onBlur={(e) => {
                  updateTopic(selectedTopic.id, {
                    content: e.currentTarget.innerHTML,
                  });
                }}
                style={{
                  minHeight: "300px",
                  fontSize: `${selectedTopic?.textFontSize || textFontSize}px`,
                  fontFamily: selectedTopic?.textFontFamily || textFontFamily,
                }}
                className={`editor-content editor-scrollbar w-full flex-1 outline-none p-8 rounded-3xl leading-relaxed font-medium transition-all focus:ring-4 focus:ring-orange-500/10 shadow-md ${
                  forceLightBg
                    ? "bg-[#fcfdfd] border border-slate-200 text-slate-800 shadow-2xl"
                    : selectedPaper.className
                }`}
              ></div>
            </div>

            {isTableModalOpen && (
              <div className="fixed inset-0 z-[202] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-[40px] w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in duration-300 overflow-hidden">
                  {/* Pinned Header */}
                  <div className="flex items-center gap-4 p-6 pb-4 border-b border-slate-100 shrink-0">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
                      <Table size={24} strokeWidth={3} />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase italic leading-tight">
                        Table Builder
                      </h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        Design your custom structured grid
                      </p>
                    </div>
                  </div>

                  {/* Scrollable Center Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Header topic (Title)
                      </label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none focus:border-orange-500 transition-all"
                        value={tableConfig.headerTitle}
                        onChange={(e) =>
                          setTableConfig({
                            ...tableConfig,
                            headerTitle: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                          Rows
                        </label>
                        <input
                          type="number"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none focus:border-orange-500"
                          value={tableConfig.rows}
                          onChange={(e) =>
                            setTableConfig({
                              ...tableConfig,
                              rows: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                          Columns
                        </label>
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-900 outline-none focus:border-orange-500"
                          value={tableConfig.cols}
                          onChange={(e) =>
                            setTableConfig({
                              ...tableConfig,
                              cols: parseInt(e.target.value),
                            })
                          }
                        >
                          {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                            <option key={n} value={n}>
                              {n} Columns
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 py-1">
                      <input
                        type="checkbox"
                        id="hasHeader"
                        checked={tableConfig.hasHeader}
                        onChange={(e) =>
                          setTableConfig({
                            ...tableConfig,
                            hasHeader: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <label
                        htmlFor="hasHeader"
                        className="text-sm font-bold text-slate-700 cursor-pointer"
                      >
                        Include Header Row
                      </label>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                        Theme Color
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "#f97316",
                          "#ef4444",
                          "#10b981",
                          "#3b82f6",
                          "#8b5cf6",
                          "#ffffff",
                          "#64748b",
                          "#f43f5e",
                          "#d946ef",
                          "#14b8a6",
                          "#0ea5e9",
                          "#84cc16",
                          "#eab308",
                          "#ec4899",
                        ].map((c) => (
                          <button
                            type="button"
                            key={c}
                            onClick={() =>
                              setTableConfig({ ...tableConfig, theme: c })
                            }
                            className={`w-7 h-7 rounded-full border transition-all ${tableConfig.theme === c ? "border-orange-500 scale-110 shadow-sm ring-2 ring-orange-550/20" : "border-slate-200 hover:scale-105"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                        Table & Grid Lines Visibility/Opacity
                      </label>
                      <div className="flex gap-1.5">
                        {[10, 25, 50, 75, 100].map((percentage) => (
                          <button
                            type="button"
                            key={percentage}
                            onClick={() =>
                              setTableConfig({
                                ...tableConfig,
                                gridOpacity: percentage,
                              })
                            }
                            className={`flex-1 py-2 rounded-xl border font-black text-[10px] uppercase tracking-wider transition-all ${tableConfig.gridOpacity === percentage ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/15" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                          >
                            {percentage}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                        Grid Line Style
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            id: "theme-solid",
                            name: "Whole Color",
                            desc: "Theme colors borders",
                          },
                          {
                            id: "theme-open",
                            name: "Color + Blank",
                            desc: "Borders with open sides",
                          },
                          {
                            id: "black-solid",
                            name: "Always Black",
                            desc: "Clear black borders",
                          },
                          {
                            id: "black-open",
                            name: "Black + Blank",
                            desc: "Black with open sides",
                          },
                        ].map((style) => (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() =>
                              setTableConfig({
                                ...tableConfig,
                                gridStyle: style.id,
                              })
                            }
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              (tableConfig.gridStyle || "theme-solid") ===
                              style.id
                                ? "bg-orange-500/10 border-orange-500 text-slate-800 font-extrabold"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <div className="text-[10px] font-black uppercase tracking-wide">
                              {style.name}
                            </div>
                            <div className="text-[8px] font-bold text-slate-400 mt-0.5 leading-tight">
                              {style.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pinned Footer */}
                  <div className="border-t border-slate-100 p-6 flex gap-3 shrink-0">
                    <button
                      onClick={() => setIsTableModalOpen(false)}
                      className="flex-1 py-3.5 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={insertSmartTable}
                      className="flex-1 py-3.5 bg-orange-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all"
                    >
                      Generate Table
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-6 text-slate-400 p-8 text-center bg-white/5 backdrop-blur-sm rounded-[40px] m-4">
            <div className="w-24 h-24 bg-white/40 backdrop-blur-md rounded-[32px] border border-white/60 flex items-center justify-center animate-pulse shadow-xl shadow-slate-200/50">
              <FileText size={40} className="text-slate-300" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-black uppercase tracking-[3px] text-slate-500">
                Mission Hub Empty
              </p>
              <p className="text-[10px] font-bold text-slate-400 max-w-[240px] leading-relaxed uppercase mx-auto">
                Select a dossier from the local library or initialize a new
                record via the sidebar menu
              </p>
            </div>
            <button
              onClick={onOpenSidebar}
              className="px-8 py-3 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[3px] shadow-2xl shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all md:hidden animate-bounce"
            >
              Open Mission dossier
            </button>
          </div>
        )}
      </div>

      {sharingTopic && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 text-orange-500">
                <Share2 size={24} className="stroke-[2.5]" />
                <h3 className="text-sm font-black tracking-wider uppercase text-slate-800 dark:text-slate-100">
                  Folder Share Hub
                </h3>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {getTopicSizeString(sharingTopic)}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Selected Folder
              </h4>
              <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                {sharingTopic.title}
              </p>
              <p className="text-xs text-slate-400">
                Contains notes, nested sub-folders, styles, and custom table
                configurations.
              </p>
            </div>

            {isTooLargeForCloud(sharingTopic) && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-450 rounded-xl text-xs flex flex-col gap-1">
                <p className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                  ⚡ Smart Compression & Chunking Enabled
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  This folder is{" "}
                  <strong>{getTopicSizeString(sharingTopic)}</strong>. Supabase
                  handles large payloads, so you can share it seamlessly!
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => downloadTopicJson(sharingTopic)}
                className="p-3.5 flex flex-col items-center justify-center gap-2 border border-slate-200 hover:border-orange-500/30 hover:bg-orange-50/10 dark:border-slate-800 dark:hover:border-orange-500/40 rounded-2xl group transition-all text-center"
              >
                <FileDown
                  size={22}
                  className="text-slate-500 group-hover:text-orange-500 group-hover:scale-105 transition-all"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  Download File
                </span>
                <span className="text-[9px] text-slate-400">
                  Best for large size (8MB+)
                </span>
              </button>

              <button
                onClick={() => copyTopicJsonToClipboard(sharingTopic)}
                className="p-3.5 flex flex-col items-center justify-center gap-2 border border-slate-200 hover:border-orange-500/30 hover:bg-orange-50/10 dark:border-slate-800 dark:hover:border-orange-500/40 rounded-2xl group transition-all text-center"
              >
                <Copy
                  size={22}
                  className="text-slate-500 group-hover:text-orange-500 group-hover:scale-105 transition-all"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {isCopiedJson ? "Copied!" : "Copy JSON Data"}
                </span>
                <span className="text-[9px] text-slate-400">
                  Paste & send directly
                </span>
              </button>
            </div>

            <div className="border-t border-slate-150 dark:border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  Option 3: Generates Cloud Link
                </h5>
                {/* Limit removed */}
              </div>

              {cloudShareError && (
                <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-2xl space-y-3 animate-fade-in">
                  <p className="text-[10px] text-orange-800 dark:text-orange-200 font-medium leading-tight">
                    {cloudShareError.includes("dps_shares") ||
                    cloudShareError.includes("table") ? (
                      <>
                        <span className="font-black text-orange-600 block mb-1">
                          DATABASE TABLE MISSING
                        </span>
                        You need to run the SQL setup script in Supabase to
                        enable cloud link generation.
                      </>
                    ) : (
                      cloudShareError
                    )}
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setShowSetupHelper(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-orange-600 transition-all active:scale-95 shadow-sm"
                    >
                      <Database size={10} />
                      Setup Cloud Database Now
                    </button>
                    <button
                      onClick={handleGenerateUniversalLink}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-all active:scale-95"
                    >
                      <Zap size={10} className="text-orange-500" />
                      Fallback: Use Universal Link
                    </button>
                  </div>
                </div>
              )}

              {!generatedShareLink ? (
                <div className="space-y-3">
                  <button
                    onClick={handleGenerateCloudLink}
                    disabled={isCloudShareLoading}
                    className="w-full h-11 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200/50 dark:disabled:bg-slate-800/50 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 animate-fade-in"
                  >
                    {isCloudShareLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Generating Link...
                      </>
                    ) : (
                      <>
                        <Share2 size={14} />
                        Generate Shareable Cloud Link
                      </>
                    )}
                  </button>

                  {isCloudShareLoading && (
                    <div className="flex flex-col items-center gap-1.5 animate-pulse">
                      <p className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">
                        Preparing Cloud Data...
                      </p>
                      <p className="text-[9px] text-slate-400 max-w-[80%] text-center leading-tight">
                        This may take a moment for larger folders as we compress
                        and secure your notes for the cloud.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 font-sans">
                  <input
                    type="text"
                    readOnly
                    value={generatedShareLink}
                    className="flex-1 bg-transparent text-xs text-slate-705 dark:text-slate-300 outline-none select-all truncate pr-2 font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedShareLink);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="h-8 px-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-[10px] uppercase font-black tracking-widest rounded-xl transition-all font-sans"
                  >
                    {isCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}

              {isCopied && (
                <p className="text-[10px] text-green-500 text-center font-bold animate-fade-in mt-2 flex items-center justify-center gap-1">
                  <Check size={12} /> Link copied to clipboard!
                </p>
              )}
            </div>

            <div className="border-t border-slate-150 dark:border-slate-800 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  Option 4: Universal link
                </h5>
              </div>
              <p className="text-[9px] text-slate-400 italic">
                Works instantly without setup. Best for smaller documents.
              </p>
              <button
                onClick={handleGenerateUniversalLink}
                className="w-full h-11 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Zap size={14} className="text-orange-500" />
                Generate Universal Link
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800 font-sans">
              <button
                onClick={() => {
                  setSharingTopic(null);
                  setGeneratedShareLink(null);
                  setCloudShareError(null);
                }}
                className="h-10 px-6 bg-slate-100 dark:bg-slate-805 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] max-w-lg w-full shadow-2xl space-y-4 font-sans">
            <div className="flex items-center gap-3 text-emerald-600 border-b pb-3 border-slate-100 dark:border-slate-800">
              <FileUp size={24} className="stroke-[2.5]" />
              <h3 className="text-sm font-black tracking-wider uppercase text-slate-800 dark:text-slate-100">
                Import Topic Folder
              </h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload an exported topic <code>.json</code> file or paste its JSON
              source code below to import.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans font-black">
                Option 1: Upload JSON File
              </label>
              <div
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".json";
                  input.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt: any) => {
                      const text = evt.target.result;
                      setImportJsonText(text);
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}
                className="border-2 border-dashed border-slate-200 hover:border-orange-500/60 dark:border-slate-800 dark:hover:border-orange-500/40 p-6 rounded-2xl cursor-pointer text-center group transition-all"
              >
                <FileUp
                  size={22}
                  className="mx-auto text-slate-400 group-hover:text-orange-500 group-hover:scale-110 transition-all mb-1"
                />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  Choose Topic File (.json)
                </span>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Click to browse your device
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Option 2: Paste JSON Text
              </label>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='Paste raw JSON starting with {"title": "..."}'
                className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-205 dark:border-slate-805 text-xs font-mono outline-none focus:border-orange-500 transition-all"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 font-sans">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportJsonText("");
                }}
                className="h-10 px-5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleImportJsonOrText(importJsonText)}
                disabled={!importJsonText.trim()}
                className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-emerald-500/10 transition-all font-sans font-black"
              >
                Import Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {false && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-orange-500">
              <Share2 size={24} className="stroke-[2.5]" />
              <h3 className="text-sm font-black tracking-wider uppercase text-slate-800 dark:text-slate-100">
                Topic Share Link Ready
              </h3>
            </div>

            <p className="text-xs text-slate-500">
              Anyone with this link can view and import exactly this study topic
              folder structure (including all nesting notes) to their portal!
            </p>

            <div className="flex items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <input
                type="text"
                readOnly
                value={generatedShareLink}
                className="flex-1 bg-transparent text-xs text-slate-705 dark:text-slate-300 outline-none select-all truncate pr-2 font-mono"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedShareLink);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="h-8 px-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-[10px] uppercase font-black tracking-widest rounded-xl transition-all"
              >
                {isCopied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  const searchParams = new URL(generatedShareLink).searchParams;
                  const shareId = searchParams.get("share");
                  if (!shareId) return;

                  const findNode = (nodes: any[], id: string): any => {
                    for (let node of nodes) {
                      if (node.id === id) return node;
                      if (node.children) {
                        const found = findNode(node.children, id);
                        if (found) return found;
                      }
                    }
                    return null;
                  };

                  const targetTopic = findNode(
                    topics,
                    selectedTopic?.id || sharingTopicId || "",
                  );

                  if (targetTopic) {
                    const blob = new Blob(
                      [JSON.stringify(targetTopic, null, 2)],
                      { type: "application/json" },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${targetTopic.title.replace(/[^a-z0-9]/gi, "_")}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } else {
                    alert("Topic content not found for download.");
                  }
                }}
                className="h-10 px-5 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all"
              >
                <Download size={14} /> Download File (.json)
              </button>
              <button
                onClick={() => {
                  setGeneratedShareLink(null);
                  setSharingTopicId(null);
                }}
                className="h-10 px-5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700/80 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportStyleModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[24px] max-w-4xl w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black tracking-wider uppercase text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Palette size={18} className="text-orange-500" /> Choose
                  Export Style
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure layout, formatting, and design presets for your
                  notes export
                </p>
              </div>
              <button
                onClick={() => setShowExportStyleModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                title="Close"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Side: Style Picker List */}
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                {[
                  {
                    id: "executive",
                    name: "Classic Executive",
                    desc: "Clean business serif, high readability layout with deep blue headers & solid boundaries.",
                    icon: "👔",
                    accentClass: "border-blue-500 bg-blue-50/10",
                  },
                  {
                    id: "handwritten",
                    name: "Cozy Handwritten",
                    desc: "Warm notebook diary feel with cursive scripting (Architects Daughter) on ivory lined-lined paper.",
                    icon: "✍️",
                    accentClass: "border-amber-500 bg-amber-50/10",
                  },
                  {
                    id: "minimalist",
                    name: "Nordic Minimalist",
                    desc: "Sophisticated literary formatting with Georgia serif fonts, elegant white spaces and zero clutter.",
                    icon: "🌿",
                    accentClass: "border-slate-400 bg-slate-50/10",
                  },
                  {
                    id: "academic",
                    name: "Academic Citation",
                    desc: "Standard research format featuring a double-lined header, citation metadata, running page numbers & footers.",
                    icon: "🎓",
                    accentClass: "border-purple-500 bg-purple-50/10",
                  },
                  {
                    id: "retro",
                    name: "Retro Technical",
                    desc: "Phosphor green monospace coding log layout. System stamp headers, dotted dividers and dark diagnostic styling.",
                    icon: "📟",
                    accentClass: "border-emerald-500 bg-emerald-50/10",
                  },
                  {
                    id: "medium_bg",
                    name: "Classic Medium Background",
                    desc: "Classic business layout presented with a professional medium charcoal-slate background blend for balanced focus.",
                    icon: "🔘",
                    accentClass:
                      "border-slate-500 bg-slate-100 dark:bg-slate-800",
                  },
                  {
                    id: "light_bg",
                    name: "Classic Light Background",
                    desc: "Clean corporate layout set against a beautiful warm morning-light gray canvas for soothing contrast.",
                    icon: "☀️",
                    accentClass: "border-blue-400 bg-blue-50/10",
                  },
                  {
                    id: "no_bg",
                    name: "Classic No Background",
                    desc: "Pristine, pure-white blank canvas style offering unmatched laser-print clarity and high-contrast text rendering.",
                    icon: "🏳️",
                    accentClass: "border-slate-300 bg-white dark:bg-slate-900",
                  },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedExportStyle(style.id as any)}
                    className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-start gap-3.5 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 ${
                      selectedExportStyle === style.id
                        ? `${style.accentClass} border-orange-500 ring-2 ring-orange-500/20`
                        : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20"
                    }`}
                  >
                    <span className="text-2xl mt-0.5">{style.icon}</span>
                    <div className="flex-1">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        {style.name}
                        {selectedExportStyle === style.id && (
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {style.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Right Side: Style Live Preview */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-950/40 relative overflow-hidden min-h-[300px]">
                {/* Background watermark decorations */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none select-none flex items-center justify-center font-mono text-[70px] font-black">
                  PREVIEW
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1.5">
                    Layout Preview
                  </div>

                  {/* Render Mock Preview based on selectedExportStyle */}
                  {selectedExportStyle === "executive" && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3 font-sans">
                      <div className="border-b-2 border-blue-500 pb-2">
                        <div className="h-3 w-28 bg-slate-800 dark:bg-slate-100 rounded" />
                        <div className="h-1.5 w-16 bg-slate-400 mt-1.5 rounded" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-slate-300 dark:bg-slate-700 rounded" />
                        <div className="h-2 w-5/6 bg-slate-300 dark:bg-slate-700 rounded" />
                        <div className="h-2 w-4/6 bg-slate-300 dark:bg-slate-700 rounded" />
                      </div>
                      <div className="border border-slate-200 dark:border-slate-800 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/50">
                        <div className="h-1.5 w-1/3 bg-blue-400 rounded mb-1" />
                        <div className="h-1.5 w-2/3 bg-slate-300 dark:bg-slate-700 rounded" />
                      </div>
                    </div>
                  )}

                  {selectedExportStyle === "handwritten" && (
                    <div
                      className="bg-[#fffdf5] border border-[#f5e0c5] p-4 rounded-2xl shadow-sm space-y-3 font-serif relative"
                      style={{
                        backgroundImage:
                          "linear-gradient(#fcd34d 1px, transparent 1px)",
                        backgroundSize: "100% 1.4rem",
                      }}
                    >
                      <div className="border-b border-dashed border-amber-800 pb-1 font-sans text-amber-900">
                        <span className="font-bold text-xs font-serif">
                          📔 Handwritten Note Title
                        </span>
                        <div className="text-[8px] text-amber-700 italic">
                          Scribbled on notebook...
                        </div>
                      </div>
                      <div className="space-y-2 text-amber-950 pt-1 text-[11px] leading-relaxed">
                        <div className="h-1.5 w-11/12 bg-amber-800/20 rounded" />
                        <div className="h-1.5 w-10/12 bg-amber-800/20 rounded" />
                        <div className="h-1.5 w-8/12 bg-amber-800/20 rounded" />
                      </div>
                    </div>
                  )}

                  {selectedExportStyle === "minimalist" && (
                    <div className="bg-[#fafafa] border border-slate-100 p-4 rounded-2xl shadow-sm space-y-3 font-serif">
                      <div className="border-b border-slate-200 pb-2 text-center">
                        <div className="text-[8px] text-slate-400 tracking-widest uppercase">
                          M I N I M A L • S T U D Y
                        </div>
                        <div className="h-4 w-32 bg-slate-800 mx-auto mt-1 rounded-sm" />
                      </div>
                      <div className="space-y-2 text-[10px] leading-relaxed px-2 text-slate-600">
                        <div className="h-2 w-full bg-slate-200 rounded-none ml-auto mr-auto" />
                        <div className="h-2 w-full bg-slate-200 rounded-none" />
                        <div className="h-2 w-11/12 bg-slate-200 rounded-none" />
                      </div>
                    </div>
                  )}

                  {selectedExportStyle === "academic" && (
                    <div className="bg-[#ffffff] border border-slate-300 p-4 rounded-2xl shadow-sm space-y-3 font-serif relative">
                      <div className="border-b-4 border-double border-black pb-1.5 text-center">
                        <div className="text-[7px] font-bold tracking-wider text-black">
                          JOURNAL OF ACADEMIC PORTFOLIOS
                        </div>
                        <div className="h-3 w-40 bg-black mx-auto mt-1 rounded-none" />
                      </div>
                      <div className="space-y-1.5 text-[9px] leading-relaxed text-black px-1">
                        <div className="h-1.5 w-full bg-slate-300 rounded-none text-justify" />
                        <div className="h-1.5 w-full bg-slate-300 rounded-none" />
                        <div className="h-1.5 w-10/12 bg-slate-300 rounded-none" />
                      </div>
                      <div className="border-t border-black pt-1 flex justify-between text-[6px] text-slate-500 font-serif">
                        <span>LEARNING RESEARCH ARCHIVE</span>
                        <span>PAGE 1</span>
                        <span>CONFIDENTIAL COPY</span>
                      </div>
                    </div>
                  )}

                  {selectedExportStyle === "retro" && (
                    <div className="bg-[#030712] border-2 border-emerald-500 p-4 rounded-2xl space-y-2 font-mono text-emerald-400">
                      <div className="border border-dashed border-emerald-500 p-2 bg-[#0e171b] text-[8px]">
                        <div className="flex justify-between tracking-tight text-emerald-600 font-bold mb-1">
                          <span>[SYS.STATUS: LIVE]</span>
                          <span>PORT: 3000</span>
                        </div>
                        <div className="font-bold text-emerald-300">
                          &gt; DOCUMENT RECORD
                        </div>
                      </div>
                      <div className="space-y-1 text-[8px]">
                        <div className="h-1 w-full bg-emerald-800" />
                        <div className="h-1 w-11/12 bg-emerald-800" />
                        <div className="h-1 w-full bg-emerald-800" />
                      </div>
                    </div>
                  )}

                  {selectedExportStyle === "medium_bg" && (
                    <div className="bg-slate-400 border border-slate-500 p-4 rounded-2xl shadow-sm space-y-3 font-sans text-slate-900">
                      <div className="border-b-2 border-slate-800 pb-2 text-center">
                        <div className="h-3 w-32 bg-slate-800 rounded mx-auto" />
                        <div className="h-1.5 w-20 bg-slate-700 mt-1.5 rounded mx-auto" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-slate-800/30 rounded" />
                        <div className="h-2 w-5/6 bg-slate-800/30 rounded" />
                        <div className="h-2 w-4/6 bg-slate-800/30 rounded" />
                      </div>
                      <div className="border border-slate-500 p-2 rounded-lg bg-slate-300">
                        <div className="h-1.5 w-1/3 bg-slate-800 rounded mb-1" />
                        <div className="h-1.5 w-2/3 bg-slate-700 rounded" />
                      </div>
                    </div>
                  )}

                  {selectedExportStyle === "light_bg" && (
                    <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm space-y-3 font-sans">
                      <div className="border-b-2 border-emerald-500 pb-2 text-center">
                        <div className="h-3 w-32 bg-slate-800 dark:bg-slate-100 rounded mx-auto" />
                        <div className="h-1.5 w-20 bg-slate-400 mt-1.5 rounded mx-auto" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-slate-300 dark:bg-slate-600 rounded" />
                        <div className="h-2 w-5/6 bg-slate-300 dark:bg-slate-600 rounded" />
                        <div className="h-2 w-4/6 bg-slate-300 dark:bg-slate-600 rounded" />
                      </div>
                      <div className="border border-slate-200 dark:border-slate-700 p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                        <div className="h-1.5 w-1/3 bg-emerald-500 rounded mb-1" />
                        <div className="h-1.5 w-2/3 bg-slate-400 dark:bg-slate-500 rounded" />
                      </div>
                    </div>
                  )}

                  {selectedExportStyle === "no_bg" && (
                    <div className="bg-white border border-slate-300 p-4 rounded-2xl shadow-sm space-y-3 font-sans text-black">
                      <div className="border-b-2 border-slate-950 pb-2 text-center">
                        <div className="h-3 w-32 bg-black rounded mx-auto" />
                        <div className="h-1.5 w-20 bg-slate-600 mt-1.5 rounded mx-auto" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-slate-200 rounded" />
                        <div className="h-2 w-5/6 bg-slate-200 rounded" />
                        <div className="h-2 w-4/6 bg-slate-200 rounded" />
                      </div>
                      <div className="border border-slate-300 p-2 rounded-lg bg-white">
                        <div className="h-1.5 w-1/3 bg-black rounded mb-1" />
                        <div className="h-1.5 w-2/3 bg-slate-500 rounded" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="my-4 space-y-3.5 p-4 bg-white/70 dark:bg-slate-950/70 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm z-10">
                  <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    ⚙️ PDF Advanced Settings
                  </div>

                  {/* Paper Pattern dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                      Paper Grid Pattern Style
                    </label>
                    <select
                      value={pdfPaperStyle}
                      onChange={(e) => setPdfPaperStyle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
                    >
                      <option value="none">Clean White (No Pattern)</option>
                      <option value="ruled">Classic Ruled Pattern</option>
                      <option value="grid">Math Grid Pattern</option>
                      <option value="dots">Bullet Dot Pattern</option>
                      <option value="stars">Stardust Cosmic Pattern</option>
                      <option value="engineering">
                        Engineering Grid Pattern
                      </option>
                      <option value="isometric">
                        3D Isometric Grid Pattern
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Custom Header Input */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                        Custom Page Header
                      </label>
                      <input
                        type="text"
                        value={pdfCustomHeader}
                        onChange={(e) => setPdfCustomHeader(e.target.value)}
                        placeholder="e.g. DPSSTable Confidential..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>

                    {/* Custom Footer Input */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                        Custom Page Footer
                      </label>
                      <input
                        type="text"
                        value={pdfCustomFooter}
                        onChange={(e) => setPdfCustomFooter(e.target.value)}
                        placeholder="e.g. Proprietary study record..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>

                  {/* Margin setting slider */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                        Page Margin (Inches)
                      </label>
                      <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                        {pdfMargin.toFixed(1)}"
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="2.5"
                      step="0.1"
                      value={pdfMargin}
                      onChange={(e) => setPdfMargin(parseFloat(e.target.value))}
                      className="w-full accent-orange-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] text-slate-400 font-bold px-0.5">
                      <span>0.1"</span>
                      <span>2.5"</span>
                    </div>
                  </div>

                  {/* Keep rows together switch */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                        Keep Rows Together
                      </span>
                      <span className="text-[8px] text-slate-500 dark:text-slate-400 leading-normal">
                        Force page breaks to prevent row clipping
                      </span>
                    </div>
                    <button
                      onClick={() => setKeepRowsTogether(!keepRowsTogether)}
                      className={`h-5 w-10 rounded-full transition-colors relative focus:outline-none cursor-pointer ${keepRowsTogether ? "bg-orange-500" : "bg-slate-200 dark:bg-slate-800"}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${keepRowsTogether ? "translate-x-5" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 z-10 bg-transparent">
                  <button
                    onClick={() => setShowExportStyleModal(false)}
                    className="h-9 px-4 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      exportPDF(selectedExportStyle);
                      setShowExportStyleModal(false);
                    }}
                    className="h-9 px-5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-[10px] uppercase font-black tracking-widest shadow-lg shadow-orange-600/30 active:scale-95 hover:scale-105 transition-all"
                  >
                    Generate Export 🚀
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Supabase Setup Helper Modal */}
      <AnimatePresence>
        {showSetupHelper && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSetupHelper(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-2xl px-4"
            >
              <button
                onClick={() => setShowSetupHelper(false)}
                className="absolute -top-12 right-4 p-2 text-slate-400 hover:text-white transition-colors"
                aria-label="Close setup helper"
              >
                <X size={24} />
              </button>
              <SupabaseSetupHelper />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DPSSTable;
