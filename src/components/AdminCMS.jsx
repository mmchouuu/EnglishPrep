import React, { useState, useEffect } from 'react';
import { 
  Database, 
  PlusCircle, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  Sparkles,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  FileJson,
  Info
} from 'lucide-react';
import { getFullBank, addQuestionToBank, deleteQuestionFromBank, resetToFactorySeed } from '../services/dbService';
import { isCloudConnected } from '../firebase/config';

export const AdminCMS = () => {
  const [bank, setBank] = useState({ listening: [], reading: [], writing: [], speaking: [], tests: [] });
  const [selectedSkill, setSelectedSkill] = useState('listening');
  const [statusMsg, setStatusMsg] = useState('');

  // Form State for New Question
  const [formData, setFormData] = useState({
    part: 1,
    title: '',
    audioUrl: '',
    imageUrl: '',
    question: '',
    optA: '',
    optB: '',
    optC: '',
    optD: '',
    correctAnswer: 0,
    transcript: '',
    explanation: '',
    prompt: '',
    modelAnswers: '',
    keyVocab: '',
    sampleTranscripts: ''
  });

  const [cmsPartFilter, setCmsPartFilter] = useState('all');

  useEffect(() => {
    loadBank();
  }, []);

  const loadBank = async () => {
    const data = await getFullBank();
    setBank(data);
  };

  const handleFormChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!formData.title) {
      alert('Vui lòng nhập tiêu đề câu hỏi!');
      return;
    }

    let itemToAdd = {};
    if (selectedSkill === 'listening') {
      itemToAdd = {
        part: Number(formData.part),
        title: formData.title,
        audioUrl: formData.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        question: formData.question,
        options: [formData.optA, formData.optB, formData.optC, formData.optD].filter(Boolean),
        correctAnswer: Number(formData.correctAnswer),
        transcript: formData.transcript,
        explanation: formData.explanation
      };
    } else if (selectedSkill === 'writing') {
      itemToAdd = {
        part: Number(formData.part),
        title: formData.title,
        prompt: formData.prompt,
        modelAnswers: formData.modelAnswers,
        imageUrl: formData.imageUrl
      };
    } else if (selectedSkill === 'speaking') {
      itemToAdd = {
        part: Number(formData.part),
        title: formData.title,
        questions: [formData.question],
        sampleTranscripts: formData.sampleTranscripts,
        keyVocab: formData.keyVocab,
        imageUrl: formData.imageUrl,
        prepTime: 30,
        speakTime: 45
      };
    } else {
      itemToAdd = {
        part: Number(formData.part),
        title: formData.title,
        textPattern: formData.prompt || formData.question,
        blanks: [
          { id: 1, options: [formData.optA, formData.optB, formData.optC], answer: formData.optA }
        ]
      };
    }

    await addQuestionToBank(selectedSkill, itemToAdd);
    setStatusMsg(`✅ Đã thêm 1 câu hỏi mới vào Database (${selectedSkill.toUpperCase()}) thành công!`);
    loadBank();

    // Reset Form
    setFormData({
      part: 1,
      title: '',
      audioUrl: '',
      imageUrl: '',
      question: '',
      optA: '',
      optB: '',
      optC: '',
      optD: '',
      correctAnswer: 0,
      transcript: '',
      explanation: '',
      prompt: '',
      modelAnswers: '',
      keyVocab: '',
      sampleTranscripts: ''
    });

    setTimeout(() => setStatusMsg(''), 4000);
  };


  const handleDeleteItem = async (skill, id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này khỏi Database?')) {
      await deleteQuestionFromBank(skill, id);
      loadBank();
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bank, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aptis_database_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          localStorage.setItem('APTIS_MASTER_DB_V1', JSON.stringify(parsed));
          loadBank();
          alert('✅ Đã nạp thành công bộ đề thi mới từ file JSON vào Database!');
        } catch (err) {
          alert('❌ File JSON không hợp lệ!');
        }
      };
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      
      {/* Header Admin Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Database className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-white">Quản Trị Ngân Hàng Câu Hỏi & Đề Mới (CMS)</h1>
          </div>
          <p className="text-slate-300 text-xs md:text-sm">
            Bổ sung thêm câu hỏi mới cho Listening, Reading, Writing, Speaking hoặc dán Transcript vào DB mà **không cần đụng tới mã nguồn Web**.
          </p>
        </div>

        {/* Database Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Xuất file JSON sao lưu</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-all">
            <Upload className="w-4 h-4" />
            <span>Nạp Đề Mới từ File JSON</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Main CMS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form Add New Question (7 Cols) */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            <span>Thêm Câu Hỏi / Bài Mới Vào Database</span>
          </h2>

          {/* Skill Selector Tabs */}
          <div className="grid grid-cols-4 gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
            {[
              { id: 'listening', label: 'Nghe', icon: Headphones },
              { id: 'reading', label: 'Đọc', icon: BookOpen },
              { id: 'writing', label: 'Viết', icon: PenTool },
              { id: 'speaking', label: 'Nói', icon: Mic }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedSkill(tab.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedSkill === tab.id 
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Form */}
          <form onSubmit={handleAddQuestion} className="space-y-4">
            
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1">
                <label className="text-xs font-medium text-slate-400">Phần Thi (Part):</label>
                <select
                  value={formData.part}
                  onChange={(e) => handleFormChange('part', e.target.value)}
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                >
                  <option value={1}>Part 1</option>
                  <option value={2}>Part 2</option>
                  <option value={3}>Part 3</option>
                  <option value={4}>Part 4</option>
                </select>
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-400">Tiêu đề bài thi / chủ đề:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Part 1 - Đặt phòng khách sạn"
                  value={formData.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                />
              </div>
            </div>

            {/* Listening Specific Fields */}
            {selectedSkill === 'listening' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Đường dẫn file Audio MP3:</label>
                  <input
                    type="text"
                    placeholder="https://domain.com/audio.mp3"
                    value={formData.audioUrl}
                    onChange={(e) => handleFormChange('audioUrl', e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Nội dung câu hỏi:</label>
                  <input
                    type="text"
                    placeholder="Người nói muốn chuyển máy tới bộ phận nào?"
                    value={formData.question}
                    onChange={(e) => handleFormChange('question', e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Đáp án A"
                    value={formData.optA}
                    onChange={(e) => handleFormChange('optA', e.target.value)}
                    className="p-2.5 rounded-xl glass-input text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Đáp án B"
                    value={formData.optB}
                    onChange={(e) => handleFormChange('optB', e.target.value)}
                    className="p-2.5 rounded-xl glass-input text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Đáp án C"
                    value={formData.optC}
                    onChange={(e) => handleFormChange('optC', e.target.value)}
                    className="p-2.5 rounded-xl glass-input text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Đáp án D"
                    value={formData.optD}
                    onChange={(e) => handleFormChange('optD', e.target.value)}
                    className="p-2.5 rounded-xl glass-input text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Đáp án đúng:</label>
                  <select
                    value={formData.correctAnswer}
                    onChange={(e) => handleFormChange('correctAnswer', e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                  >
                    <option value={0}>Đáp án A</option>
                    <option value={1}>Đáp án B</option>
                    <option value={2}>Đáp án C</option>
                    <option value={3}>Đáp án D</option>
                  </select>
                </div>

                {/* TRANSCRIPT FIELD */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-indigo-300">TRANSCRIPT LỜI THOẠI BĂNG NGHE:</label>
                  <textarea
                    rows={4}
                    placeholder="Dán toàn bộ lời thoại audio tiếng Anh ở đây..."
                    value={formData.transcript}
                    onChange={(e) => handleFormChange('transcript', e.target.value)}
                    className="w-full p-3 rounded-xl glass-input text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Giải thích chi tiết:</label>
                  <input
                    type="text"
                    placeholder="Lý do chọn đáp án này..."
                    value={formData.explanation}
                    onChange={(e) => handleFormChange('explanation', e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                  />
                </div>
              </>
            )}

            {/* Writing / Speaking Prompts */}
            {(selectedSkill === 'writing' || selectedSkill === 'reading') && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Đề bài yêu cầu (Prompt):</label>
                  <textarea
                    rows={3}
                    placeholder="Nhập yêu cầu đề bài..."
                    value={formData.prompt}
                    onChange={(e) => handleFormChange('prompt', e.target.value)}
                    className="w-full p-3 rounded-xl glass-input text-xs text-white"
                  />
                </div>

                {selectedSkill === 'writing' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-indigo-300">Bài mẫu đạt chuẩn (Model Answer):</label>
                    <textarea
                      rows={4}
                      placeholder="Dán bài văn mẫu..."
                      value={formData.modelAnswers}
                      onChange={(e) => handleFormChange('modelAnswers', e.target.value)}
                      className="w-full p-3 rounded-xl glass-input text-xs text-white"
                    />
                  </div>
                )}
              </>
            )}

            {selectedSkill === 'speaking' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Đường dẫn Hình ảnh (URL nếu có):</label>
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={formData.imageUrl}
                    onChange={(e) => handleFormChange('imageUrl', e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Câu hỏi nói:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Describe your hometown."
                    value={formData.question}
                    onChange={(e) => handleFormChange('question', e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-indigo-300">Transcript câu trả lời mẫu:</label>
                  <textarea
                    rows={3}
                    placeholder="Dán câu trả lời mẫu..."
                    value={formData.sampleTranscripts}
                    onChange={(e) => handleFormChange('sampleTranscripts', e.target.value)}
                    className="w-full p-3 rounded-xl glass-input text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Từ vựng ăn điểm (Key Vocab):</label>
                  <input
                    type="text"
                    placeholder="vibrant capital, rich history..."
                    value={formData.keyVocab}
                    onChange={(e) => handleFormChange('keyVocab', e.target.value)}
                    className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>BỔ SUNG VÀO DATABASE</span>
            </button>

          </form>
        </div>

        {/* Existing Question List in DB (5 Cols) */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Danh sách trong DB ({selectedSkill.toUpperCase()}):
            </h3>
            
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Lọc:</span>
              <select
                value={cmsPartFilter}
                onChange={(e) => setCmsPartFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-indigo-300 text-xs rounded-lg px-2 py-1 font-bold"
              >
                <option value="all">Tất cả Part</option>
                <option value={1}>Part 1</option>
                <option value={2}>Part 2</option>
                <option value={3}>Part 3</option>
                <option value={4}>Part 4</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
            {bank[selectedSkill]
              ?.filter(item => cmsPartFilter === 'all' || Number(item.part) === Number(cmsPartFilter))
              ?.map((item, idx) => (
              <div key={item.id} className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                      Part {item.part}
                    </span>
                    <span className="font-semibold text-white">{item.title}</span>
                  </div>
                  {item.transcript && (
                    <p className="text-[10px] text-slate-400 line-clamp-2 italic">
                      Transcript: {item.transcript}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteItem(selectedSkill, item.id)}
                  className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors shrink-0"
                  title="Xóa khỏi Database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>


      </div>

    </div>
  );
};
