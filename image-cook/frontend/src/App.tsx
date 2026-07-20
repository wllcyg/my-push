import { useState, useEffect, useRef, useMemo } from 'react';
import { UploadCloud, Copy, Image as ImageIcon, Trash2, LogIn, Loader2, Check, RefreshCw } from 'lucide-react';
import './index.css';

const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:8787' : 'https://api.cheatppf.xyz';

type Toast = { msg: string; type: string };
type ImageItem = { key: string; url: string; size: number; uploaded: string; tags?: string };

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLogged, setIsLogged] = useState(!!token);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 1. 废弃原来的前端内存分页
  // 2. 无限滚动加载逻辑 (真实后端分页)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchImages(false);
        }
      },
      { rootMargin: '300px' }
    );

    const target = loadMoreRef.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMore, loading, loadingMore, cursor]); // 确保状态更新时使用最新的 cursor

  const showToast = (msg: string, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    localStorage.setItem('token', token);
    setIsLogged(true);
    fetchImages(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setIsLogged(false);
    setImages([]);
  };

  const fetchImages = async (reset = true) => {
    if (reset) {
      setLoading(true);
      setCursor(null);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const query = new URLSearchParams({ limit: '30' });
      // 如果不是重置，并且存在 cursor，则带上游标获取下一页
      if (!reset && cursor) {
        query.append('cursor', cursor);
      }

      const res = await fetch(`${API_BASE}/api/images?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleLogout();
        showToast('Token expired or invalid', 'error');
        return;
      }
      const data = await res.json();
      if (data.images) {
        setImages(prev => reset ? data.images : [...prev, ...data.images]);
        setCursor(data.cursor);
        setHasMore(data.hasMore);
      }
    } catch (err) {
      showToast('Failed to fetch images', 'error');
    } finally {
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (isLogged) fetchImages(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogged]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isLogged) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) handleUpload(file);
          break; // 只处理第一张图
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isLogged, token]); // 依赖 token 保证 handleUpload 闭包有效

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }
    
    setUploading(true);
    
    let fileToUpload = file;

    const formData = new FormData();
    formData.append('file', fileToUpload, file.name);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        showToast('Image uploaded successfully!', 'success');
        fetchImages(true); // 上传后重置图库列表
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Network error during upload', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/images/${key}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Image deleted', 'success');
        fetchImages(true); // 删除后重置图库列表
      }
    } catch (err) {
      showToast('Failed to delete image', 'error');
    }
  };

  const copyToClipboard = (text: string, isMarkdown = false) => {
    const content = isMarkdown ? `![image](${text})` : text;
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard!', 'success');
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  if (!isLogged) {
    return (
      <div className="app-container">
        <div className="header">
          <h1>Image Cook</h1>
          <p>Personal Cloudflare R2 Image Hosting</p>
        </div>
        <div className="glass-panel login-container">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <ImageIcon size={48} color="var(--accent)" />
          </div>
          <h2 style={{ marginBottom: '1.5rem' }}>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Secret Token</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Enter your admin token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              <LogIn size={20} /> Login
            </button>
          </form>
        </div>
        {toast && (
          <div className="toast-container">
            <div className="toast">
              {toast.msg}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left' }}>
          <h1>Image Cook</h1>
          <p>Manage your R2 bucket images</p>
        </div>
        <button onClick={handleLogout} className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>
          Logout
        </button>
      </div>

      <div 
        className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading ? (
          <Loader2 size={48} className="loader upload-icon" style={{ margin: '0 auto 1rem' }} />
        ) : (
          <UploadCloud size={48} className="upload-icon" style={{ margin: '0 auto 1rem' }} />
        )}
        <div className="upload-text">Click or drag image here to upload</div>
        <div className="upload-subtext">Supports PNG, JPG, GIF, WebP</div>
      </div>

      <div className="glass-panel">
        <div className="gallery-header">
          <h2>Gallery ({images.length}{hasMore ? '+' : ''})</h2>
          <button onClick={() => fetchImages(true)} className="btn" style={{ background: 'transparent', padding: '0.5rem' }}>
            <RefreshCw size={20} className={loading ? 'loader' : ''} />
          </button>
        </div>

        {loading && images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="loader" style={{ margin: '0 auto 1rem' }} />
            Loading images...
          </div>
        ) : images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No images found in your bucket.
          </div>
        ) : (
          <>
            <div className="gallery-grid">
              {images.map((img) => (
                <div key={img.key} className="image-card">
                  <img src={img.url} alt={img.key} loading="lazy" />
                  <div className="image-overlay">
                    <div className="image-actions">
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(img.url); }} title="Copy URL">
                      <Copy size={16} /> URL
                    </button>
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(img.url, true); }} title="Copy Markdown">
                      <Copy size={16} /> MD
                    </button>
                    <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); handleDelete(img.key); }} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="image-info">{img.key}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    <span>{(img.size / 1024).toFixed(1)} KB</span>
                    <span>{new Date(img.uploaded).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
            </div>
            
            {/* 4. 底部哨兵元素：如果后端还有更多数据，则渲染该哨兵，IntersectionObserver 就能触发下一页加载 */}
            {hasMore && (
              <div ref={loadMoreRef} style={{ height: '30px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0' }}>
                {loadingMore && <Loader2 size={24} className="loader" style={{ color: 'var(--text-muted)' }} />}
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div className="toast-container">
          <div className="toast" style={{ borderColor: toast.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
            {toast.type === 'error' ? <Trash2 size={16} color="var(--danger)" /> : <Check size={16} color="var(--success)" />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
